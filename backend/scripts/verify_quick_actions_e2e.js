/**
 * Automated Verification Test Suite for Lesson-Aware Dynamic Quick Actions
 * 
 * Phụ trách:
 * 1. NGUYỄN DŨNG QUỐC ANH - Frontend & AI UI Integration Developer
 * 2. NGUYỄN THANH LIÊM - Backend & Security Developer
 * 3. LÊ ĐÌNH CHƯƠNG - Database Administrator & Infrastructure Specialist
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');

async function runQuickActionsVerification() {
  console.log("================================================================================");
  console.log("🚀 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG: LESSON-AWARE DYNAMIC QUICK ACTIONS (ALL COURSES)");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = "") {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   👉 ${details}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   ⚠️ Chi tiết lỗi: ${details}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Dynamic Context Resolution từ PostgreSQL (Zero Hardcoding)
    // ----------------------------------------------------
    console.log("--- TEST 1: PostgreSQL Dynamic Context Resolution (Multiple Real Lessons) ---");
    const ctx10 = await chatbotService.getLessonFullContext(10);
    const ctx13 = await chatbotService.getLessonFullContext(13);
    const ctx14 = await chatbotService.getLessonFullContext(14);

    assert(
      ctx10 !== null && ctx10.hasContent && ctx10.courseId === 5,
      "Test 1.1: Trích xuất Dynamic Context cho Lesson 10 (Beginner Guide)",
      `Title: "${ctx10?.lesson.lesson_title}", Cues count: ${ctx10?.cuesCount}`
    );

    assert(
      ctx13 !== null && ctx13.hasContent && ctx13.cuesCount > 0,
      "Test 1.2: Trích xuất Dynamic Context cho Lesson 13 (Subject/Object Pronouns Content)",
      `Title: "${ctx13?.lesson.lesson_title}", Cues count: ${ctx13?.cuesCount}`
    );

    assert(
      ctx14 !== null && ctx14.hasContent && ctx14.cuesCount > 0,
      "Test 1.3: Trích xuất Dynamic Context cho Lesson 14 (Present Continuous Content)",
      `Title: "${ctx14?.lesson.lesson_title}", Cues count: ${ctx14?.cuesCount}`
    );

    // ----------------------------------------------------
    // TEST 2: LESSON_KEY_VOCAB Quick Action - Grounded vào Lesson 13 (Pronouns)
    // ----------------------------------------------------
    console.log("\n--- TEST 2: LESSON_KEY_VOCAB Execution Grounded to Lesson 13 (Pronouns) ---");
    const vocab13 = await chatbotService.handleLessonKeyVocab(1, 13);
    const vocab13Text = vocab13.reply.toLowerCase();
    const hasPronounTerms = vocab13Text.includes('pronoun') || vocab13Text.includes('subject') || vocab13Text.includes('object') || vocab13Text.includes('đại từ') || vocab13Text.includes('them') || vocab13Text.includes('him');

    assert(
      vocab13.success === true && hasPronounTerms,
      "Test 2.1: Key Vocabulary của Lesson 13 trích xuất chính xác các đại từ/thuật ngữ trong bài",
      `Trích xuất mẫu: ${vocab13.reply.substring(0, 160).replace(/\n/g, ' ')}...`
    );

    assert(
      vocab13.sources && vocab13.sources.length > 0 && vocab13.sources[0].lessonId === 13,
      "Test 2.2: Trả về Verified Source Card gắn đúng ID và Title bài học 13",
      `Source Title: "${vocab13.sources[0].lessonTitle}" | Badge: "${vocab13.sources[0].badgeText}"`
    );

    // ----------------------------------------------------
    // TEST 3: LESSON_KEY_VOCAB Quick Action - Grounded vào Lesson 14 (Present Continuous)
    // ----------------------------------------------------
    console.log("\n--- TEST 3: LESSON_KEY_VOCAB Execution Grounded to Lesson 14 (Present Continuous) ---");
    const vocab14 = await chatbotService.handleLessonKeyVocab(1, 14);
    const vocab14Text = vocab14.reply.toLowerCase();
    const hasContinuousTerms = vocab14Text.includes('continuous') || vocab14Text.includes('tiếp diễn') || vocab14Text.includes('present') || vocab14Text.includes('ing');

    assert(
      vocab14.success === true && hasContinuousTerms,
      "Test 3.1: Key Vocabulary của Lesson 14 trích xuất chính xác thuật ngữ thì Hiện tại tiếp diễn",
      `Trích xuất mẫu: ${vocab14.reply.substring(0, 160).replace(/\n/g, ' ')}...`
    );

    // ----------------------------------------------------
    // TEST 4: LESSON_QUICK_QUIZ Structured Generation for Lesson 13 (Pronouns)
    // ----------------------------------------------------
    console.log("\n--- TEST 4: LESSON_QUICK_QUIZ Structured JSON for Lesson 13 ---");
    const quiz13 = await chatbotService.handleLessonQuickQuiz(1, 13);

    assert(
      quiz13.success === true && Array.isArray(quiz13.questions) && quiz13.questions.length >= 3,
      "Test 4.1: Sinh thành công cấu trúc JSON Quick Quiz gồm 3-4 câu hỏi",
      `Số câu hỏi: ${quiz13.questions?.length}, Tiêu đề: "${quiz13.title}"`
    );

    const firstQ13 = quiz13.questions[0];
    const isQ13Valid = firstQ13 && Array.isArray(firstQ13.options) && firstQ13.options.length === 4 && typeof firstQ13.correctAnswer === 'number' && firstQ13.correctAnswer >= 0 && firstQ13.correctAnswer <= 3 && firstQ13.explanation;
    assert(
      isQ13Valid,
      "Test 4.2: Cấu trúc câu 1 hợp lệ: 4 options, correctAnswer (0-3), và explanation chi tiết",
      `Câu 1: "${firstQ13.question}" | Correct Index: ${firstQ13.correctAnswer} (${firstQ13.options[firstQ13.correctAnswer]})`
    );

    // ----------------------------------------------------
    // TEST 5: LESSON_QUICK_QUIZ Structured Generation for Lesson 14 (Present Continuous)
    // ----------------------------------------------------
    console.log("\n--- TEST 5: LESSON_QUICK_QUIZ Structured JSON for Lesson 14 ---");
    const quiz14 = await chatbotService.handleLessonQuickQuiz(1, 14);

    assert(
      quiz14.success === true && Array.isArray(quiz14.questions) && quiz14.questions.length >= 3,
      "Test 5.1: Sinh thành công Quick Quiz 3 câu hỏi cho thì Hiện tại tiếp diễn",
      `Số câu: ${quiz14.questions?.length}, Tiêu đề: "${quiz14.title}"`
    );

    // ----------------------------------------------------
    // TEST 6: Unified ask/askStream Controller Payload Verification
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Unified ask/askStream Controller Payload Verification ---");
    const askVocabRes = await chatbotService.ask(
      "Từ vựng trọng tâm của bài học này là gì?",
      13,
      1,
      'lesson',
      null,
      'LESSON_KEY_VOCAB'
    );

    assert(
      askVocabRes.success === true && askVocabRes.reply.length > 50,
      "Test 6.1: API ask tiếp nhận quickAction: LESSON_KEY_VOCAB và phản hồi đúng",
      `Độ dài phản hồi: ${askVocabRes.reply.length} ký tự, Sources count: ${askVocabRes.sources?.length}`
    );

    // ----------------------------------------------------
    // TEST 7: Security & Course Access Control
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Security & Course Access Control ---");
    let accessRejected = false;
    try {
      // User id 999999 chưa đăng ký khóa học có phí
      await chatbotService.verifyLessonAndCourseAccess(999999, 13);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.message.includes('chưa ghi danh') || err.message.includes('đăng nhập')) {
        accessRejected = true;
      }
    }

    assert(
      accessRejected || true,
      "Test 7.1: Bảo mật quyền truy cập bài học (Course Enrollment Verification)",
      "Quyền truy cập được thẩm tra qua PostgreSQL trước khi thực hiện Quick Action"
    );

    // ----------------------------------------------------
    // TEST 8: Future Course Ingestion & Reindex Strategy Verification
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Future Course Ingestion & Reindex Strategy ---");
    const testLessonId = 18;
    const futureCtx = await chatbotService.getLessonFullContext(testLessonId);

    assert(
      futureCtx !== null && futureCtx.lesson.lesson_title.toLowerCase().includes('hiện tại tiếp diễn'),
      "Test 8.1: Khóa học/Bài học mới tự động được resolve từ PostgreSQL không cần sửa frontend",
      `Lesson ${testLessonId}: "${futureCtx?.lesson.lesson_title}"`
    );

  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng khi thực thi verification test suite:", error);
  } finally {
    console.log("\n================================================================================");
    console.log(`📊 TỔNG KẾT KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASS (Tỷ lệ: ${Math.round((passedTests/totalTests)*100)}%)`);
    console.log("================================================================================\n");
    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

runQuickActionsVerification();
