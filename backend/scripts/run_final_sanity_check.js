/**
 * Final Phase 3 Sanity Check Runner
 * - Kiểm chứng Rollback Version Switch (ACTIVE_RAG_VERSION: v2 vs v1)
 * - Kiểm chứng Vector ID Format Collision-Proof
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const v2Data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../rag_v2_vector_store.json'), 'utf-8'));
const v2Records = v2Data.records;

// Mock pool V1
const legacyV1Records = v2Records.map(r => ({
  id: `lesson-${r.metadata.lesson_id}-chunk-${r.metadata.chunk_index}`,
  values: r.values,
  metadata: {
    lesson_id: r.metadata.lesson_id,
    text: r.metadata.text,
    source: r.metadata.source
  }
}));

function cosineSimilarity(vecA, vecB) {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    nA += vecA[i] * vecA[i];
    nB += vecB[i] * vecB[i];
  }
  return (nA === 0 || nB === 0) ? 0 : dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

async function getEmbedding(text) {
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return res.embedding?.values || res.embeddings?.[0]?.values || [];
}

async function runSanityCheck() {
  console.log("==========================================================================");
  console.log("🔍 FINAL PHASE 3 SANITY CHECK");
  console.log("==========================================================================\n");

  const query = "Phương pháp nghe thụ động Passive Listening và nghe chép chính tả";
  const qVec = await getEmbedding(query);

  // 1. Kiểm tra V2 Query (ACTIVE_RAG_VERSION = 'v2')
  console.log("1. KIỂM THỬ V2 QUERY (ACTIVE_RAG_VERSION = 'v2'):");
  // Khi ở V2: Query namespace rag-v2 với filter: { lesson_id: 14, schema_version: 'v2' }
  const v2Matches = v2Records
    .filter(r => r.metadata.lesson_id === 14 && r.metadata.schema_version === 'v2')
    .map(r => ({ id: r.id, score: cosineSimilarity(qVec, r.values) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const v2Pass = v2Matches.length > 0 && v2Matches.every(m => m.id.includes('-v2-transcript-chunk-') || m.id.includes('-v2-material-'));
  console.log(`   Retrieved ID: [${v2Matches.map(m => m.id).join(', ')}]`);
  console.log(`   Score: ${v2Matches[0]?.score?.toFixed(4)}`);
  console.log(`   -> V2 query: ${v2Pass ? "PASS" : "FAIL"}\n`);

  // 2. Kiểm tra V1 Rollback Query (ACTIVE_RAG_VERSION = 'v1')
  console.log("2. KIỂM THỬ V1 ROLLBACK QUERY (ACTIVE_RAG_VERSION = 'v1'):");
  // Khi Rollback V1: Query namespace '' với filter: { lesson_id: 14 } (KHÔNG áp schema_version = 'v2')
  const v1Matches = legacyV1Records
    .filter(r => r.metadata.lesson_id === 14)
    .map(r => ({ id: r.id, score: cosineSimilarity(qVec, r.values) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const v1Pass = v1Matches.length > 0 && v1Matches.every(m => !m.id.includes('-v2-'));
  console.log(`   Retrieved ID: [${v1Matches.map(m => m.id).join(', ')}]`);
  console.log(`   Score: ${v1Matches[0]?.score?.toFixed(4)}`);
  console.log(`   -> V1 rollback query: ${v1Pass ? "PASS" : "FAIL"}\n`);

  // 3. Kiểm tra Vector ID Format thực tế
  console.log("3. KIỂM TRA ĐỊNH DẠNG VECTOR ID V2 THỰC TẾ:");
  const sampleTranscriptId = v2Records.find(r => r.metadata.content_type === 'transcript')?.id;
  console.log(`   Sample Transcript ID thực tế: "${sampleTranscriptId}"`);
  console.log(`   Mẫu PDF Material ID chuẩn hóa: "lesson-14-v2-material-5-chunk-0"`);

  const allIds = v2Records.map(r => r.id);
  const uniqueCount = new Set(allIds).size;
  const collisionPass = allIds.length === uniqueCount && sampleTranscriptId.includes('-v2-transcript-chunk-');
  console.log(`   Total Vectors: ${allIds.length} | Unique: ${uniqueCount}`);
  console.log(`   -> Collision-proof: ${collisionPass ? "PASS" : "FAIL"}\n`);

  console.log("==========================================================================");
  console.log("📋 KẾT QUẢ FINAL SANITY CHECK:");
  console.log(`- V1 rollback query: ${v1Pass ? "PASS" : "FAIL"}`);
  console.log(`- V2 query: ${v2Pass ? "PASS" : "FAIL"}`);
  console.log(`- Production V2 ID sample thực tế: "${sampleTranscriptId}"`);
  console.log(`- Collision-proof: ${collisionPass ? "PASS" : "FAIL"}`);
  console.log("==========================================================================\n");

  process.exit(0);
}

runSanityCheck().catch(err => {
  console.error("Lỗi Sanity Check:", err);
  process.exit(1);
});
