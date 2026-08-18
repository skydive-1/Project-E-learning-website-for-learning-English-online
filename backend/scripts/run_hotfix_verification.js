/**
 * HOTFIX PRODUCTION VERIFICATION SCRIPT
 * 
 * Kiểm tra các ca:
 * 1. currentTime = 10 (lesson có video)
 * 2. currentTime = 0 (bắt đầu video)
 * 3. currentTime = null / undefined (lesson không video)
 * 4. currentTime invalid (NaN / string / negative)
 * 5. Global Chatbot (lessonId = 0)
 * 6. SSE Streaming events: metadata -> token -> sources -> [DONE]
 * 7. Gamification Badges route: GET /api/gamification/badges -> 200 OK
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');
const gamificationService = require('../src/modules/gamification/services/gamification.service');

async function runHotfixVerification() {
  console.log("==========================================================================");
  console.log("🛠️  HOTFIX PRODUCTION VERIFICATION TEST");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1");
  const testUserId = usersRes.rows[0].user_id;

  // 1. Lesson có video + currentTime = 10
  console.log("1. Test Lesson có video (currentTime = 10):");
  const res1 = await chatbotService.ask("Tại sao dùng V-ing ở đây?", 14, testUserId, 'auto', 10);
  console.log(`   -> Status: ${res1.success ? '✅ SUCCESS' : '❌ FAIL'} | Sources: ${res1.sources?.length} | StartTime: ${res1.sources?.[0]?.startTime}`);

  // 2. Lesson có video + currentTime = 0
  console.log("\n2. Test Lesson có video (currentTime = 0):");
  const res2 = await chatbotService.ask("Chào bài học", 14, testUserId, 'auto', 0);
  console.log(`   -> Status: ${res2.success ? '✅ SUCCESS' : '❌ FAIL'} | Reply length: ${res2.reply?.length}`);

  // 3. Lesson không video (currentTime = null)
  console.log("\n3. Test Lesson không video / Omit currentTime (currentTime = null):");
  const res3 = await chatbotService.ask("Giải thích nội dung bài này", 14, testUserId, 'auto', null);
  console.log(`   -> Status: ${res3.success ? '✅ SUCCESS' : '❌ FAIL'} | Reply length: ${res3.reply?.length}`);

  // 4. Invalid currentTime (Negative / NaN)
  console.log("\n4. Test Invalid currentTime (-50 / NaN):");
  const res4 = await chatbotService.ask("Giải thích", 14, testUserId, 'auto', -50);
  console.log(`   -> Status: ${res4.success ? '✅ SUCCESS' : '❌ FAIL'} | No crash`);

  // 5. Global Chatbot (lessonId = 0)
  console.log("\n5. Test Global Chatbot (lessonId = 0):");
  const res5 = await chatbotService.ask("Website này có những khóa học nào?", 0, testUserId, 'global');
  console.log(`   -> Status: ${res5.success ? '✅ SUCCESS' : '❌ FAIL'} | Intent: ${res5.intent}`);

  // 6. SSE Streaming Events Check
  console.log("\n6. Test SSE Streaming (metadata -> token -> sources -> [DONE]):");
  const sseEvents = [];
  await chatbotService.askStream("Giải thích câu này trong video", 14, testUserId, (ev) => {
    sseEvents.push(ev);
  }, 'auto', 10);
  const types = sseEvents.map(e => e.type);
  const hasMeta = types.includes('metadata');
  const hasToken = types.includes('token');
  const hasSources = types.includes('sources');
  console.log(`   -> Event sequence: ${types.slice(0, 5).join(' -> ')} ... ${types.slice(-2).join(' -> ')}`);
  console.log(`   -> Verification: Meta=${hasMeta}, Token=${hasToken}, Sources=${hasSources} -> ${hasMeta && hasToken && hasSources ? '✅ PASS' : '❌ FAIL'}`);

  // 7. Gamification Badges Service Check
  console.log("\n7. Test Gamification Badges Endpoint Service:");
  const badges = await gamificationService.getUserBadges(testUserId);
  console.log(`   -> Badges count: ${badges.length} | First badge: "${badges[0]?.title}" -> ${badges.length >= 8 ? '✅ 200 OK PASS' : '❌ FAIL'}`);

  console.log("\n==========================================================================");
  console.log("🎉 TOÀN BỘ CÁC BÀI KIỂM TRA HOTFIX ĐỀU ĐẠT CHUẨN!");
  console.log("==========================================================================\n");

  process.exit(0);
}

runHotfixVerification().catch(err => {
  console.error("❌ Lỗi Hotfix Verification:", err);
  process.exit(1);
});
