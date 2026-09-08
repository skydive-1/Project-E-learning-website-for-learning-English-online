/**
 * Script Backfill Suggested Questions based 100% on Video Transcript
 * Đảm bảo mọi bài học có video đều có 4 câu hỏi gợi ý bám sát nội dung bài giảng thực tế
 * Phụ trách: NGUYỄN THANH LIÊM, LÊ ĐÌNH CHƯƠNG, NGUYỄN DŨNG QUỐC ANH
 */

'use strict';

const db = require('../src/config/database');
const { generateAndSaveSuggestedQuestions } = require('../src/modules/lessons/services/suggestedQuestions.service');

async function run() {
  console.log('🚀 Bắt đầu backfill câu hỏi gợi ý bám sát 100% video bài học...');
  try {
    const res = await db.query(`
      SELECT ls.lesson_id, l.title, c.course_name, ls.cues
      FROM lesson_subtitles ls
      JOIN lessons l ON l.lesson_id = ls.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE jsonb_array_length(ls.cues) > 0
      ORDER BY ls.lesson_id ASC
    `);

    console.log(`Tìm thấy ${res.rows.length} bài học có transcript video.`);

    for (const lesson of res.rows) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Đang xử lý lessonId=${lesson.lesson_id}: "${lesson.title}" (${lesson.course_name}) - ${lesson.cues.length} cues`);
      try {
        const questions = await generateAndSaveSuggestedQuestions(lesson.lesson_id, lesson.cues);
        console.log(`✅ Kết quả 4 câu hỏi cho bài ${lesson.lesson_id}:`);
        questions.forEach((q, idx) => console.log(`   ${idx + 1}. ${q}`));
      } catch (err) {
        console.error(`❌ Lỗi bài ${lesson.lesson_id}:`, err.message);
      }
      // Dừng 1.2 giây giữa các request để tránh rate limit
      await new Promise(r => setTimeout(r, 1200));
    }

    console.log('\n==================================================');
    console.log('🎉 Hoàn tất cập nhật câu hỏi gợi ý 100% bám sát video bài học!');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

run();
