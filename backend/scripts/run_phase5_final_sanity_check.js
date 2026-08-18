/**
 * Phase 5 Final Conversation Memory Sanity Check Runner
 * - Test A: Same lesson follow-up -> Context preserved
 * - Test B: Cross-Lesson follow-up (Lesson A -> Lesson B in active session) -> Context preserved
 * - Test C: Stale History Protection (>30 mins) -> Old referent ignored
 * - Test D: Ambiguous pronoun without history -> Safe fallback, no hallucination
 * - Test E: User Ownership Security (Zero Trust Isolation) -> User B cannot access User A history
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const { contextualizeQuery, getRecentConversationHistory } = require('../src/modules/chatbot/services/queryRewriter.service');

async function runSanityCheck() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU SMOKE TEST PHASE 5 FINAL MEMORY SANITY CHECK");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 2");
  if (usersRes.rows.length < 2) {
    throw new Error("Cần ít nhất 2 user trong CSDL để test security");
  }
  const testUserId = usersRes.rows[0].user_id;
  const otherUserId = usersRes.rows[1].user_id;
  const lessonA = 11;
  const lessonB = 14;

  try {
    // Dọn dẹp dữ liệu test cũ nếu có
    await db.query("DELETE FROM ai_chat WHERE student_id IN ($1, $2)", [testUserId, otherUserId]);

    // ==================== TEST A: SAME LESSON FOLLOW-UP ====================
    console.log("1. TEST A: Same Lesson Follow-up");
    await db.query(`
      INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
      VALUES ($1, $2, 'Present Continuous là gì?', 'user', NOW() - INTERVAL '2 minutes'),
             ($1, $2, 'Thì hiện tại tiếp diễn chỉ hành động đang diễn ra.', 'bot', NOW() - INTERVAL '1 minute')
    `, [testUserId, lessonA]);

    const resA = await contextualizeQuery("Bài nào nói về nó?", null, { userId: testUserId, lessonId: lessonA });
    console.log(`   Query: "Bài nào nói về nó?" -> Retrieval: "${resA.retrievalQuery}" (${resA.method})`);
    const passA = resA.rewritten && resA.retrievalQuery.toLowerCase().includes("present continuous");
    console.log(`   -> Test A: ${passA ? "✅ PASS" : "❌ FAIL"}\n`);

    // ==================== TEST B: CROSS-LESSON CONTINUITY ====================
    console.log("2. TEST B: Cross-Lesson Continuity (Lesson A -> Lesson B in same active session)");
    // User chuyển sang lessonB và hỏi follow-up
    const resB = await contextualizeQuery("Cái đó giải thích như thế nào?", null, { userId: testUserId, lessonId: lessonB });
    console.log(`   In Lesson B, Query: "Cái đó giải thích như thế nào?" -> Retrieval: "${resB.retrievalQuery}" (${resB.method})`);
    const passB = resB.rewritten && (resB.retrievalQuery.toLowerCase().includes("present continuous") || resB.retrievalQuery.toLowerCase().includes("hiện tại tiếp diễn"));
    console.log(`   -> Test B: ${passB ? "✅ PASS (Ngữ cảnh phiên học được duy trì xuyên suốt khi đổi bài)" : "❌ FAIL"}\n`);

    // ==================== TEST C: STALE HISTORY PROTECTION ====================
    console.log("3. TEST C: Stale History Protection (Phiên học cũ cách đây 2 tiếng)");
    await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);
    await db.query(`
      INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
      VALUES ($1, $2, 'Khái niệm Passive Listening', 'user', NOW() - INTERVAL '120 minutes'),
             ($1, $2, 'Nghe thụ động kết hợp chép chính tả', 'bot', NOW() - INTERVAL '119 minutes')
    `, [testUserId, lessonA]);

    const resC = await contextualizeQuery("Bài đó học ở đâu?", null, { userId: testUserId, lessonId: lessonA });
    console.log(`   Stale History Query: "Bài đó học ở đâu?" -> Retrieval: "${resC.retrievalQuery}" (${resC.method})`);
    const passC = !resC.rewritten || resC.method === 'no_history_bypass' || resC.retrievalQuery === "Bài đó học ở đâu?";
    console.log(`   -> Test C: ${passC ? "✅ PASS (Không sử dụng ngữ cảnh cũ quá 30 phút)" : "❌ FAIL"}\n`);

    // ==================== TEST D: AMBIGUOUS PRONOUN WITHOUT HISTORY ====================
    console.log("4. TEST D: Ambiguous Pronoun Without History (Anti-Hallucination)");
    await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);
    const resD = await contextualizeQuery("Nó nằm ở bài nào?", [], { userId: testUserId, lessonId: lessonA });
    console.log(`   No History Query: "Nó nằm ở bài nào?" -> Retrieval: "${resD.retrievalQuery}" (${resD.method})`);
    const passD = resD.retrievalQuery === "Nó nằm ở bài nào?" && !resD.rewritten;
    console.log(`   -> Test D: ${passD ? "✅ PASS (Tuyệt đối không tự suy diễn thực thể khi thiếu lịch sử)" : "❌ FAIL"}\n`);

    // ==================== TEST E: USER OWNERSHIP SECURITY ====================
    console.log("5. TEST E: User Ownership Security (Zero Trust Isolation)");
    // Tạo tin nhắn cho User A
    await db.query(`
      INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
      VALUES ($1, $2, 'Bí mật của User A: Talking About Yourself', 'user', NOW() - INTERVAL '1 minute')
    `, [testUserId, lessonA]);

    // User B truy vấn lịch sử
    const historyUserB = await getRecentConversationHistory(otherUserId, lessonA, 6);
    console.log(`   User B accessed history count: ${historyUserB.length} records`);
    const passE = historyUserB.length === 0;
    console.log(`   -> Test E: ${passE ? "✅ PASS (User B hoàn toàn không thấy tin nhắn của User A)" : "❌ FAIL"}\n`);

    // Dọn dẹp
    await db.query("DELETE FROM ai_chat WHERE student_id IN ($1, $2)", [testUserId, otherUserId]);

    console.log("==========================================================================");
    console.log("📋 TỔNG HỢP KẾT QUẢ SMOKE TEST PHASE 5:");
    console.log(`- Test A (Same lesson follow-up): ${passA ? "PASS" : "FAIL"}`);
    console.log(`- Test B (Cross-lesson continuity): ${passB ? "PASS" : "FAIL"}`);
    console.log(`- Test C (Stale history protection): ${passC ? "PASS" : "FAIL"}`);
    console.log(`- Test D (Anti-hallucination): ${passD ? "PASS" : "FAIL"}`);
    console.log(`- Test E (User ownership security): ${passE ? "PASS" : "FAIL"}`);
    console.log("==========================================================================\n");

    const allPass = passA && passB && passC && passD && passE;
    process.exit(allPass ? 0 : 1);
  } catch (err) {
    console.error("Lỗi Sanity Check:", err);
    await db.query("DELETE FROM ai_chat WHERE student_id IN ($1, $2)", [testUserId, otherUserId]).catch(() => {});
    process.exit(1);
  }
}

runSanityCheck();
