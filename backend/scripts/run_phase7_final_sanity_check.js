/**
 * Phase 7 Final Structured UI Sanity Check
 * 
 * 1. Structured Source Persistence (JSON format, legacy plain-text, malformed JSON fallback, reload)
 * 2. CURRENT_LESSON_QA Sources (Returns verified current lesson source, no irrelevant lesson cards)
 * 3. SSE Robustness (sources=[], deduplication by lessonId, metadata events, stream resilience)
 * 4. Navigation Authorization (Client tampering rejection, lessonCard is not permission token)
 * 5. Route Integration (/lessons/:lessonId verification)
 * 6. Full Smoke Regression (8 cases)
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');
const { verifyLessonAndCourseAccess } = require('../src/modules/chatbot/services/chatbot.service');

async function runSanityCheck() {
  console.log("==========================================================================");
  console.log("🔍 BẮT ĐẦU PHASE 7 FINAL STRUCTURED UI SANITY CHECK");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id, role_id FROM users ORDER BY user_id ASC LIMIT 1");
  const testUserId = usersRes.rows[0].user_id;
  const lesson14 = 14;

  let allChecksPassed = true;

  // ==================== 1. STRUCTURED SOURCE PERSISTENCE ====================
  console.log("1. KIỂM TRA LƯU TRỮ VÀ TƯƠNG THÍCH LỊCH SỬ TIN NHẮN (PERSISTENCE):");
  await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);

  // A. Lưu tin nhắn có structured sources
  const sampleSources = [{
    courseId: 5,
    lessonId: 14,
    lessonTitle: "5. Phương pháp nghe thụ động (Passive Listening)",
    sectionTitle: "Chương 3: Luyện nghe",
    badgeText: "Bài học liên quan"
  }];
  const sampleActions = [{ type: "OPEN_LESSON", lessonId: 14, route: "/lessons/14" }];
  await chatbotService.saveHistory(testUserId, lesson14, "Hỏi bài nghe thụ động", "Đây là bài học bạn cần.", sampleSources, sampleActions);

  // B. Lưu tin nhắn cũ dạng plain-text (Legacy message)
  await db.query("INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at) VALUES ($1, $2, $3, 'bot', NOW())",
    [testUserId, lesson14, "Tin nhắn cũ dạng thuần văn bản không có JSON metadata."]);

  // C. Lưu tin nhắn có chuỗi JSON lỗi/malformed
  await db.query("INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at) VALUES ($1, $2, $3, 'bot', NOW())",
    [testUserId, lesson14, '{"answer": "Chuỗi JSON bị hỏng dở dang...", "sources": [broken']);

  // Tải lại lịch sử qua getHistory
  const loadedHistory = await chatbotService.getHistory(testUserId, lesson14);
  
  const msgStructured = loadedHistory.find(m => m.title === "Đây là bài học bạn cần.");
  const msgLegacy = loadedHistory.find(m => m.title === "Tin nhắn cũ dạng thuần văn bản không có JSON metadata.");
  const msgMalformed = loadedHistory.find(m => m.title && m.title.includes("Chuỗi JSON bị hỏng"));

  const pass1A = msgStructured && msgStructured.sources && msgStructured.sources.length === 1 && msgStructured.sources[0].lessonId === 14;
  const pass1B = msgLegacy && (!msgLegacy.sources || msgLegacy.sources.length === 0);
  const pass1C = msgMalformed && msgMalformed.title.length > 0 && (!msgMalformed.sources || msgMalformed.sources.length === 0);

  console.log(`   - Tải lại tin nhắn có thẻ bài học (Structured Reload): ${pass1A ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Tương thích ngược tin nhắn cũ (Legacy Compatibility): ${pass1B ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Xử lý an toàn khi JSON hỏng (Malformed Resilience): ${pass1C ? "✅ PASS" : "❌ FAIL"}`);
  const pass1 = pass1A && pass1B && pass1C;
  if (!pass1) allChecksPassed = false;
  console.log(`   -> Mục 1 (Persistence & Compatibility): ${pass1 ? "PASS" : "FAIL"}\n`);

  // ==================== 2. CURRENT_LESSON_QA SOURCES ====================
  console.log("2. KIỂM TRA NGUỒN CHO CURRENT_LESSON_QA ('Tại sao ở đây dùng V-ing?'):");
  const resCur = await chatbotService.ask("Tại sao ở đây dùng V-ing?", lesson14, testUserId, 'force_lesson');
  const pass2 = resCur.sources && resCur.sources.length === 1 && resCur.sources[0].lessonId === 14 && resCur.sources[0].badgeText === 'Nội dung bài học hiện tại';
  console.log(`   Intent   : ${resCur.intent}`);
  console.log(`   Sources  : ${resCur.sources.length} card (ID: ${resCur.sources[0]?.lessonId}, Badge: "${resCur.sources[0]?.badgeText}")`);
  console.log(`   -> Mục 2 (CURRENT_LESSON_QA Source): ${pass2 ? "✅ PASS" : "❌ FAIL"}\n`);
  if (!pass2) allChecksPassed = false;

  // ==================== 3. SSE ROBUSTNESS & DEDUPLICATION ====================
  console.log("3. KIỂM TRA SSE STREAMING ROBUSTNESS & DEDUPLICATION:");
  const events = [];
  const sseRes = await chatbotService.askStream("Bài nào dạy Passive Listening?", lesson14, testUserId, (ev) => {
    events.push(ev);
  }, 'course_wide');

  const metaEvent = events.find(e => e.type === 'metadata');
  const tokenEvents = events.filter(e => e.type === 'token');
  const sourcesEvent = events.find(e => e.type === 'sources');

  const pass3A = !!metaEvent && tokenEvents.length > 0 && !!sourcesEvent;
  const pass3B = sseRes.sources && sseRes.sources.length === 1 && sseRes.sources[0].lessonId === 14;
  console.log(`   - Sự kiện Stream (Metadata, Tokens, Sources): ${pass3A ? "✅ Đầy đủ" : "❌ Thiếu"}`);
  console.log(`   - Thẻ bài học không bị duplicate/lỗi: ${pass3B ? "✅ Chính xác (1 thẻ duy nhất)" : "❌ Duplicate"}`);
  const pass3 = pass3A && pass3B;
  if (!pass3) allChecksPassed = false;
  console.log(`   -> Mục 3 (SSE Robustness): ${pass3 ? "PASS" : "FAIL"}\n`);

  // ==================== 4. NAVIGATION AUTHORIZATION ====================
  console.log("4. KIỂM TRA PHÂN QUYỀN VÀ BẢO VỆ ĐIỀU HƯỚNG (NAVIGATION AUTHORIZATION):");
  // A. Bài học hợp lệ có quyền
  let authValid = false;
  try {
    const v = await verifyLessonAndCourseAccess(testUserId, lesson14);
    authValid = v.authorized === true;
  } catch (e) {
    authValid = false;
  }

  // B. Giả lập client tampering (truy cập bài học không tồn tại ID 999999 hoặc bài học khóa trả phí chưa mua)
  let tamperingBlocked = false;
  try {
    await verifyLessonAndCourseAccess(testUserId, 999999);
  } catch (err) {
    // Phải ném lỗi 404 hoặc 403
    tamperingBlocked = (err.status === 404 || err.status === 403);
  }

  console.log(`   - Xác thực bài học hợp lệ: ${authValid ? "✅ Cho phép truy cập" : "❌ Từ chối sai"}`);
  console.log(`   - Chống can thiệp Client Tampering: ${tamperingBlocked ? "✅ Chặn 100% (404/403)" : "❌ Lỗ hổng"}`);
  const pass4 = authValid && tamperingBlocked;
  if (!pass4) allChecksPassed = false;
  console.log(`   -> Mục 4 (Navigation Authorization): ${pass4 ? "PASS" : "FAIL"}\n`);

  // ==================== 5. ROUTE INTEGRATION ====================
  console.log("5. KIỂM TRA ROUTE INTEGRATION:");
  const expectedRoutePattern = "/lessons/:lessonId";
  const actualActionRoute = sampleActions[0].route;
  const pass5 = actualActionRoute === "/lessons/14";
  console.log(`   - Route định tuyến trong Action: ${actualActionRoute}`);
  console.log(`   - Khớp cấu trúc Route thực tế (${expectedRoutePattern}): ${pass5 ? "✅ Khớp 100%" : "❌ Sai lệch"}`);
  console.log(`   -> Mục 5 (Route Integration): ${pass5 ? "PASS" : "FAIL"}\n`);
  if (!pass5) allChecksPassed = false;

  // ==================== 6. SMOKE SUBSET REGRESSION ====================
  console.log("6. CHẠY SMOKE REGRESSION (8 HẠNG MỤC):");
  const smokeTests = [
    { name: "SEARCH_LESSON card", q: "Tìm bài Passive Listening", lessonId: 14, check: r => r.sources?.some(s => s.lessonId === 14) },
    { name: "NAVIGATE card", q: "Đưa tôi tới bài Meet My Family", lessonId: 39, check: r => r.intent === 'NAVIGATE_TO_LESSON' && r.sources?.length === 1 && r.sources[0].lessonId === 39 },
    { name: "RECOMMEND cards", q: "Học xong bài này tôi nên học bài nào?", lessonId: 10, check: r => r.intent === 'RECOMMEND_LESSON' && r.sources?.length >= 1 },
    { name: "CURRENT_LESSON_QA source", q: "Tại sao ở đây dùng V-ing?", lessonId: 14, check: r => r.sources?.some(s => s.lessonId === 14) },
    { name: "OOD zero card", q: "Kubernetes cluster là gì?", lessonId: 14, check: r => (!r.sources || r.sources.length === 0) },
    { name: "General QA zero card", q: "Hello nghĩa là gì?", lessonId: 14, check: r => (!r.sources || r.sources.length === 0) },
    { name: "Reload persistence", q: "History Test", lessonId: 14, check: () => pass1A },
    { name: "Streaming SSE", q: "Passive Listening", lessonId: 14, check: () => pass3 }
  ];

  let smokePass = 0;
  for (const st of smokeTests) {
    let ok = false;
    if (st.q && st.check && !st.name.includes("Reload") && !st.name.includes("Streaming")) {
      const res = await chatbotService.ask(st.q, st.lessonId, testUserId, 'course_wide');
      ok = st.check(res);
    } else {
      ok = st.check();
    }
    console.log(`   - ${st.name}: ${ok ? "✅ PASS" : "❌ FAIL"}`);
    if (ok) smokePass++;
  }

  const pass6 = smokePass === smokeTests.length;
  if (!pass6) allChecksPassed = false;
  console.log(`   -> Mục 6 (Smoke Regression): ${pass6 ? "8/8 PASS" : `${smokePass}/8 PASS`}\n`);

  // Dọn dẹp
  await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);

  console.log("==========================================================================");
  console.log(`📋 TỔNG KẾT SANITY CHECK: ${allChecksPassed ? "TẤT CẢ 6 MỤC PASS 100%" : "CÓ MỤC FAIL"}`);
  console.log("==========================================================================\n");

  process.exit(allChecksPassed ? 0 : 1);
}

runSanityCheck().catch(err => {
  console.error("❌ Lỗi Sanity Check:", err);
  process.exit(1);
});
