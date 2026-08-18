require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');

(async () => {
  try {
    const u = 5;
    await db.query('DELETE FROM ai_chat WHERE student_id = $1', [u]);
    await chatbotService.saveHistory(u, 14, 'question', 'Đây là bài học bạn cần.', [{ lessonId: 14 }], [{ type: 'OPEN_LESSON' }]);
    const raw = await db.query('SELECT * FROM ai_chat WHERE student_id = $1 ORDER BY ai_chat ASC', [u]);
    console.log('Raw DB rows:', raw.rows);
    const h = await chatbotService.getHistory(u, 14);
    console.log('Returned history length:', h.length);
    console.log('First item:', h[0]);
    console.log('Second item:', h[1]);
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
})();
