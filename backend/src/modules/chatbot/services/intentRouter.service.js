/**
 * Intent Router Service
 * - Phân loại ý định của người dùng (User Intent Classification) trước khi thực hiện Retrieval
 * - Tự động định tuyến phạm vi truy xuất (Retrieval Scope: current_lesson | course_wide | none)
 * - Sử dụng kiến trúc Hybrid (Rule-based Fast Path + Gemini Structured Fallback)
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { geminiModel } = require('../../../utils/ai-clients');

const INTENTS = {
  CURRENT_LESSON_QA: 'CURRENT_LESSON_QA',
  SUMMARIZE_CURRENT_LESSON: 'SUMMARIZE_CURRENT_LESSON',
  SEARCH_LESSON: 'SEARCH_LESSON',
  NAVIGATE_TO_LESSON: 'NAVIGATE_TO_LESSON',
  RECOMMEND_LESSON: 'RECOMMEND_LESSON',
  COURSE_QA: 'COURSE_QA',
  GENERAL_ENGLISH_QA: 'GENERAL_ENGLISH_QA'
};

const SCOPE_MAPPING = {
  [INTENTS.CURRENT_LESSON_QA]: 'current_lesson',
  [INTENTS.SUMMARIZE_CURRENT_LESSON]: 'current_lesson',
  [INTENTS.SEARCH_LESSON]: 'course_wide',
  [INTENTS.NAVIGATE_TO_LESSON]: 'course_wide',
  [INTENTS.RECOMMEND_LESSON]: 'course_wide',
  [INTENTS.COURSE_QA]: 'course_wide',
  [INTENTS.GENERAL_ENGLISH_QA]: 'none'
};

/**
 * 1. Rule-Based Fast Classifier (Độ trễ < 1ms, zero-cost, xử lý semantic category chuẩn xác)
 */
