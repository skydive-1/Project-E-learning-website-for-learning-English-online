/**
 * Subtitles Service - Hệ thống Phụ đề Thông minh & Kịch bản Tương tác Song ngữ (AI Subtitles)
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: Lesson Media Security, Multimodal AI & Video Captions
 */

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
   * Sinh phụ đề thông minh song ngữ bằng Google Gemini 2.5 Flash
   */
  async generateSubtitlesWithGemini(lessonId) {
    const lesson = await lessonsService.getLessonById(lessonId);
    if (!lesson) {
      throw new Error(`Không tìm thấy bài học có ID ${lessonId}`);
    }

    const lessonTitle = lesson.title || 'English Lesson';
    const speakingSentences = lesson.speaking_sentences || '';
    const speakingQuestions = lesson.speaking_questions || '';

    const prompt = `
Bạn là chuyên gia phiên âm và biên dịch phụ đề video học tiếng Anh chuyên nghiệp (Professional Subtitle & Transcription Engine).
Nhiệm vụ của bạn: Tạo danh sách phụ đề video chi tiết (Cues) kèm mốc thời gian (Timestamp) chính xác cho bài học tiếng Anh sau:

Tiêu đề bài học: "${lessonTitle}"
Nội dung/Câu luyện nói chính trong bài:
${speakingSentences ? `Các câu trọng tâm:\n${speakingSentences}` : ''}
${speakingQuestions ? `Câu hỏi tương tác:\n${speakingQuestions}` : ''}

Yêu cầu định dạng đầu ra:
1. Trả về DUY NHẤT một JSON hợp lệ (không chứa markdown \`\`\`json ở đầu/cuối nếu có thể, hoặc bọc đúng chuẩn JSON).
2. JSON phải có cấu trúc như sau:
{
  "cues": [
    {
      "id": 1,
      "start": 0.0,
      "end": 3.5,
      "startFormatted": "00:00:00.000",
      "endFormatted": "00:00:03.500",
      "en": "Welcome to today's English lesson on greetings and introductions.",
      "vi": "Chào mừng các bạn đến với bài học tiếng Anh hôm nay về chủ đề chào hỏi và tự giới thiệu."
    },
    {
      "id": 2,
      "start": 3.8,
      "end": 7.2,
      "startFormatted": "00:00:03.800",
      "endFormatted": "00:00:07.200",
      "en": "First, let's practice how to say hello in formal and informal situations.",
      "vi": "Đầu tiên, chúng ta hãy cùng luyện tập cách chào hỏi trong các tình huống trang trọng và thân mật."
    }
  ]
}

Quy tắc tạo nội dung:
- Phân đoạn lời thoại tự nhiên (khoảng 6 đến 12 câu chất lượng theo tiến trình bài học từ giới thiệu, giải thích ngữ pháp/từ vựng, ví dụ minh họa và tổng kết).
- Mốc thời gian (start, end) tăng dần liên tục, mỗi câu dài từ 2.5 đến 5.0 giây.
- Tiếng Anh: Chuẩn văn phong bản xứ, tự nhiên, rõ ràng.
- Tiếng Việt: Dịch sát nghĩa, dễ hiểu, phù hợp cho người học tiếng Anh.
`;

    console.log(`[Gemini Subtitle Engine] Đang sinh phụ đề song ngữ cho bài học ID ${lessonId} ("${lessonTitle}")...`);
    
    let generatedCues = [];
    try {
      const response = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      });

      const responseText = response?.response?.text() || '';
      const cleanJson = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      generatedCues = parsed.cues || [];
    } catch (aiErr) {
      console.warn(`[Gemini Subtitle Engine Warning]: Lỗi gọi API Gemini (${aiErr.message}), kích hoạt bộ sinh phụ đề dự phòng:`);
      // Fallback Cues nếu API lỗi
      generatedCues = this.createFallbackCues(lessonTitle, speakingSentences);
    }

    if (!generatedCues || generatedCues.length === 0) {
      generatedCues = this.createFallbackCues(lessonTitle, speakingSentences);
    }

    // Đảm bảo định dạng timestamp
    generatedCues = generatedCues.map((c, idx) => ({
      id: c.id || idx + 1,
      start: Number(c.start || idx * 4),
      end: Number(c.end || (idx + 1) * 4),
      startFormatted: c.startFormatted || formatVttTimestamp(Number(c.start || idx * 4)),
      endFormatted: c.endFormatted || formatVttTimestamp(Number(c.end || (idx + 1) * 4)),
      en: c.en || `Lesson practice sentence ${idx + 1}`,
      vi: c.vi || `Câu luyện tập bài học ${idx + 1}`
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

  /**
   * Tạo phụ đề dự phòng chuẩn sư phạm theo tiêu đề bài học
   */
  createFallbackCues(title, sentences) {
    const rawList = sentences ? sentences.split('\n').filter(s => s.trim()) : [];
    const cues = [
      {
        id: 1,
        start: 0.0,
        end: 4.0,
        startFormatted: "00:00:00.000",
        endFormatted: "00:00:04.000",
        en: `Hello everyone! Welcome to ${title}.`,
        vi: `Chào mừng tất cả các bạn đến với bài học ${title}.`
      },
      {
        id: 2,
        start: 4.2,
        end: 8.5,
        startFormatted: "00:00:04.200",
        endFormatted: "00:00:08.500",
        en: "In this lesson, we will focus on essential daily English communication skills.",
        vi: "Trong bài học này, chúng ta sẽ tập trung vào các kỹ năng giao tiếp tiếng Anh thiết yếu hàng ngày."
      }
    ];

    if (rawList.length > 0) {
      rawList.forEach((line, idx) => {
        const start = 9.0 + idx * 4.5;
        const end = start + 4.0;
        cues.push({
          id: cues.length + 1,
          start: start,
          end: end,
          startFormatted: formatVttTimestamp(start),
          endFormatted: formatVttTimestamp(end),
          en: line.trim(),
          vi: `Luyện tập phát âm: ${line.trim()}`
        });
      });
    } else {
      cues.push(
        {
          id: 3,
          start: 9.0,
          end: 13.5,
          startFormatted: "00:00:09.000",
          endFormatted: "00:00:13.500",
          en: "Please listen carefully and repeat after the native speaker.",
          vi: "Hãy lắng nghe thật kỹ và lặp lại theo người bản xứ."
        },
        {
          id: 4,
          start: 14.0,
          end: 18.5,
          startFormatted: "00:00:14.000",
          endFormatted: "00:00:18.500",
          en: "Practice makes perfect. Let's start speaking with confidence!",
          vi: "Luyện tập tạo nên sự hoàn hảo. Hãy bắt đầu nói tiếng Anh một cách tự tin nhé!"
        }
      );
    }

    return cues;
  }
}

module.exports = new SubtitlesService();
