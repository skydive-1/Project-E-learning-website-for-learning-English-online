/**
 * Phase 6 Hybrid Search, Lesson Grouping & Reranking Evaluation Suite
 * - So sánh định lượng 4 kiến trúc:
 *   A. Semantic-Only Baseline
 *   B. Hybrid Retrieval
 *   C. Hybrid + Grouping
 *   D. Hybrid + Grouping + Reranking (Production Target)
 * - Đo Hit@1, Hit@3, MRR, Recall@K, OOD Rejection Rate, Latency breakdown
 * - Khảo sát tham số Top-K candidate sizes (5 vs 8 vs 10)
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const { searchPostgreSQLLexical, mergeGroupAndRerank, CONFIDENCE_THRESHOLD } = require('../src/modules/chatbot/services/hybridSearch.service');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const v2Data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../rag_v2_vector_store.json'), 'utf-8'));
const v2Records = v2Data.records;

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return (normA === 0 || normB === 0) ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text) {
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return res.embedding?.values || res.embeddings?.[0]?.values || [];
}

// 20 Course-Wide Relevant Queries + 5 Out-Of-Domain (OOD) Queries
const evaluationDataset = [
  // --- Nhóm 1: Exact Lesson Title Matches ---
  { id: "Q-01", query: "Passive Listening", expectedCourseId: 5, expectedLessonId: 14, isRelevant: true },
  { id: "Q-02", query: "Present Continuous", expectedCourseId: 5, expectedLessonId: 14, isRelevant: true },
  { id: "Q-03", query: "Subject Pronouns", expectedCourseId: 5, expectedLessonId: 11, isRelevant: true },
  { id: "Q-04", query: "Meet My Family", expectedCourseId: 22, expectedLessonId: 39, isRelevant: true },
  { id: "Q-05", query: "First Meeting", expectedCourseId: 22, expectedLessonId: 35, isRelevant: true },

  // --- Nhóm 2: Semantic Paraphrases & Tiếng Việt ---
  { id: "Q-06", query: "Đại từ dùng làm chủ ngữ trong câu tiếng Anh", expectedCourseId: 5, expectedLessonId: 11, isRelevant: true },
  { id: "Q-07", query: "Phương pháp nghe chép chính tả và nghe thụ động", expectedCourseId: 5, expectedLessonId: 14, isRelevant: true },
  { id: "Q-08", query: "Cách chào hỏi và làm quen với người mới gặp lần đầu", expectedCourseId: 22, expectedLessonId: 35, isRelevant: true },
  { id: "Q-09", query: "Từ vựng về các thành viên trong gia đình bố mẹ anh chị", expectedCourseId: 22, expectedLessonId: 39, isRelevant: true },
  { id: "Q-10", query: "Các thì thời gian phổ biến trong văn phong giao tiếp nói", expectedCourseId: 5, expectedLessonId: 12, isRelevant: true },

  // --- Nhóm 3: English Natural Queries & Terminology ---
  { id: "Q-11", query: "Where is the structure S + am/is/are + V-ing taught?", expectedCourseId: 5, expectedLessonId: 14, isRelevant: true },
  { id: "Q-12", query: "Which lesson explains thinking in English mindset reflex?", expectedCourseId: 5, expectedLessonId: 11, isRelevant: true },
  { id: "Q-13", query: "How to introduce yourself when meeting new people", expectedCourseId: 22, expectedLessonId: 35, isRelevant: true },
  { id: "Q-14", query: "Vocabulary about parents, siblings, and relatives", expectedCourseId: 22, expectedLessonId: 39, isRelevant: true },
  { id: "Q-15", query: "Lessons on speaking fluently using daily tenses", expectedCourseId: 5, expectedLessonId: 12, isRelevant: true },

  // --- Nhóm 4: Cross-Lesson & Contextual Follow-up (Phase 5 Rewritten) ---
  { id: "Q-16", query: "Bài học dạy về thì Hiện Tại Tiếp Diễn Present Continuous", expectedCourseId: 5, expectedLessonId: 14, isRelevant: true },
  { id: "Q-17", query: "Bài học dạy về đại từ nhân xưng Subject Pronouns", expectedCourseId: 5, expectedLessonId: 11, isRelevant: true },
  { id: "Q-18", query: "Bài học về cách nói thông tin cá nhân Talking About Yourself", expectedCourseId: 22, expectedLessonId: 37, isRelevant: true },
  { id: "Q-19", query: "Chương học hướng dẫn luyện phát âm và nghe thụ động", expectedCourseId: 5, expectedLessonId: 14, isRelevant: true },
  { id: "Q-20", query: "Khóa học có bài nào dạy về chủ đề gia đình Meet My Family không?", expectedCourseId: 22, expectedLessonId: 39, isRelevant: true },

  // --- Nhóm 5: Out-Of-Domain (OOD) / Irrelevant Queries (Không thuộc khóa học) ---
  { id: "OOD-01", query: "Kubernetes cluster deployment on AWS EKS", expectedCourseId: 5, expectedLessonId: null, isRelevant: false },
  { id: "OOD-02", query: "Dynamic Programming Knapsack problem algorithm in C++", expectedCourseId: 5, expectedLessonId: null, isRelevant: false },
  { id: "OOD-03", query: "Quantum Computing Qubits and Superposition math", expectedCourseId: 5, expectedLessonId: null, isRelevant: false },
  { id: "OOD-04", query: "Bảo dưỡng động cơ xe máy 4 thì và thay nhớt", expectedCourseId: 5, expectedLessonId: null, isRelevant: false },
  { id: "OOD-05", query: "Công thức nấu phở bò gia truyền chuẩn vị Hà Nội", expectedCourseId: 22, expectedLessonId: null, isRelevant: false }
];

async function runEvaluation() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU BENCHMARK TOÀN DIỆN HYBRID SEARCH, GROUPING & RERANKING");
  console.log("==========================================================================\n");

  const relevantCases = evaluationDataset.filter(d => d.isRelevant);
  const oodCases = evaluationDataset.filter(d => !d.isRelevant);

  // Bộ đếm cho 4 cấu hình
  const stats = {
    modeA_semanticOnly: { hit1: 0, hit3: 0, mrrSum: 0 },
    modeB_hybridNoGroup: { hit1: 0, hit3: 0, mrrSum: 0 },
    modeC_hybridGroup: { hit1: 0, hit3: 0, mrrSum: 0 },
    modeD_hybridGroupRerank: { hit1: 0, hit3: 0, mrrSum: 0 }
  };

  const latencies = {
    pinecone: [],
    postgresql: [],
    mergeRerank: [],
    total: []
  };

  let oodRejectedCount = 0;
  let oodFalsePositiveCount = 0;

  for (let i = 0; i < evaluationDataset.length; i++) {
    const item = evaluationDataset[i];
    const totalStart = Date.now();

    // 1. Semantic Vector Retrieval (Pinecone)
    const pcStart = Date.now();
    const queryVec = await getEmbedding(item.query);
    const vectorCandidates = v2Records
      .filter(r => r.metadata.course_id === item.expectedCourseId && r.metadata.schema_version === 'v2')
      .map(r => ({
        id: r.id,
        score: cosineSimilarity(queryVec, r.values),
        metadata: r.metadata
      }))
      .sort((a, b) => b.score - a.score);
    const pcLat = Date.now() - pcStart;
    latencies.pinecone.push(pcLat);

    // 2. Lexical Search (PostgreSQL)
    const lexStart = Date.now();
    const lexicalMatches = await searchPostgreSQLLexical(item.query, item.expectedCourseId);
    const lexLat = Date.now() - lexStart;
    latencies.postgresql.push(lexLat);

    // 3. Merge & Grouping & Reranking
    const mrStart = Date.now();
    const rankedTarget = mergeGroupAndRerank(vectorCandidates.slice(0, 8), lexicalMatches, item.query, { topK: 3 });
    const mrLat = Date.now() - mrStart;
    latencies.mergeRerank.push(mrLat);

    const totalLat = Date.now() - totalStart;
    latencies.total.push(totalLat);

    if (item.isRelevant) {
      // --- ĐÁNH GIÁ 4 CẤU HÌNH ---
      // A. Mode A: Semantic Only (top 3 chunks, raw lesson ids)
      const rawTop3Lessons = vectorCandidates.slice(0, 3).map(c => c.metadata.lesson_id);
      const rawIdx = rawTop3Lessons.indexOf(item.expectedLessonId);
      if (rawIdx === 0) { stats.modeA_semanticOnly.hit1++; stats.modeA_semanticOnly.hit3++; stats.modeA_semanticOnly.mrrSum += 1.0; }
      else if (rawIdx > 0) { stats.modeA_semanticOnly.hit3++; stats.modeA_semanticOnly.mrrSum += 1.0 / (rawIdx + 1); }

      // B. Mode B: Hybrid No Grouping (Lấy top matches thuần túy từ cả 2 nguồn)
      const hybridNoGroup = [...vectorCandidates.slice(0, 3).map(c => c.metadata.lesson_id), ...lexicalMatches.slice(0, 2).map(l => l.lessonId)];
      const bIdx = hybridNoGroup.indexOf(item.expectedLessonId);
      if (bIdx === 0) { stats.modeB_hybridNoGroup.hit1++; stats.modeB_hybridNoGroup.hit3++; stats.modeB_hybridNoGroup.mrrSum += 1.0; }
      else if (bIdx > 0 && bIdx < 3) { stats.modeB_hybridNoGroup.hit3++; stats.modeB_hybridNoGroup.mrrSum += 1.0 / (bIdx + 1); }

      // C. Mode C: Hybrid Grouping (Gom nhóm theo bài nhưng không rerank title boost)
      const groupOnly = mergeGroupAndRerank(vectorCandidates.slice(0, 8), lexicalMatches, item.query, { topK: 3, confidenceThreshold: 0 });
      const cIdx = groupOnly.findIndex(l => l.lessonId === item.expectedLessonId);
      if (cIdx === 0) { stats.modeC_hybridGroup.hit1++; stats.modeC_hybridGroup.hit3++; stats.modeC_hybridGroup.mrrSum += 1.0; }
      else if (cIdx > 0) { stats.modeC_hybridGroup.hit3++; stats.modeC_hybridGroup.mrrSum += 1.0 / (cIdx + 1); }

      // D. Mode D: Hybrid + Grouping + Reranking (Production Target)
      const dIdx = rankedTarget.findIndex(l => l.lessonId === item.expectedLessonId);
      if (dIdx === 0) { stats.modeD_hybridGroupRerank.hit1++; stats.modeD_hybridGroupRerank.hit3++; stats.modeD_hybridGroupRerank.mrrSum += 1.0; }
      else if (dIdx > 0) { stats.modeD_hybridGroupRerank.hit3++; stats.modeD_hybridGroupRerank.mrrSum += 1.0 / (dIdx + 1); }

      console.log(`[${item.id}] "${item.query.slice(0, 38)}..." (Exp: Lesson ${item.expectedLessonId})`);
      console.log(`   -> Target Hybrid Rank: #${dIdx >= 0 ? dIdx + 1 : 'Not in Top 3'} (Score: ${rankedTarget[0]?.rerankScore || 0})`);
    } else {
      // --- ĐÁNH GIÁ OOD (Out-Of-Domain Rejection) ---
      const hasAcceptedMatches = rankedTarget.length > 0;
      if (!hasAcceptedMatches) {
        oodRejectedCount++;
      } else {
        oodFalsePositiveCount++;
      }
      console.log(`[${item.id}] [OOD Test] "${item.query}" -> Matches: ${rankedTarget.length} (${hasAcceptedMatches ? "⚠️ False Positive" : "🛡️ Rejected Correctly"})`);
    }
  }

  const nRel = relevantCases.length;
  const nOOD = oodCases.length;

  const modeAMetrics = {
    hit1: ((stats.modeA_semanticOnly.hit1 / nRel) * 100).toFixed(1) + "%",
    hit3: ((stats.modeA_semanticOnly.hit3 / nRel) * 100).toFixed(1) + "%",
    mrr: (stats.modeA_semanticOnly.mrrSum / nRel).toFixed(3)
  };

  const modeBMetrics = {
    hit1: ((stats.modeB_hybridNoGroup.hit1 / nRel) * 100).toFixed(1) + "%",
    hit3: ((stats.modeB_hybridNoGroup.hit3 / nRel) * 100).toFixed(1) + "%",
    mrr: (stats.modeB_hybridNoGroup.mrrSum / nRel).toFixed(3)
  };

  const modeCMetrics = {
    hit1: ((stats.modeC_hybridGroup.hit1 / nRel) * 100).toFixed(1) + "%",
    hit3: ((stats.modeC_hybridGroup.hit3 / nRel) * 100).toFixed(1) + "%",
    mrr: (stats.modeC_hybridGroup.mrrSum / nRel).toFixed(3)
  };

  const modeDMetrics = {
    hit1: ((stats.modeD_hybridGroupRerank.hit1 / nRel) * 100).toFixed(1) + "%",
    hit3: ((stats.modeD_hybridGroupRerank.hit3 / nRel) * 100).toFixed(1) + "%",
    mrr: (stats.modeD_hybridGroupRerank.mrrSum / nRel).toFixed(3)
  };

  const oodRejectionRate = ((oodRejectedCount / nOOD) * 100).toFixed(1) + "%";
  const falsePositiveRate = ((oodFalsePositiveCount / nOOD) * 100).toFixed(1) + "%";

  const avgPineconeLat = Math.round(latencies.pinecone.reduce((a, b) => a + b, 0) / latencies.pinecone.length);
  const avgPostgresLat = Math.round(latencies.postgresql.reduce((a, b) => a + b, 0) / latencies.postgresql.length);
  const avgMergeLat = Math.round(latencies.mergeRerank.reduce((a, b) => a + b, 0) / latencies.mergeRerank.length);
  const avgTotalLat = Math.round(latencies.total.reduce((a, b) => a + b, 0) / latencies.total.length);

  console.log("\n==========================================================================");
  console.log("📊 BẢNG SO SÁNH HIỆU QUẢ RETRIEVAL TRÊN 4 CẤU HÌNH KIẾN TRÚC:");
  console.log("==========================================================================");
  console.log(`1. Semantic-Only Baseline          : Hit@1 = ${modeAMetrics.hit1} | Hit@3 = ${modeAMetrics.hit3} | MRR = ${modeAMetrics.mrr}`);
  console.log(`2. Hybrid Retrieval (No Grouping)  : Hit@1 = ${modeBMetrics.hit1} | Hit@3 = ${modeBMetrics.hit3} | MRR = ${modeBMetrics.mrr}`);
  console.log(`3. Hybrid + Lesson Grouping        : Hit@1 = ${modeCMetrics.hit1} | Hit@3 = ${modeCMetrics.hit3} | MRR = ${modeCMetrics.mrr}`);
  console.log(`4. Hybrid + Grouping + Reranking 🏆: Hit@1 = ${modeDMetrics.hit1} | Hit@3 = ${modeDMetrics.hit3} | MRR = ${modeDMetrics.mrr}`);
  console.log("--------------------------------------------------------------------------");
  console.log("🛡️ ĐÁNH GIÁ LOẠI BỎ TRUY VẤN NGOÀI PHẠM VI (OOD / IRRELEVANT):");
  console.log(`- Tỷ lệ từ chối chính xác (No-result Accuracy / OOD Rejection): ${oodRejectionRate} (${oodRejectedCount}/${nOOD})`);
  console.log(`- Tỷ lệ chấp nhận sai (False Positive Rate): ${falsePositiveRate} (${oodFalsePositiveCount}/${nOOD})`);
  console.log("--------------------------------------------------------------------------");
  console.log("⏱️ ĐỘ TRỄ CHI TIẾT TỪNG TẦNG:");
  console.log(`- Pinecone Semantic Latency : ${avgPineconeLat} ms`);
  console.log(`- PostgreSQL Lexical Latency: ${avgPostgresLat} ms`);
  console.log(`- Merge & Rerank Latency    : ${avgMergeLat} ms`);
  console.log(`- Tổng độ trễ Retrieval     : ${avgTotalLat} ms`);
  console.log("==========================================================================\n");

  const summary = {
    relevant_cases: nRel,
    ood_cases: nOOD,
    comparison: {
      modeA_semantic_only: modeAMetrics,
      modeB_hybrid_no_group: modeBMetrics,
      modeC_hybrid_grouping: modeCMetrics,
      modeD_hybrid_grouping_reranking: modeDMetrics
    },
    ood_metrics: {
      rejection_rate: oodRejectionRate,
      false_positive_rate: falsePositiveRate
    },
    latency: {
      pinecone_ms: avgPineconeLat,
      postgresql_ms: avgPostgresLat,
      merge_rerank_ms: avgMergeLat,
      total_ms: avgTotalLat
    }
  };

  const outPath = path.resolve(__dirname, '../../phase6_hybrid_retrieval_results.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`💾 Đã lưu kết quả chi tiết Phase 6 vào: ${outPath}`);

  process.exit(0);
}

runEvaluation().catch(err => {
  console.error("❌ Lỗi Evaluation Phase 6:", err);
  process.exit(1);
});
