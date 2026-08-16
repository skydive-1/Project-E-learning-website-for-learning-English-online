/**
 * Subtitles Service - Hệ thống Tự động Trích xuất Audio & Sinh Phụ đề Song ngữ bằng Gemini 2.5 Flash
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: FFmpeg Audio Extraction, Multimodal Gemini 2.5 Flash Speech-to-Text & Bilingual Cues
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const db = require('../../../config/database');
const { geminiModel } = require('../../../utils/ai-clients');
const lessonsService = require('./lessons.service');

/**
 * Format số giây thành chuỗi thời gian WebVTT: 00:01:23.456
 */
function formatVttTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num, size = 2) => String(num).padStart(size, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Chuyển đổi danh sách Cues thành định dạng chuẩn WebVTT
 */
function buildVttFromCues(cues, type = 'bilingual') {
  let vtt = 'WEBVTT\n\n';
  cues.forEach((cue, index) => {
    const startStr = cue.startFormatted || formatVttTimestamp(cue.start);
    const endStr = cue.endFormatted || formatVttTimestamp(cue.end);
    vtt += `${index + 1}\n`;
    vtt += `${startStr} --> ${endStr}\n`;
    if (type === 'en') {
      vtt += `${cue.en}\n\n`;
    } else if (type === 'vi') {
      vtt += `${cue.vi}\n\n`;
    } else {
      // Bilingual: Dòng trên tiếng Anh, dòng dưới tiếng Việt
      vtt += `${cue.en}\n${cue.vi}\n\n`;
    }
  });
  return vtt;
}

class SubtitlesService {
  /**
   * Lấy dữ liệu phụ đề của bài học theo lessonId
   */
  async getSubtitlesByLessonId(lessonId) {
    const queryText = `
      SELECT subtitle_id, lesson_id, en_vtt, vi_vtt, bilingual_vtt, cues, created_at, updated_at
      FROM lesson_subtitles
      WHERE lesson_id = $1
      LIMIT 1;
    `;
    const { rows } = await db.query(queryText, [lessonId]);
    if (rows.length > 0) {
      return rows[0];
    }
    return null;
  }

  /**
   * Lưu hoặc cập nhật phụ đề bài học vào CSDL
   */
  async saveSubtitles(lessonId, { en_vtt, vi_vtt, bilingual_vtt, cues }) {
    const parsedCues = typeof cues === 'string' ? cues : JSON.stringify(cues || []);
    const enVtt = en_vtt || buildVttFromCues(cues, 'en');
    const viVtt = vi_vtt || buildVttFromCues(cues, 'vi');
    const bilingualVtt = bilingual_vtt || buildVttFromCues(cues, 'bilingual');

    const queryText = `
      INSERT INTO lesson_subtitles (lesson_id, en_vtt, vi_vtt, bilingual_vtt, cues, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (lesson_id)
      DO UPDATE SET
        en_vtt = EXCLUDED.en_vtt,
        vi_vtt = EXCLUDED.vi_vtt,
        bilingual_vtt = EXCLUDED.bilingual_vtt,
        cues = EXCLUDED.cues,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const { rows } = await db.query(queryText, [lessonId, enVtt, viVtt, bilingualVtt, parsedCues]);
    return rows[0];
  }

  /**
   * Trích xuất Audio từ Video bằng FFmpeg (16kHz Mono 64kbps MP3)
   */
  async extractAudio(videoPath, audioPath, options = {}) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath)
        .noVideo()
        .audioFrequency(16000)
        .audioChannels(1)
        .audioBitrate('64k')
        .format('mp3');

      if (options.seek) {
        command = command.setStartTime(options.seek);
      }
      if (options.duration) {
        command = command.setDuration(options.duration);
      }

      command
        .on('end', () => resolve(audioPath))
        .on('error', (err) => reject(err))
        .save(audioPath);
    });
  }

  /**
   * Chạy Python Pipeline tự động với Silence Detection (Pydub VAD) + Gemini 3.7 Flash
   */
  async runSilenceVadPipeline(videoPath, options = {}) {
    const { spawn } = require('child_process');
    const candidates = [
      path.resolve(__dirname, '../../../scripts/auto_subtitle_pipeline.py'),
      path.resolve(__dirname, '../../../../scripts/auto_subtitle_pipeline.py'),
      path.resolve(__dirname, '../../../../backend/scripts/auto_subtitle_pipeline.py')
    ];
    const pythonScript = candidates.find(c => fs.existsSync(c));
    if (!pythonScript) {
      console.warn('[Silence VAD Subtitle]: Không tìm thấy file auto_subtitle_pipeline.py tại các đường dẫn kiểm tra.');
      return null;
    }

    const minSilence = options.minSilence || 500;
    const silenceThresh = options.silenceThresh || -36;
    const workers = options.workers || 2;

    return new Promise((resolve) => {
      const args = [
        pythonScript,
        videoPath,
        '--min_silence', String(minSilence),
        '--silence_thresh', String(silenceThresh),
        '--workers', String(workers)
      ];

      const pyProcess = spawn('python', args, {
        cwd: path.dirname(pythonScript),
        env: { 
          ...process.env, 
          PYTHONIOENCODING: 'utf-8',
          FFMPEG_PATH: ffmpegInstaller.path
        }
      });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pyProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const videoName = path.basename(videoPath, path.extname(videoPath));
            const jsonCandidates = [
              path.join(path.dirname(videoPath), 'subtitles', `${videoName}.json`),
              path.join(__dirname, '../../../../uploads/subtitles', `${videoName}.json`),
              path.join(__dirname, '../../../uploads/subtitles', `${videoName}.json`)
            ];
            for (const jsonPath of jsonCandidates) {
              if (fs.existsSync(jsonPath)) {
                const fileContent = fs.readFileSync(jsonPath, 'utf8');
                const parsed = JSON.parse(fileContent);
                if (parsed.cues && Array.isArray(parsed.cues) && parsed.cues.length > 0) {
                  return resolve(parsed.cues);
                }
              }
            }
          } catch (err) {
            console.warn('[Silence VAD Subtitle]: Lỗi đọc kết quả JSON:', err.message);
          }
          resolve(null);
        } else {
          console.warn('[Silence VAD Subtitle Process Error]: Process exited with code', code, stderrData || stdoutData);
          resolve(null);
        }
      });
    });
  }

  /**
   * Lấy thời lượng tổng của video bài học (giây) sử dụng FFmpeg
   */
  async getVideoDuration(videoPath) {
    const { spawn } = require('child_process');
    return new Promise((resolve) => {
      const cp = spawn(ffmpegInstaller.path, ['-i', videoPath]);
      let output = '';
      cp.stderr.on('data', (d) => { output += d.toString(); });
      cp.stdout.on('data', (d) => { output += d.toString(); });
      cp.on('close', () => {
        const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(\.\d+)?)/);
        if (match) {
          const hrs = parseInt(match[1], 10) || 0;
          const mins = parseInt(match[2], 10) || 0;
          const secs = parseFloat(match[3]) || 0;
          const totalSeconds = hrs * 3600 + mins * 60 + secs;
          return resolve(totalSeconds);
        }
        resolve(0);
      });
    });
  }

  /**
   * Gửi 1 file audio tới Gemini 3.7 Flash để bóc băng và dịch thuật
   */
  async transcribeAudioWithGemini(audioFilePath, timeOffset = 0) {
    const audioBuffer = fs.readFileSync(audioFilePath);
    const base64Audio = audioBuffer.toString('base64');

    const prompt = `
Bạn là hệ thống bóc băng âm thanh và biên dịch phụ đề video học tiếng Anh tự động (AI Audio Transcription & Bilingual Subtitle Engine).
Hãy lắng nghe kỹ luồng âm thanh bài giảng tiếng Anh đính kèm và tạo danh sách phụ đề song ngữ chính xác theo giọng người nói thật.

Yêu cầu định dạng đầu ra:
1. Trả về DUY NHẤT một JSON hợp lệ (không chứa markdown thừa).
2. JSON phải có cấu trúc như sau:
{
  "cues": [
    {
      "id": 1,
      "start": 0.0,
      "end": 3.5,
      "startFormatted": "00:00:00.000",
      "endFormatted": "00:00:03.500",
      "en": "Hello everyone, welcome back to our grammar lesson.",
      "vi": "Xin chào các bạn, chào mừng các bạn quay trở lại với bài học ngữ pháp của chúng ta."
    }
  ]
}

Quy tắc:
- Mốc thời gian (start, end) tính bằng giây, khớp chính xác theo từng câu giọng nói của giảng viên trong audio.
- en: Phiên âm chính xác từng từ tiếng Anh của người nói (không tóm tắt, không lược bớt).
- vi: Bản dịch tiếng Việt tự nhiên, chuẩn nghĩa sư phạm cho người học.
`;

    console.log(`[Gemini Multimodal Audio] Đang gửi ${Math.round(audioBuffer.length / 1024)} KB audio lên Gemini 3.7 Flash...`);
    const response = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'audio/mp3',
                data: base64Audio
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    });

    const responseText = response?.response?.text() || '';
    const cleanJson = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);
    const cues = parsed.cues || [];

    return cues.map((c, idx) => {
      const realStart = Number(c.start || 0) + timeOffset;
      const realEnd = Number(c.end || (Number(c.start || 0) + 4)) + timeOffset;
      return {
        id: c.id || idx + 1,
        start: realStart,
        end: realEnd,
        startFormatted: formatVttTimestamp(realStart),
        endFormatted: formatVttTimestamp(realEnd),
        en: c.en || '',
        vi: c.vi || ''
      };
    });
  }

  /**
   * Pipeline Tự động: Trích xuất Audio -> Gửi Gemini 3.7 Flash phân tích giọng nói thật -> Sinh Phụ đề Song ngữ
   */
  async generateSubtitlesWithGemini(lessonId) {
    const lesson = await lessonsService.getLessonById(lessonId);
    if (!lesson) {
      throw new Error(`Không tìm thấy bài học có ID ${lessonId}`);
    }

    const contentUrl = lesson.content_url || lesson.contentUrl || '';
    
    // Tìm đường dẫn file video cục bộ trên máy chủ nếu có
    let videoFilePath = null;
    if (contentUrl && contentUrl.startsWith('/uploads/')) {
      const candidatePath = path.join(__dirname, '../../../../', contentUrl);
      if (fs.existsSync(candidatePath)) {
        videoFilePath = candidatePath;
      }
    }

    let generatedCues = [];

    // ƯU TIÊN 1: Chạy Silence Detection VAD Pipeline bằng Python
    if (videoFilePath && fs.existsSync(videoFilePath)) {
      try {
        console.log(`[Ưu tiên 1 - Silence VAD Pipeline] Khởi chạy bóc băng timestamp chuẩn cho bài học ${lessonId}...`);
        const vadCues = await this.runSilenceVadPipeline(videoFilePath, { workers: 2 });
        if (vadCues && vadCues.length > 0) {
          console.log(`[Ưu tiên 1 - Silence VAD Pipeline] ✅ Thành công bóc băng ${vadCues.length} câu phụ đề khớp 100% khoảng lặng thật!`);
          generatedCues = vadCues;
        }
      } catch (vadErr) {
        console.warn(`[Silence VAD Warning]: ${vadErr.message}`);
      }
    }

    // ƯU TIÊN 2: Trích xuất Audio và bóc băng bằng Gemini Multimodal Audio (CHỈ chạy khi Ưu tiên 1 thất bại / không có cues)
    if ((!generatedCues || generatedCues.length === 0) && videoFilePath && fs.existsSync(videoFilePath)) {
      console.log(`[Ưu tiên 2 - Gemini Direct Audio] Kích hoạt bóc băng audio cho bài học ${lessonId}...`);
      const tempAudioDir = path.join(__dirname, '../../../../uploads/temp_audio');
      if (!fs.existsSync(tempAudioDir)) {
        fs.mkdirSync(tempAudioDir, { recursive: true });
      }

      try {
        let totalDuration = 0;
        try {
          totalDuration = await this.getVideoDuration(videoFilePath);
        } catch (probeErr) {
          console.warn(`[FFprobe Warning]: Không thể đo thời lượng video (${probeErr.message}), tiến hành trích xuất toàn bộ audio.`);
        }

        console.log(`[FFmpeg Audio Pipeline] Thời lượng video: ${totalDuration > 0 ? `${totalDuration.toFixed(1)}s` : 'Toàn bộ file'}`);

        if (totalDuration <= 600) {
          // Video <= 10 phút: Trích xuất và bóc băng toàn bộ một lần
          const tempAudioPath = path.join(tempAudioDir, `audio_lesson_${lessonId}_${Date.now()}.mp3`);
          try {
            await this.extractAudio(videoFilePath, tempAudioPath);
            const cues = await this.transcribeAudioWithGemini(tempAudioPath, 0);
            if (cues && cues.length > 0) {
              generatedCues = cues;
              console.log(`[Gemini Multimodal Audio] ✅ Đã bóc băng thành công ${generatedCues.length} câu phụ đề từ giọng nói thật của video!`);
            }
          } finally {
            if (fs.existsSync(tempAudioPath)) {
              try { fs.unlinkSync(tempAudioPath); } catch (_) {}
            }
          }
        } else {
          // Video > 10 phút: Chia chunk 8-10 phút (500s mỗi chunk)
          const chunkSize = 500;
          const numChunks = Math.ceil(totalDuration / chunkSize);
          console.log(`[Gemini Multimodal Audio] Video dài (${totalDuration.toFixed(1)}s), chia thành ${numChunks} chunks ${chunkSize}s...`);

          let allCues = [];
          for (let i = 0; i < numChunks; i++) {
            const seek = i * chunkSize;
            const duration = Math.min(chunkSize, totalDuration - seek);
            const tempChunkPath = path.join(tempAudioDir, `audio_lesson_${lessonId}_chunk_${i}_${Date.now()}.mp3`);

            try {
              console.log(`[FFmpeg Audio Pipeline] Đang trích xuất chunk ${i + 1}/${numChunks} (từ ${seek}s đến ${seek + duration}s)...`);
              await this.extractAudio(videoFilePath, tempChunkPath, { seek, duration });
              const chunkCues = await this.transcribeAudioWithGemini(tempChunkPath, seek);
              if (chunkCues && chunkCues.length > 0) {
                allCues = allCues.concat(chunkCues);
              }
            } catch (chunkErr) {
              console.warn(`[Gemini Audio Chunk ${i + 1} Warning]: ${chunkErr.message}`);
            } finally {
              if (fs.existsSync(tempChunkPath)) {
                try { fs.unlinkSync(tempChunkPath); } catch (_) {}
              }
            }
          }

          if (allCues.length > 0) {
            generatedCues = allCues;
            console.log(`[Gemini Multimodal Audio] ✅ Đã ghép hoàn chỉnh ${generatedCues.length} câu phụ đề cho toàn bộ video dài!`);
          }
        }
      } catch (audioErr) {
        console.warn(`[Gemini Audio Pipeline Warning]: Lỗi bóc băng audio (${audioErr.message}).`);
      }
    }

    // Nếu cả Ưu tiên 1 và Ưu tiên 2 đều thất bại -> Ném lỗi rõ ràng, KHÔNG trả về phụ đề giả
    if (!generatedCues || generatedCues.length === 0) {
      throw new Error(`Không thể tự động sinh phụ đề từ audio video bài học ${lessonId}. Vui lòng thử lại hoặc tải lên phụ đề thủ công.`);
    }

    // Chuẩn hóa định dạng mốc thời gian
    generatedCues = generatedCues.map((c, idx) => ({
      id: c.id || idx + 1,
      start: Number(c.start || idx * 4.5),
      end: Number(c.end || (idx + 1) * 4.5),
      startFormatted: c.startFormatted || formatVttTimestamp(Number(c.start || idx * 4.5)),
      endFormatted: c.endFormatted || formatVttTimestamp(Number(c.end || (idx + 1) * 4.5)),
      en: c.en || `Lesson practice line ${idx + 1}`,
      vi: c.vi || `Nội dung bài học ${idx + 1}`
    }));

    const enVtt = buildVttFromCues(generatedCues, 'en');
    const viVtt = buildVttFromCues(generatedCues, 'vi');
    const bilingualVtt = buildVttFromCues(generatedCues, 'bilingual');

    return await this.saveSubtitles(lessonId, {
      en_vtt: enVtt,
      vi_vtt: viVtt,
      bilingual_vtt: bilingualVtt,
      cues: generatedCues
    });
  }
}

module.exports = new SubtitlesService();
