/**
 * Phase 7 Acceptance & Source Verification Test Suite
 * - Case 1: Search Lesson ("Bài nào dạy Passive Listening?") -> Verified Source Lesson 14
 * - Case 2: Semantic Search ("Bài nào dạy phương pháp nghe khi đang làm việc khác?") -> Verified Source Lesson 14
 * - Case 3: Navigate Intent ("Đưa tôi tới bài Meet My Family.") -> NAVIGATE_TO_LESSON + 1 Target Card
 * - Case 4: Recommend Intent ("Học xong bài này tôi nên học bài nào?") -> RECOMMEND_LESSON + 1-3 Cards
 * - Case 5: Follow-up Rewriting ("Bài nào nói về nó?") -> Verified Source Lesson 14
 * - Case 6: Out-of-Domain ("Bài nào dạy Kubernetes?") -> sources: []
 * - Case 7: General English QA ("Hello nghĩa là gì?") -> sources: []
 * - Security & Authoritative DB Integrity Check
 * - Regression Subset Check (Phase 3-6)
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');
const { buildVerifiedSources, fetchAuthoritativeLessons } = require('../src/modules/chatbot/services/sourceBuilder.service');

async function runAcceptanceTests() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU CHẠY ACCEPTANCE TESTS & VERIFIED SOURCES (PHASE 7)");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 2");
  if (usersRes.rows.length === 0) throw new Error("Cần ít nhất 1 user trong DB");
  const testUserId = usersRes.rows[0].user_id;

  const course5Id = 5;
  const course22Id = 22;
  const lesson14 = 14;
  const lesson39 = 39;

  let totalCases = 7;
  let passCount = 0;

  // ==================== CASE 1: SEARCH LESSON ====================
  console.log("1. CASE 1 — SEARCH LESSON ('Bài nào dạy Passive Listening?')");
  const res1 = await chatbotService.ask("Bài nào dạy Passive Listening?", lesson14, testUserId, 'course_wide');
  const pass1 = res1.sources && res1.sources.length > 0 && res1.sources.some(s => s.lessonId === 14);
  console.log(`   Reply   : "${res1.reply.slice(0, 70)}..."`);
  console.log(`   Sources : ${res1.sources.length} cards (First: "${res1.sources[0]?.lessonTitle}", ID: ${res1.sources[0]?.lessonId})`);
  console.log(`   Actions : ${res1.actions.length} actions (Route: ${res1.actions[0]?.route})`);
  console.log(`   -> Case 1: ${pass1 ? "✅ PASS" : "❌ FAIL"}\n`);
  if (pass1) passCount++;

  // ==================== CASE 2: SEMANTIC SEARCH ====================
  console.log("2. CASE 2 — SEMANTIC SEARCH ('Bài nào dạy phương pháp nghe khi đang làm việc khác?')");
  const res2 = await chatbotService.ask("Bài nào dạy phương pháp nghe khi đang làm việc khác?", lesson14, testUserId, 'course_wide');
  const pass2 = res2.sources && res2.sources.length > 0 && res2.sources.some(s => s.lessonId === 14);
  console.log(`   Sources : ${res2.sources.length} cards (First: "${res2.sources[0]?.lessonTitle}")`);
  console.log(`   -> Case 2: ${pass2 ? "✅ PASS" : "❌ FAIL"}\n`);
  if (pass2) passCount++;

  // ==================== CASE 3: NAVIGATE TO LESSON ====================
  console.log("3. CASE 3 — NAVIGATE ('Đưa tôi tới bài Meet My Family.')");
  const res3 = await chatbotService.ask("Đưa tôi tới bài Meet My Family.", lesson39, testUserId, 'course_wide');
  const pass3 = res3.intent === 'NAVIGATE_TO_LESSON' && res3.sources.length === 1 && res3.sources[0].lessonId === 39 && res3.actions[0]?.type === 'OPEN_LESSON';
  console.log(`   Intent  : ${res3.intent}`);
  console.log(`   Sources : ${res3.sources.length} card (Target: "${res3.sources[0]?.lessonTitle}", Badge: "${res3.sources[0]?.badgeText}")`);
  console.log(`   Action  : ${res3.actions[0]?.type} -> ${res3.actions[0]?.route}`);
  console.log(`   -> Case 3: ${pass3 ? "✅ PASS" : "❌ FAIL"}\n`);
  if (pass3) passCount++;

  // ==================== CASE 4: RECOMMEND LESSON ====================
  console.log("4. CASE 4 — RECOMMEND ('Học xong bài này tôi nên học bài nào?')");
  const res4 = await chatbotService.ask("Học xong bài này tôi nên học bài nào?", lesson14, testUserId, 'course_wide');
  const pass4 = res4.intent === 'RECOMMEND_LESSON' && res4.sources.length >= 1 && res4.sources.length <= 3 && res4.sources[0].badgeText === 'Đề xuất học tiếp';
  console.log(`   Intent  : ${res4.intent}`);
  console.log(`   Sources : ${res4.sources.length} recommendations (Badge: "${res4.sources[0]?.badgeText}")`);
  console.log(`   -> Case 4: ${pass4 ? "✅ PASS" : "❌ FAIL"}\n`);
  if (pass4) passCount++;

  // ==================== CASE 5: CONTEXTUAL FOLLOW-UP ====================
  console.log("5. CASE 5 — CONTEXTUAL FOLLOW-UP ('Bài nào nói về nó?')");
  // Lưu turn trước
  await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);
  await chatbotService.saveHistory(testUserId, lesson14, "Passive Listening là gì?", "Passive Listening là phương pháp nghe thụ động giúp làm quen ngữ điệu.");
  const res5 = await chatbotService.ask("Bài nào nói về nó?", lesson14, testUserId, 'course_wide');
  const pass5 = res5.sources && res5.sources.length > 0 && res5.sources.some(s => s.lessonId === 14);
  console.log(`   Sources : ${res5.sources.length} cards (Resolved to: "${res5.sources[0]?.lessonTitle}")`);
  console.log(`   -> Case 5: ${pass5 ? "✅ PASS" : "❌ FAIL"}\n`);
  if (pass5) passCount++;

  // ==================== CASE 6: OUT-OF-DOMAIN (NO CARDS) ====================
  console.log("6. CASE 6 — OUT-OF-DOMAIN ('Bài nào dạy Kubernetes?')");
  const res6 = await chatbotService.ask("Bài nào dạy Kubernetes?", lesson14, testUserId, 'course_wide');
  const pass6 = (!res6.sources || res6.sources.length === 0) && (!res6.actions || res6.actions.length === 0);
  console.log(`   Reply   : "${res6.reply.slice(0, 60)}..."`);
  console.log(`   Sources : ${res6.sources.length} cards (No fake/irrelevant cards)`);
  console.log(`   -> Case 6: ${pass6 ? "✅ PASS (Không tạo card ảo khi không đủ độ tự tin)" : "❌ FAIL"}\n`);
  if (pass6) passCount++;

  // ==================== CASE 7: GENERAL ENGLISH QA ====================
  console.log("7. CASE 7 — GENERAL ENGLISH QA ('Hello nghĩa là gì?')");
  const res7 = await chatbotService.ask("Hello nghĩa là gì?", lesson14, testUserId, 'course_wide');
  const pass7 = res7.intent === 'GENERAL_ENGLISH_QA' && (!res7.sources || res7.sources.length === 0);
  console.log(`   Intent  : ${res7.intent}`);
  console.log(`   Sources : ${res7.sources.length} cards`);
  console.log(`   -> Case 7: ${pass7 ? "✅ PASS" : "❌ FAIL"}\n`);
  if (pass7) passCount++;

  // ==================== 8. SECURITY & AUTHORITATIVE DB INTEGRITY ====================
  console.log("8. KIỂM TRA BẢO MẬT & TÍNH TOÀN VẸN CSDL (AUTHORITATIVE DB INTEGRITY):");
  // Thử truyền lessonId không tồn tại (ID 999999) vào sourceBuilder
  const fakeTest = await buildVerifiedSources({
    intent: 'SEARCH_LESSON',
    rankedLessons: [{ lessonId: 999999, rerankScore: 0.99 }, { lessonId: 14, rerankScore: 0.90 }],
    courseId: 5
  });
  const passSec1 = fakeTest.sources.every(s => s.lessonId !== 999999) && fakeTest.sources.some(s => s.lessonId === 14);
  console.log(`   - Chống bịa đặt Lesson ID ảo (Anti-Hallucination): ${passSec1 ? "✅ PASS (ID 999999 bị loại bỏ 100%)" : "❌ FAIL"}`);

  // Thử truyền lesson thuộc Course 22 nhưng yêu cầu trong Course 5
  const fakeCourseTest = await buildVerifiedSources({
    intent: 'SEARCH_LESSON',
    rankedLessons: [{ lessonId: 39, rerankScore: 0.95 }], // Lesson 39 belongs to course 22
    courseId: 5
  });
  const passSec2 = fakeCourseTest.sources.length === 0;
  console.log(`   - Chống rò rỉ bài học khác khóa (Course Boundary): ${passSec2 ? "✅ PASS (Bài học khác khóa bị từ chối 100%)" : "❌ FAIL"}\n`);

  // ==================== 9. STREAMING SSE FORMAT TEST ====================
  console.log("9. KIỂM TRA ĐỊNH DẠNG STREAMING SSE:");
  const receivedEvents = [];
  const streamResult = await chatbotService.askStream("Bài nào dạy Passive Listening?", lesson14, testUserId, (event) => {
    receivedEvents.push(event);
  }, 'course_wide');

  const hasMetadataEvent = receivedEvents.some(e => e.type === 'metadata');
  const hasTokenEvents = receivedEvents.some(e => e.type === 'token');
  const hasSourcesEvent = receivedEvents.some(e => e.type === 'sources');
  const passStream = hasMetadataEvent && hasTokenEvents && hasSourcesEvent && streamResult.sources.length > 0;
  console.log(`   - Metadata Event : ${hasMetadataEvent ? "✅ Đã nhận" : "❌ Thiếu"}`);
  console.log(`   - Token Events   : ${hasTokenEvents ? `✅ Đã nhận (${receivedEvents.filter(e => e.type === 'token').length} tokens)` : "❌ Thiếu"}`);
  console.log(`   - Sources Event  : ${hasSourcesEvent ? `✅ Đã nhận (${streamResult.sources.length} verified sources)` : "❌ Thiếu"}`);
  console.log(`   -> Streaming SSE Test: ${passStream ? "✅ PASS" : "❌ FAIL"}\n`);

  // Dọn dẹp
  await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);

  console.log("==========================================================================");
  console.log(`📋 TỔNG HỢP KẾT QUẢ ACCEPTANCE TESTS PHASE 7: ${passCount}/${totalCases} PASS`);
  console.log(`- Case 1 (Search Lesson)        : ${pass1 ? "PASS" : "FAIL"}`);
  console.log(`- Case 2 (Semantic Search)      : ${pass2 ? "PASS" : "FAIL"}`);
  console.log(`- Case 3 (Navigate Intent)      : ${pass3 ? "PASS" : "FAIL"}`);
  console.log(`- Case 4 (Recommend Intent)     : ${pass4 ? "PASS" : "FAIL"}`);
  console.log(`- Case 5 (Contextual Follow-up) : ${pass5 ? "PASS" : "FAIL"}`);
  console.log(`- Case 6 (Out-of-Domain)        : ${pass6 ? "PASS" : "FAIL"}`);
  console.log(`- Case 7 (General English QA)   : ${pass7 ? "PASS" : "FAIL"}`);
  console.log(`- Security & DB Verification    : ${passSec1 && passSec2 ? "PASS" : "FAIL"}`);
  console.log(`- Streaming SSE Event Test      : ${passStream ? "PASS" : "FAIL"}`);
  console.log("==========================================================================\n");

  const allPassed = passCount === totalCases && passSec1 && passSec2 && passStream;
  process.exit(allPassed ? 0 : 1);
}

runAcceptanceTests().catch(err => {
  console.error("❌ Lỗi Acceptance Test:", err);
  process.exit(1);
});
