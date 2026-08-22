/**
 * Lesson RAG Auto-Ingestion Service
 * Tự động nạp nội dung bài học vào Pinecone RAG & PostgreSQL khi giảng viên gán video/PDF,
 * KHÔNG phụ thuộc vào việc người dùng bấm "Tạo Phụ Đề AI".
 *
 * Pipeline 2 Phase:
 *   Phase 1 (~50ms): Nạp metadata bài học (title, mô tả, tên khóa học) ngay lập tức vào Pinecone
 *   Phase 2 (async background): Gọi Subtitles & Audio Pipeline (VAD / Gemini) để trích xuất audio,
 *                              lưu phụ đề song ngữ vào PostgreSQL và nạp vector transcript vào Pinecone.
 *
 * Phụ trách:
 *   NGUYỄN THANH LIÊM (Backend & Security Developer)
 *   LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

'use strict';

const db = require('../../../config/database');
const { ingestLessonTranscript } = require('./ragIngestion.service');

// ─── Phase 1: Ingest Metadata (~50ms) ─────────────────────────────────────────

async function ingestLessonMetadata(lessonId) {
  try {
    const res = await db.query(`
      SELECT l.lesson_id, l.title, s.title AS section_title, c.course_name, c.description AS course_description
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses  c ON s.course_id  = c.course_id
      WHERE l.lesson_id = $1
    `, [Number(lessonId)]);

    if (res.rows.length === 0) return;
    const row = res.rows[0];

    const metaText = [
      `Bài học: ${row.title}`,
      `Chương: ${row.section_title}`,
      `Khóa học: ${row.course_name}`,
      row.course_description ? `Mô tả khóa học: ${row.course_description}` : null
    ].filter(Boolean).join('\n');

    await ingestLessonTranscript(lessonId, metaText, { source: 'lesson-metadata' });
    console.log(`[LessonRAG] ✅ Phase 1 metadata đã nạp thành công cho lessonId=${lessonId} ("${row.title}")`);
  } catch (err) {
    console.warn(`[LessonRAG] ⚠️ Phase 1 metadata thất bại lessonId=${lessonId}:`, err.message);
  }
}

// ─── Phase 2: Video Transcript & Subtitles (Background Async) ────────────────

async function ingestVideoTranscript(lessonId) {
  try {
    console.log(`[LessonRAG] Phase 2 bắt đầu: bóc băng & nạp RAG cho lessonId=${lessonId}...`);
    const subtitlesService = require('./subtitles.service');
    const result = await subtitlesService.generateSubtitlesWithGemini(lessonId);
    console.log(`[LessonRAG] ✅ Phase 2 hoàn tất cho lessonId=${lessonId}: Đã lưu PostgreSQL + Pinecone!`);
    return result;
  } catch (err) {
    console.error(`[LessonRAG] ❌ Phase 2 thất bại cho lessonId=${lessonId}:`, err.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Trigger auto-RAG ingestion cho bài học. LUÔN non-blocking.
 * @param {number|string} lessonId
 * @param {string|null} rawStorageKey - Storage key hoặc URL video (hoặc null nếu chỉ có metadata)
 * @param {string} [triggerReason] - Lý do trigger ('video-assigned', 'lesson-created', 'backfill')
 */
async function triggerLessonRagIngestion(lessonId, rawStorageKey, triggerReason = 'unknown') {
  try {
    console.log(`[LessonRAG] 🚀 Trigger auto-RAG (lý do: ${triggerReason}) lessonId=${lessonId}`);

    // Phase 1: Metadata nạp tức thì
    await ingestLessonMetadata(lessonId);

    // Phase 2: Video transcript chạy nền không chặn luồng chính
    if (rawStorageKey && typeof rawStorageKey === 'string') {
      ingestVideoTranscript(lessonId).catch((err) => {
        console.error(`[LessonRAG] ❌ Background Phase 2 lỗi lessonId=${lessonId}:`, err.message);
      });
      console.log(`[LessonRAG] 📤 Phase 2 đã được khởi động ở background cho lessonId=${lessonId}`);
    } else if (!rawStorageKey) {
      console.log(`[LessonRAG] ℹ️ Không có video -> Chỉ nạp metadata cho lessonId=${lessonId}`);
    }
  } catch (err) {
    console.error(`[LessonRAG] ❌ triggerLessonRagIngestion lỗi lessonId=${lessonId}:`, err.message);
  }
}

module.exports = { triggerLessonRagIngestion, ingestLessonMetadata, ingestVideoTranscript };

