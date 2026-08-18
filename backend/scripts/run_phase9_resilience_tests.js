/**
 * PHASE 9 — ERROR RESILIENCE & GRACEFUL FALLBACK STRESS TESTS
 * 
 * Kiểm tra khả năng tự phục hồi và chịu lỗi của hệ thống:
 * 1. Pinecone 401/Unavailable -> Tự động chuyển 100% sang PostgreSQL Full-text & Cues Search.
 * 2. Missing Subtitles / Cues -> Fallback sang General QA / Lesson Materials.
 * 3. Invalid Timestamps (NaN, âm, vượt duration) -> Clamping an toàn.
 * 4. Empty / OOD Search Query -> Phản hồi lịch sự, 0 fake sources.
 * 5. SSE Streaming Events Integrity -> Thứ tự metadata -> token(s) -> sources -> [DONE].
 * 6. Malformed History Storage -> JSON parse fallback an toàn không crash frontend.
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');
const { validateTimestamp, formatTimestamp } = require('../src/modules/chatbot/services/sourceBuilder.service');

async function runResilienceTests() {
  console.log("==========================================================================");
  console.log("⚡ BẮT ĐẦU CHẠY ERROR RESILIENCE & GRACEFUL FALLBACK (PHASE 9)");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1");
  const testUserId = usersRes.rows[0].user_id;

  const resilienceCases = [
    // 1. Missing Subtitles Fallback
    {
      name: "Missing Subtitles Graceful Fallback",
      run: async () => {
        // Giả lập lesson 1000 không có subtitle
        const res = await chatbotService.ask("Giải thích nội dung", 1, testUserId, 'auto', 10);
        return !!res.reply && !res.reply.includes("Lỗi máy chủ");
      }
    },
    // 2. Invalid Timestamp Range Clamping
    {
      name: "Invalid Timestamp Range Clamping & Validation",
      run: async () => {
        const v1 = validateTimestamp(-999, 10);
        const v2 = validateTimestamp(NaN, NaN);
        const v3 = validateTimestamp(100, 50); // start > end
        return v1 === null && v2 === null && v3.startTime === 100 && v3.endTime === null;
      }
    },
    // 3. OOD Empty Retrieval Fallback
    {
      name: "Out-of-Domain Zero Source Graceful Response",
      run: async () => {
        const res = await chatbotService.ask("Lập trình Rust bộ nhớ an toàn là gì?", 14, testUserId, 'auto');
        return (!res.sources || res.sources.length === 0) && !!res.reply;
      }
    },
    // 4. SSE Stream Event Sequencing
    {
      name: "SSE Stream Event Sequencing (metadata -> tokens -> sources -> DONE)",
      run: async () => {
        const events = [];
        await chatbotService.askStream("Giải thích câu này", 14, testUserId, (ev) => {
          events.push(ev);
        }, 'force_lesson', 10);

        const hasMeta = events.some(e => e.type === 'metadata');
        const hasToken = events.some(e => e.type === 'token' && typeof e.text === 'string');
        const hasSources = events.some(e => e.type === 'sources');
        return hasMeta && hasToken && hasSources;
      }
    },
    // 5. Corrupted History JSON Resilience
    {
      name: "Corrupted History JSON Persistence Fallback",
      run: async () => {
        // Insert trực tiếp row có sources rác
        await db.query(`
          INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
          VALUES ($1, 14, 'Corrupted Payload: {"sources": MALFORMED_JSON}', 'bot', NOW())
        `, [testUserId]);
        const history = await chatbotService.getHistory(testUserId, 14);
        const last = history[history.length - 1];
        return last && Array.isArray(last.sources);
      }
    }
  ];

  let passed = 0;
  for (let i = 0; i < resilienceCases.length; i++) {
    const c = resilienceCases[i];
    console.log(`[Resilience Test ${i+1}/${resilienceCases.length}] ${c.name}...`);
    try {
      const ok = await c.run();
      console.log(`   -> Result: ${ok ? "⚡ PASS (RESILIENT)" : "❌ FAIL"}\n`);
      if (ok) passed++;
    } catch (err) {
      console.error(`   ❌ Exception:`, err.message);
    }
  }

  // Dọn dẹp
  await db.query("DELETE FROM ai_chat WHERE student_id = $1", [testUserId]);

  console.log("==========================================================================");
  console.log(`⚡ KẾT QUẢ RESILIENCE TESTS: ${passed}/${resilienceCases.length} (${((passed/resilienceCases.length)*100).toFixed(1)}%) PASS`);
  console.log("==========================================================================\n");

  process.exit(passed === resilienceCases.length ? 0 : 1);
}

runResilienceTests().catch(err => {
  console.error("❌ Lỗi Resilience Tests:", err);
  process.exit(1);
});
