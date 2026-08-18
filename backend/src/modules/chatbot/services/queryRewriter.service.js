/**
 * Conversational Query Rewriter Service (Phase 5)
 * - Tách biệt Original Query và Retrieval Query
 * - Contextualize & Coreference Resolution cho các câu hỏi follow-up dựa trên lịch sử chat
 * - Bộ lọc Bypass Fast-Gate (< 1ms) cho các câu hỏi độc lập (self-contained)
 * - Cơ chế Safe Failure và Anti-Hallucination (Không tự bịa thực thể nếu thiếu lịch sử)
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { geminiModel } = require('../../../utils/ai-clients');
const db = require('../../../config/database');

// Các mẫu dấu hiệu câu hỏi phụ thuộc ngữ cảnh (Context-Dependent Markers) - Tương thích chuẩn Unicode tiếng Việt
const CONTEXT_DEPENDENT_REGEX = new RegExp(
  '(?:^|[\\s,?!;("])(' +
  // Tiếng Việt
  'nó|cái này|cái đó|phần đó|bài đó|bài này|cấu trúc này|cấu trúc đó|thì này|thì đó|từ này|từ đó|' +
  'ở trên|như trên|ví dụ vừa rồi|ví dụ trên|bài vừa rồi|bài học đó|bài trước|' +
  'còn .* thì sao|thế còn|vậy còn|học nó ở đâu|học cái này ở đâu|mở bài đó|qua bài đó|sau bài đó|' +
  // Tiếng Anh
  'it|that|this|these|those|this structure|that structure|that tense|this tense|' +
  'what about|how about|previous one|last one|as above|like that|that example|where is it|where can i find it|' +
  'that topic' +
  ')(?:$|[\\s,?!;.)"])',
  'i'
);

/**
 * 1. Kiểm tra xem câu hỏi có chứa dấu hiệu phụ thuộc ngữ cảnh cần Rewrite hay không (Fast Bypass Gate)
 */
function shouldRewrite(question) {
  if (!question || typeof question !== 'string') return false;
  const q = question.trim();
  // Nếu câu quá ngắn hoặc chứa từ chỉ định phụ thuộc ngữ cảnh
  if (q.length <= 15 && /^(còn|what about|how about|nó|it\?|that\?)/i.test(q)) return true;
  return CONTEXT_DEPENDENT_REGEX.test(q);
}

/**
 * 2. Lấy lịch sử hội thoại gần nhất của học viên từ PostgreSQL
 * - Cô lập phạm vi theo khóa học (Cross-Course Context Isolation)
 * - Hỗ trợ liên thông bài học trong cùng khóa học (Same-Course Cross-Lesson Continuity)
 * - Cô lập Chatbot toàn cục (Global Chatbot Isolation)
 * - Tích hợp Stale History Protection (mặc định giới hạn trong vòng 30 phút gần nhất)
 * - Đảm bảo Zero-Trust User Isolation (chỉ truy xuất dữ liệu thuộc về req.user.id)
 */
async function getRecentConversationHistory(userId, lessonId, limit = 6, options = {}) {
  if (!userId) return [];
  try {
    const sessionMinutes = options.sessionWindowMinutes || 30; // Giới hạn phiên học 30 phút
    let targetCourseId = options.courseId;

    // Nếu chưa có courseId nhưng có lessonId hợp lệ, truy vấn course_id từ DB PostgreSQL
    if (!targetCourseId && lessonId && Number(lessonId) > 0) {
      try {
        const cRes = await db.query(`
          SELECT s.course_id 
          FROM lessons l
          JOIN sections s ON l.section_id = s.section_id
          WHERE l.lesson_id = $1
          LIMIT 1
        `, [Number(lessonId)]);
        if (cRes.rows.length > 0) {
          targetCourseId = cRes.rows[0].course_id;
        }
      } catch (e) {
        console.warn('[Query Rewriter] Lỗi phân giải course_id:', e.message);
      }
    }

    let query;
    let params;

    if (targetCourseId) {
      // 1. Ngữ cảnh trong khóa học: Lấy các tin nhắn thuộc các bài học trong cùng courseId và trong session 30 phút
      query = `
        SELECT ac.sender_type, ac.title, ac.lesson_id, ac.created_at
        FROM ai_chat ac
        JOIN lessons l ON ac.lesson_id = l.lesson_id
        JOIN sections s ON l.section_id = s.section_id
        WHERE ac.student_id = $1
          AND s.course_id = $2
          AND ac.created_at >= NOW() - ($3 || ' minutes')::INTERVAL
        ORDER BY ac.created_at DESC
        LIMIT $4
      `;
      params = [userId, targetCourseId, sessionMinutes.toString(), limit];
    } else {
      // 2. Ngữ cảnh Chatbot toàn cục (Global Chatbot): Chỉ lấy tin nhắn độc lập (lesson_id IS NULL)
      query = `
        SELECT sender_type, title, lesson_id, created_at
        FROM ai_chat
        WHERE student_id = $1
          AND lesson_id IS NULL
          AND ac_created.created_at >= NOW() - ($2 || ' minutes')::INTERVAL
        ORDER BY created_at DESC
        LIMIT $3
      `.replace('ac_created.', '');
      params = [userId, sessionMinutes.toString(), limit];
    }

    const res = await db.query(query, params);
    
    // Đảo ngược lại theo thứ tự thời gian tăng dần (cũ -> mới)
    return res.rows.reverse().map(r => ({
      role: r.sender_type === 'user' ? 'User' : 'Assistant',
      content: r.title,
      lessonId: r.lesson_id
    }));
  } catch (err) {
    console.warn(`[Query Rewriter Warning] Lỗi đọc lịch sử ai_chat:`, err.message);
    return [];
  }
}