function classifyWithRules(question) {
  if (!question || typeof question !== 'string') return null;
  const q = question.trim().toLowerCase();

  // 1. Tóm tắt bài học hiện tại (SUMMARIZE_CURRENT_LESSON)
  if (
    /(tóm tắt|tổng kết|tổng quan|nội dung chính|bài này nói về gì|bài học này nói về gì|nội dung bài này|điểm ngữ pháp trọng tâm|tom tat|recap)/i.test(q) ||
    /(summarize this lesson|summary of this lesson|what is this lesson about|recap this lesson|main key takeaways|key points of this lesson|^summarize\??$|^tóm tắt\??$)/i.test(q)
  ) {
    return {
      intent: INTENTS.SUMMARIZE_CURRENT_LESSON,
      scope: SCOPE_MAPPING[INTENTS.SUMMARIZE_CURRENT_LESSON],
      confidence: 0.95,
      method: 'rule_based',
      reason: 'Matched summarize keywords'
    };
  }

  // 2. Đề xuất bài học tiếp theo / tiền đề / lộ trình (RECOMMEND_LESSON) - Ưu tiên cao nhất trước generic navigation & current lesson
  if (
    /(nên học bài nào|học bài nào tiếp theo|qua bài nào tiếp theo|bài tiếp theo là gì|tiếp theo tôi nên học gì|tiếp theo học gì|học xong.*thì học gì|học xong.*qua bài nào|trước khi học bài|học trước bài nào|cần học gì trước|cần học trước bài nào|học gì trước|lộ trình các bài học|gợi ý.*lộ trình|gợi ý.*bài học|bài sau\?|bài tiếp theo\?|hoc gi tiep theo|hoc bai nao tiep theo|hoc truoc bai nao|can hoc gi truoc)/i.test(q) ||
    /(what should i learn next|what should i learn before|what to learn next|what to study next|next lesson to study|recommended next lesson|recommended prerequisite|prerequisite.*lesson|what to study after this|^next lesson\??$)/i.test(q)
  ) {
    return {
      intent: INTENTS.RECOMMEND_LESSON,
      scope: SCOPE_MAPPING[INTENTS.RECOMMEND_LESSON],
      confidence: 0.95,
      method: 'rule_based',
      reason: 'Matched recommendation/prerequisite semantic pattern'
    };
  }

  // 3. Điều hướng bài học cụ thể (NAVIGATE_TO_LESSON)
  if (
    /(đưa tôi tới|đưa tôi đến|mở bài học|mở bài|chuyển sang bài|chuyển đến bài|dẫn tôi tới|navigate to|take me to|open lesson|go to lesson|jump to lesson|switch to lesson|chuyen sang bai|mo bai)/i.test(q)
  ) {
    return {
      intent: INTENTS.NAVIGATE_TO_LESSON,
      scope: SCOPE_MAPPING[INTENTS.NAVIGATE_TO_LESSON],
      confidence: 0.95,
      method: 'rule_based',
      reason: 'Matched navigation commands'
    };
  }

  // 4. Tìm kiếm bài học trong khóa (SEARCH_LESSON)
  if (
    /(bài nào dạy|bài nào nói về|bài mấy dạy|học ở bài nào|nằm ở bài nào|bài học nào|ở bài mấy|có bài nào về|tìm bài|tìm giúp bài|bai nao day|hoc o bai nao|o bai may|chỗ.*nằm ở đâu|bài nào có)/i.test(q) ||
    /(which lesson teaches|which lesson covers|what lesson is about|where can i learn|where can i find|where do i study|in which lesson|find lesson)/i.test(q)
  ) {
    return {
      intent: INTENTS.SEARCH_LESSON,
      scope: SCOPE_MAPPING[INTENTS.SEARCH_LESSON],
      confidence: 0.95,
      method: 'rule_based',
      reason: 'Matched search lesson keywords'
    };
  }

  // 5. Hỏi đáp tổng quan về toàn khóa học (COURSE_QA)
  if (
    /(trong khóa( học)?( này)? có|khóa học này gồm|khóa học này dạy những gì|toàn bộ khóa học|tất cả các bài trong khóa|kéo dài bao nhiêu bài|chương học nào|trong khoá này)/i.test(q) ||
    /(in this course|what does this course cover|how many lessons in this course|what topics does this.*course cover|course overview|syllabus of this course)/i.test(q)
  ) {
    return {
      intent: INTENTS.COURSE_QA,
      scope: SCOPE_MAPPING[INTENTS.COURSE_QA],
      confidence: 0.90,
      method: 'rule_based',
      reason: 'Matched course QA keywords'
    };
  }

  // 6. Hỏi đáp ngữ cảnh bài học hiện tại (CURRENT_LESSON_QA)
  if (
    /(phần này|đoạn này|ở đây|trong video này|từ này trong câu|tại sao ở đây|giải thích đoạn|câu này nghĩa là gì|trong bài này|ngữ cảnh bài này|trong bài|bài này|giai thik|đoạn video)/i.test(q) ||
    /(in this part|in this section|in this video|why is this word used here|explain this sentence|in this lesson|in this sentence|in this context)/i.test(q)
  ) {
    return {
      intent: INTENTS.CURRENT_LESSON_QA,
      scope: SCOPE_MAPPING[INTENTS.CURRENT_LESSON_QA],
      confidence: 0.92,
      method: 'rule_based',
      reason: 'Matched in-lesson spatial keywords'
    };
  }

  // 7. Tiếng Anh tổng quát / Xã giao ngoài bài học (GENERAL_ENGLISH_QA)
  if (
    /(nghĩa là gì|phân biệt cách dùng|phát âm.*như thế nào|how do you pronounce|chúc bạn|hôm nay trời đẹp|tiếng anh là gì|dịch sang tiếng anh|how to say .* in english|what is the difference between .* in general)/i.test(q)
  ) {
    return {
      intent: INTENTS.GENERAL_ENGLISH_QA,
      scope: SCOPE_MAPPING[INTENTS.GENERAL_ENGLISH_QA],
      confidence: 0.88,
      method: 'rule_based',
      reason: 'Matched general English keywords'
    };
  }

  return null;
}

