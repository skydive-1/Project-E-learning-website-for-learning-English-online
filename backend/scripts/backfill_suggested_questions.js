require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const { generateAndSaveSuggestedQuestions } = require('../src/modules/lessons/services/suggestedQuestions.service');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('='.repeat(60));
  console.log('[Suggested Questions Backfill] Bắt đầu nạp câu hỏi gợi ý cho các bài học...');
  console.log('='.repeat(60));

  try {
    // 1. Lấy tất cả bài học trong database
    const res = await db.query(`
      SELECT l.lesson_id, l.title, c.course_name,
             (SELECT COUNT(*) FROM lesson_suggested_questions sq WHERE sq.lesson_id = l.lesson_id) AS has_suggested,
             (SELECT cues FROM lesson_subtitles ls WHERE ls.lesson_id = l.lesson_id) AS cues
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      ORDER BY c.course_id, s.section_id, l.order_index, l.lesson_id
    `);

    const lessons = res.rows;
    console.log(`[Suggested Questions Backfill] Tìm thấy ${lessons.length} bài học trên hệ thống.\n`);

    let successCount = 0;
    let fallbackCount = 0;
    let errorCount = 0;

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const progress = `[${i + 1}/${lessons.length}]`;
      const lessonId = lesson.lesson_id;
      const title = lesson.title;

      try {
        console.log(`${progress} Đang xử lý lessonId=${lessonId} ("${title}") [Khóa học: ${lesson.course_name}]...`);
        const questions = await generateAndSaveSuggestedQuestions(lessonId, lesson.cues);
        console.log(`  -> Đã sinh ${questions.length} câu hỏi:`);
        questions.forEach((q, qIdx) => console.log(`     ${qIdx + 1}. ${q}`));
        successCount++;
      } catch (err) {
        console.error(`  ❌ Lỗi lessonId=${lessonId}: ${err.message}`);
        errorCount++;
      }

      // Giãn cách nhẹ để tránh rate limit
      if (i < lessons.length - 1) {
        await sleep(1000);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`[Suggested Questions Backfill] HOÀN TẤT: ${successCount} Thành công / ${errorCount} Lỗi / ${lessons.length} Tổng số`);
    console.log('='.repeat(60));

  } catch (err) {
    console.error('[Suggested Questions Backfill] Lỗi nghiêm trọng:', err.message);
  } finally {
    await db.pool.end();
  }
}

main();
