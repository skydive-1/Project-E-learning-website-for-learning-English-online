/**
 * Backfill Script: Nạp metadata cho mọi bài học và transcript thật vào Pinecone khi có phụ đề
 * Usage: node scripts/backfillRagIngestion.js (chạy từ thư mục backend)
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config();
const db = require('../src/config/database');
const { ingestLessonTranscript } = require('../src/modules/lessons/services/ragIngestion.service');
const { ingestLessonMetadata } = require('../src/modules/lessons/services/lessonRagIngestion.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBackfill() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU BACKFILL RAG INGESTION CHO TOÀN BỘ BÀI HỌC");
  console.log("==========================================================================");

  try {
    // 1. Kiểm tra kết nối CSDL
    const isDbOk = await db.testConnection();
    if (!isDbOk) {
      throw new Error("Không thể kết nối đến cơ sở dữ liệu PostgreSQL.");
    }

    // 2. Truy vấn mọi bài học: metadata luôn được nạp, transcript chỉ nạp khi có cues thật.
    const query = `
      SELECT l.lesson_id, ls.cues, l.title
      FROM lessons l
      LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
      ORDER BY l.lesson_id ASC;
    `;
    const result = await db.query(query);
    const rows = result.rows || [];

    console.log(`\n📋 Tìm thấy tổng cộng ${rows.length} bài học trong CSDL.\n`);

    if (rows.length === 0) {
      console.log("⚠️ Không có bài học nào để backfill.");
      process.exit(0);
    }

    let successCount = 0;
    let skippedCount = 0;

    // 3. Xử lý tuần tự; dịch vụ embedding tự throttle và retry theo quota của Google.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lessonId = row.lesson_id;
      const lessonTitle = row.title || 'Untitled';
      await ingestLessonMetadata(lessonId, { throwOnError: true });
      
      let cues = [];
      try {
        cues = typeof row.cues === 'string' ? JSON.parse(row.cues) : (row.cues || []);
      } catch (parseErr) {
        console.warn(`[Backfill RAG] (${i + 1}/${rows.length}) ⚠️ Lỗi parse cues cho lessonId=${lessonId}:`, parseErr.message);
        cues = [];
      }

      if (!cues || cues.length === 0) {
        console.log(`[Backfill RAG] (${i + 1}/${rows.length}) ⏩ Bỏ qua lessonId=${lessonId} ("${lessonTitle}"): Không có câu thoại cues.`);
        skippedCount++;
        continue;
      }

      console.log(`[Backfill RAG] (${i + 1}/${rows.length}) 🔄 Đang xử lý lessonId=${lessonId} ("${lessonTitle}") với ${cues.length} câu phụ đề...`);
      
      // Thực hiện ingest đồng bộ và đợi hoàn thành
      await ingestLessonTranscript(lessonId, cues);
      successCount++;

      // Delay 500ms giữa mỗi bài học
      if (i < rows.length - 1) {
        await sleep(500);
      }
    }

    console.log("\n==========================================================================");
    console.log(`🎉 HOÀN THÀNH QUÁ TRÌNH BACKFILL RAG INGESTION!`);
    console.log(`✅ Thành công: ${successCount}/${rows.length} bài học`);
    if (skippedCount > 0) {
      console.log(`⏩ Bỏ qua: ${skippedCount} bài học (do không có cues)`);
    }
    console.log("==========================================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ [Backfill RAG Fatal Error]:", error);
    process.exit(1);
  }
}

runBackfill();