/**
 * Hàm sinh Safe Fallback dựa trên ngữ cảnh hiện tại (Context-Aware Safe Fallback)
 */
function getSafeFallback(options = {}, reason = 'Safe fallback') {
  const hasValidLesson = options.hasValidLesson ?? (Boolean(options.lessonId) && Number(options.lessonId) > 0);
  if (hasValidLesson) {
    return {
      intent: INTENTS.CURRENT_LESSON_QA,
      scope: SCOPE_MAPPING[INTENTS.CURRENT_LESSON_QA],
      confidence: 0.60,
      method: 'safe_fallback',
      reason: `Context-aware fallback to current_lesson: ${reason}`
    };
  }
  return {
    intent: INTENTS.GENERAL_ENGLISH_QA,
    scope: SCOPE_MAPPING[INTENTS.GENERAL_ENGLISH_QA],
    confidence: 0.60,
    method: 'safe_fallback',
    reason: `Context-aware fallback to scope none (no valid lesson): ${reason}`
  };
}

/**
 * 2. LLM-Based Fallback Classifier (Có Timeout 3.5s và Context-Aware Safe Fallback)
 */
async function classifyWithLLM(question, options = {}) {
  try {
    const prompt = `Phân loại câu hỏi E-Learning vào DUY NHẤT 1 Intent:
1. CURRENT_LESSON_QA (Hỏi kiến thức/đoạn văn bài hiện tại)
2. SUMMARIZE_CURRENT_LESSON (Tóm tắt bài hiện tại)
3. SEARCH_LESSON (Tìm bài học chứa chủ đề trong khóa)
4. NAVIGATE_TO_LESSON (Mở/chuyển sang bài học cụ thể)
5. RECOMMEND_LESSON (Gợi ý bài học tiếp theo/tiền đề)
6. COURSE_QA (Hỏi tổng thể khóa học)
7. GENERAL_ENGLISH_QA (Hỏi nghĩa từ chung/xã giao)

CÂU HỎI: "${question}"

JSON Output:
{"intent":"INTENT_NAME","confidence":0.85}`;

    // Bảo vệ Timeout 3.5s
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LLM Classifier Timeout (3500ms)')), 3500)
    );

    const res = await Promise.race([
      geminiModel.generateContent(prompt),
      timeoutPromise
    ]);

    let text = res.response ? res.response.text() : (typeof res === 'string' ? res : '');
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);

    const intent = INTENTS[parsed.intent] || INTENTS.CURRENT_LESSON_QA;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;

    // Nếu confidence quá thấp (< 0.60), rơi về Context-Aware Safe Fallback
    if (confidence < 0.60) {
      return getSafeFallback(options, 'Low confidence');
    }

    return {
      intent: intent,
      scope: SCOPE_MAPPING[intent] || (options.hasValidLesson ? 'current_lesson' : 'none'),
      confidence: confidence,
      method: 'llm_fallback',
      reason: 'Classified by Gemini'
    };
  } catch (err) {
    console.warn(`[Intent Router Warning] Safe fallback triggered: ${err.message}`);
    return getSafeFallback(options, err.message);
  }
}

/**
 * Hàm phân loại Intent chính (Hybrid Intent Classification Pipeline)
 */
async function routeIntent(question, options = {}) {
  const startTime = Date.now();

  // 1. Thử Fast-path Rule-Based trước (< 1ms)
  const ruleResult = classifyWithRules(question);
  if (ruleResult && ruleResult.confidence >= 0.85) {
    ruleResult.latencyMs = Date.now() - startTime;
    return ruleResult;
  }

  // 2. Nếu không khớp Rule, gọi LLM Fallback (với ngữ cảnh options)
  const llmResult = await classifyWithLLM(question, options);
  llmResult.latencyMs = Date.now() - startTime;
  return llmResult;
}

module.exports = {
  INTENTS,
  SCOPE_MAPPING,
  classifyWithRules,
  classifyWithLLM,
  getSafeFallback,
  routeIntent
};
