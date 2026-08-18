/**
 * Intent-Based Retrieval Routing Evaluation Suite (Phase 4)
 * - Đánh giá định lượng bộ 35 câu Intent Test đa dạng (Tiếng Việt & Tiếng Anh)
 * - Đo Intent Accuracy, Scope Routing Accuracy, Phân bố Confusion Matrix và Latency
 * - Kiểm thử tích hợp Integration Test cho các luồng Retrieval Scope thực tế
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { routeIntent, INTENTS, SCOPE_MAPPING } = require('../src/modules/chatbot/services/intentRouter.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== TẬP 35 CÂU HỎI BENCHMARK ĐA DẠNG INTENT ====================
const intentDataset35 = [
  // 1. CURRENT_LESSON_QA (Scope: current_lesson)
  { id: "INT-01", query: "Phần này trong video nghĩa là gì vậy cô?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "INT-02", query: "Tại sao ở đây thầy lại dùng đại từ 'them' thay vì 'they'?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "INT-03", query: "Giải thích giúp em câu ví dụ thứ hai trong đoạn này.", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "INT-04", query: "Why is the speaker using Present Continuous in this sentence?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },
  { id: "INT-05", query: "Từ 'mindset' trong ngữ cảnh bài này có nghĩa là gì?", expectedIntent: INTENTS.CURRENT_LESSON_QA, expectedScope: "current_lesson" },

  // 2. SUMMARIZE_CURRENT_LESSON (Scope: current_lesson)
  { id: "INT-06", query: "Tóm tắt nội dung chính của bài học này giúp tôi.", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "INT-07", query: "Bài học này nói về gì vậy?", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "INT-08", query: "Tổng kết các điểm ngữ pháp trọng tâm trong bài này.", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "INT-09", query: "Can you give me a summary of this lesson?", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },
  { id: "INT-10", query: "What are the main key takeaways from this video?", expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON, expectedScope: "current_lesson" },

  // 3. SEARCH_LESSON (Scope: course_wide)
  { id: "INT-11", query: "Bài nào dạy về công thức Thì Hiện Tại Tiếp Diễn?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "INT-12", query: "Trong khóa học có bài nào về Subject Pronouns và Object Pronouns không?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "INT-13", query: "Tôi học phương pháp Passive Listening ở bài mấy?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "INT-14", query: "Which lesson teaches about family vocabulary and relationships?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },
  { id: "INT-15", query: "Where can I find the lesson covering self-introductions and hobbies?", expectedIntent: INTENTS.SEARCH_LESSON, expectedScope: "course_wide" },

  // 4. NAVIGATE_TO_LESSON (Scope: course_wide)
  { id: "INT-16", query: "Đưa tôi tới bài học về Passive Listening.", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },
  { id: "INT-17", query: "Mở bài học về First Meeting và giới thiệu bản thân.", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },
  { id: "INT-18", query: "Chuyển sang bài dạy các thì thời gian trong văn phong nói.", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },
  { id: "INT-19", query: "Take me to the lesson about Meet My Family.", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },
  { id: "INT-20", query: "Navigate to the English Mindset lesson please.", expectedIntent: INTENTS.NAVIGATE_TO_LESSON, expectedScope: "course_wide" },

  // 5. RECOMMEND_LESSON (Scope: course_wide)
  { id: "INT-21", query: "Tôi nên học bài nào tiếp theo sau bài này?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },
  { id: "INT-22", query: "Trước khi học bài này thì em nên học bài nào trước để nắm vững?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },
  { id: "INT-23", query: "Gợi ý cho tôi lộ trình các bài học tiếp theo trong khóa.", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },
  { id: "INT-24", query: "What should I learn next after finishing this lesson?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },
  { id: "INT-25", query: "What are the recommended prerequisite lessons for this topic?", expectedIntent: INTENTS.RECOMMEND_LESSON, expectedScope: "course_wide" },

  // 6. COURSE_QA (Scope: course_wide)
  { id: "INT-26", query: "Khóa học này gồm có những chương học nào?", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" },
  { id: "INT-27", query: "Trong khóa học này có dạy về câu điều kiện không?", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" },
  { id: "INT-28", query: "Toàn bộ khóa học này kéo dài bao nhiêu bài giảng?", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" },
  { id: "INT-29", query: "What topics does this entire course cover?", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" },
  { id: "INT-30", query: "Are there any speaking practice quizzes in this course?", expectedIntent: INTENTS.COURSE_QA, expectedScope: "course_wide" },

  // 7. GENERAL_ENGLISH_QA (Scope: none)
  { id: "INT-31", query: "Từ 'serendipity' trong tiếng Anh nghĩa là gì?", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },
  { id: "INT-32", query: "Phân biệt cách dùng 'affect' và 'effect' trong tiếng Anh.", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },
  { id: "INT-33", query: "How do you pronounce the word 'comfortable' correctly?", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },
  { id: "INT-34", query: "Hôm nay trời đẹp quá, chúc bạn một ngày tốt lành!", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" },
  { id: "INT-35", query: "What is the difference between active voice and passive voice in general grammar?", expectedIntent: INTENTS.GENERAL_ENGLISH_QA, expectedScope: "none" }
];

async function runIntentEvaluation() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU BENCHMARK ĐỊNH LƯỢNG INTENT-BASED RETRIEVAL ROUTING (PHASE 4)");
  console.log("==========================================================================\n");

  const results = [];
  let ruleHits = 0;
  let llmHits = 0;
  let totalLatency = 0;

  // Confusion matrix tracking
  const confusionMatrix = {};
  Object.keys(INTENTS).forEach(exp => {
    confusionMatrix[exp] = {};
    Object.keys(INTENTS).forEach(pred => {
      confusionMatrix[exp][pred] = 0;
    });
  });

  for (let i = 0; i < intentDataset35.length; i++) {
    const item = intentDataset35[i];
    const startTime = Date.now();
    const routed = await routeIntent(item.query);
    const latency = Date.now() - startTime;
    totalLatency += latency;

    if (routed.method === 'rule_based') ruleHits++;
    else llmHits++;

    const isIntentMatch = routed.intent === item.expectedIntent;
    const isScopeMatch = routed.scope === item.expectedScope;

    if (confusionMatrix[item.expectedIntent]) {
      confusionMatrix[item.expectedIntent][routed.intent] = (confusionMatrix[item.expectedIntent][routed.intent] || 0) + 1;
    }

    results.push({
      id: item.id,
      query: item.query,
      expectedIntent: item.expectedIntent,
      predictedIntent: routed.intent,
      expectedScope: item.expectedScope,
      predictedScope: routed.scope,
      confidence: routed.confidence,
      method: routed.method,
      latencyMs: latency,
      intentPassed: isIntentMatch,
      scopePassed: isScopeMatch,
      reasoning: routed.reasoning
    });

    console.log(`[${item.id}] "${item.query.slice(0, 45)}..."`);
    console.log(`    Expected: [${item.expectedIntent} -> ${item.expectedScope}] | Predicted: [${routed.intent} -> ${routed.scope}] (${routed.method}, ${latency}ms)`);
    console.log(`    Status: Intent ${isIntentMatch ? "✅ PASS" : "❌ FAIL"} | Scope ${isScopeMatch ? "✅ PASS" : "❌ FAIL"}`);
    await sleep(60);
  }

  // Thống kê kết quả
  const total = results.length;
  const intentCorrect = results.filter(r => r.intentPassed).length;
  const scopeCorrect = results.filter(r => r.scopePassed).length;

  const intentAccuracy = ((intentCorrect / total) * 100).toFixed(1) + "%";
  const scopeAccuracy = ((scopeCorrect / total) * 100).toFixed(1) + "%";
  const avgLatency = Math.round(totalLatency / total);

  console.log("\n==========================================================================");
  console.log("📊 KẾT QUẢ TỔNG HỢP BENCHMARK INTENT ROUTING (35 TEST CASES):");
  console.log("==========================================================================");
  console.log(`- Tổng số câu hỏi kiểm thử: ${total}`);
  console.log(`- Intent Classification Accuracy: ${intentAccuracy} (${intentCorrect}/${total})`);
  console.log(`- Scope Routing Accuracy: ${scopeAccuracy} (${scopeCorrect}/${total})`);
  console.log(`- Phân bổ phương pháp: Rule-Based: ${ruleHits} (${((ruleHits/total)*100).toFixed(1)}%) | LLM Fallback: ${llmHits} (${((llmHits/total)*100).toFixed(1)}%)`);
  console.log(`- Average Latency: ${avgLatency} ms (Rule-based: < 1ms, LLM: ~500-700ms)`);
  console.log("==========================================================================\n");

  const summary = {
    total_queries: total,
    intent_accuracy: intentAccuracy,
    scope_accuracy: scopeAccuracy,
    avg_latency_ms: avgLatency,
    method_distribution: {
      rule_based: ruleHits,
      llm_fallback: llmHits
    },
    confusion_matrix: confusionMatrix,
    test_details: results
  };

  const outPath = path.resolve(__dirname, '../../phase4_intent_routing_results.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`💾 Đã lưu kết quả chi tiết Intent Routing vào: ${outPath}`);

  process.exit(0);
}

runIntentEvaluation().catch(err => {
  console.error("❌ Lỗi Intent Benchmark:", err);
  process.exit(1);
});
