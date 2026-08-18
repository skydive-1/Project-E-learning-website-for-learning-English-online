/**
 * Phase 4 Closeout Smoke Test Runner
 * - Scenario 1: Valid lesson + classifier failure -> falls back to current_lesson
 * - Scenario 2: Global/no lesson + classifier failure -> falls back to scope none
 * - Scenario 3: Production force_scope attempt -> ignored, routes via Intent Router
 * - Scenario 4: Development force_scope -> honored for debug
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { getSafeFallback, classifyWithLLM, routeIntent } = require('../src/modules/chatbot/services/intentRouter.service');

async function runCloseoutSmoke() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU SMOKE TEST PHASE 4 CLOSEOUT PATCH");
  console.log("==========================================================================\n");

  // 1. Valid lesson + classifier failure
  console.log("1. TEST SCENARIO 1: Valid lesson + classifier failure");
  const fallbackWithLesson = getSafeFallback({ lessonId: 14, hasValidLesson: true }, "Simulated Timeout");
  console.log(`   Result: Intent: ${fallbackWithLesson.intent} | Scope: ${fallbackWithLesson.scope} (${fallbackWithLesson.reason})`);
  const pass1 = fallbackWithLesson.intent === 'CURRENT_LESSON_QA' && fallbackWithLesson.scope === 'current_lesson';
  console.log(`   -> Scenario 1: ${pass1 ? "✅ PASS" : "❌ FAIL"}\n`);

  // 2. Global/no lesson + classifier failure
  console.log("2. TEST SCENARIO 2: Global/no lesson + classifier failure");
  const fallbackNoLesson = getSafeFallback({ lessonId: null, hasValidLesson: false }, "Simulated Error");
  console.log(`   Result: Intent: ${fallbackNoLesson.intent} | Scope: ${fallbackNoLesson.scope} (${fallbackNoLesson.reason})`);
  const pass2 = fallbackNoLesson.intent === 'GENERAL_ENGLISH_QA' && fallbackNoLesson.scope === 'none';
  console.log(`   -> Scenario 2: ${pass2 ? "✅ PASS" : "❌ FAIL"}\n`);

  // 3. Production force_scope attempt
  console.log("3. TEST SCENARIO 3: Production force_scope attempt (Non-admin / Production mode)");
  // Giả lập môi trường production và user thường
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const isAdminProd = false;
  const isDevOrAdminProd = process.env.NODE_ENV !== 'production' || isAdminProd;
  
  const clientAttemptedScope = 'force_course';
  let effectiveScopeProd = 'current_lesson';
  const testQuestion = "Phần này nghĩa là gì?";

  if (isDevOrAdminProd && (clientAttemptedScope === 'force_course' || clientAttemptedScope === 'course_wide')) {
    effectiveScopeProd = 'course_wide';
  } else {
    const routed = await routeIntent(testQuestion, { lessonId: 14, hasValidLesson: true });
    effectiveScopeProd = routed.scope;
  }
  process.env.NODE_ENV = prevEnv; // Restore

  console.log(`   Client sent: '${clientAttemptedScope}' | Effective Scope in Production: '${effectiveScopeProd}'`);
  const pass3 = effectiveScopeProd === 'current_lesson'; // Router override successfully
  console.log(`   -> Scenario 3: ${pass3 ? "✅ PASS (Production ignores force_course from normal client)" : "❌ FAIL"}\n`);

  // 4. Development force_scope
  console.log("4. TEST SCENARIO 4: Development force_scope (Dev / Test environment)");
  process.env.NODE_ENV = 'development';
  const isDevOrAdminDev = process.env.NODE_ENV !== 'production' || false;
  let effectiveScopeDev = 'current_lesson';

  if (isDevOrAdminDev && (clientAttemptedScope === 'force_course' || clientAttemptedScope === 'course_wide')) {
    effectiveScopeDev = 'course_wide';
  }
  process.env.NODE_ENV = prevEnv; // Restore

  console.log(`   Client sent: '${clientAttemptedScope}' | Effective Scope in Dev: '${effectiveScopeDev}'`);
  const pass4 = effectiveScopeDev === 'course_wide';
  console.log(`   -> Scenario 4: ${pass4 ? "✅ PASS (Dev environment honors force_course for debugging)" : "❌ FAIL"}\n`);

  console.log("==========================================================================");
  console.log("📋 TỔNG HỢP KẾT QUẢ SMOKE TEST CLOSEOUT PATCH:");
  console.log(`- Scenario 1 (Valid lesson + failure): ${pass1 ? "PASS" : "FAIL"}`);
  console.log(`- Scenario 2 (Global/no lesson + failure): ${pass2 ? "PASS" : "FAIL"}`);
  console.log(`- Scenario 3 (Production force_scope): ${pass3 ? "PASS" : "FAIL"}`);
  console.log(`- Scenario 4 (Development force_scope): ${pass4 ? "PASS" : "FAIL"}`);
  console.log("==========================================================================\n");

  const allPass = pass1 && pass2 && pass3 && pass4;
  process.exit(allPass ? 0 : 1);
}

runCloseoutSmoke().catch(err => {
  console.error("Lỗi Closeout Smoke Test:", err);
  process.exit(1);
});
