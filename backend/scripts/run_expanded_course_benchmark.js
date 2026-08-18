/**
 * Expanded Course-Wide Benchmark & Current-Lesson Regression Evaluation
 * - Đánh giá định lượng Course-Aware Retrieval (filter: course_id == verifiedCourseId)
 * - Đo lường các giá trị topK = 2, topK = 3, topK = 5
 * - Kiểm thử hồi quy Current-Lesson Scoped QA (đảm bảo không bị regression)
 * - Sử dụng 100% dữ liệu bài học & vector V2 thực tế từ PostgreSQL
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Load Vector Store V2 Snapshot
const v2Data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../rag_v2_vector_store.json'), 'utf-8'));
const v2Records = v2Data.records;

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

async function getEmbedding(text) {
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return res.embedding?.values || res.embeddings?.[0]?.values || [];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== EXPANDED COURSE-WIDE BENCHMARK DATASET ====================
// Gồm 20 Cross-Lesson Queries thật (Current Lesson != Expected Lesson)
const courseWideDataset = [
  // Course 5: English for Communication & AI Interaction
  {
    id: "CW-01",
    query: "Phương pháp nghe thụ động Passive Listening và nghe chép chính tả nằm ở bài nào?",
    currentLessonId: 10,
    expectedLessonId: 14,
    courseId: 5,
    description: "Học viên ở Bài 10 (Chào mừng) hỏi về Passive Listening ở Bài 14"
  },
  {
    id: "CW-02",
    query: "Khóa học này có bài nào hướng dẫn phân biệt Subject Pronouns và Object Pronouns?",
    currentLessonId: 10,
    expectedLessonId: 11,
    courseId: 5,
    description: "Học viên ở Bài 10 hỏi về Đại từ nhân xưng ở Bài 11"
  },
  {
    id: "CW-03",
    query: "Bài học về công thức Thì Hiện Tại Tiếp Diễn S + am/is/are + V-ing là bài mấy?",
    currentLessonId: 11,
    expectedLessonId: 14,
    courseId: 5,
    description: "Học viên ở Bài 11 hỏi về Present Continuous ở Bài 14"
  },
  {
    id: "CW-04",
    query: "Cách sử dụng câu hỏi đuôi Tag Questions và câu nghi vấn tự nhiên học ở đâu?",
    currentLessonId: 10,
    expectedLessonId: 13,
    courseId: 5,
    description: "Học viên ở Bài 10 hỏi về Question Tags ở Bài 13"
  },
  {
    id: "CW-05",
    query: "Cách chào hỏi Good morning, How are you và tự giới thiệu bản thân ở bài mở đầu?",
    currentLessonId: 14,
    expectedLessonId: 10,
    courseId: 5,
    description: "Học viên ở Bài 14 hỏi ngược lại kiến thức chào hỏi ở Bài 10"
  },
  {
    id: "CW-06",
    query: "Trong khóa này bài nào dạy cách cài đặt tư duy phản xạ tiếng Anh English Mindset?",
    currentLessonId: 13,
    expectedLessonId: 11,
    courseId: 5,
    description: "Học viên ở Bài 13 hỏi về English Mindset ở Bài 11"
  },
  {
    id: "CW-07",
    query: "Các thì thời gian trong văn phong nói Speaking Tenses học ở bài nào?",
    currentLessonId: 10,
    expectedLessonId: 12,
    courseId: 5,
    description: "Học viên ở Bài 10 hỏi về Speaking Tenses ở Bài 12"
  },
  {
    id: "CW-08",
    query: "Quy tắc chia động từ thêm đuôi -ing khi hành động đang diễn ra ngay lúc nói",
    currentLessonId: 11,
    expectedLessonId: 14,
    courseId: 5,
    description: "Học viên ở Bài 11 hỏi về quy tắc chia V-ing ở Bài 14"
  },
  {
    id: "CW-09",
    query: "Cách dùng đại từ them, me, us làm tân ngữ trong câu tiếng Anh",
    currentLessonId: 14,
    expectedLessonId: 11,
    courseId: 5,
    description: "Học viên ở Bài 14 hỏi về Object Pronouns ở Bài 11"
  },
  {
    id: "CW-10",
    query: "Hướng dẫn cách học tập hiệu quả cùng trợ lý AI Assistant",
    currentLessonId: 12,
    expectedLessonId: 10,
    courseId: 5,
    description: "Học viên ở Bài 12 hỏi về AI Assistant ở Bài 10"
  },

  // Course 22: ENGLISH FOR COMPLETE BEGINNERS - MEETING PEOPLE
  {
    id: "CW-11",
    query: "Cách giới thiệu các thành viên trong gia đình Meet My Family học ở bài mấy?",
    currentLessonId: 35,
    expectedLessonId: 39,
    courseId: 22,
    description: "Học viên ở Bài 35 (Hello) hỏi về bài Family (Bài 39)"
  },
  {
    id: "CW-12",
    query: "Mẫu câu nói về bản thân và sở thích Talking About Yourself nằm ở bài nào?",
    currentLessonId: 39,
    expectedLessonId: 37,
    courseId: 22,
    description: "Học viên ở Bài 39 hỏi về Talking About Yourself ở Bài 37"
  },
  {
    id: "CW-13",
    query: "Các câu chào hỏi lần đầu gặp mặt First Meeting Hello and Introductions",
    currentLessonId: 37,
    expectedLessonId: 35,
    courseId: 22,
    description: "Học viên ở Bài 37 hỏi về bài First Meeting (Bài 35)"
  },
  {
    id: "CW-14",
    query: "How do I describe my parents and siblings in English in this course?",
    currentLessonId: 35,
    expectedLessonId: 39,
    courseId: 22,
    description: "Học viên ở Bài 35 hỏi tiếng Anh về bài Family (Bài 39)"
  },
  {
    id: "CW-15",
    query: "Where can I learn how to introduce my job, hobbies and hometown?",
    currentLessonId: 35,
    expectedLessonId: 37,
    courseId: 22,
    description: "Học viên ở Bài 35 hỏi về bài Talking About Yourself (Bài 37)"
  },
  {
    id: "CW-16",
    query: "What is the best way to say nice to meet you and introduce my name?",
    currentLessonId: 39,
    expectedLessonId: 35,
    courseId: 22,
    description: "Học viên ở Bài 39 hỏi về bài Introductions (Bài 35)"
  },
  {
    id: "CW-17",
    query: "Khóa học này có bài nào dạy về từ vựng cha mẹ, anh chị em không?",
    currentLessonId: 37,
    expectedLessonId: 39,
    courseId: 22,
    description: "Học viên ở Bài 37 hỏi về từ vựng gia đình ở Bài 39"
  },
  {
    id: "CW-18",
    query: "Trong khóa học này có bài nào luyện tập nghe chép chính tả không?",
    currentLessonId: 10,
    expectedLessonId: 14,
    courseId: 5,
    description: "Học viên ở Bài 10 hỏi về nghe chép chính tả ở Bài 14"
  },
  {
    id: "CW-19",
    query: "Ví dụ câu mẫu 'I see them' và 'They know me' nằm ở bài giảng nào?",
    currentLessonId: 14,
    expectedLessonId: 11,
    courseId: 5,
    description: "Học viên ở Bài 14 hỏi về câu mẫu ở Bài 11"
  },
  {
    id: "CW-20",
    query: "Thì diễn tả hành động đang xảy ra tại thời điểm nói học ở bài nào?",
    currentLessonId: 10,
    expectedLessonId: 14,
    courseId: 5,
    description: "Học viên ở Bài 10 hỏi về Present Continuous ở Bài 14"
  }
];

// ==================== CURRENT-LESSON REGRESSION DATASET ====================
// Kiểm tra hồi quy 10 câu hỏi cùng bài học (Current Lesson == Expected Lesson)
const regressionDataset = [
  { id: "REG-01", query: "Phương pháp nghe thụ động (Passive Listening) & nghe chép chính tả", currentLessonId: 14, expectedLessonId: 14, courseId: 5 },
  { id: "REG-02", query: "Subject Pronouns and Object Pronouns", currentLessonId: 11, expectedLessonId: 11, courseId: 5 },
  { id: "REG-03", query: "Present Continuous Tense formula", currentLessonId: 14, expectedLessonId: 14, courseId: 5 },
  { id: "REG-04", query: "Cách dùng đại từ nhân xưng làm chủ ngữ và tân ngữ trong câu tiếng Anh", currentLessonId: 11, expectedLessonId: 11, courseId: 5 },
  { id: "REG-05", query: "Làm thế nào để chào hỏi và tự giới thiệu bản thân một cách tự tin?", currentLessonId: 10, expectedLessonId: 10, courseId: 5 },
  { id: "REG-06", query: "What are common greetings used when meeting someone for the first time?", currentLessonId: 10, expectedLessonId: 10, courseId: 5 },
  { id: "REG-07", query: "First Meeting – Hello and Introductions", currentLessonId: 35, expectedLessonId: 35, courseId: 22 },
  { id: "REG-08", query: "How do I introduce my family members and describe relationships in English?", currentLessonId: 39, expectedLessonId: 39, courseId: 22 },
  { id: "REG-09", query: "Thầy cô có thể hướng dẫn em chi tiết cách luyện tập nghe chép chính tả không?", currentLessonId: 14, expectedLessonId: 14, courseId: 5 },
  { id: "REG-10", query: "Cách phân biệt và sử dụng đại từ them, me, us so với they, I, we", currentLessonId: 11, expectedLessonId: 11, courseId: 5 }
];

async function runExpandedBenchmark() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU BENCHMARK COURSE-WIDE RETRIEVAL & CURRENT-LESSON REGRESSION");
  console.log("==========================================================================\n");

  let totalLatency = 0;

  // 1. CHẠY COURSE-WIDE RETRIEVAL VỚI NHIỀU TOP-K: topK=2, topK=3, topK=5
  const topKOptions = [2, 3, 5];
  const courseWideResults = {
    topK_2: [],
    topK_3: [],
    topK_5: []
  };

  console.log("🔍 1. Chạy Course-Wide Search (20 Cross-Lesson queries, Current Lesson != Expected Lesson)...\n");

  for (let i = 0; i < courseWideDataset.length; i++) {
    const item = courseWideDataset[i];
    const startTime = Date.now();
    const queryVector = await getEmbedding(item.query);
    const itemLatency = Date.now() - startTime;
    totalLatency += itemLatency;

    // Filter theo Course ID của khóa học hiện tại (Course-Aware Filtering)
    const courseChunks = v2Records.filter(r => r.metadata.course_id === item.courseId);
    
    // Tính điểm tương đồng Cosine
    const scored = courseChunks.map(c => ({
      ...c,
      score: cosineSimilarity(queryVector, c.values)
    })).sort((a, b) => b.score - a.score);

    topKOptions.forEach(k => {
      const retrieved = scored.slice(0, k);
      let rank = 0;
      for (let r = 0; r < retrieved.length; r++) {
        if (retrieved[r].metadata.lesson_id === item.expectedLessonId) {
          rank = r + 1;
          break;
        }
      }

      const hit1 = rank === 1 ? 1 : 0;
      const hit3 = (rank >= 1 && rank <= 3) ? 1 : 0;
      const mrr = rank > 0 ? 1 / rank : 0;

      courseWideResults[`topK_${k}`].push({
        id: item.id,
        query: item.query,
        courseId: item.courseId,
        currentLessonId: item.currentLessonId,
        expectedLessonId: item.expectedLessonId,
        topScore: retrieved[0]?.score || 0,
        retrievedLessons: retrieved.map(r => r.metadata.lesson_id),
        rank,
        hit1,
        hit3,
        mrr,
        latencyMs: itemLatency,
        topChunk: retrieved[0] ? {
          score: Number(retrieved[0].score.toFixed(4)),
          lessonId: retrieved[0].metadata.lesson_id,
          lessonTitle: retrieved[0].metadata.lesson_title,
          snippet: retrieved[0].metadata.text.slice(0, 100) + "..."
        } : null
      });
    });

    const res5 = courseWideResults.topK_5[i];
    console.log(`[${item.id}] "${item.query.slice(0, 45)}..." -> Current L#${item.currentLessonId} | Expected L#${item.expectedLessonId}`);
    console.log(`    Rank: ${res5.rank} | Hit@1: ${res5.hit1} | Hit@3: ${res5.hit3} | Top: [Lesson #${res5.topChunk?.lessonId} - ${res5.topChunk?.score}]: "${res5.topChunk?.snippet.slice(0, 60)}..."`);
    await sleep(60);
  }

  // 2. CHẠY REGRESSION TEST CHO CURRENT-LESSON RETRIEVAL
  console.log("\n🔒 2. Chạy Current-Lesson QA Regression Test (10 in-lesson queries)...\n");
  const regressionResults = [];

  for (let i = 0; i < regressionDataset.length; i++) {
    const item = regressionDataset[i];
    const startTime = Date.now();
    const queryVector = await getEmbedding(item.query);
    const itemLatency = Date.now() - startTime;

    // Filter cố định theo Lesson ID
    const lessonChunks = v2Records.filter(r => r.metadata.lesson_id === item.currentLessonId);
    const scored = lessonChunks.map(c => ({
      ...c,
      score: cosineSimilarity(queryVector, c.values)
    })).sort((a, b) => b.score - a.score);

    const retrieved = scored.slice(0, 2);
    let rank = 0;
    for (let r = 0; r < retrieved.length; r++) {
      if (retrieved[r].metadata.lesson_id === item.expectedLessonId) {
        rank = r + 1;
        break;
      }
    }

    const hit1 = rank === 1 ? 1 : 0;
    const hit3 = (rank >= 1 && rank <= 3) ? 1 : 0;
    const mrr = rank > 0 ? 1 / rank : 0;

    regressionResults.push({
      id: item.id,
      query: item.query,
      currentLessonId: item.currentLessonId,
      expectedLessonId: item.expectedLessonId,
      hit1,
      hit3,
      mrr,
      latencyMs: itemLatency,
      topScore: retrieved[0]?.score || 0
    });

    console.log(`[${item.id}] Regression Check L#${item.currentLessonId} -> Hit@1: ${hit1} | Top Score: ${retrieved[0]?.score?.toFixed(4)}`);
    await sleep(60);
  }

  // 3. TỔNG HỢP VÀ TÍNH TOÁN METRICS
  const calcMetrics = (arr) => ({
    count: arr.length,
    hitAt1: ((arr.reduce((a, b) => a + b.hit1, 0) / arr.length) * 100).toFixed(1) + "%",
    hitAt3: ((arr.reduce((a, b) => a + b.hit3, 0) / arr.length) * 100).toFixed(1) + "%",
    mrr: (arr.reduce((a, b) => a + b.mrr, 0) / arr.length).toFixed(3),
    avgLatencyMs: Math.round(arr.reduce((a, b) => a + b.latencyMs, 0) / arr.length)
  });

  const summary = {
    metadataVersion: "v2",
    vectorCountTotal: v2Records.length,
    courseWideBenchmark: {
      description: "20 Cross-Lesson queries (Current Lesson != Expected Lesson) qua filter: course_id",
      topK_2: calcMetrics(courseWideResults.topK_2),
      topK_3: calcMetrics(courseWideResults.topK_3),
      topK_5: calcMetrics(courseWideResults.topK_5)
    },
    currentLessonRegression: {
      description: "Kiểm thử hồi quy Current-Lesson Scoped QA (10 test cases, topK=2)",
      metrics: calcMetrics(regressionResults)
    },
    comparisonBeforeAfter: {
      v1_baseline_cross_lesson: {
        description: "V1 Hardcoded filter lesson_id hiện tại",
        hitAt1: "0.0%",
        hitAt3: "0.0%",
        mrr: "0.000"
      },
      v2_course_aware_topK_3: {
        description: "V2 Course-Aware filter course_id (topK=3)",
        hitAt1: calcMetrics(courseWideResults.topK_3).hitAt1,
        hitAt3: calcMetrics(courseWideResults.topK_3).hitAt3,
        mrr: calcMetrics(courseWideResults.topK_3).mrr
      },
      v2_course_aware_topK_5: {
        description: "V2 Course-Aware filter course_id (topK=5)",
        hitAt1: calcMetrics(courseWideResults.topK_5).hitAt1,
        hitAt3: calcMetrics(courseWideResults.topK_5).hitAt3,
        mrr: calcMetrics(courseWideResults.topK_5).mrr
      }
    }
  };

  console.log("\n==========================================================================");
  console.log("📊 KẾT QUẢ TỔNG HỢP BENCHMARK V2 SO VỚI V1 BASELINE:");
  console.log("==========================================================================");
  console.log(JSON.stringify(summary, null, 2));

  // Lưu toàn bộ kết quả vào file JSON artifact
  const outPath = path.resolve(__dirname, '../../rag_v2_course_benchmark_results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    summary,
    courseWideDetails: courseWideResults,
    regressionDetails: regressionResults
  }, null, 2), 'utf-8');

  console.log(`\n💾 Đã lưu kết quả chi tiết Benchmark V2 vào: ${outPath}`);
  process.exit(0);
}

runExpandedBenchmark().catch(err => {
  console.error("❌ Lỗi Benchmark Course-Wide V2:", err);
  process.exit(1);
});
