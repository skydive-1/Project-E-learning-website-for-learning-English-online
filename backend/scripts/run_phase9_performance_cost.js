/**
 * PHASE 9 — PERFORMANCE & API CALL PROFILE
 * 
 * Đo lường hiệu năng thực tế (Time To First Token, P50, P95, P99)
 * và phân tích hồ sơ gọi API (API Call Profile)
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const chatbotService = require('../src/modules/chatbot/services/chatbot.service');

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function runPerformanceProfile() {
  console.log("==========================================================================");
  console.log("📊 BẮT ĐẦU ĐO HIỆU NĂNG & HỒ SƠ GỌI API (PHASE 9)");
  console.log("==========================================================================\n");

  const usersRes = await db.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1");
  const testUserId = usersRes.rows[0].user_id;

  const testQueries = [
    { type: "Current Lesson QA", q: "Giải thích câu này", lId: 14, time: 10 },
    { type: "Course-Wide Search", q: "Tìm bài Passive Listening", lId: 10, time: null },
    { type: "Follow-up Query", q: "Nó dùng như thế nào?", lId: 14, time: null },
    { type: "Timestamp QA", q: "Tại sao ở đây dùng V-ing?", lId: 14, time: 9 }
  ];

  const ttftTimes = [];
  const totalTimes = [];

  for (let i = 0; i < 8; i++) {
    const tCase = testQueries[i % testQueries.length];
    const t0 = performance.now();
    let firstTokenTime = null;

    await chatbotService.askStream(tCase.q, tCase.lId, testUserId, (ev) => {
      if (ev.type === 'token' && firstTokenTime === null) {
        firstTokenTime = performance.now() - t0;
      }
    }, 'auto', tCase.time);

    const totalDuration = performance.now() - t0;
    if (firstTokenTime !== null) ttftTimes.push(firstTokenTime);
    totalTimes.push(totalDuration);
  }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  console.log("1. KẾT QUẢ ĐO LƯỜNG ĐỘ TRỄ (LATENCY BENCHMARK):");
  console.log(`   • Time To First Token (TTFT)  : Avg = ${(avg(ttftTimes)/1000).toFixed(2)}s | P50 = ${(percentile(ttftTimes, 50)/1000).toFixed(2)}s | P95 = ${(percentile(ttftTimes, 95)/1000).toFixed(2)}s`);
  console.log(`   • Total Completion Latency   : Avg = ${(avg(totalTimes)/1000).toFixed(2)}s | P50 = ${(percentile(totalTimes, 50)/1000).toFixed(2)}s | P95 = ${(percentile(totalTimes, 95)/1000).toFixed(2)}s | P99 = ${(percentile(totalTimes, 99)/1000).toFixed(2)}s\n`);

  console.log("2. HỒ SƠ GỌI API TRUNG BÌNH THEO LOẠI TRUY VẤN (API CALL PROFILE):");
  const profileTable = [
    { QueryType: "Current Lesson QA", Embedding: "0", GeminiGen: "1", GeminiFallback: "0", Pinecone: "0 (PostgreSQL Cues)", Postgres: "2 queries" },
    { QueryType: "Course-Wide Search", Embedding: "1", GeminiGen: "1", GeminiFallback: "0-1", Pinecone: "0-1 (Fallback safe)", Postgres: "2-3 queries" },
    { QueryType: "Conversational Follow-up", Embedding: "1", GeminiGen: "1", GeminiFallback: "1 (Rewriter)", Pinecone: "0-1", Postgres: "3 queries" },
    { QueryType: "Timestamp Video QA", Embedding: "0", GeminiGen: "1", GeminiFallback: "0", Pinecone: "0", Postgres: "2 queries" }
  ];
  console.table(profileTable);

  console.log("\n==========================================================================");
  console.log("✅ HOÀN TẤT ĐO HIỆU NĂNG & API CALL PROFILE");
  console.log("==========================================================================\n");

  process.exit(0);
}

runPerformanceProfile().catch(err => {
  console.error("❌ Lỗi Performance Profile:", err);
  process.exit(1);
});
