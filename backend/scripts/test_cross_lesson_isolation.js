require('dotenv').config();
const db = require('../src/config/database');
const { getRecentConversationHistory, contextualizeQuery } = require('../src/modules/chatbot/services/queryRewriter.service');

async function runTest() {
  console.log('='.repeat(60));
  console.log('KIEM TRA CO LAP LICH SU HOI THOAI THEO TUNG BAI HOC (LESSON ISOLATION)');
  console.log('='.repeat(60));

  let testUserId;
  const lessonA = 14;
  const lessonB = 15;

  try {
    const uRes = await db.query('SELECT user_id FROM users LIMIT 1');
    if (uRes.rows.length === 0) throw new Error('No users found in database');
    testUserId = uRes.rows[0].user_id;

    // Don dep chat test truoc
    await db.query('DELETE FROM ai_chat WHERE student_id = $1 AND title LIKE \'%[TEST_ISOLATION]%\'', [testUserId]);

    console.log(`\n[Buoc 1] Them tin nhan chat o Bai A (lesson_id = ${lessonA}) cho user_id = ${testUserId}`);
    await db.query(`
      INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
      VALUES ($1, $2, '[TEST_ISOLATION] Phuong phap nghe thu dong Passive Listening la gi?', 'user', NOW() - INTERVAL '2 minutes'),
             ($1, $2, '[TEST_ISOLATION] Nghe thu dong la phuong phap tiep xuc voi tieng Anh...', 'bot', NOW() - INTERVAL '1 minutes')
    `, [testUserId, lessonA]);

    console.log(`\n[Buoc 2] Chuyen sang Bai B (lesson_id = ${lessonB}) trong cung khoa hoc va lay lich su hoi thoai:`);
    const historyLessonB = await getRecentConversationHistory(testUserId, lessonB, 6);
    console.log(' -> So tin nhan lay duoc cho Bai B:', historyLessonB.length);
    const testItemsInB = historyLessonB.filter(h => h.content && h.content.includes('[TEST_ISOLATION]'));

    if (testItemsInB.length === 0) {
      console.log('  [PASS] LICH SU BAI B HOAN TOAN KHONG DINH TIN NHAN CUA BAI A!');
    } else {
      console.error('  [FAIL] Lich su Bai B bi ro ri du lieu tu Bai A:', testItemsInB);
      throw new Error('Leakage detected!');
    }

    console.log(`\n[Buoc 3] Kiem tra lai lich su hoi thoai khi o Bai A (lesson_id = ${lessonA}):`);
    const historyLessonA = await getRecentConversationHistory(testUserId, lessonA, 6);
    const testItemsInA = historyLessonA.filter(h => h.content && h.content.includes('[TEST_ISOLATION]'));
    console.log(' -> So tin nhan test lay duoc cho Bai A:', testItemsInA.length);
    if (testItemsInA.length === 2) {
      console.log('  [PASS] Lich su Bai A lay dung 2 tin nhan cua Bai A.');
    } else {
      console.error('  [FAIL] Lich su Bai A khong lay dung du lieu:', testItemsInA);
      throw new Error('Lesson A history retrieval mismatch');
    }

    console.log('\n[Buoc 4] O Bai B, hoi cau hoi generic: "giai thich cau truc nay giup toi"');
    const rewriteRes = await contextualizeQuery('giai thich cau truc nay giup toi', null, {
      userId: testUserId,
      lessonId: lessonB
    });
    console.log(' -> Ket qua rewrite:', JSON.stringify(rewriteRes));
    
    const isLeaked = (rewriteRes.retrievalQuery || '').toLowerCase().includes('passive listening') || (rewriteRes.retrievalQuery || '').toLowerCase().includes('nghe thu dong');
    if (!isLeaked) {
      console.log('  [PASS] retrievalQuery KHONG bi anh huong boi chu de cua Bai A!');
    } else {
      console.error('  [FAIL] retrievalQuery bi dinh chu de cua Bai A:', rewriteRes.retrievalQuery);
      throw new Error('Query rewrite leakage detected');
    }

    console.log('\n' + '='.repeat(60));
    console.log('TAT CA CAC BUOC KIEM THU CO LAP BAI HOC DA PASS 100%!');
    console.log('='.repeat(60));

  } finally {
    if (testUserId) {
      await db.query('DELETE FROM ai_chat WHERE student_id = $1 AND title LIKE \'%[TEST_ISOLATION]%\'', [testUserId]);
    }
    await db.pool.end();
  }
}

runTest().catch((err) => {
  console.error('Loi kiem thu:', err.message);
  process.exit(1);
});
