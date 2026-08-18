/**
 * Phase 4 Final Sanity Check: Holdout Intent Evaluation & Regression Suite
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { routeIntent, classifyWithLLM, INTENTS } = require('../src/modules/chatbot/services/intentRouter.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== 30-QUERY HOLDOUT DATASET ====================
const holdoutDataset30 = [
  // 1. Câu mơ hồ (Ambiguous)
  { id: "H-01", query: "Cái này áp dụng thực tế thế nào?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "H-02", query: "Tìm giúp mình chỗ nói về cách chào hỏi đối tác", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "H-03", query: "Học xong cái này thì làm gì tiếp?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },

  // 2. Câu rất ngắn (Very short)
  { id: "H-04", query: "Tóm tắt?", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "H-05", query: "bài sau?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },
  { id: "H-06", query: "summarize", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "H-07", query: "next lesson?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },

  // 3. Typo nhẹ & tiếng Việt không dấu
  { id: "H-08", query: "bai nao day thi qua khu don", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "H-09", query: "giai thik doan video nay voi", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "H-10", query: "tom tat noi dung chinh", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "H-11", query: "chuyen sang bai speaking", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },

  // 4. Việt + Anh trộn (Mixed Vi-En)
  { id: "H-12", query: "Bài nào dạy về present continuous tense vậy cô?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "H-13", query: "Trong bài này sao dùng pronoun them?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "H-14", query: "Cho em xin recap of this lesson", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "H-15", query: "Open lesson về family members giúp tôi", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },

  // 5. Câu đa dấu hiệu / Conflicting cues
  { id: "H-16", query: "Đang xem video này nhưng cho hỏi bài nào dạy về câu điều kiện?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "H-17", query: "Trong khóa học này có bài nào về Passive Listening không?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "H-18", query: "Học xong bài hiện tại thì qua bài nào tiếp theo?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },

  // 6. Tự nhiên không chứa regex rõ
  { id: "H-19", query: "Chỗ phát âm âm /θ/ nằm ở đâu thế?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "H-20", query: "Cô giáo vừa nói câu gì ở đoạn này vậy?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "H-21", query: "Tôi muốn biết toàn bộ các chủ đề sẽ học trong khóa", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" },
  { id: "H-22", query: "Để học tốt bài này có cần học trước bài nào không?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },

  // 7. General English khi đang ở Lesson
  { id: "H-23", query: "Con mèo tiếng anh là gì?", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },
  { id: "H-24", query: "How to say 'cảm ơn' in English?", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },
  { id: "H-25", query: "Dịch sang tiếng anh câu 'Tôi yêu gia đình'", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },
  { id: "H-26", query: "Phát âm từ 'schedule' như thế nào?", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },

  // 8. Điều hướng & Khóa học biến thể
  { id: "H-27", query: "Dẫn tôi tới bài học số 3", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },
  { id: "H-28", query: "Khóa học này gồm bao nhiêu bài giảng?", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" },
  { id: "H-29", query: "Tại sao ở đây lại chia động từ thêm s?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "H-30", query: "Trong khoá này có dạy IELTS không?", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" }
];

async function runHoldoutSanityCheck() {
  console.log("==========================================================================");
  console.log("🔍 BẮT ĐẦU HOLDOUT EVALUATION & SANITY CHECK (PHASE 4)");
  console.log("==========================================================================\n");

  const results = [];
  const latencies = [];
  let fastPathCount = 0;
  let llmFallbackCount = 0;

  for (let i = 0; i < holdoutDataset30.length; i++) {
    const item = holdoutDataset30[i];
    const start = Date.now();
    const routed = await routeIntent(item.query);
    const latency = Date.now() - start;
    latencies.push(latency);

    if (routed.method === 'rule_based') fastPathCount++;
    else llmFallbackCount++;

    const isIntentMatch = routed.intent === item.expectedIntent;
    const isScopeMatch = routed.scope === item.expectedScope;

    results.push({
      id: item.id,
      query: item.query,
      expectedIntent: item.expectedIntent,
      predictedIntent: routed.intent,
      expectedScope: item.expectedScope,
      predictedScope: routed.scope,
      method: routed.method,
      confidence: routed.confidence,
      latencyMs: latency,
      passed: isIntentMatch && isScopeMatch
    });

    console.log(`[${item.id}] "${item.query.slice(0, 42)}..."`);
    console.log(`    Exp: [${item.expectedIntent} -> ${item.expectedScope}] | Pred: [${routed.intent} -> ${routed.scope}] (${routed.method}, ${latency}ms)`);
    console.log(`    Result: ${isIntentMatch && isScopeMatch ? "✅ PASS" : "❌ FAIL"}`);
    await sleep(40);
  }

  // Tính toán chỉ số thống kê
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const holdoutAccuracy = ((passedCount / total) * 100).toFixed(1) + "%";
  const fastPathRate = ((fastPathCount / total) * 100).toFixed(1) + "%";
  const llmFallbackRate = ((llmFallbackCount / total) * 100).toFixed(1) + "%";

  const sumLat = latencies.reduce((a, b) => a + b, 0);
  const avgLat = Math.round(sumLat / total);

  // Tính P95 Latency
  const sortedLat = [...latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(0.95 * sortedLat.length);
  const p95Lat = sortedLat[p95Index];

  console.log("\n==========================================================================");
  console.log("📊 KẾT QUẢ TỔNG HỢP 30 CÂU HOLDOUT SET:");
  console.log(`- Holdout Intent Accuracy: ${holdoutAccuracy} (${passedCount}/${total})`);
  console.log(`- Fast-path Rate (Rule-based): ${fastPathRate} (${fastPathCount}/${total})`);
  console.log(`- LLM Fallback Rate: ${llmFallbackRate} (${llmFallbackCount}/${total})`);
  console.log(`- Average Latency (Toàn bộ Router): ${avgLat} ms`);
  console.log(`- P95 Latency: ${p95Lat} ms`);
  console.log("==========================================================================\n");

  // ==================== 2. KIỂM CHỨNG SAFE FAILURE BEHAVIOR ====================
  console.log("🛡️ KIỂM CHỨNG SAFE FAILURE BEHAVIOR (KHI GẶP LỖI/MALFORMED/TIMEOUT):");
  // Test safe fallback với context-aware lesson
  const safeFallbackTest = await classifyWithLLM("$$$### malformed input test", { lessonId: 14, hasValidLesson: true });
  console.log(`  -> Fallback Output: Intent: ${safeFallbackTest.intent} | Scope: ${safeFallbackTest.scope} (${safeFallbackTest.method})`);
  console.log(`  -> Safe Failure Behavior: ${safeFallbackTest.scope === 'current_lesson' ? "✅ PASS (Mặc định an toàn current_lesson khi có bài học, không đổ về course_wide)" : "❌ FAIL"}\n`);

  // ==================== 3. CHẠY REGRESSION SUBSET PHASE 3 ====================
  console.log("🧪 CHẠY REGRESSION SUBSET PHASE 3 (5 CURRENT-LESSON + 5 COURSE-WIDE):");
  const regressionSubset = [
    { type: "Lesson", query: "Phương pháp nghe thụ động Passive Listening là gì?", expectedScope: "current_lesson" },
    { type: "Lesson", query: "Subject Pronouns và Object Pronouns trong câu", expectedScope: "current_lesson" },
    { type: "Lesson", query: "Giải thích đoạn video này giúp em với", expectedScope: "current_lesson" },
    { type: "Lesson", query: "Tại sao ở đây lại dùng từ này?", expectedScope: "current_lesson" },
    { type: "Lesson", query: "Tóm tắt bài học hiện tại", expectedScope: "current_lesson" },
    { type: "Course", query: "Thì Hiện Tại Tiếp Diễn S + am/is/are + V-ing nằm ở bài mấy?", expectedScope: "course_wide" },
    { type: "Course", query: "Bài nào trong khóa dạy về Subject Pronouns?", expectedScope: "course_wide" },
    { type: "Course", query: "Các thì thời gian trong văn phong nói học ở bài nào?", expectedScope: "course_wide" },
    { type: "Course", query: "Đưa tôi tới bài học Meet My Family", expectedScope: "course_wide" },
    { type: "Course", query: "Mở bài học về First Meeting", expectedScope: "course_wide" }
  ];

  let regPass = 0;
  for (const reg of regressionSubset) {
    const r = await routeIntent(reg.query, { lessonId: 14, hasValidLesson: true });
    const pass = r.scope === reg.expectedScope;
    if (pass) regPass++;
    console.log(`  [${reg.type}] "${reg.query.slice(0, 35)}..." -> Scope: ${r.scope} | ${pass ? "✅ PASS" : "❌ FAIL"}`);
  }
  console.log(`  -> Phase 3 Regression Result: ${regPass}/10 (${((regPass/10)*100).toFixed(0)}% PASS)\n`);

  process.exit(0);
}

runHoldoutSanityCheck().catch(err => {
  console.error("Lỗi Holdout Sanity Check:", err);
  process.exit(1);
});
