require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const db = require('../src/config/database');
const { chunkText } = require('../src/modules/lessons/services/ragIngestion.service');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper tính Cosine Similarity giữa 2 vector
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Hàm nhúng vector qua gemini-embedding-001
async function getEmbedding(text) {
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return res.embedding?.values || res.embeddings?.[0]?.values || [];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBenchmark() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU BENCHMARK EVALUATION BASELINE CHO HỆ THỐNG RAG HIỆN TẠI");
  console.log("==========================================================================\n");

  // 1. Tải toàn bộ dữ liệu bài học & phụ đề thật từ CSDL PostgreSQL
  console.log("📦 1. Đang nạp dữ liệu bài học & phụ đề thực tế từ PostgreSQL...");
  const lessonRows = await db.query(`
    SELECT l.lesson_id, l.title, s.course_id, c.course_name, ls.cues
    FROM lessons l
    JOIN sections s ON l.section_id = s.section_id
    JOIN courses c ON s.course_id = c.course_id
    LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
    ORDER BY s.course_id, l.lesson_id;
  `);

  console.log(`✅ Đã tải ${lessonRows.rows.length} bài học từ CSDL.`);

  // 2. Xây dựng Vector Index mô phỏng Pinecone với thuật toán Chunking & Embedding thực tế
  console.log("🧠 2. Đang tạo Vector Embeddings bằng gemini-embedding-001 (768-dim) cho toàn bộ chunks...");
  const vectorStore = []; // { id, lesson_id, course_id, text, values }

  for (const row of lessonRows.rows) {
    let fullText = row.title || '';
    if (row.cues) {
      try {
        const parsed = typeof row.cues === 'string' ? JSON.parse(row.cues) : row.cues;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cuesText = parsed.map(c => c.en).filter(Boolean).join(' ');
          fullText += ' ' + cuesText;
        }
      } catch (e) {}
    }

    if (!fullText.trim()) continue;

    // Áp dụng đúng hàm chunkText hiện tại của backend: chunkSize = 900, overlap = 150
    const chunks = chunkText(fullText, 900, 150);
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      const vector = await getEmbedding(chunk);
      vectorStore.push({
        id: `lesson-${row.lesson_id}-chunk-${cIdx}`,
        lesson_id: row.lesson_id,
        lesson_title: row.title,
        course_id: row.course_id,
        course_name: row.course_name,
        text: chunk,
        values: vector
      });
      await sleep(100); // chống rate-limit
    }
  }

  console.log(`✅ Đã lập chỉ mục Vector thành công cho tổng cộng ${vectorStore.length} chunks trên cơ sở tri thức thật.\n`);

  // 3. Danh sách Benchmark Dataset bao phủ 10 nhóm query
  const benchmarkDataset = [
    // 1. Exact lesson title
    {
      id: "TC-01",
      category: "1. Exact lesson title",
      query: "Phương pháp nghe thụ động (Passive Listening) & nghe chép chính tả",
      currentLessonId: 14,
      expectedLessonId: 14,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-02",
      category: "1. Exact lesson title",
      query: "First Meeting – Hello and Introductions",
      currentLessonId: 35,
      expectedLessonId: 35,
      courseId: 22,
      isOutOfDomain: false
    },

    // 2. Exact keyword
    {
      id: "TC-03",
      category: "2. Exact keyword",
      query: "Subject Pronouns and Object Pronouns",
      currentLessonId: 11,
      expectedLessonId: 11,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-04",
      category: "2. Exact keyword",
      query: "Present Continuous Tense formula",
      currentLessonId: 14,
      expectedLessonId: 14,
      courseId: 5,
      isOutOfDomain: false
    },

    // 3. Semantic paraphrase
    {
      id: "TC-05",
      category: "3. Semantic paraphrase",
      query: "Cách dùng đại từ nhân xưng làm chủ ngữ và tân ngữ trong câu tiếng Anh",
      currentLessonId: 11,
      expectedLessonId: 11,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-06",
      category: "3. Semantic paraphrase",
      query: "Quy tắc chia động từ thêm đuôi ing khi hành động đang xảy ra",
      currentLessonId: 14,
      expectedLessonId: 14,
      courseId: 5,
      isOutOfDomain: false
    },

    // 4. Câu hỏi bằng tiếng Việt
    {
      id: "TC-07",
      category: "4. Câu hỏi bằng tiếng Việt",
      query: "Làm thế nào để chào hỏi và tự giới thiệu bản thân một cách tự tin?",
      currentLessonId: 10,
      expectedLessonId: 10,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-08",
      category: "4. Câu hỏi bằng tiếng Việt",
      query: "Công thức Subject + am / is / are + Verb-ing là của cấu trúc nào?",
      currentLessonId: 14,
      expectedLessonId: 14,
      courseId: 5,
      isOutOfDomain: false
    },

    // 5. Câu hỏi bằng tiếng Anh
    {
      id: "TC-09",
      category: "5. Câu hỏi bằng tiếng Anh",
      query: "What are common greetings used when meeting someone for the first time?",
      currentLessonId: 10,
      expectedLessonId: 10,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-10",
      category: "5. Câu hỏi bằng tiếng Anh",
      query: "How do I introduce my family members and describe relationships in English?",
      currentLessonId: 39,
      expectedLessonId: 39,
      courseId: 22,
      isOutOfDomain: false
    },

    // 6. Query ngắn
    {
      id: "TC-11",
      category: "6. Query ngắn",
      query: "Passive Listening",
      currentLessonId: 14,
      expectedLessonId: 14,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-12",
      category: "6. Query ngắn",
      query: "I see them",
      currentLessonId: 11,
      expectedLessonId: 11,
      courseId: 5,
      isOutOfDomain: false
    },

    // 7. Query tự nhiên dài
    {
      id: "TC-13",
      category: "7. Query tự nhiên dài",
      query: "Thầy cô có thể hướng dẫn em chi tiết cách luyện tập nghe chép chính tả và nghe thụ động mỗi ngày sao cho hiệu quả không ạ?",
      currentLessonId: 14,
      expectedLessonId: 14,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-14",
      category: "7. Query tự nhiên dài",
      query: "Khi giao tiếp lần đầu gặp đối tác hoặc bạn bè thì những mẫu câu chào hỏi thông dụng và lịch sự nhất là gì?",
      currentLessonId: 10,
      expectedLessonId: 10,
      courseId: 5,
      isOutOfDomain: false
    },

    // 8. Query không chứa tên chính xác của lesson
    {
      id: "TC-15",
      category: "8. Query không chứa tên chính xác của lesson",
      query: "Cách phân biệt và sử dụng đại từ them, me, us so với they, I, we",
      currentLessonId: 11,
      expectedLessonId: 11,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-16",
      category: "8. Query không chứa tên chính xác của lesson",
      query: "Các mốc thời gian chào Good morning, Good afternoon và Good evening",
      currentLessonId: 10,
      expectedLessonId: 10,
      courseId: 5,
      isOutOfDomain: false
    },

    // 9. Query không có kết quả (Out of domain / Unmentioned)
    {
      id: "TC-17",
      category: "9. Query không có kết quả",
      query: "Cách cấu hình Kubernetes cluster microservices và Docker trên AWS",
      currentLessonId: 10,
      expectedLessonId: null,
      courseId: 5,
      isOutOfDomain: true
    },
    {
      id: "TC-18",
      category: "9. Query không có kết quả",
      query: "Giải thích thuật toán quy hoạch động Dynamic Programming bài toán balo Knapsack",
      currentLessonId: 14,
      expectedLessonId: null,
      courseId: 5,
      isOutOfDomain: true
    },

    // 10. Follow-up query (Conversational / Context-dependent)
    {
      id: "TC-19",
      category: "10. Follow-up query (Conversational)",
      query: "Thế còn dạng câu phủ định và nghi vấn của cấu trúc này thì chia như thế nào?",
      prevContext: "Đang hỏi về cấu trúc Thì Hiện Tại Tiếp Diễn ở bài học 14",
      currentLessonId: 14,
      expectedLessonId: 14,
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-20",
      category: "10. Follow-up query (Conversational)",
      query: "Cho mình xin thêm 3 ví dụ đặt câu có chứa từ 'them' như câu mẫu vừa rồi",
      prevContext: "Đang hỏi về Subject/Object Pronouns ở bài học 11",
      currentLessonId: 11,
      expectedLessonId: 11,
      courseId: 5,
      isOutOfDomain: false
    },

    // 11. Cross-lesson queries to test Course-Wide Limitation (Học viên đang ở Lesson 10 nhưng hỏi nội dung thuộc Lesson 14 trong cùng Course 5)
    {
      id: "TC-21",
      category: "Course-wide Cross-Lesson (Limitation Test)",
      query: "Phương pháp nghe thụ động Passive Listening và nghe chép chính tả học ở đâu?",
      currentLessonId: 10, // Học viên đang đứng ở Lesson 10
      expectedLessonId: 14, // Bài chứa nội dung là Lesson 14
      courseId: 5,
      isOutOfDomain: false
    },
    {
      id: "TC-22",
      category: "Course-wide Cross-Lesson (Limitation Test)",
      query: "Khóa học này có bài nào dạy về Subject Pronouns và Object Pronouns không?",
      currentLessonId: 10, // Học viên đang đứng ở Lesson 10
      expectedLessonId: 11, // Bài chứa nội dung là Lesson 11
      courseId: 5,
      isOutOfDomain: false
    }
  ];

  console.log(`📋 3. Bắt đầu đánh giá ${benchmarkDataset.length} Test Cases qua pipeline Retrieval...\n`);

  const results = [];
  let totalLatency = 0;

  for (let i = 0; i < benchmarkDataset.length; i++) {
    const item = benchmarkDataset[i];
    const startTime = Date.now();

    // 1. Tạo query embedding
    const queryVector = await getEmbedding(item.query);
    const queryLatency = Date.now() - startTime;
    totalLatency += queryLatency;

    // Tính điểm tương đồng cho tất cả chunks trong Vector Store
    const scoredChunks = vectorStore.map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryVector, chunk.values)
    })).sort((a, b) => b.score - a.score);

    // MODE A: Current Production Behavior (Lọc cứng theo lesson_id == currentLessonId, topK = 2)
    const currentLessonFiltered = scoredChunks.filter(c => c.lesson_id === Number(item.currentLessonId));
    const prodRetrieved = currentLessonFiltered.slice(0, 2);

    // MODE B: Unfiltered Vector Search (topK = 5)
    const unfilteredRetrieved = scoredChunks.slice(0, 5);

    // MODE C: Course-wide Search (filter: course_id == item.courseId, topK = 5)
    const courseFiltered = scoredChunks.filter(c => c.course_id === Number(item.courseId));
    const courseRetrieved = courseFiltered.slice(0, 5);

    // Đánh giá Mode A (Production)
    let prodRank = 0;
    if (item.isOutOfDomain) {
      const topScore = prodRetrieved[0]?.score || 0;
      prodRank = topScore < 0.65 ? 1 : 0; // Out of domain: score thấp coi như lọc thành công
    } else {
      for (let r = 0; r < prodRetrieved.length; r++) {
        if (prodRetrieved[r].lesson_id === item.expectedLessonId) {
          prodRank = r + 1;
          break;
        }
      }
    }
    const prodHit1 = prodRank === 1 ? 1 : 0;
    const prodHit3 = (prodRank >= 1 && prodRank <= 3) ? 1 : 0;
    const prodMRR = prodRank > 0 ? 1 / prodRank : 0;

    // Đánh giá Mode B (Unfiltered)
    let unfilterRank = 0;
    if (!item.isOutOfDomain) {
      for (let r = 0; r < unfilteredRetrieved.length; r++) {
        if (unfilteredRetrieved[r].lesson_id === item.expectedLessonId) {
          unfilterRank = r + 1;
          break;
        }
      }
    }
    const unfilterHit1 = unfilterRank === 1 ? 1 : 0;
    const unfilterHit3 = (unfilterRank >= 1 && unfilterRank <= 3) ? 1 : 0;

    const record = {
      id: item.id,
      category: item.category,
      query: item.query,
      currentLessonId: item.currentLessonId,
      expectedLessonId: item.expectedLessonId,
      isOutOfDomain: item.isOutOfDomain,
      latencyMs: queryLatency,
      productionMode: {
        filter: { lesson_id: { $eq: item.currentLessonId } },
        topK: 2,
        hitAt1: prodHit1,
        hitAt3: prodHit3,
        mrr: prodMRR,
        retrieved: prodRetrieved.map(m => ({
          score: Number(m.score.toFixed(4)),
          lessonId: m.lesson_id,
          lessonTitle: m.lesson_title,
          snippet: m.text.slice(0, 100) + "..."
        }))
      },
      unfilteredMode: {
        hitAt1: unfilterHit1,
        hitAt3: unfilterHit3,
        topMatches: unfilteredRetrieved.slice(0, 3).map(m => ({
          score: Number(m.score.toFixed(4)),
          lessonId: m.lesson_id,
          lessonTitle: m.lesson_title,
          snippet: m.text.slice(0, 100) + "..."
        }))
      }
    };

    results.push(record);
    console.log(`[${item.id}] "${item.query.slice(0, 40)}..." | Category: ${item.category}`);
    console.log(`    -> Production Filter: lesson_id == ${item.currentLessonId} | Hit@1: ${prodHit1} | Expected: ${item.expectedLessonId} | Top Score: ${prodRetrieved[0]?.score?.toFixed(4) || 'N/A'}`);
    if (prodRetrieved.length > 0) {
      console.log(`       Retrieved chunk 1: [Lesson ${prodRetrieved[0].lesson_id} - score ${prodRetrieved[0].score.toFixed(4)}]: "${prodRetrieved[0].text.slice(0, 80)}..."`);
    }
  }

  // Tổng hợp chỉ số
  const validDomainItems = results.filter(r => !r.isOutOfDomain);
  const avgLatency = Math.round(totalLatency / results.length);

  const prodHit1Total = validDomainItems.reduce((acc, r) => acc + r.productionMode.hitAt1, 0);
  const prodHit3Total = validDomainItems.reduce((acc, r) => acc + r.productionMode.hitAt3, 0);
  const prodMRRTotal = validDomainItems.reduce((acc, r) => acc + r.productionMode.mrr, 0);

  const unfilterHit1Total = validDomainItems.reduce((acc, r) => acc + r.unfilteredMode.hitAt1, 0);
  const unfilterHit3Total = validDomainItems.reduce((acc, r) => acc + r.unfilteredMode.hitAt3, 0);

  // Phân tích theo từng Category
  const categoryStats = {};
  results.forEach(r => {
    if (!categoryStats[r.category]) {
      categoryStats[r.category] = { total: 0, hit1: 0, mrrSum: 0 };
    }
    categoryStats[r.category].total += 1;
    categoryStats[r.category].hit1 += r.productionMode.hitAt1;
    categoryStats[r.category].mrrSum += r.productionMode.mrr;
  });

  const summary = {
    totalQueries: results.length,
    inDomainQueries: validDomainItems.length,
    outOfDomainQueries: results.length - validDomainItems.length,
    avgLatencyMs: avgLatency,
    productionCurrentMetrics: {
      description: "Hệ thống hiện tại: Filter cứng lesson_id hiện tại, topK = 2",
      hitAt1: ((prodHit1Total / validDomainItems.length) * 100).toFixed(1) + "%",
      hitAt3: ((prodHit3Total / validDomainItems.length) * 100).toFixed(1) + "%",
      mrr: (prodMRRTotal / validDomainItems.length).toFixed(3)
    },
    unfilteredVectorMetrics: {
      description: "Đối chứng Vector Space toàn cục: Không filter, topK = 5",
      hitAt1: ((unfilterHit1Total / validDomainItems.length) * 100).toFixed(1) + "%",
      hitAt3: ((unfilterHit3Total / validDomainItems.length) * 100).toFixed(1) + "%"
    },
    categoryBreakdown: categoryStats
  };

  console.log("\n==========================================================================");
  console.log("📊 KẾT QUẢ BASELINE METRICS TỔNG HỢP:");
  console.log("==========================================================================");
  console.log(JSON.stringify(summary, null, 2));

  // Lưu file kết quả baseline
  const outputPath = path.resolve(__dirname, '../../rag_baseline_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, details: results }, null, 2), 'utf-8');
  console.log(`\n💾 Đã lưu toàn bộ kết quả benchmark vào: ${outputPath}`);

  process.exit(0);
}

runBenchmark().catch(err => {
  console.error("❌ Lỗi khi chạy Benchmark:", err);
  process.exit(1);
});
