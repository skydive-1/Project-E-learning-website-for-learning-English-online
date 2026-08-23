require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const {
  getFallbackSuggestedQuestions,
  getSuggestedQuestionsByLessonId,
  generateAndSaveSuggestedQuestions,
  saveQuestionsToDb
} = require('../src/modules/lessons/services/suggestedQuestions.service');

async function runTest() {
  console.log('='.repeat(60));
  console.log('KIỂM THỬ TÍNH NĂNG SUGGESTED QUESTIONS (UDEMY-LIKE)');
  console.log('='.repeat(60));

  let testLessonId = 14;

  try {
    // 1. Kiểm tra Fallback Template
    console.log('\n[Test 1] Kiểm tra hàm Fallback Template:');
    const fallback = getFallbackSuggestedQuestions('Thì Quá Khứ Đơn', 'English For Beginners');
    console.log(' -> Số câu hỏi fallback:', fallback.length);
    fallback.forEach((q, idx) => console.log(`    ${idx + 1}. ${q}`));
    if (fallback.length === 4 && fallback[0].includes('Thì Quá Khứ Đơn')) {
      console.log('  ✅ [PASS] Fallback Template sinh đúng 4 câu hỏi định dạng chuẩn!');
    } else {
      throw new Error('Fallback template failed');
    }

    // 2. Lấy 1 bài học thật từ Database để kiểm tra
    const lessonRes = await db.query('SELECT lesson_id, title FROM lessons LIMIT 1');
    if (lessonRes.rows.length === 0) {
      throw new Error('Không có bài học nào trong DB để test');
    }
    testLessonId = lessonRes.rows[0].lesson_id;
    const testTitle = lessonRes.rows[0].title;
    console.log(`\n[Test 2] Sử dụng lesson_id = ${testLessonId} ("${testTitle}") để kiểm thử:`);

    // 3. Xóa dữ liệu cũ nếu có
    await db.query('DELETE FROM lesson_suggested_questions WHERE lesson_id = $1', [testLessonId]);

    // 4. Khi chưa có trong DB, getSuggestedQuestionsByLessonId phải trả về Fallback ngay
    const initQuestions = await getSuggestedQuestionsByLessonId(testLessonId);
    console.log(' -> Khi chưa có trong DB, trả về:', initQuestions.length, 'câu hỏi');
    if (initQuestions.length === 4) {
      console.log('  ✅ [PASS] Trả về Fallback Template thành công khi DB rỗng!');
    } else {
      throw new Error('Init questions length mismatch');
    }

    // 5. Thử lưu câu hỏi vào DB
    console.log('\n[Test 3] Lưu và đọc lại từ bảng lesson_suggested_questions:');
    const mockQuestions = [
      'Bài học này giới thiệu những gì?',
      'Cách sử dụng cấu trúc ngữ pháp trong bài?',
      'Ví dụ thực tế trong hội thoại hàng ngày?',
      'Tổng kết những điều cần nhớ.'
    ];
    await saveQuestionsToDb(testLessonId, mockQuestions);

    const dbQuestions = await getSuggestedQuestionsByLessonId(testLessonId);
    console.log(' -> Đọc từ DB:', dbQuestions);
    if (dbQuestions.length === 4 && dbQuestions[0] === mockQuestions[0]) {
      console.log('  ✅ [PASS] Upsert và đọc lại từ DB thành công 100%!');
    } else {
      throw new Error('DB read mismatch');
    }

    // 6. Thử gọi AI generateAndSaveSuggestedQuestions
    console.log('\n[Test 4] Thử sinh câu hỏi qua Gemini Flash (AI Ingestion):');
    const aiGenerated = await generateAndSaveSuggestedQuestions(testLessonId);
    console.log(' -> AI sinh được:', aiGenerated);
    if (aiGenerated.length >= 3) {
      console.log('  ✅ [PASS] AI sinh và lưu câu hỏi gợi ý thành công!');
    } else {
      throw new Error('AI Generation failed');
    }

    console.log('\n' + '='.repeat(60));
    console.log('TẤT CẢ CÁC BƯỚC KIỂM THỬ SUGGESTED QUESTIONS ĐÃ PASS 100%!');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

runTest();
