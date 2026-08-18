/**
 * Phase 5 Final Conversation Scope Patch Evaluation Runner
 * - Scenario A/B: Cross-Course Contamination Test (Course A vs Course B)
 * - Scenario C: Same-Course Cross-Lesson Continuity (Course A Lesson 11 -> Course A Lesson 14)
 * - Scenario D: Global Chatbot Contamination Test (Global chatbot vs Course A)
 * - Scenario E: Security Ownership Check
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const { contextualizeQuery, getRecentConversationHistory } = require('../src/modules/chatbot/services/queryRewriter.service');

async function runScopePatchEval() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU KIỂM THỬ CONVERSATION SCOPE & CROSS-COURSE ISOLATION (PHASE 5)");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 2");
  if (usersRes.rows.length < 2) throw new Error("Cần ít nhất 2 user");
  const testUserId = usersRes.rows[0].user_id;
  const otherUserId = usersRes.rows[1].user_id;

  const courseA = 5;
  const lessonA1 = 11; // In Course 5
  const lessonA2 = 14; // In Course 5

  const courseB = 22;
  const lessonB1 = 35; // In Course 22

  try {
    // 1. Dọn dẹp
    await db.query("DELETE FROM ai_chat WHERE student_id IN ($1, $2)", [testUserId, otherUserId]);

    // 2. Nạp tin nhắn tại Course A (Lesson 11)
    console.log("--- BƯỚC 1: Học viên chat tại Course A (Lesson 11) ---");
    await db.query(`
      INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
      VALUES ($1, $2, 'Present Continuous là gì?', 'user', NOW() - INTERVAL '2 minutes'),
             ($1, $2, 'Thì Hiện Tại Tiếp Diễn chỉ hành động đang diễn ra.', 'bot', NOW() - INTERVAL '1 minute')
    `, [testUserId, lessonA1]);
    console.log("   Đã lưu tin nhắn về 'Present Continuous' tại Course A (Lesson 11).\n");

    // ==================== SCENARIO 1: SAME-COURSE CROSS-LESSON ====================
    console.log("1. SCENARIO 1: Same-Course Cross-Lesson (Lesson 11 -> Lesson 14 trong cùng Course A)");
    const resSameCourse = await contextualizeQuery("Cái đó giải thích thế nào?", null, {
      userId: testUserId,
      lessonId: lessonA2,
      courseId: courseA
    });
    console.log(`   Query: "Cái đó giải thích thế nào?" -> Retrieval: "${resSameCourse.retrievalQuery}" (${resSameCourse.method})`);
    const passSameCourse = resSameCourse.rewritten && (
      resSameCourse.retrievalQuery.toLowerCase().includes("present continuous") ||
      resSameCourse.retrievalQuery.toLowerCase().includes("hiện tại tiếp diễn")
    );
    console.log(`   -> Same-Course Cross-Lesson: ${passSameCourse ? "✅ PASS" : "❌ FAIL"}\n`);

    // ==================== SCENARIO 2: CROSS-COURSE CONTAMINATION ====================
    console.log("2. SCENARIO 2: Cross-Course Contamination Test (Chuyển sang Course B Lesson 35 trong < 30 phút)");
    const resCrossCourse = await contextualizeQuery("Cái đó là gì?", null, {
      userId: testUserId,
      lessonId: lessonB1,
      courseId: courseB
    });
    console.log(`   In Course B, Query: "Cái đó là gì?" -> Retrieval: "${resCrossCourse.retrievalQuery}" (${resCrossCourse.method})`);
    // Phải KHÔNG lấy 'Present Continuous' từ Course A
    const passCrossCourse = !resCrossCourse.retrievalQuery.toLowerCase().includes("present continuous") &&
                            !resCrossCourse.retrievalQuery.toLowerCase().includes("hiện tại tiếp diễn");
    console.log(`   -> Cross-Course Contamination: ${passCrossCourse ? "✅ PASS (Không bị ô nhiễm ngữ cảnh giữa 2 khóa học khác nhau)" : "❌ FAIL"}\n`);

    // ==================== SCENARIO 3: GLOBAL CHATBOT CONTAMINATION ====================
    console.log("3. SCENARIO 3: Global Chatbot Contamination Test (Vào Chatbot toàn cục sau khi chat Course A)");
    const resGlobal = await contextualizeQuery("Nó là gì?", null, {
      userId: testUserId,
      lessonId: null,
      courseId: null
    });
    console.log(`   In Global Chatbot, Query: "Nó là gì?" -> Retrieval: "${resGlobal.retrievalQuery}" (${resGlobal.method})`);
    const passGlobal = !resGlobal.retrievalQuery.toLowerCase().includes("present continuous") &&
                       !resGlobal.retrievalQuery.toLowerCase().includes("hiện tại tiếp diễn");
    console.log(`   -> Global Contamination: ${passGlobal ? "✅ PASS (Chatbot toàn cục không bị dính ngữ cảnh từ khóa học)" : "❌ FAIL"}\n`);

    // ==================== SCENARIO 4: SECURITY OWNERSHIP ====================
    console.log("4. SCENARIO 4: Security Ownership Check (User B truy vấn trong Course A)");
    const historyUserB = await getRecentConversationHistory(otherUserId, lessonA1, 6, { courseId: courseA });
    console.log(`   User B accessed Course A history count: ${historyUserB.length} messages`);
    const passSecurity = historyUserB.length === 0;
    console.log(`   -> Security Ownership: ${passSecurity ? "✅ PASS (User B bị cách ly 100%)" : "❌ FAIL"}\n`);

    // Dọn dẹp
    await db.query("DELETE FROM ai_chat WHERE student_id IN ($1, $2)", [testUserId, otherUserId]);

    console.log("==========================================================================");
    console.log("📋 TỔNG KẾT CONVERSATION SCOPE PATCH:");
    console.log(`- Same-course cross-lesson: ${passSameCourse ? "PASS" : "FAIL"}`);
    console.log(`- Cross-course contamination: ${passCrossCourse ? "PASS" : "FAIL"}`);
    console.log(`- Global contamination: ${passGlobal ? "PASS" : "FAIL"}`);
    console.log(`- Security ownership: ${passSecurity ? "PASS" : "FAIL"}`);
    console.log("==========================================================================\n");

    const allPass = passSameCourse && passCrossCourse && passGlobal && passSecurity;
    process.exit(allPass ? 0 : 1);
  } catch (err) {
    console.error("Lỗi Scope Patch Eval:", err);
    await db.query("DELETE FROM ai_chat WHERE student_id IN ($1, $2)", [testUserId, otherUserId]).catch(() => {});
    process.exit(1);
  }
}

runScopePatchEval();
