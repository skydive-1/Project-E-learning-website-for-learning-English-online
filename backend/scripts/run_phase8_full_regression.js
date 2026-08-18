/**
 * Phase 8 Full Regression & Zero-Regression Verification Suite
 * - Phase 3/6: Exact Title Search & Course-Wide Search
 * - Phase 4: Intent Router (Navigate, Recommend)
 * - Phase 5: Query Rewriting Follow-up
 * - Phase 6: Confidence Rejection (OOD)
 * - Phase 7: Structured Contract & History Persistence
 * - Phase 8: Timestamp-Aware Retrieval & Click-to-Seek
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');

async function runRegressionSuite() {
  console.log("==========================================================================");
  console.log("🔍 BẮT ĐẦU CHẠY FULL REGRESSION & ZERO REGRESSION (PHASE 3 - 8)");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1");
  const testUserId = usersRes.rows[0].user_id;

  const testCases = [
    { name: "P3/P6 Exact Title Search", query: "Meet My Family", lessonId: 39, expectLesson: 39 },
    { name: "P3/P6 Course-Wide Passive Listening", query: "Tìm bài Passive Listening", lessonId: 14, expectLesson: 14 },
    { name: "P4 Intent Routing (Navigate)", query: "Chuyển sang bài Meet My Family", lessonId: 39, expectIntent: "NAVIGATE_TO_LESSON" },
    { name: "P4 Intent Routing (Recommend)", query: "Tôi nên học bài nào tiếp theo?", lessonId: 10, expectIntent: "RECOMMEND_LESSON" },
    { name: "P5 Query Rewriting Follow-up", query: "Bài nào dạy nó?", lessonId: 14, prevQ: "Passive Listening là gì?", expectLesson: 14 },
    { name: "P6 Confidence Rejection (OOD)", query: "Docker container là gì?", lessonId: 14, expectZeroSources: true },
    { name: "P7 Structured Contract (/ask)", query: "Tìm bài Passive Listening", lessonId: 14, checkContract: true },
    { name: "P7 Chat History Persistence", query: "Test History", lessonId: 14, checkHistory: true },
    { name: "P8 Timestamp Retrieval (@10s)", query: "Tại sao ở đây dùng V-ing?", lessonId: 14, currentTime: 10, checkTimestamp: true },
    { name: "P8 Click-to-Seek Action Generation", query: "Giải thích phần này", lessonId: 14, currentTime: 15, checkSeekAction: true }
  ];

  let passed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`[Test ${i+1}/${testCases.length}] ${tc.name}: "${tc.query}"`);

    if (tc.prevQ) {
      await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);
      await chatbotService.saveHistory(testUserId, tc.lessonId, tc.prevQ, "Giải thích thuật ngữ.");
    }

    const res = await chatbotService.ask(tc.query, tc.lessonId, testUserId, 'auto', tc.currentTime);

    let ok = true;
    if (tc.expectLesson) {
      ok = ok && res.sources && res.sources.some(s => s.lessonId === tc.expectLesson);
    }
    if (tc.expectIntent) {
      ok = ok && res.intent === tc.expectIntent;
    }
    if (tc.expectZeroSources) {
      ok = ok && (!res.sources || res.sources.length === 0);
    }
    if (tc.checkContract) {
      ok = ok && res.reply && res.intent && Array.isArray(res.sources) && Array.isArray(res.actions);
    }
    if (tc.checkHistory) {
      await chatbotService.saveHistory(testUserId, tc.lessonId, tc.query, res.reply, res.sources, res.actions);
      const historyLoaded = await chatbotService.getHistory(testUserId, tc.lessonId);
      ok = ok && historyLoaded.length > 0 && historyLoaded[historyLoaded.length - 1].message === res.reply;
    }
    if (tc.checkTimestamp) {
      ok = ok && res.sources?.length === 1 && res.sources[0].startTime !== undefined && res.sources[0].startTime !== null;
    }
    if (tc.checkSeekAction) {
      ok = ok && res.actions?.length === 1 && res.actions[0].type === 'SEEK_VIDEO' && res.actions[0].route.includes('?seek=');
    }

    console.log(`   -> Result: ${ok ? "✅ PASS" : "❌ FAIL"}\n`);
    if (ok) passed++;
  }

  // Dọn dẹp
  await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);

  console.log("==========================================================================");
  console.log(`📋 KẾT QUẢ ZERO REGRESSION TEST: ${passed}/${testCases.length} (${((passed/testCases.length)*100).toFixed(1)}%) PASS`);
  console.log("==========================================================================\n");

  process.exit(passed === testCases.length ? 0 : 1);
}

runRegressionSuite().catch(err => {
  console.error("❌ Lỗi Regression Test:", err);
  process.exit(1);
});
