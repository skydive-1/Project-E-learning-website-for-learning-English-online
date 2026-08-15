/**
 * Seed Subtitles for Existing Lessons
 */

const db = require('./src/config/database');
const subtitlesService = require('./src/modules/lessons/services/subtitles.service');

async function main() {
  console.log("=== BẮT ĐẦU SEED PHỤ ĐỀ SONG NGỮ CHO CÁC BÀI HỌC HIỆN CÓ ===");
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS lesson_subtitles (
        subtitle_id SERIAL PRIMARY KEY,
        lesson_id INT NOT NULL UNIQUE REFERENCES lessons(lesson_id) ON DELETE CASCADE,
        en_vtt TEXT,
        vi_vtt TEXT,
        bilingual_vtt TEXT,
        cues JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_lesson_subtitles_lesson_id ON lesson_subtitles(lesson_id);`);
    console.log("✅ Bảng lesson_subtitles đã sẵn sàng.");

    const { rows: lessons } = await db.query(`
      SELECT lesson_id, title, content_type, speaking_sentences 
      FROM lessons 
      ORDER BY lesson_id ASC;
    `);

    console.log(`Tìm thấy ${lessons.length} bài học trong cơ sở dữ liệu.`);

    for (const l of lessons) {
      console.log(`-> Xử lý phụ đề bài học ${l.lesson_id}: "${l.title}" (${l.content_type})...`);
      try {
        const result = await subtitlesService.generateSubtitlesWithGemini(l.lesson_id);
        console.log(`   ✅ Thành công! Đã tạo ${result?.cues?.length || 0} câu phụ đề song ngữ.`);
      } catch (err) {
        console.warn(`   ⚠️ Lỗi bài học ${l.lesson_id}:`, err.message);
      }
    }

    console.log("=== HOÀN TẤT SEED PHỤ ĐỀ ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi chính:", error);
    process.exit(1);
  }
}

main();
