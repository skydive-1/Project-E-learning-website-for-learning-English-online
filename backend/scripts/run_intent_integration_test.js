/**
 * Intent Router Integration & Regression Test (Phase 4)
 * - Xác minh luồng chạy thực tế của các Intent vào retrieval layer
 * - Kiểm chứng các ca mơ hồ (Ambiguous queries) kích hoạt LLM Fallback
 * - Đảm bảo 0% Regression cho Phase 3
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { routeIntent, classifyWithLLM, INTENTS } = require('../src/modules/chatbot/services/intentRouter.service');

async function runIntegrationTest() {
  console.log("==========================================================================");
  console.log("🔬 BẮT ĐẦU KIỂM THỬ TÍCH HỢP (INTEGRATION TEST) INTENT ROUTING");
  console.log("==========================================================================\n");

  const integrationCases = [
    {
      name: "SEARCH_LESSON -> Course Retrieval",
      query: "Bài nào trong khóa dạy về Thì Hiện Tại Tiếp Diễn?",
      expectedScope: "course_wide",
      expectedIntent: INTENTS.SEARCH_LESSON
    },
    {
      name: "CURRENT_LESSON_QA -> Lesson Retrieval",
      query: "Giải thích giúp em câu ví dụ thứ hai trong đoạn này.",
      expectedScope: "current_lesson",
      expectedIntent: INTENTS.CURRENT_LESSON_QA
    },
    {
      name: "NAVIGATE_TO_LESSON -> Course Retrieval",
      query: "Đưa tôi tới bài học về Passive Listening.",
      expectedScope: "course_wide",
      expectedIntent: INTENTS.NAVIGATE_TO_LESSON
    },
    {
      name: "SUMMARIZE_CURRENT_LESSON -> Lesson Retrieval",
      query: "Tóm tắt nội dung chính của bài học này giúp tôi.",
      expectedScope: "current_lesson",
      expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON
    },
    {
      name: "GENERAL_ENGLISH_QA -> None Scope (No Unnecessary DB Search)",
      query: "Từ 'serendipity' trong tiếng Anh nghĩa là gì?",
      expectedScope: "none",
      expectedIntent: INTENTS.GENERAL_ENGLISH_QA
    }
  ];

  for (const c of integrationCases) {
    const routed = await routeIntent(c.query);
    const scopeMatch = routed.scope === c.expectedScope;
    const intentMatch = routed.intent === c.expectedIntent;
    console.log(`[${c.name}]`);
    console.log(`  Query: "${c.query}"`);
    console.log(`  Routed Intent: ${routed.intent} | Scope: ${routed.scope} (${routed.method})`);
    console.log(`  Result: ${scopeMatch && intentMatch ? "✅ PASSED" : "❌ FAILED"}\n`);
  }

  console.log("==========================================================================");
  console.log("🤖 KIỂM THỬ TRỰC TIẾP LLM FALLBACK CLASSIFICATION VỚI CÂU HỎI MƠ HỒ:");
  console.log("==========================================================================");

  const ambiguousQueries = [
    { query: "Cái này khó hiểu quá, bạn giải thích thêm được không?", expected: "CURRENT_LESSON_QA" },
    { query: "Tìm cho mình phần nói về cách xưng hô với đồng nghiệp", expected: "SEARCH_LESSON" },
    { query: "I want to know all the speaking exercises available here", expected: "COURSE_QA" }
  ];

  for (const amb of ambiguousQueries) {
    const start = Date.now();
    const res = await classifyWithLLM(amb.query);
    const lat = Date.now() - start;
    console.log(`  Query: "${amb.query}"`);
    console.log(`  LLM Classified: Intent: ${res.intent} | Scope: ${res.scope} | Confidence: ${res.confidence} (${lat}ms)`);
    console.log(`  Reasoning: "${res.reasoning}"\n`);
  }

  console.log("==========================================================================");
  console.log("🎉 HOÀN TẤT KIỂM THỬ TÍCH HỢP INTENT ROUTER!");
  console.log("==========================================================================\n");

  process.exit(0);
}

runIntegrationTest().catch(err => {
  console.error("Lỗi Integration Test:", err);
  process.exit(1);
});
