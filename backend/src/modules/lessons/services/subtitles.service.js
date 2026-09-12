/**
 * Subtitles Service - Hệ thống Tự động Trích xuất Audio & Sinh Phụ đề Song ngữ bằng Gemini 3.7 Flash
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: FFmpeg Audio Extraction, Multimodal Gemini 3.7 Flash Speech-to-Text & Bilingual Cues
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const db = require('../../../config/database');
const { geminiModel } = require('../../../utils/ai-clients');
const { GEMINI_MODELS } = require('../../../config/ai-model');
const youtubeTranscript = require('../../../utils/youtubeTranscript.util');
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
  constructor() {
    this.activeAutoGenerationJobs = new Set();
    this.autoGenerationQueue = new Map();
    this.autoQueueRunning = false;
    this.generationQueueTail = Promise.resolve();
    this.activeGenerationPromises = new Map();
    this.recoveryTimer = null;
  }

  /**
   * Lấy dữ liệu phụ đề của bài học theo lessonId
   */
  async getSubtitlesByLessonId(lessonId) {
    const queryText = `
      SELECT subtitle_id, lesson_id, en_vtt, vi_vtt, bilingual_vtt, cues, subtitle_status, created_at, updated_at
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
   * Lấy trạng thái xử lý phụ đề (none | pending | processing | ready | failed)
   */
  async getSubtitleStatus(lessonId) {
    const queryText = `
      SELECT subtitle_status, error_code, error_message, updated_at
      FROM lesson_subtitles
      WHERE lesson_id = $1
      LIMIT 1;
    `;
    const { rows } = await db.query(queryText, [lessonId]);
    if (rows.length > 0) {
      const status = rows[0].subtitle_status || 'ready';
      return {
        status,
        code: status === 'failed' ? (rows[0].error_code || null) : null,
        message: status === 'failed' ? (rows[0].error_message || null) : null,
        updatedAt: rows[0].updated_at
      };
    }
    return { status: 'none', code: null, message: null, updatedAt: null };
  }

  /**
   * Đặt trạng thái phụ đề (dùng để track tiến trình xử lý nền)
   */
  async setSubtitleStatus(lessonId, status, sourceContentUrl = null, errorDetails = {}) {
    const errorCode = status === 'failed' ? (errorDetails.code || null) : null;
    const errorMessage = status === 'failed' ? (errorDetails.message || null) : null;
    const queryText = `
      INSERT INTO lesson_subtitles (
        lesson_id, cues, subtitle_status, source_content_url,
        error_code, error_message, updated_at
      )
      VALUES ($1, '[]'::jsonb, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (lesson_id)
      DO UPDATE SET
        subtitle_status = EXCLUDED.subtitle_status,
        source_content_url = COALESCE(EXCLUDED.source_content_url, lesson_subtitles.source_content_url),
        error_code = EXCLUDED.error_code,
        error_message = EXCLUDED.error_message,
        updated_at = CURRENT_TIMESTAMP;
    `;
    await db.query(queryText, [lessonId, status, sourceContentUrl, errorCode, errorMessage]);
  }

  /**
   * Ghi nhận video mới và khởi chạy pipeline nền sau khi transaction gắn
   * media vào lesson đã COMMIT. Việc ghi pending là đồng bộ; phần AI là
   * fire-and-forget nên response lưu course không phải chờ FFmpeg/Gemini.
   */
  async queueAutoGeneration(lessonId) {
    const cleanLessonId = parseInt(lessonId, 10);
    const lessonResult = await db.query(
      `SELECT lesson_id, content_type, content_url, storage_key
       FROM lessons
       WHERE lesson_id = $1`,
      [cleanLessonId]
    );
    const lesson = lessonResult.rows[0];
    const sourceContentUrl = lesson?.storage_key || lesson?.content_url || '';
    if (!lesson || !['video', 'youtube'].includes(lesson.content_type) || !sourceContentUrl) return false;

    await db.query(
      `INSERT INTO lesson_subtitles (
         lesson_id, en_vtt, vi_vtt, bilingual_vtt, cues,
         subtitle_status, source_content_url, error_code, error_message, updated_at
       )
       VALUES ($1, NULL, NULL, NULL, '[]'::jsonb, 'pending', $2, NULL, NULL, CURRENT_TIMESTAMP)
       ON CONFLICT (lesson_id)
       DO UPDATE SET
         en_vtt = NULL,
         vi_vtt = NULL,
         bilingual_vtt = NULL,
         cues = '[]'::jsonb,
         subtitle_status = 'pending',
         source_content_url = EXCLUDED.source_content_url,
         error_code = NULL,
         error_message = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [cleanLessonId, sourceContentUrl]
    );

    this.scheduleAutoGeneration(cleanLessonId, sourceContentUrl);
    return true;
  }

  scheduleAutoGeneration(lessonId, expectedSourceUrl) {
    const jobKey = String(lessonId);
    this.autoGenerationQueue.set(jobKey, { lessonId, expectedSourceUrl });
    this.drainAutoGenerationQueue();
  }

  drainAutoGenerationQueue() {
    if (this.autoQueueRunning) return;
    this.autoQueueRunning = true;

    setImmediate(async () => {
      try {
        while (this.autoGenerationQueue.size > 0) {
          const [jobKey, job] = this.autoGenerationQueue.entries().next().value;
          this.autoGenerationQueue.delete(jobKey);
          if (this.activeAutoGenerationJobs.has(jobKey)) continue;

          this.activeAutoGenerationJobs.add(jobKey);
          try {
            console.log(`[Auto-Subtitle] Bắt đầu xử lý nền cho bài học ${job.lessonId}`);
            await this.generateSubtitlesWithGemini(job.lessonId, {
              expectedSourceUrl: job.expectedSourceUrl
            });
            console.log(`[Auto-Subtitle] Hoàn tất xử lý nền cho bài học ${job.lessonId}`);
          } catch (error) {
            console.warn(`[Auto-Subtitle] Xử lý bài học ${job.lessonId} thất bại: ${error.message}`);
          } finally {
            this.activeAutoGenerationJobs.delete(jobKey);
          }

          // Nếu video bị thay trong lúc job cũ đang chạy, row vẫn là pending
          // và cần được chạy lại với source mới.
          try {
            const pending = await db.query(
              `SELECT ls.source_content_url
               FROM lesson_subtitles ls
               WHERE ls.lesson_id = $1 AND ls.subtitle_status = 'pending'`,
              [job.lessonId]
            );
            if (pending.rows[0]?.source_content_url) {
              this.autoGenerationQueue.set(jobKey, {
                lessonId: job.lessonId,
                expectedSourceUrl: pending.rows[0].source_content_url
              });
            }
          } catch (_) {}
        }
      } finally {
        this.autoQueueRunning = false;
        if (this.autoGenerationQueue.size > 0) this.drainAutoGenerationQueue();
      }
    });
  }

  async resumePendingAutoGeneration() {
    const { rows } = await db.query(
      `SELECT ls.lesson_id, COALESCE(NULLIF(l.storage_key, ''), l.content_url) AS source_content_url
       FROM lesson_subtitles ls
       JOIN lessons l ON l.lesson_id = ls.lesson_id
       WHERE l.content_type IN ('video', 'youtube')
         AND COALESCE(NULLIF(l.storage_key, ''), l.content_url) IS NOT NULL
         AND COALESCE(NULLIF(l.storage_key, ''), l.content_url) <> ''
         AND ls.subtitle_status IN ('pending', 'processing')`
    );

    for (const row of rows) {
      await db.query(
        `UPDATE lesson_subtitles
         SET subtitle_status = 'pending', source_content_url = $2,
             error_code = NULL, error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE lesson_id = $1`,
        [row.lesson_id, row.source_content_url]
      );
      this.scheduleAutoGeneration(row.lesson_id, row.source_content_url);
    }
    return rows.length;
  }

  /**
   * Admin/CLI recovery: bỏ qua thời gian chờ watchdog, đồng bộ source hiện
   * tại rồi đưa ngay một batch pending vào worker tuần tự.
   */
  async recoverPendingNow({ courseId = null, lessonIds = [], limit = 10, includeFailed = false } = {}) {
    const parsedCourseId = courseId === null || courseId === undefined || courseId === ''
      ? null
      : parseInt(courseId, 10);
    if (parsedCourseId !== null && (!Number.isInteger(parsedCourseId) || parsedCourseId <= 0)) {
      const error = new Error('courseId không hợp lệ.');
      error.status = 400;
      error.code = 'INVALID_COURSE_ID';
      throw error;
    }

    const parsedLessonIds = Array.isArray(lessonIds)
      ? [...new Set(lessonIds.map(value => parseInt(value, 10)).filter(value => Number.isInteger(value) && value > 0))]
      : [];
    const batchLimit = Math.min(20, Math.max(1, parseInt(limit, 10) || 10));
    const recoverableStatuses = includeFailed ? ['pending', 'failed'] : ['pending'];
    const params = [];
    const filters = [
      "l.content_type IN ('video', 'youtube')",
      includeFailed
        ? "ls.subtitle_status IN ('pending', 'failed')"
        : "ls.subtitle_status = 'pending'",
      "COALESCE(NULLIF(l.storage_key, ''), l.content_url) IS NOT NULL",
      "COALESCE(NULLIF(l.storage_key, ''), l.content_url) <> ''"
    ];

    if (parsedCourseId !== null) {
      params.push(parsedCourseId);
      filters.push(`c.course_id = $${params.length}`);
    }
    if (parsedLessonIds.length > 0) {
      params.push(parsedLessonIds);
      filters.push(`l.lesson_id = ANY($${params.length}::int[])`);
    }
    const { rows } = await db.query(
      `SELECT c.course_id, c.course_name, l.lesson_id, l.title AS lesson_title,
              ls.subtitle_status AS previous_status,
              ls.source_content_url,
              COALESCE(NULLIF(l.storage_key, ''), l.content_url) AS current_source_url
       FROM lesson_subtitles ls
       JOIN lessons l ON l.lesson_id = ls.lesson_id
       JOIN sections s ON s.section_id = l.section_id
       JOIN courses c ON c.course_id = s.course_id
       WHERE ${filters.join('\n         AND ')}
       ORDER BY
         CASE WHEN ls.source_content_url IS DISTINCT FROM COALESCE(NULLIF(l.storage_key, ''), l.content_url)
              THEN 0 ELSE 1 END,
         ls.updated_at ASC,
         l.lesson_id ASC
       LIMIT 200`,
      params
    );

    const scheduledLessons = [];
    const alreadyActiveLessons = [];
    for (const row of rows) {
      if (scheduledLessons.length >= batchLimit) break;
      const jobKey = String(row.lesson_id);
      if (
        this.activeAutoGenerationJobs.has(jobKey)
        || this.activeGenerationPromises.has(jobKey)
        || this.autoGenerationQueue.has(jobKey)
      ) {
        alreadyActiveLessons.push(row.lesson_id);
        continue;
      }

      const transitioned = await db.query(
        `UPDATE lesson_subtitles
         SET en_vtt = NULL,
             vi_vtt = NULL,
             bilingual_vtt = NULL,
             cues = '[]'::jsonb,
             subtitle_status = 'pending',
             source_content_url = $2,
             error_code = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE lesson_id = $1 AND subtitle_status = ANY($3::text[])
         RETURNING lesson_id`,
        [row.lesson_id, row.current_source_url, recoverableStatuses]
      );
      if (transitioned.rows.length === 0) continue;

      this.scheduleAutoGeneration(row.lesson_id, row.current_source_url);
      scheduledLessons.push({
        courseId: row.course_id,
        courseName: row.course_name,
        lessonId: row.lesson_id,
        lessonTitle: row.lesson_title,
        previousStatus: row.previous_status,
        sourceRepaired: row.source_content_url !== row.current_source_url
      });
    }

    return {
      matched: rows.length,
      scheduled: scheduledLessons.length,
      alreadyActive: alreadyActiveLessons.length,
      batchLimit,
      scheduledLessons,
      alreadyActiveLessonIds: alreadyActiveLessons
    };
  }

  /**
   * Chọn object tốt nhất để bóc transcript. Video DASH giữ manifest để phát,
   * còn pipeline ưu tiên MP4 gốc và tự dùng audio DRM khi MP4 gốc đã bị dọn.
   */
  async resolveStorageMediaForTranscription(rawLesson) {
    const sourceKey = rawLesson?.storage_key || rawLesson?.content_url || '';
    if (!sourceKey || /^https?:\/\//i.test(sourceKey) || sourceKey.startsWith('/uploads/')) {
      return { storageKey: sourceKey, encrypted: false, audioOnly: false };
    }
    if (!sourceKey.toLowerCase().endsWith('.mpd')) {
      return { storageKey: sourceKey, encrypted: false, audioOnly: false };
    }

    const storage = require('../../../utils/supabaseStorage');
    const prefix = path.posix.dirname(sourceKey);
    const candidates = [
      { storageKey: path.posix.join(prefix, 'source.mp4'), encrypted: false, audioOnly: false },
      { storageKey: path.posix.join(prefix, 'audio.mp4'), encrypted: true, audioOnly: true }
    ];
    for (const candidate of candidates) {
      const exists = await storage.checkObjectExists(
        candidate.storageKey,
        rawLesson.storage_bucket || 'videos',
        rawLesson.storage_provider || 'r2'
      );
      if (exists) return candidate;
    }

    const error = new Error(
      'Không tìm thấy MP4 nguồn hoặc audio DRM dự phòng trong kho lưu trữ. Vui lòng tải lại video bài học.'
    );
    error.code = 'TRANSCRIPT_MEDIA_SOURCE_MISSING';
    throw error;
  }

  async waitForAutoGenerationIdle(timeoutMs = 2 * 60 * 60 * 1000) {
    const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 2 * 60 * 60 * 1000);
    while (
      this.autoQueueRunning
      || this.autoGenerationQueue.size > 0
      || this.activeAutoGenerationJobs.size > 0
      || this.activeGenerationPromises.size > 0
    ) {
      if (Date.now() >= deadline) return false;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return true;
  }

  /**
   * Safety net cho job pending bị mất khỏi memory khi worker gặp sự cố nhưng
   * process vẫn còn sống. Chỉ nhặt job pending đã im lặng đủ lâu; job đang
   * processing không bị giành lease giữa chừng.
   */
  async recoverStalledAutoGeneration(staleMs = 15 * 60 * 1000) {
    const { rows } = await db.query(
      `SELECT ls.lesson_id,
              ls.source_content_url,
              COALESCE(NULLIF(l.storage_key, ''), l.content_url) AS current_source_url
       FROM lesson_subtitles ls
       JOIN lessons l ON l.lesson_id = ls.lesson_id
       WHERE l.content_type IN ('video', 'youtube')
         AND ls.subtitle_status = 'pending'
         AND ls.updated_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 millisecond')
         AND COALESCE(NULLIF(l.storage_key, ''), l.content_url) IS NOT NULL
         AND COALESCE(NULLIF(l.storage_key, ''), l.content_url) <> ''`,
      [Math.max(1000, Number(staleMs) || 15 * 60 * 1000)]
    );

    let scheduledCount = 0;
    for (const row of rows) {
      const jobKey = String(row.lesson_id);
      if (
        this.activeAutoGenerationJobs.has(jobKey)
        || this.activeGenerationPromises.has(jobKey)
        || this.autoGenerationQueue.has(jobKey)
      ) continue;

      if (row.source_content_url !== row.current_source_url) {
        await db.query(
          `UPDATE lesson_subtitles
           SET source_content_url = $2,
               error_code = NULL,
               error_message = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE lesson_id = $1 AND subtitle_status = 'pending'`,
          [row.lesson_id, row.current_source_url]
        );
      }
      this.scheduleAutoGeneration(row.lesson_id, row.current_source_url);
      scheduledCount += 1;
    }
    return scheduledCount;
  }

  startAutoGenerationRecoveryWorker({ intervalMs = 5 * 60 * 1000, staleMs = 15 * 60 * 1000 } = {}) {
    if (this.recoveryTimer) return this.recoveryTimer;

    const recover = () => this.recoverStalledAutoGeneration(staleMs).catch((error) => {
      console.warn(`[Auto-Subtitle Recovery] Không thể rà soát job pending: ${error.message}`);
    });

    this.recoveryTimer = setInterval(recover, Math.max(30_000, Number(intervalMs) || 5 * 60 * 1000));
    this.recoveryTimer.unref?.();
    return this.recoveryTimer;
  }

  stopAutoGenerationRecoveryWorker() {
    if (!this.recoveryTimer) return;
    clearInterval(this.recoveryTimer);
    this.recoveryTimer = null;
  }

  /**
   * Lưu hoặc cập nhật phụ đề bài học vào CSDL
   */
  async saveSubtitles(lessonId, { en_vtt, vi_vtt, bilingual_vtt, cues, subtitle_status = 'ready', source_content_url = null }) {
    const parsedCues = typeof cues === 'string' ? cues : JSON.stringify(cues || []);
    const enVtt = en_vtt || buildVttFromCues(cues, 'en');
    const viVtt = vi_vtt || buildVttFromCues(cues, 'vi');
    const bilingualVtt = bilingual_vtt || buildVttFromCues(cues, 'bilingual');

    const queryText = `
      INSERT INTO lesson_subtitles (lesson_id, en_vtt, vi_vtt, bilingual_vtt, cues, subtitle_status, source_content_url, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (lesson_id)
      DO UPDATE SET
        en_vtt = EXCLUDED.en_vtt,
        vi_vtt = EXCLUDED.vi_vtt,
        bilingual_vtt = EXCLUDED.bilingual_vtt,
        cues = EXCLUDED.cues,
        subtitle_status = EXCLUDED.subtitle_status,
        source_content_url = COALESCE(EXCLUDED.source_content_url, lesson_subtitles.source_content_url),
        error_code = NULL,
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const { rows } = await db.query(queryText, [lessonId, enVtt, viVtt, bilingualVtt, parsedCues, subtitle_status, source_content_url]);
    return rows[0];
  }

  async saveGeneratedSubtitles(lessonId, expectedSourceUrl, { en_vtt, vi_vtt, bilingual_vtt, cues }) {
    const parsedCues = typeof cues === 'string' ? cues : JSON.stringify(cues || []);
    const queryText = `
      UPDATE lesson_subtitles
      SET en_vtt = $3,
          vi_vtt = $4,
          bilingual_vtt = $5,
          cues = $6::jsonb,
          subtitle_status = 'ready',
          error_code = NULL,
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE lesson_id = $1 AND source_content_url = $2
      RETURNING *;
    `;
    const { rows } = await db.query(queryText, [
      lessonId,
      expectedSourceUrl,
      en_vtt,
      vi_vtt,
      bilingual_vtt,
      parsedCues
    ]);
    return rows[0] || null;
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

      if (options.decryptionKey) {
        command = command.inputOptions(['-decryption_key', String(options.decryptionKey)]);
      }

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
      path.resolve(__dirname, '../../../../backend/scripts/auto_subtitle_pipeline.py'),
      path.resolve(__dirname, '../../../../scripts/auto_subtitle_pipeline.py'),
      path.resolve(__dirname, '../../../scripts/auto_subtitle_pipeline.py')
    ];
    const pythonScript = candidates.find(c => fs.existsSync(c));
    if (!pythonScript) {
      throw new Error('Không tìm thấy auto_subtitle_pipeline.py tại các đường dẫn đã cấu hình.');
    }

    const minSilence = options.minSilence || 400;
    const silenceThresh = options.silenceThresh || -40;
    const workers = options.workers || Number(process.env.SUBTITLE_VAD_WORKERS) || 1;

    const videoName = path.basename(videoPath, path.extname(videoPath));
    const outputJsonPath = path.join(
      __dirname,
      '../../../../uploads/subtitles',
      `${videoName}_vad_${Date.now()}.json`
    );

    const outputDir = path.dirname(outputJsonPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const args = [
        pythonScript,
        videoPath,
        '--min_silence', String(minSilence),
        '--silence_thresh', String(silenceThresh),
        '--workers', String(workers),
        '--output', outputJsonPath
      ];

      const pyProcess = spawn('python', args, {
        cwd: path.dirname(pythonScript),
        env: { 
          ...process.env, 
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1',
          FFMPEG_PATH: ffmpegInstaller.path
        }
      });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          if (line.includes('[Tiến độ]') || line.includes('✅') || line.includes('🧩')) {
            console.log(`[Python VAD Subtitles]: ${line.trim()}`);
          }
        }
      });

      pyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pyProcess.on('error', (error) => {
        reject(new Error(`Không thể khởi chạy Python VAD pipeline: ${error.message}`));
      });

      pyProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputJsonPath)) {
          try {
            const fileContent = fs.readFileSync(outputJsonPath, 'utf8');
            const parsed = JSON.parse(fileContent);
            if (Array.isArray(parsed.cues)) {
              try { fs.unlinkSync(outputJsonPath); } catch (_) {}
              return resolve(parsed.cues);
            }
          } catch (err) {
            return reject(new Error(`Không đọc được kết quả JSON của VAD pipeline: ${err.message}`));
          }
          reject(new Error('VAD pipeline không trả về trường cues hợp lệ.'));
        } else {
          reject(new Error(`VAD pipeline thoát với mã ${code}: ${stderrData || stdoutData}`));
        }
      });
    });
  }

  /**
   * Lấy thời lượng tổng của video bài học (giây) sử dụng FFmpeg
   */
  async getVideoDuration(videoPath, options = {}) {
    const { spawn } = require('child_process');
    return new Promise((resolve) => {
      const inputArgs = options.decryptionKey
        ? ['-decryption_key', String(options.decryptionKey), '-i', videoPath]
        : ['-i', videoPath];
      const cp = spawn(ffmpegInstaller.path, inputArgs);
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
   * Cố gắng salvage các cue object hoàn chỉnh từ JSON bị truncate
   * Dùng khi Gemini cắt response giữa chừng do token limit
   */
  tryParsePartialJson(rawText) {
    const cues = [];
    // Regex trích từng object cue hoàn chỉnh — dừng khi gặp object dở
    const cueRegex = /\{\s*"id"\s*:\s*(\d+)\s*,\s*"start"\s*:\s*([\d.]+)\s*,\s*"end"\s*:\s*([\d.]+)\s*,\s*"startFormatted"\s*:\s*"([^"]+)"\s*,\s*"endFormatted"\s*:\s*"([^"]+)"\s*,\s*"en"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"vi"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    let match;
    while ((match = cueRegex.exec(rawText)) !== null) {
      try {
        cues.push({
          id: parseInt(match[1], 10),
          start: parseFloat(match[2]),
          end: parseFloat(match[3]),
          startFormatted: match[4],
          endFormatted: match[5],
          en: match[6].replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
          vi: match[7].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        });
      } catch (_) { /* bỏ qua cue lỗi */ }
    }
    return cues;
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
- Bắt buộc ghi nhận mọi âm thanh người nói: Ngay cả khi audio ngắn, câu chào hỏi, câu luyện phát âm hoặc thán từ (ví dụ "Hello", "Mm-hmm", "Yes", "OK"), vẫn phải tạo ít nhất một cue tương ứng, không được trả về mảng cues rỗng nếu có giọng nói trong tệp.
- QUAN TRọNG: Đảm bảo JSON luôn đóng hoàn chỉnh — mảng cues phải kết thúc bằng ] và object gốc bằng }.
`;

    const subtitleModel = GEMINI_MODELS.subtitle;
    console.log(`[Gemini Multimodal Audio] Đang gửi ${Math.round(audioBuffer.length / 1024)} KB audio lên ${subtitleModel}...`);
    const response = await geminiModel.generateContent({
      model: subtitleModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: path.extname(audioFilePath).toLowerCase() === '.wav' ? 'audio/wav' : 'audio/mp3',
                data: base64Audio
              }
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 65536, // Tăng tối đa để tránh JSON bị truncate với audio dài
        responseMimeType: "application/json"
      }
    });

    const responseText = (typeof response?.text === 'function' ? response.text() : response?.text) || response?.response?.text?.() || response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();

    let cues = [];

    // Lớp 1: Parse JSON hoàn chỉnh (happy path)
    try {
      const parsed = JSON.parse(cleanJson);
      cues = parsed.cues || [];
      console.log(`[Gemini Multimodal Audio] ✅ Parse JSON hoàn chỉnh: ${cues.length} cues`);
    } catch (parseErr) {
      // Lớp 2: JSON bị truncate — salvage các cue object hoàn chỉnh bằng regex
      console.warn(`[Gemini Multimodal Audio] ⚠️ JSON parse thất bại (${parseErr.message.substring(0, 80)}). Thử salvage partial JSON...`);
      const partialCues = this.tryParsePartialJson(cleanJson);
      if (partialCues.length > 0) {
        cues = partialCues;
        console.warn(`[Gemini Multimodal Audio] ⚠️ Salvaged ${cues.length} cues từ JSON bị truncate (một số cue cuối có thể bị thiếu).`);
      } else {
        // Lớp 3: Không salvage được gì — throw để pipeline thử lại hoặc báo lỗi
        throw new Error(`Gemini trả về JSON không parse được và không salvage được cue nào. Parse error: ${parseErr.message}`);
      }
    }

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

  createYoutubeTranslationBatches(cues, maxCharacters = 6000, maxCues = 50) {
    const totalCharacters = cues.reduce((sum, cue) => sum + cue.en.length, 0);
    if (cues.length <= 1 || (totalCharacters <= maxCharacters && cues.length <= maxCues)) return [cues];

    const targetCharacters = Math.ceil(totalCharacters / 2);
    let runningCharacters = 0;
    let splitIndex = 1;
    for (let index = 0; index < cues.length - 1; index += 1) {
      runningCharacters += cues[index].en.length;
      if (runningCharacters >= targetCharacters) {
        splitIndex = index + 1;
        break;
      }
    }

    // Trước đây chỉ bisect ĐÚNG 1 LẦN, nên video/transcript rất dài vẫn có thể
    // để lại 1 nửa vượt ngưỡng — khiến Gemini phải dịch 1 batch quá lớn, dễ bị
    // cắt output giữa chừng (JSON hỏng, thiếu/trùng id). Giờ đệ quy chia tiếp
    // cho tới khi mọi batch đều nằm dưới ngưỡng ký tự an toàn.
    const left = cues.slice(0, splitIndex);
    const right = cues.slice(splitIndex);
    return [
      ...this.createYoutubeTranslationBatches(left, maxCharacters, maxCues),
      ...this.createYoutubeTranslationBatches(right, maxCharacters, maxCues)
    ].filter(batch => batch.length > 0);
  }

  createYoutubeTranslationError(message, cause = null) {
    const error = new Error(message);
    error.code = 'YOUTUBE_SUBTITLE_TRANSLATION_INVALID';
    if (cause) error.cause = cause;
    return error;
  }

  parseYoutubeTranslationResponse(responseText, batch) {
    const cleanJson = String(responseText || '')
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (error) {
      throw this.createYoutubeTranslationError(
        `Gemini trả về JSON dịch phụ đề YouTube không hợp lệ: ${error.message}`,
        error
      );
    }

    const translations = Array.isArray(parsed?.translations) ? parsed.translations : [];
    if (translations.length !== batch.length) {
      throw this.createYoutubeTranslationError(
        `Gemini trả về ${translations.length}/${batch.length} bản dịch trong batch.`
      );
    }

    const expectedIds = new Set(batch.map(cue => cue.id));
    const translationById = new Map();
    for (const item of translations) {
      const id = Number(item?.id);
      const vi = String(item?.vi || '').trim();
      if (!Number.isInteger(id) || !expectedIds.has(id) || !vi || translationById.has(id)) {
        throw this.createYoutubeTranslationError(
          'Gemini trả về danh sách dịch phụ đề YouTube bị thiếu, thừa hoặc trùng ID.'
        );
      }
      translationById.set(id, vi);
    }

    return batch.map(cue => {
      const vi = translationById.get(cue.id);
      if (!vi) {
        throw this.createYoutubeTranslationError(`Gemini không trả bản dịch cho cue YouTube id=${cue.id}.`);
      }
      return { ...cue, vi };
    });
  }

  async requestYoutubeTranslationBatch(batch) {
    const translationInput = batch.map(cue => ({ id: cue.id, en: cue.en }));
    const expectedIds = batch.map(cue => cue.id);
    const prompt = `
Bạn là biên dịch viên phụ đề cho nền tảng học tiếng Anh.
Hãy dịch chính xác từng câu tiếng Anh sau sang tiếng Việt tự nhiên, rõ nghĩa và phù hợp ngữ cảnh giảng dạy.

Yêu cầu bắt buộc:
- Chỉ trả về JSON hợp lệ, không markdown và không giải thích.
- Giữ nguyên mỗi id; không bỏ, thêm, gộp hoặc tách câu.
- Chỉ dịch nội dung. Không thay đổi thứ tự.
- Cấu trúc đầu ra: {"translations":[{"id":1,"vi":"Bản dịch tiếng Việt"}]}

Dữ liệu:
${JSON.stringify(translationInput)}
`;

    const response = await geminiModel.generateContent({
      model: GEMINI_MODELS.subtitle,
      purpose: 'subtitle_translation_youtube',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: Math.min(
          8192,
          Math.max(1024, Math.ceil(batch.reduce((sum, cue) => sum + cue.en.length, 0) * 1.5))
        ),
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['translations'],
          properties: {
            translations: {
              type: 'array',
              minItems: batch.length,
              maxItems: batch.length,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'vi'],
                properties: {
                  id: { type: 'integer', enum: expectedIds },
                  vi: { type: 'string', minLength: 1 }
                }
              }
            }
          }
        }
      }
    });

    const responseText = response?.response?.text?.() || response?.text?.() || '';
    return this.parseYoutubeTranslationResponse(responseText, batch);
  }

  async translateSingleYoutubeCueAsText(cue) {
    const response = await geminiModel.generateContent({
      model: GEMINI_MODELS.subtitle,
      purpose: 'subtitle_translation_youtube_recovery',
      contents: [{
        role: 'user',
        parts: [{
          text: `Dịch câu tiếng Anh sau sang tiếng Việt tự nhiên. Chỉ trả về đúng bản dịch, không JSON, không markdown, không giải thích:\n${cue.en}`
        }]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: 'text/plain'
      }
    });

    let vi = String(response?.response?.text?.() || response?.text?.() || '').trim();
    if (vi.startsWith('```') && vi.endsWith('```')) {
      vi = vi.replace(/^```(?:text)?\s*/i, '').replace(/```$/i, '').trim();
    }
    try {
      const parsed = JSON.parse(vi);
      if (typeof parsed === 'string') vi = parsed.trim();
    } catch (_) {}
    if (!vi) {
      throw this.createYoutubeTranslationError(`Gemini không thể dịch cue YouTube id=${cue.id}.`);
    }
    return { ...cue, vi };
  }

  async translateYoutubeBatchResilient(batch) {
    try {
      return await this.requestYoutubeTranslationBatch(batch);
    } catch (error) {
      if (error?.code !== 'YOUTUBE_SUBTITLE_TRANSLATION_INVALID') throw error;

      if (batch.length === 1) {
        console.warn(`[YouTube Subtitles] JSON lỗi ở cue id=${batch[0].id}; chuyển sang recovery dạng text.`);
        return [await this.translateSingleYoutubeCueAsText(batch[0])];
      }

      const midpoint = Math.ceil(batch.length / 2);
      console.warn(
        `[YouTube Subtitles] Batch ${batch[0].id}-${batch[batch.length - 1].id} không hợp lệ; `
        + `tự chia đôi để phục hồi mà không chạy lại các batch đã thành công.`
      );
      const left = await this.translateYoutubeBatchResilient(batch.slice(0, midpoint));
      const right = await this.translateYoutubeBatchResilient(batch.slice(midpoint));
      return [...left, ...right];
    }
  }

  async translateYoutubeTranscriptWithGemini(transcriptSegments) {
    const sourceCues = transcriptSegments.map((segment, index) => {
      const start = Number(segment.start);
      const duration = Number(segment.duration);
      const end = start + Math.max(duration, 0.001);
      return {
        id: index + 1,
        start,
        end,
        startFormatted: formatVttTimestamp(start),
        endFormatted: formatVttTimestamp(end),
        en: segment.text,
        vi: ''
      };
    });

    const translatedCues = [];
    const batches = this.createYoutubeTranslationBatches(sourceCues);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      const translatedBatch = await this.translateYoutubeBatchResilient(batch);
      translatedCues.push(...translatedBatch);
    }

    return translatedCues;
  }

  /**
   * Tải video từ URL (Signed URL Supabase) về file tạm cục bộ để FFmpeg xử lý
   * @param {string} signedUrl - URL tạm của Supabase Storage (có thời hạn)
   * @param {string} lessonId - ID bài học (dùng đặt tên file tạm)
   * @returns {Promise<string>} Đường dẫn file tạm trên disk
   */
  async downloadVideoToTemp(signedUrl, lessonId) {
    const https = require('https');
    const http = require('http');
    const os = require('os');
    const crypto = require('crypto');

    const tempDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();
    const tempFilePath = path.join(tempDir, `subtitle_video_${lessonId}_${uniqueId}.mp4`);

    return new Promise((resolve, reject) => {
      const protocol = signedUrl.startsWith('https://') ? https : http;
      const fileStream = fs.createWriteStream(tempFilePath);

      const request = protocol.get(signedUrl, (response) => {
        if (response.statusCode !== 200) {
          fileStream.close();
          fs.unlink(tempFilePath, () => {});
          const error = new Error(`Tải media từ kho lưu trữ thất bại: HTTP ${response.statusCode}`);
          error.code = response.statusCode === 404
            ? 'TRANSCRIPT_MEDIA_SOURCE_MISSING'
            : 'TRANSCRIPT_MEDIA_DOWNLOAD_FAILED';
          return reject(error);
        }
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(tempFilePath);
        });
      });

      request.on('error', (err) => {
        fileStream.close();
        fs.unlink(tempFilePath, () => {});
        reject(new Error(`Lỗi kết nối tải video tạm: ${err.message}`));
      });

      // Timeout 5 phút cho video lớn
      request.setTimeout(300000, () => {
        request.destroy();
        fileStream.close();
        fs.unlink(tempFilePath, () => {});
        reject(new Error('Tải video từ Supabase bị timeout (>5 phút)'));
      });
    });
  }

  /**
   * Pipeline Tự động: Trích xuất Audio -> Gửi Gemini 3.7 Flash phân tích giọng nói thật -> Sinh Phụ đề Song ngữ
   * Hỗ trợ 3 nguồn video:
   *   - Path C (legacy): /uploads/... — file local còn sót trên disk
   *   - Supabase storage key: courses/xxx/uuid/video.mp4 — tải tạm về qua Signed URL
   *   - Signed HTTPS URL: https://...supabase.co/... — tải tạm trực tiếp
   */
  generateSubtitlesWithGemini(lessonId, options = {}) {
    const jobKey = String(parseInt(lessonId, 10));
    const activeJob = this.activeGenerationPromises.get(jobKey);
    if (activeJob) return activeJob;

    const queuedJob = this.generationQueueTail.then(() => (
      this._generateSubtitlesWithGemini(lessonId, options)
    ));

    // Giữ chuỗi hàng đợi luôn resolve để một job lỗi không chặn các job sau.
    this.generationQueueTail = queuedJob.catch(() => undefined);
    this.activeGenerationPromises.set(jobKey, queuedJob);
    queuedJob.then(
      () => this.activeGenerationPromises.delete(jobKey),
      () => this.activeGenerationPromises.delete(jobKey)
    );
    return queuedJob;
  }

  async _generateSubtitlesWithGemini(lessonId, options = {}) {
    const expectedSourceUrl = options.expectedSourceUrl || null;
    let rawContentUrl = '';
    let videoFilePath = null;
    let tempVideoPath = null; // File tạm cần xóa sau khi xử lý xong
    let mediaDecryptionKey = null;
    let mediaIsEncryptedAudio = false;
    let generatedCues = [];

    try {
      // Query raw content_url từ DB trực tiếp vì pipeline phụ đề cần nguồn storage
      // server-side; URL/khoá nguồn này không được trả về player phía client.
      const rawResult = await db.query(
        `SELECT lesson_id, content_type, content_url, storage_key, storage_bucket, storage_provider
         FROM lessons WHERE lesson_id = $1`,
        [parseInt(lessonId, 10)]
      );
      if (rawResult.rows.length === 0) {
        throw new Error(`Không tìm thấy bài học có ID ${lessonId}`);
      }
      const rawLesson = rawResult.rows[0];

      if (!['video', 'youtube'].includes(rawLesson.content_type)) {
        throw new Error(`Bài học ${lessonId} không phải video/YouTube (content_type = ${rawLesson.content_type})`);
      }

      rawContentUrl = rawLesson.storage_key || rawLesson.content_url || '';
      if (!rawContentUrl) {
        throw new Error(`Bài học ${lessonId} chưa có nguồn video`);
      }

      if (expectedSourceUrl && rawContentUrl !== expectedSourceUrl) {
        // Nguồn media có thể được đổi từ MP4 sang manifest DRM (hoặc được
        // tái tổ chức trong R2) sau lúc job được tạo. Đồng bộ lại lease thay
        // vì trả null và để drain loop nạp mãi source cũ.
        await db.query(
          `UPDATE lesson_subtitles
           SET en_vtt = NULL,
               vi_vtt = NULL,
               bilingual_vtt = NULL,
               cues = '[]'::jsonb,
               subtitle_status = 'pending',
               source_content_url = $3,
               error_code = NULL,
               error_message = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE lesson_id = $1 AND source_content_url = $2`,
          [lessonId, expectedSourceUrl, rawContentUrl]
        );
        return null;
      }

      if (expectedSourceUrl) {
        const claimed = await db.query(
          `UPDATE lesson_subtitles
           SET subtitle_status = 'processing',
               error_code = NULL,
               error_message = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE lesson_id = $1
             AND source_content_url = $2
             AND subtitle_status = 'pending'
           RETURNING lesson_id`,
          [lessonId, expectedSourceUrl]
        );
        if (claimed.rows.length === 0) return null;
      } else {
        await this.setSubtitleStatus(lessonId, 'processing', rawContentUrl);
      }

      // --- Nhận diện nguồn video ---
      const youtubeVideoId = youtubeTranscript.extractYoutubeVideoId(rawContentUrl);
      if (youtubeVideoId) {
        console.log(`[YouTube Subtitles] Bài học ${lessonId}: Đang lấy phụ đề công khai cho video ${youtubeVideoId}...`);
        const transcriptSegments = await youtubeTranscript.fetchYoutubeTranscript(youtubeVideoId);
        generatedCues = await this.translateYoutubeTranscriptWithGemini(transcriptSegments);
        console.log(`[YouTube Subtitles] ✅ Đã lấy và dịch ${generatedCues.length} cue cho bài học ${lessonId}.`);
      } else if (rawContentUrl.startsWith('/uploads/')) {
        // PATH C (legacy): Video cũ còn nằm trên local disk
        let localSourceUrl = rawContentUrl;
        if (rawContentUrl.endsWith('.mpd')) {
          localSourceUrl = rawContentUrl.includes('_drm.mpd')
            ? rawContentUrl.replace(/_drm\.mpd$/i, '.mp4')
            : path.posix.join(path.posix.dirname(rawContentUrl), 'source.mp4');
        }
        const candidatePath = path.join(__dirname, '../../../../', localSourceUrl);
        if (fs.existsSync(candidatePath)) {
          videoFilePath = candidatePath;
          console.log(`[Subtitles] Bài học ${lessonId}: Dùng file local (Path C) tại ${videoFilePath}`);
        } else {
          console.warn(`[Subtitles] Bài học ${lessonId}: /uploads/ path không còn trên disk (đã bị xóa sau deploy). Bỏ qua.`);
        }
      } else if (rawContentUrl && !rawContentUrl.startsWith('http://') && !rawContentUrl.startsWith('https://')) {
        // Private object storage key dạng: courses/123/uuid/video.mp4
        console.log(`[Subtitles] Bài học ${lessonId}: Phát hiện private storage key. Đang tìm nguồn bóc transcript...`);
        const { generateSignedUrl } = require('../../../utils/supabaseStorage');
        const resolvedMedia = await this.resolveStorageMediaForTranscription(rawLesson);
        const sourceStorageKey = resolvedMedia.storageKey;
        mediaIsEncryptedAudio = resolvedMedia.encrypted && resolvedMedia.audioOnly;
        if (resolvedMedia.encrypted) {
          const { generateLessonDrmKeys, getLessonDrmKeyReference } = require('../../../utils/drm.util');
          const keyReference = getLessonDrmKeyReference(rawLesson, lessonId);
          mediaDecryptionKey = generateLessonDrmKeys(keyReference).secretKey;
          console.log(`[Subtitles] Bài học ${lessonId}: MP4 nguồn không còn; dùng audio DRM dự phòng.`);
        }
        const signedUrl = await generateSignedUrl(
          sourceStorageKey,
          rawLesson.storage_bucket || 'videos',
          3600,
          rawLesson.storage_provider || 'r2'
        );
        if (!signedUrl) {
          const error = new Error(`Không thể tạo Signed URL cho media transcript của bài học ${lessonId}.`);
          error.code = 'TRANSCRIPT_MEDIA_URL_UNAVAILABLE';
          throw error;
        }
        console.log(`[Subtitles] Bài học ${lessonId}: Đang tải video tạm về từ object storage (có thể mất vài giây với video lớn)...`);
        tempVideoPath = await this.downloadVideoToTemp(signedUrl, lessonId);
        videoFilePath = tempVideoPath;
        console.log(`[Subtitles] Bài học ${lessonId}: ✅ Đã tải video tạm về ${tempVideoPath} (${Math.round(fs.statSync(tempVideoPath).size / (1024 * 1024))}MB). Bắt đầu pipeline FFmpeg...`);
      } else if (rawContentUrl.startsWith('http://') || rawContentUrl.startsWith('https://')) {
        // Signed URL HTTPS đầy đủ (vd: đã được resolve trước) hoặc URL ngoài
        console.log(`[Subtitles] Bài học ${lessonId}: Phát hiện HTTPS URL. Đang tải video tạm...`);
        tempVideoPath = await this.downloadVideoToTemp(rawContentUrl, lessonId);
        videoFilePath = tempVideoPath;
        console.log(`[Subtitles] Bài học ${lessonId}: ✅ Đã tải video tạm về ${tempVideoPath}. Bắt đầu pipeline FFmpeg...`);
      }

      // Tại điểm này, videoFilePath là đường dẫn local hợp lệ (hoặc null nếu không resolve được)
      if (!youtubeVideoId && (!videoFilePath || !fs.existsSync(videoFilePath))) {
        throw new Error(
          `Không thể truy cập file video cho bài học ${lessonId}. ` +
          `content_url="${rawContentUrl}". ` +
          `Đảm bảo video đã được upload lên Supabase Storage hoặc còn tồn tại trên server.`
        );
      }

      // ƯU TIÊN 1: Chạy Silence Detection VAD Pipeline bằng Python khi được bật.
      const vadEnabled = String(process.env.ENABLE_SUBTITLE_VAD || 'true').toLowerCase() === 'true';
      if (!youtubeVideoId && vadEnabled && !mediaIsEncryptedAudio) {
        console.log(`[Ưu tiên 1 - Silence VAD Pipeline] Khởi chạy bóc băng timestamp chuẩn cho bài học ${lessonId}...`);
        try {
          const vadCues = await this.runSilenceVadPipeline(videoFilePath, {
            workers: Number(process.env.SUBTITLE_VAD_WORKERS) || 1
          });
          if (vadCues && vadCues.length > 0) {
            console.log(`[Ưu tiên 1 - Silence VAD Pipeline] ✅ Thành công bóc băng ${vadCues.length} câu phụ đề khớp khoảng lặng thật!`);
            generatedCues = vadCues;
          } else {
            console.warn(`[Ưu tiên 1 - Silence VAD Pipeline] VAD không phát hiện đoạn thoại, chuyển sang Ưu tiên 2 (Gemini Direct Audio)...`);
          }
        } catch (vadError) {
          console.warn(`[Ưu tiên 1 - Silence VAD Pipeline] Môi trường không hỗ trợ Python VAD (${vadError.message}), tự động fallback sang Ưu tiên 2 (Gemini Direct Audio)...`);
        }
      }

      // ƯU TIÊN 2: Gemini Direct Audio (Chạy khi VAD bị tắt HOẶC khi VAD gặp lỗi môi trường/Python)
      if (!youtubeVideoId && (!generatedCues || generatedCues.length === 0)) {
        console.log(`[Ưu tiên 2 - Gemini Direct Audio] Kích hoạt bóc băng audio cho bài học ${lessonId}...`);
        const os = require('os');
        const tempAudioDir = path.join(os.tmpdir(), 'elearn_temp_audio');
        if (!fs.existsSync(tempAudioDir)) {
          fs.mkdirSync(tempAudioDir, { recursive: true });
        }

        try {
          let totalDuration = 0;
          try {
            totalDuration = await this.getVideoDuration(videoFilePath, {
              decryptionKey: mediaDecryptionKey
            });
          } catch (probeErr) {
            console.warn(`[FFprobe Warning]: Không thể đo thời lượng video (${probeErr.message}), tiến hành trích xuất toàn bộ audio.`);
          }

          console.log(`[FFmpeg Audio Pipeline] Thời lượng video: ${totalDuration > 0 ? `${totalDuration.toFixed(1)}s` : 'Toàn bộ file'}`);

          if (totalDuration <= 600) {
            // Video <= 10 phút: Trích xuất và bóc băng toàn bộ một lần
            const tempAudioPath = path.join(tempAudioDir, `audio_lesson_${lessonId}_${Date.now()}.mp3`);
            try {
              await this.extractAudio(videoFilePath, tempAudioPath, {
                decryptionKey: mediaDecryptionKey
              });
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
              await this.extractAudio(videoFilePath, tempChunkPath, {
                seek,
                duration,
                decryptionKey: mediaDecryptionKey
              });
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

      const generatedPayload = {
        en_vtt: enVtt,
        vi_vtt: viVtt,
        bilingual_vtt: bilingualVtt,
        cues: generatedCues
      };
      const savedResult = expectedSourceUrl
        ? await this.saveGeneratedSubtitles(lessonId, expectedSourceUrl, generatedPayload)
        : await this.saveSubtitles(lessonId, {
            ...generatedPayload,
            subtitle_status: 'ready',
            source_content_url: rawContentUrl
          });

      // Video đã bị thay trong lúc job cũ đang chạy: bỏ kết quả cũ,
      // giữ row pending để scheduler chạy source mới.
      if (!savedResult) return null;

      // PostgreSQL là nguồn dữ liệu phụ đề chính. Lỗi Pinecone/embedding không được
      // đổi một bộ phụ đề đã lưu thành "failed"; RAG có quota và vòng đời retry riêng.
      const { ingestLessonTranscript } = require('./ragIngestion.service');
      try {
        await ingestLessonTranscript(lessonId, generatedCues);
      } catch (ragError) {
        console.warn(
          `[Subtitles RAG] Phụ đề lessonId=${lessonId} đã sẵn sàng nhưng chưa nạp được RAG: ${ragError.message}`
        );
      }

      // Tự động sinh và lưu 4 câu hỏi gợi ý bám sát 100% video cho học viên
      try {
        const { generateAndSaveSuggestedQuestions } = require('./suggestedQuestions.service');
        await generateAndSaveSuggestedQuestions(lessonId, generatedCues);
      } catch (suggestErr) {
        console.warn(
          `[Subtitles AI Questions] ⚠️ Lỗi sinh câu hỏi gợi ý cho lessonId=${lessonId}: ${suggestErr.message}`
        );
      }

      return savedResult;
    } catch (pipelineErr) {
      // Chỉ job của đúng source được phép ghi failed; job cũ không
      // được ghi đè trạng thái pending của video mới.
      try {
        // Trước đây: chỉ lưu lại error_code/error_message khi lỗi khớp
        // đúng mã YOUTUBE_NO_CAPTIONS_AVAILABLE; MỌI lỗi khác (mất mạng,
        // YouTube chặn IP server / rate-limit, lỗi dịch Gemini...) đều bị
        // ghi đè thành null, khiến admin/giảng viên chỉ thấy "Tạo phụ đề
        // thất bại - Vui lòng thử lại sau" mà không có manh mối gì để
        // debug. Giờ luôn lưu lại lý do thật (rút gọn nếu cần) cho mọi
        // loại lỗi, không chỉ riêng 1 trường hợp đã biết trước.
        const errorCode = String(pipelineErr?.code || 'SUBTITLE_PIPELINE_FAILED').slice(0, 80);
        const errorMessage = pipelineErr?.code === 'YOUTUBE_NO_CAPTIONS_AVAILABLE'
          ? youtubeTranscript.YOUTUBE_NO_CAPTIONS_MESSAGE
          : String(pipelineErr?.message || 'Lỗi không xác định trong quá trình tạo phụ đề.').slice(0, 500);
        if (expectedSourceUrl) {
          await db.query(
            `UPDATE lesson_subtitles
             SET subtitle_status = 'failed',
                 error_code = $3,
                 error_message = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE lesson_id = $1 AND source_content_url = $2`,
            [lessonId, expectedSourceUrl, errorCode, errorMessage]
          );
        } else {
          await this.setSubtitleStatus(lessonId, 'failed', rawContentUrl || null, {
            code: errorCode,
            message: errorMessage
          });
        }
      } catch (_) {}
      throw pipelineErr;
    } finally {
      // Dọn dẹp file video tạm nếu đã tải từ Supabase — LUÔN chạy dù thành công hay thất bại
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        try {
          fs.unlinkSync(tempVideoPath);
          console.log(`[Subtitles Cleanup] ✅ Đã xóa file video tạm: ${tempVideoPath}`);
        } catch (cleanupErr) {
          console.warn(`[Subtitles Cleanup] ⚠️ Không thể xóa file video tạm ${tempVideoPath}: ${cleanupErr.message}`);
        }
      }
    }
  }
}

module.exports = new SubtitlesService();
