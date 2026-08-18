/**
 * Phase 5 Conversational Query Rewriting Benchmark & Evaluation Suite
 * - Đánh giá 32 Test Cases hội thoại đa lượt (Multi-turn Context)
 * - Đo Rewrite Accuracy, Coreference Resolution Accuracy
 * - So sánh trực tiếp hiệu quả Retrieval: RAW QUERY vs REWRITTEN QUERY (Hit@1, Hit@3, MRR)
 * - Đo Latency (Fast-Bypass Gate vs LLM Rewrite)
 * - Kiểm tra Safe Failure & Anti-Hallucination khi không có lịch sử
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { contextualizeQuery, shouldRewrite } = require('../src/modules/chatbot/services/queryRewriter.service');
const { routeIntent, INTENTS } = require('../src/modules/chatbot/services/intentRouter.service');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// ==================== BỘ 32 CONVERSATIONAL TEST CASES ====================
const conversationalDataset32 = [
  // --- Group A: Pronoun Resolution (Đại từ thay thế) ---
  {
    id: "CONV-01",
    category: "A. Pronoun Resolution",
    history: [
      { role: "User", content: "Thì Hiện Tại Tiếp Diễn Present Continuous dùng như thế nào?" },
      { role: "Assistant", content: "Thì Hiện Tại Tiếp Diễn (S + am/is/are + V-ing) dùng để diễn tả hành động đang diễn ra." }
    ],
    query: "Bài nào nói về nó?",
    expectedTarget: "Present Continuous",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-02",
    category: "A. Pronoun Resolution",
    history: [
      { role: "User", content: "Passive Listening là phương pháp gì?" },
      { role: "Assistant", content: "Passive Listening là phương pháp nghe thụ động kết hợp nghe chép chính tả." }
    ],
    query: "Nó được dạy ở bài mấy trong khóa học?",
    expectedTarget: "Passive Listening",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-03",
    category: "A. Pronoun Resolution",
    history: [
      { role: "User", content: "What is the English Mindset reflex concept?" },
      { role: "Assistant", content: "English Mindset is the habit of thinking in English without translating from your native language." }
    ],
    query: "Which lesson covers it in this course?",
    expectedTarget: "English Mindset",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 11
  },

  // --- Group B: Ellipsis (Tỉnh lược & hỏi tiếp nối) ---
  {
    id: "CONV-04",
    category: "B. Ellipsis",
    history: [
      { role: "User", content: "Giải thích Subject Pronouns trong tiếng Anh." },
      { role: "Assistant", content: "Subject Pronouns gồm I, you, we, they, he, she, it làm chủ ngữ." }
    ],
    query: "Còn Object Pronouns thì sao?",
    expectedTarget: "Object Pronouns",
    expectedIntent: INTENTS.CURRENT_LESSON_QA,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 11
  },
  {
    id: "CONV-05",
    category: "B. Ellipsis",
    history: [
      { role: "User", content: "Bài 10 dạy về Chào hỏi và AI Assistant." },
      { role: "Assistant", content: "Đúng rồi, bài 10 hướng dẫn làm quen và học cùng AI." }
    ],
    query: "Thế còn Speaking Tenses?",
    expectedTarget: "Speaking Tenses",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 12
  },

  // --- Group C: Previous Example Reference (Tham chiếu ví dụ trước) ---
  {
    id: "CONV-06",
    category: "C. Previous Example Reference",
    history: [
      { role: "User", content: "Cho tôi ví dụ về đại từ tân ngữ them." },
      { role: "Assistant", content: "Ví dụ: 'I see them every day at school'." }
    ],
    query: "Cho thêm 2 câu tương tự ví dụ vừa rồi.",
    expectedTarget: "them",
    expectedIntent: INTENTS.CURRENT_LESSON_QA,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 11
  },

  // --- Group D: Lesson Reference & Prerequisite ---
  {
    id: "CONV-07",
    category: "D. Lesson Reference",
    history: [
      { role: "User", content: "Bài Passive Listening và nghe chép chính tả khá khó." },
      { role: "Assistant", content: "Bài này yêu cầu luyện tập tai nghe thường xuyên." }
    ],
    query: "Có bài nào nên học trước bài đó không?",
    expectedTarget: "Passive Listening",
    expectedIntent: INTENTS.RECOMMEND_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-08",
    category: "D. Lesson Reference",
    history: [
      { role: "User", content: "Bài học về First Meeting và giới thiệu bản thân." },
      { role: "Assistant", content: "Bài học này hướng dẫn các mẫu câu Nice to meet you." }
    ],
    query: "Mở bài đó giúp tôi.",
    expectedTarget: "First Meeting",
    expectedIntent: INTENTS.NAVIGATE_TO_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 22,
    expectedLessonId: 35
  },

  // --- Group E: Vietnamese Coreference Markers ---
  {
    id: "CONV-09",
    category: "E. Vietnamese Markers",
    history: [
      { role: "User", content: "Trong bài có nhắc đến Speaking Tenses trong văn phong nói." },
      { role: "Assistant", content: "Speaking Tenses tập trung vào các thì thông dụng nhất khi giao tiếp." }
    ],
    query: "Cấu trúc này áp dụng như thế nào?",
    expectedTarget: "Speaking Tenses",
    expectedIntent: INTENTS.CURRENT_LESSON_QA,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 12
  },
  {
    id: "CONV-10",
    category: "E. Vietnamese Markers",
    history: [
      { role: "User", content: "Meet My Family là bài học về các thành viên gia đình." },
      { role: "Assistant", content: "Bài học cung cấp từ vựng cha mẹ, anh chị em." }
    ],
    query: "Bài đó nằm ở đâu trong khóa học?",
    expectedTarget: "Meet My Family",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 22,
    expectedLessonId: 39
  },
  {
    id: "CONV-11",
    category: "E. Vietnamese Markers",
    history: [
      { role: "User", content: "Từ 'mindset' ở phần trên nghĩa là gì?" },
      { role: "Assistant", content: "Mindset nghĩa là tư duy hoặc lối suy nghĩ định hình phản xạ." }
    ],
    query: "Tại sao ở đây lại cần cài đặt cái này?",
    expectedTarget: "mindset",
    expectedIntent: INTENTS.CURRENT_LESSON_QA,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 11
  },
  {
    id: "CONV-12",
    category: "E. Vietnamese Markers",
    history: [
      { role: "User", content: "Talking About Yourself dạy về cách nói thông tin cá nhân." },
      { role: "Assistant", content: "Đúng, bài học giúp bạn tự tin chia sẻ sở thích và nghề nghiệp." }
    ],
    query: "Dẫn tôi tới phần đó.",
    expectedTarget: "Talking About Yourself",
    expectedIntent: INTENTS.NAVIGATE_TO_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 22,
    expectedLessonId: 37
  },

  // --- Group F: English Coreference Markers ---
  {
    id: "CONV-13",
    category: "F. English Markers",
    history: [
      { role: "User", content: "What is the structure of Present Continuous tense?" },
      { role: "Assistant", content: "It is Subject + am/is/are + Verb-ing." }
    ],
    query: "Where is that tense taught in this course?",
    expectedTarget: "Present Continuous",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-14",
    category: "F. English Markers",
    history: [
      { role: "User", content: "Can you explain Passive Listening dictation?" },
      { role: "Assistant", content: "Dictation is writing down exactly what you hear word-by-word." }
    ],
    query: "What should I learn before it?",
    expectedTarget: "Passive Listening",
    expectedIntent: INTENTS.RECOMMEND_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-15",
    category: "F. English Markers",
    history: [
      { role: "User", content: "Lesson about Meeting People and Introductions." },
      { role: "Assistant", content: "It covers greetings like Hello, Good morning, and Nice to meet you." }
    ],
    query: "Take me to that lesson please.",
    expectedTarget: "Meeting People",
    expectedIntent: INTENTS.NAVIGATE_TO_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 22,
    expectedLessonId: 35
  },
  {
    id: "CONV-16",
    category: "F. English Markers",
    history: [
      { role: "User", content: "How do Subject Pronouns work?" },
      { role: "Assistant", content: "They replace the noun performing the action." }
    ],
    query: "Give me more examples of that structure.",
    expectedTarget: "Subject Pronouns",
    expectedIntent: INTENTS.CURRENT_LESSON_QA,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 11
  },

  // --- Group G: No-History Ambiguity (Safe Anti-Hallucination) ---
  {
    id: "CONV-17",
    category: "G. No-History Ambiguity",
    history: [], // KHÔNG CÓ LỊCH SỬ
    query: "Bài nào nói về nó?",
    expectedTarget: null, // Không được tự bịa
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: false, // Giữ nguyên câu gốc
    expectedCourseId: 5,
    expectedLessonId: null
  },
  {
    id: "CONV-18",
    category: "G. No-History Ambiguity",
    history: [], // KHÔNG CÓ LỊCH SỬ
    query: "Cái này học ở đâu?",
    expectedTarget: null,
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: false,
    expectedCourseId: 5,
    expectedLessonId: null
  },
  {
    id: "CONV-19",
    category: "G. No-History Ambiguity",
    history: [],
    query: "Where is it taught?",
    expectedTarget: null,
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: false,
    expectedCourseId: 5,
    expectedLessonId: null
  },

  // --- Group H: Self-Contained Queries (Fast Bypass Gate - < 1ms) ---
  {
    id: "CONV-20",
    category: "H. Self-Contained (Bypass)",
    history: [
      { role: "User", content: "Chào bạn!" },
      { role: "Assistant", content: "Chào bạn, mình có thể giúp gì cho bạn hôm nay?" }
    ],
    query: "Thì Hiện Tại Tiếp Diễn Present Continuous là gì?",
    expectedTarget: "Present Continuous",
    expectedIntent: INTENTS.CURRENT_LESSON_QA,
    shouldBeRewritten: false, // Bypassed
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-21",
    category: "H. Self-Contained (Bypass)",
    history: [],
    query: "Bài nào trong khóa học dạy về Passive Listening?",
    expectedTarget: "Passive Listening",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: false, // Bypassed
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-22",
    category: "H. Self-Contained (Bypass)",
    history: [],
    query: "Tóm tắt nội dung bài học số 11",
    expectedTarget: "bài học số 11",
    expectedIntent: INTENTS.SUMMARIZE_CURRENT_LESSON,
    shouldBeRewritten: false, // Bypassed
    expectedCourseId: 5,
    expectedLessonId: 11
  },
  {
    id: "CONV-23",
    category: "H. Self-Contained (Bypass)",
    history: [],
    query: "Từ 'comfortable' phát âm như thế nào?",
    expectedTarget: "comfortable",
    expectedIntent: INTENTS.GENERAL_ENGLISH_QA,
    shouldBeRewritten: false, // Bypassed
    expectedCourseId: null,
    expectedLessonId: null
  },
  {
    id: "CONV-24",
    category: "H. Self-Contained (Bypass)",
    history: [],
    query: "Mở bài học Meet My Family",
    expectedTarget: "Meet My Family",
    expectedIntent: INTENTS.NAVIGATE_TO_LESSON,
    shouldBeRewritten: false, // Bypassed
    expectedCourseId: 22,
    expectedLessonId: 39
  },

  // --- Extended Multi-turn Test Cases ---
  {
    id: "CONV-25",
    category: "A. Pronoun Resolution",
    history: [
      { role: "User", content: "First Meeting dạy các câu chào hỏi khi mới gặp gỡ." },
      { role: "Assistant", content: "Đúng, học cách chào và giới thiệu tên tuổi." }
    ],
    query: "Bài nào dạy nó trong khóa tiếng Anh cho người mới bắt đầu?",
    expectedTarget: "First Meeting",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 22,
    expectedLessonId: 35
  },
  {
    id: "CONV-26",
    category: "B. Ellipsis",
    history: [
      { role: "User", content: "Tôi đã học xong bài Chào mừng và AI Assistant." },
      { role: "Assistant", content: "Chúc mừng bạn đã hoàn thành bài đầu tiên!" }
    ],
    query: "Còn bài English Mindset thì học gì?",
    expectedTarget: "English Mindset",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 11
  },
  {
    id: "CONV-27",
    category: "E. Vietnamese Markers",
    history: [
      { role: "User", content: "Speaking Tenses hướng dẫn nói tiếng Anh tự nhiên." },
      { role: "Assistant", content: "Tập trung vào thì Hiện tại đơn và Quá khứ đơn." }
    ],
    query: "Chuyển sang bài đó cho tôi.",
    expectedTarget: "Speaking Tenses",
    expectedIntent: INTENTS.NAVIGATE_TO_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 12
  },
  {
    id: "CONV-28",
    category: "F. English Markers",
    history: [
      { role: "User", content: "Family vocabulary includes parents, siblings, and relatives." },
      { role: "Assistant", content: "Yes, you can describe your family tree." }
    ],
    query: "What lesson is that topic covered in?",
    expectedTarget: "Family",
    expectedIntent: INTENTS.SEARCH_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 22,
    expectedLessonId: 39
  },
  {
    id: "CONV-29",
    category: "C. Previous Example Reference",
    history: [
      { role: "User", content: "Giải thích câu 'I am studying English right now'." },
      { role: "Assistant", content: "Đây là câu thì hiện tại tiếp diễn chỉ hành động đang làm." }
    ],
    query: "Đặt thêm 3 câu tương tự cấu trúc này.",
    expectedTarget: "hiện tại tiếp diễn",
    expectedIntent: INTENTS.CURRENT_LESSON_QA,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 14
  },
  {
    id: "CONV-30",
    category: "D. Lesson Reference",
    history: [
      { role: "User", content: "Bài học số 12 về Speaking Tenses." },
      { role: "Assistant", content: "Bài này nói về các thì trong giao tiếp." }
    ],
    query: "Sau bài đó nên học tiếp bài nào?",
    expectedTarget: "Speaking Tenses",
    expectedIntent: INTENTS.RECOMMEND_LESSON,
    shouldBeRewritten: true,
    expectedCourseId: 5,
    expectedLessonId: 12
  },
  {
    id: "CONV-31",
    category: "H. Self-Contained (Bypass)",
    history: [],
    query: "Trong khóa học này có bao nhiêu bài giảng tất cả?",
    expectedTarget: "khóa học",
    expectedIntent: INTENTS.COURSE_QA,
    shouldBeRewritten: false,
    expectedCourseId: 5,
    expectedLessonId: null
  },
  {
    id: "CONV-32",
    category: "H. Self-Contained (Bypass)",
    history: [],
    query: "Hôm nay tôi muốn luyện tập phát âm tiếng Anh",
    expectedTarget: "luyện tập phát âm",
    expectedIntent: INTENTS.GENERAL_ENGLISH_QA,
    shouldBeRewritten: false,
    expectedCourseId: null,
    expectedLessonId: null
  }
];

async function runBenchmark() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU BENCHMARK CONVERSATIONAL QUERY REWRITING (PHASE 5)");
  console.log("==========================================================================\n");

  const results = [];
  const latencies = [];
  let bypassCount = 0;
  let rewrittenCount = 0;
  let correctRewriteCount = 0;
  let correctEntityCount = 0;

  // Đo hiệu quả retrieval trực tiếp: RAW QUERY vs REWRITTEN QUERY
  let rawHits1 = 0, rawHits3 = 0, rawMrrSum = 0;
  let rwHits1 = 0, rwHits3 = 0, rwMrrSum = 0;
  let retrievalEvalCount = 0;

  for (let i = 0; i < conversationalDataset32.length; i++) {
    const item = conversationalDataset32[i];
    const start = Date.now();
    
    // Gọi module Contextualize Query
    const rewriteRes = await contextualizeQuery(item.query, item.history, {
      hasValidLesson: Boolean(item.expectedLessonId)
    });
    const latency = Date.now() - start;
    latencies.push(latency);

    if (rewriteRes.method === 'fast_bypass' || rewriteRes.method === 'no_history_bypass') {
      bypassCount++;
    } else {
      rewrittenCount++;
    }

    // 1. Kiểm tra Rewrite Decision Accuracy
    const isRewriteDecisionCorrect = rewriteRes.rewritten === item.shouldBeRewritten;
    if (isRewriteDecisionCorrect) correctRewriteCount++;

    // 2. Kiểm tra Entity / Coreference Resolution
    let entityPass = true;
    if (item.shouldBeRewritten && item.expectedTarget) {
      entityPass = rewriteRes.retrievalQuery.toLowerCase().includes(item.expectedTarget.toLowerCase());
    } else if (!item.shouldBeRewritten && item.expectedTarget === null) {
      // Anti-hallucination check: retrievalQuery must equal originalQuery
      entityPass = rewriteRes.retrievalQuery === item.query;
    }
    if (entityPass) correctEntityCount++;

    // 3. Đo lường so sánh Retrieval trực tiếp trên tập vector V2 (Đối với các câu Search/Course-wide có expectedLessonId)
    let rawHit1 = false, rawHit3 = false, rawRank = 0;
    let rwHit1 = false, rwHit3 = false, rwRank = 0;

    if (item.expectedCourseId && item.expectedLessonId && item.shouldBeRewritten) {
      retrievalEvalCount++;

      // A. Truy xuất bằng RAW QUERY
      const rawVec = await getEmbedding(item.query);
      const rawMatches = v2Records
        .filter(r => r.metadata.course_id === item.expectedCourseId && r.metadata.schema_version === 'v2')
        .map(r => ({ id: r.id, score: cosineSimilarity(rawVec, r.values), lessonId: r.metadata.lesson_id }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const rawIdx = rawMatches.findIndex(m => m.lessonId === item.expectedLessonId);
      if (rawIdx === 0) { rawHit1 = true; rawHit3 = true; rawRank = 1; rawHits1++; rawHits3++; rawMrrSum += 1.0; }
      else if (rawIdx > 0) { rawHit3 = true; rawRank = rawIdx + 1; rawHits3++; rawMrrSum += 1.0 / (rawIdx + 1); }

      // B. Truy xuất bằng REWRITTEN QUERY
      const rwVec = await getEmbedding(rewriteRes.retrievalQuery);
      const rwMatches = v2Records
        .filter(r => r.metadata.course_id === item.expectedCourseId && r.metadata.schema_version === 'v2')
        .map(r => ({ id: r.id, score: cosineSimilarity(rwVec, r.values), lessonId: r.metadata.lesson_id }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const rwIdx = rwMatches.findIndex(m => m.lessonId === item.expectedLessonId);
      if (rwIdx === 0) { rwHit1 = true; rwHit3 = true; rwRank = 1; rwHits1++; rwHits3++; rwMrrSum += 1.0; }
      else if (rwIdx > 0) { rwHit3 = true; rwRank = rwIdx + 1; rwHits3++; rwMrrSum += 1.0 / (rwIdx + 1); }
    }

    results.push({
      id: item.id,
      category: item.category,
      originalQuery: item.query,
      retrievalQuery: rewriteRes.retrievalQuery,
      rewritten: rewriteRes.rewritten,
      method: rewriteRes.method,
      latencyMs: latency,
      rewriteDecisionPass: isRewriteDecisionCorrect,
      entityPass: entityPass,
      retrievalComparison: item.expectedLessonId && item.shouldBeRewritten ? {
        raw: { hit1: rawHit1, hit3: rawHit3, rank: rawRank },
        rewritten: { hit1: rwHit1, hit3: rwHit3, rank: rwRank }
      } : null
    });

    console.log(`[${item.id}] [${item.category}] "${item.query}"`);
    console.log(`    -> Retrieval Query: "${rewriteRes.retrievalQuery}" (${rewriteRes.method}, ${latency}ms)`);
    console.log(`    -> Rewrite Match: ${isRewriteDecisionCorrect ? "✅" : "❌"} | Entity Match: ${entityPass ? "✅" : "❌"}`);
    if (item.expectedLessonId && item.shouldBeRewritten) {
      console.log(`    -> Direct Retrieval: RAW Hit@1=${rawHit1 ? "YES" : "NO"} (Rank #${rawRank}) vs REWRITTEN Hit@1=${rwHit1 ? "YES" : "NO"} (Rank #${rwRank})`);
    }
    console.log("");
    await sleep(40);
  }

  const total = results.length;
  const rewriteAccuracy = ((correctRewriteCount / total) * 100).toFixed(1) + "%";
  const entityAccuracy = ((correctEntityCount / total) * 100).toFixed(1) + "%";
  const bypassRate = ((bypassCount / total) * 100).toFixed(1) + "%";
  const rewrittenRate = ((rewrittenCount / total) * 100).toFixed(1) + "%";

  const sumLat = latencies.reduce((a, b) => a + b, 0);
  const avgLat = Math.round(sumLat / total);
  const sortedLat = [...latencies].sort((a, b) => a - b);
  const p95Lat = sortedLat[Math.floor(0.95 * sortedLat.length)];

  // Retrieval Metrics
  const rawHit1Rate = ((rawHits1 / retrievalEvalCount) * 100).toFixed(1) + "%";
  const rawHit3Rate = ((rawHits3 / retrievalEvalCount) * 100).toFixed(1) + "%";
  const rawMrr = (rawMrrSum / retrievalEvalCount).toFixed(3);

  const rwHit1Rate = ((rwHits1 / retrievalEvalCount) * 100).toFixed(1) + "%";
  const rwHit3Rate = ((rwHits3 / retrievalEvalCount) * 100).toFixed(1) + "%";
  const rwMrr = (rwMrrSum / retrievalEvalCount).toFixed(3);

  console.log("==========================================================================");
  console.log("📊 KẾT QUẢ TỔNG HỢP BENCHMARK CONVERSATIONAL QUERY REWRITING (32 TEST CASES):");
  console.log("==========================================================================");
  console.log(`- Rewrite Decision Accuracy: ${rewriteAccuracy} (${correctRewriteCount}/${total})`);
  console.log(`- Coreference / Entity Resolution Accuracy: ${entityAccuracy} (${correctEntityCount}/${total})`);
  console.log(`- Tỷ lệ Fast Bypass Gate: ${bypassRate} (${bypassCount}/${total}) (Latency < 1ms)`);
  console.log(`- Tỷ lệ Kích hoạt LLM Rewrite: ${rewrittenRate} (${rewrittenCount}/${total})`);
  console.log(`- Average Latency (Toàn bộ Pipeline): ${avgLat} ms | P95: ${p95Lat} ms`);
  console.log("--------------------------------------------------------------------------");
  console.log("🔥 ĐỐI ĐẦU ĐỊNH LƯỢNG RETRIEVAL: RAW QUERY vs REWRITTEN QUERY:");
  console.log(`  • RAW QUERY RETRIEVAL      : Hit@1 = ${rawHit1Rate} | Hit@3 = ${rawHit3Rate} | MRR = ${rawMrr}`);
  console.log(`  • REWRITTEN QUERY RETRIEVAL: Hit@1 = ${rwHit1Rate} | Hit@3 = ${rwHit3Rate} | MRR = ${rwMrr}`);
  console.log("==========================================================================\n");

  const summary = {
    total_test_cases: total,
    rewrite_decision_accuracy: rewriteAccuracy,
    coreference_resolution_accuracy: entityAccuracy,
    bypass_rate: bypassRate,
    rewritten_rate: rewrittenRate,
    avg_latency_ms: avgLat,
    p95_latency_ms: p95Lat,
    retrieval_comparison: {
      evaluated_cases: retrievalEvalCount,
      raw_query: { hit1: rawHit1Rate, hit3: rawHit3Rate, mrr: rawMrr },
      rewritten_query: { hit1: rwHit1Rate, hit3: rwHit3Rate, mrr: rwMrr }
    },
    test_details: results
  };

  const outPath = path.resolve(__dirname, '../../phase5_conversational_rewriting_results.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`💾 Đã lưu kết quả chi tiết Phase 5 vào: ${outPath}`);

  process.exit(0);
}

runBenchmark().catch(err => {
  console.error("❌ Lỗi Benchmark Phase 5:", err);
  process.exit(1);
});