/**
 * 3. Thực hiện Rewrite câu hỏi bằng Gemini LLM
 */
async function rewriteWithLLM(question, history = [], options = {}) {
  // Anti-Hallucination: Nếu không có lịch sử hội thoại nào, không bao giờ được tự suy diễn thực thể
  if (!history || history.length === 0) {
    return {
      originalQuery: question,
      retrievalQuery: question,
      rewritten: false,
      confidence: 1.0,
      method: 'no_history_bypass',
      reason: 'No conversation history to resolve reference'
    };
  }

  try {
    const formattedHistory = history
      .map(h => `${h.role}: ${h.content}`)
      .join('\n');

    const prompt = `Bạn là bộ Conversational Query Rewriter cho hệ thống E-Learning RAG.
Nhiệm vụ: Dựa vào LỊCH SỬ HỘI THOẠI gần nhất, hãy viết lại CÂU HỎI HIỆN TẠI thành một câu truy vấn tìm kiếm độc lập (standalone retrieval query) chứa đầy đủ thực thể/khái niệm được tham chiếu.

QUY TẮC BẮT BUỘC:
1. Nếu câu hỏi có đại từ thay thế ("nó", "cái này", "bài đó", "it", "that", "còn X thì sao"), hãy thay thế đại từ bằng thực thể/chủ đề cụ thể đã xuất hiện trong lịch sử.
2. Nếu câu hỏi đã đầy đủ thông tin hoặc lịch sử không chứa thực thể liên quan, GIỮ NGUYÊN câu hỏi gốc, TUYỆT ĐỐI KHÔNG tự suy diễn hoặc bịa đặt thực thể (No Hallucination).
3. KHÔNG thay đổi mục đích tìm kiếm (Intent) của người dùng.

LỊCH SỬ HỘI THOẠI:
${formattedHistory}

CÂU HỎI HIỆN TẠI:
"${question}"

TRẢ VỀ DUY NHẤT JSON THEO SCHEMA (Không thêm markdown hay văn bản nào khác):
{"originalQuery":"${question}","retrievalQuery":"câu truy vấn độc lập sau khi thế từ","rewritten":true/false,"confidence":0.95}`;

    // Bảo vệ Timeout 3.5s
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query Rewriter Timeout (3500ms)')), 3500)
    );

    const res = await Promise.race([
      geminiModel.generateContent(prompt),
      timeoutPromise
    ]);

    let text = res.response ? res.response.text() : (typeof res === 'string' ? res : '');
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);

    const retrievalQuery = (parsed.retrievalQuery && typeof parsed.retrievalQuery === 'string')
      ? parsed.retrievalQuery.trim()
      : question;
    const isRewritten = Boolean(parsed.rewritten) && (retrievalQuery.toLowerCase() !== question.trim().toLowerCase());
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.90;

    // Nếu confidence quá thấp (< 0.60), giữ nguyên câu hỏi gốc
    if (confidence < 0.60) {
      return {
        originalQuery: question,
        retrievalQuery: question,
        rewritten: false,
        confidence: confidence,
        method: 'low_confidence_fallback',
        reason: 'Low confidence in rewritten query'
      };
    }

    return {
      originalQuery: question,
      retrievalQuery: retrievalQuery,
      rewritten: isRewritten,
      confidence: confidence,
      method: isRewritten ? 'llm_rewritten' : 'llm_kept_original',
      reason: isRewritten ? 'Coreference resolved from conversation history' : 'Query already self-contained'
    };
  } catch (err) {
    console.warn(`[Query Rewriter Warning] Lỗi Rewrite: ${err.message}. Safe fallback về câu hỏi gốc.`);
    return {
      originalQuery: question,
      retrievalQuery: question,
      rewritten: false,
      confidence: 0.50,
      method: 'safe_fallback',
      reason: `Safe fallback on error: ${err.message}`
    };
  }
}

/**
 * Hàm điều phối chính (Pipeline Orchestrator cho Query Contextualization)
 * @param {string} question Câu hỏi người dùng
 * @param {Array|null} customHistory Mảng lịch sử tùy chọn (hoặc tự query từ DB nếu có userId)
 * @param {Object} options Tùy chọn (userId, lessonId, courseId)
 * @returns {Promise<{originalQuery: string, retrievalQuery: string, rewritten: boolean, confidence: number, method: string, latencyMs: number}>}
 */
async function contextualizeQuery(question, customHistory = null, options = {}) {
  const startTime = Date.now();

  // 1. Kiểm tra Fast Bypass Gate: Nếu câu hỏi không chứa từ ngữ phụ thuộc ngữ cảnh
  if (!shouldRewrite(question)) {
    return {
      originalQuery: question,
      retrievalQuery: question,
      rewritten: false,
      confidence: 1.0,
      method: 'fast_bypass',
      latencyMs: Date.now() - startTime,
      reason: 'Query is self-contained (no coreference markers)'
    };
  }

  // 2. Lấy lịch sử hội thoại (Ưu tiên customHistory truyền vào cho test/eval, hoặc query từ DB)
  let history = customHistory;
  if (!history && options.userId) {
    history = await getRecentConversationHistory(options.userId, options.lessonId, 6);
  }

  // 3. Thực hiện Rewrite với lịch sử
  const result = await rewriteWithLLM(question, history || [], options);
  result.latencyMs = Date.now() - startTime;
  return result;
}

module.exports = {
  shouldRewrite,
  getRecentConversationHistory,
  rewriteWithLLM,
  contextualizeQuery
};
