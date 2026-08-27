/**
 * Lesson Suggested Questions Service (Udemy-like AI Assistant Feature)
 * - Tự động sinh và lưu trữ 4 câu hỏi gợi ý cho từng bài học sau khi có transcript
 * - Tận dụng Gemini 3.7 Flash để tạo câu hỏi sát với bài giảng thực tế
 * - Cơ chế Deterministic Fallback Template (0 token, 0ms) khi chưa có transcript
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

'use strict';

const db = require('../../../config/database');
const { geminiModel } = require('../../../utils/ai-clients');

const QUESTION_COUNT = 4;
const MAX_QUESTION_LENGTH = 92;
const LEGACY_QUESTION_PATTERNS = [
  /muc dich va noi dung chinh cua bai/,
  /giai thich cac diem ngu phap va cau truc cau/,
  /trich xuat cac tu vung moi va vi du minh hoa/,
  /tom tat nhung kien thuc cot loi/
];
const GROUNDING_STOP_WORDS = new Set([
  'bai', 'hoc', 'nay', 'trong', 'cua', 'nhung', 'mot', 'cac', 'cho', 'voi', 'the', 'nao',
  'nghia', 'giai', 'thich', 'tom', 'tat', 'noi', 'dung', 'chinh', 'kien', 'thuc', 'quan',
  'trong', 'duoc', 'dung', 'khi', 'dau', 'vi', 'sao', 'what', 'when', 'where', 'which',
  'how', 'why', 'this', 'that', 'lesson', 'course', 'about', 'from', 'with', 'into', 'your',
  'you', 'the', 'and', 'for', 'are', 'was', 'were', 'have', 'has', 'can', 'will'
]);

function normalizeForMatch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function getMeaningfulTokens(value = '') {
  return normalizeForMatch(value)
    .match(/[a-z0-9][a-z0-9'-]{2,}/g)?.filter(token => !GROUNDING_STOP_WORDS.has(token)) || [];
}

function buildTranscriptText(cues = [], maxChars = 8000) {
  if (typeof cues === 'string') return cues.trim().slice(0, maxChars);
  if (!Array.isArray(cues) || cues.length === 0) return '';

  const sampleSize = Math.min(cues.length, 120);
  const sampledCues = sampleSize === cues.length
    ? cues
    : Array.from({ length: sampleSize }, (_, index) => cues[Math.floor(index * (cues.length - 1) / (sampleSize - 1))]);

  return sampledCues
    .map(cue => cue?.en || cue?.text || cue?.vi || '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function extractGroundedTerms(sourceText = '', limit = QUESTION_COUNT) {
  const frequency = new Map();
  const originalTokens = String(sourceText).match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) || [];

  originalTokens.forEach((originalToken, index) => {
    const token = normalizeForMatch(originalToken);
    if (GROUNDING_STOP_WORDS.has(token)) return;

    const current = frequency.get(token) || {
      count: 0,
      firstIndex: index,
      display: originalToken
    };
    current.count += 1;
    frequency.set(token, current);
  });

  return [...frequency.entries()]
    .filter(([token]) => token.length <= 24)
    .sort((a, b) => b[1].count - a[1].count || a[1].firstIndex - b[1].firstIndex)
    .slice(0, limit)
    .map(([, metadata]) => metadata.display);
}

function isLegacyGenericQuestionSet(questions = []) {
  return Array.isArray(questions) && questions.some(question => {
    const normalized = normalizeForMatch(question);
    return LEGACY_QUESTION_PATTERNS.some(pattern => pattern.test(normalized));
  });
}

function normalizeSuggestedQuestions(questions = [], sourceText = '') {
  if (!Array.isArray(questions)) return [];

  const sourceTokens = new Set(getMeaningfulTokens(sourceText));
  const requireGrounding = sourceTokens.size > 0;
  const seen = new Set();

  return questions.reduce((result, rawQuestion) => {
    if (result.length >= QUESTION_COUNT || typeof rawQuestion !== 'string') return result;

    let question = rawQuestion.replace(/\s+/g, ' ').trim();
    if (!question || question.length > MAX_QUESTION_LENGTH) return result;
    if (!question.endsWith('?')) question = `${question.replace(/[.!]+$/, '')}?`;

    const normalized = normalizeForMatch(question);
    if (seen.has(normalized) || LEGACY_QUESTION_PATTERNS.some(pattern => pattern.test(normalized))) {
      return result;
    }

    if (requireGrounding) {
      const isGrounded = getMeaningfulTokens(question).some(token => sourceTokens.has(token));
      if (!isGrounded) return result;
    }

    seen.add(normalized);
    result.push(question);
    return result;
  }, []);
}

/**
 * 1. Trả về 4 câu hỏi gợi ý mẫu theo Template chuỗi (0 token, 0ms latency, KHÔNG gọi Gemini)
 * @param {string} lessonTitle 
 * @param {string} courseName 
 * @returns {Array<string>} 4 câu hỏi gợi ý
 */
function getFallbackSuggestedQuestions(lessonTitle = '', courseName = '', sourceText = '') {
  const groundedTerms = extractGroundedTerms(sourceText);
  if (groundedTerms.length > 0) {
    const templates = [
      term => `“${term}” nghĩa là gì trong bài?`,
      term => `Bài dùng “${term}” khi nào?`,
      term => `Ví dụ nào có “${term}”?`,
      term => `Ý chính về “${term}” là gì?`
    ];

    return templates.map((template, index) => template(groundedTerms[index % groundedTerms.length]));
  }

  return [
    'Bài này có những ý chính nào?',
    'Khái niệm nào cần ghi nhớ?',
    'Từ nào xuất hiện trong bài?',
    'Kiểm tra nhanh kiến thức bài này?'
  ];
}

/**
 * 2. Lấy 4 câu hỏi gợi ý cho một bài học từ Database (hoặc trả về Fallback tức thì nếu chưa có)
 * @param {number|string} lessonId 
 * @returns {Promise<Array<string>>}
 */
async function getSuggestedQuestionsByLessonId(lessonId) {
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
    return getFallbackSuggestedQuestions();
  }

  try {
    const res = await db.query(`
      SELECT l.title, ls.cues, q.questions
      FROM lessons l
      LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
      LEFT JOIN lesson_suggested_questions q ON q.lesson_id = l.lesson_id
      WHERE l.lesson_id = $1
      LIMIT 1
    `, [parsedLessonId]);

    if (res.rows.length === 0) return getFallbackSuggestedQuestions();

    const lessonTitle = res.rows[0].title || '';
    const transcriptCues = res.rows[0].cues || [];
    const transcriptText = buildTranscriptText(transcriptCues);

    if (res.rows[0].questions) {
      let questions = res.rows[0].questions;
      if (typeof questions === 'string') {
        try { questions = JSON.parse(questions); } catch (_) {}
      }
      const normalizedQuestions = normalizeSuggestedQuestions(questions, transcriptText);
      if (!isLegacyGenericQuestionSet(questions) && normalizedQuestions.length === QUESTION_COUNT) {
        return normalizedQuestions;
      }
    }

    // Legacy hoặc câu không bám transcript sẽ được tạo lại một lần rồi cache vào DB.
    if (transcriptText) {
      return generateAndSaveSuggestedQuestions(parsedLessonId, transcriptCues);
    }

    return getFallbackSuggestedQuestions(lessonTitle);
  } catch (err) {
    console.warn(`[SuggestedQuestions Warning] Lỗi đọc DB lessonId=${lessonId}:`, err.message);
    return getFallbackSuggestedQuestions();
  }
}

/**
 * 3. Tự động sinh và lưu 4 câu hỏi gợi ý bằng Gemini Flash dựa trên Transcript (Phase 2 Ingestion)
 * @param {number|string} lessonId 
 * @param {Array<Object>|null} cues - Mảng phụ đề cues [{ start, end, en, vi }]
 * @returns {Promise<Array<string>>}
 */
async function generateAndSaveSuggestedQuestions(lessonId, cues = null) {
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
    return getFallbackSuggestedQuestions();
  }

  try {
    console.log(`[SuggestedQuestions] 🚀 Bắt đầu sinh câu hỏi gợi ý cho lessonId=${parsedLessonId}...`);

    // 1. Lấy thông tin bài học & khóa học
    const infoRes = await db.query(`
      SELECT l.title AS lesson_title, s.title AS section_title, c.course_name
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE l.lesson_id = $1
    `, [parsedLessonId]);

    if (infoRes.rows.length === 0) {
      console.warn(`[SuggestedQuestions] ⚠️ Không tìm thấy bài học id=${parsedLessonId}`);
      return getFallbackSuggestedQuestions();
    }

    const { lesson_title, section_title, course_name } = infoRes.rows[0];

    // 2. Lấy transcript nếu cues chưa được truyền vào trực tiếp
    let transcriptCues = cues;
    if (!transcriptCues || transcriptCues.length === 0) {
      const subRes = await db.query(
        'SELECT cues FROM lesson_subtitles WHERE lesson_id = $1',
        [parsedLessonId]
      );
      if (subRes.rows.length > 0 && subRes.rows[0].cues) {
        transcriptCues = subRes.rows[0].cues;
      }
    }

    // Nếu hoàn toàn không có transcript -> Lưu fallback template
    if (!transcriptCues || !Array.isArray(transcriptCues) || transcriptCues.length === 0) {
      console.log(`[SuggestedQuestions] ℹ️ Không có transcript -> Dùng Fallback Template cho lessonId=${parsedLessonId}`);
      const fallbackQuestions = getFallbackSuggestedQuestions(lesson_title, course_name);
      await saveQuestionsToDb(parsedLessonId, fallbackQuestions);
      return fallbackQuestions;
    }

    // Lấy mẫu xuyên suốt toàn bộ transcript thay vì chỉ lấy phần mở đầu.
    const transcriptText = buildTranscriptText(transcriptCues);

    // 4. Xây dựng Prompt cho Gemini Flash
    const prompt = `Bạn là chuyên gia sư phạm tiếng Anh kiêm cố vấn AI Assistant tại E-Learn Academy.
Dựa vào thông tin bài giảng và đoạn bóc băng âm thanh (transcript) dưới đây, hãy tạo ĐÚNG 4 CÂU HỎI GỢI Ý ngắn gọn, tự nhiên, và hữu ích nhất mà học viên tiếng Anh có khả năng cao sẽ hỏi AI Assistant về bài học này (giống tính năng Suggested Questions của Udemy AI).

THÔNG TIN BÀI HỌC:
- Khóa học: ${course_name}
- Chương: ${section_title}
- Bài học: ${lesson_title}

NỘI DUNG BÓC BĂNG TRANSCRIPT:
${transcriptText}

YÊU CẦU BẮT BUỘC:
1. Tạo đúng 4 câu hỏi, mỗi câu 6-12 từ và không quá 72 ký tự.
2. Mỗi câu phải nêu rõ ít nhất một từ, cụm từ, mẫu câu hoặc ví dụ xuất hiện nguyên văn trong transcript.
3. Chỉ hỏi điều có thể trả lời hoàn toàn bằng transcript; không thêm kiến thức bên ngoài.
4. Không dùng câu chung chung như "Bài này nói về gì?", "Mục đích bài học là gì?" hoặc "Tóm tắt bài học".
5. Bốn câu không trùng ý và dùng ngôn ngữ tự nhiên, trực tiếp.
6. Trả về DUY NHẤT một JSON hợp lệ theo schema sau (không thêm markdown hay văn bản ngoài):
{"questions": ["Câu hỏi 1?", "Câu hỏi 2?", "Câu hỏi 3?", "Câu hỏi 4?"]}`;

    // 5. Gọi Gemini với Timeout 4.5s
    let generatedQuestions = null;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Suggested Questions Generation Timeout (4500ms)')), 4500)
      );

      const aiResponse = await Promise.race([
        geminiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }),
        timeoutPromise
      ]);

      let text = aiResponse.response ? aiResponse.response.text() : (typeof aiResponse === 'string' ? aiResponse : '');
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.questions)) {
        generatedQuestions = normalizeSuggestedQuestions(parsed.questions, transcriptText);
      }
    } catch (aiErr) {
      console.warn(`[SuggestedQuestions Warning] Gemini gặp lỗi/timeout cho lessonId=${parsedLessonId}:`, aiErr.message);
    }

    // Nếu AI không trả về đủ 4 câu hỏi -> Sử dụng Fallback Template
    if (!generatedQuestions || generatedQuestions.length !== QUESTION_COUNT) {
      console.log(`[SuggestedQuestions] ⚠️ Dùng fallback bám transcript do AI không phản hồi đủ câu hỏi hợp lệ (lessonId=${parsedLessonId})`);
      generatedQuestions = getFallbackSuggestedQuestions(lesson_title, course_name, transcriptText);
    }

    // 6. Lưu / Ghi đè vào bảng lesson_suggested_questions
    await saveQuestionsToDb(parsedLessonId, generatedQuestions);
    console.log(`[SuggestedQuestions] ✅ Đã lưu thành công 4 câu hỏi gợi ý cho lessonId=${parsedLessonId} ("${lesson_title}")`);

    return generatedQuestions;
  } catch (err) {
    console.error(`[SuggestedQuestions Error] Lỗi sinh câu hỏi gợi ý cho lessonId=${parsedLessonId}:`, err.message);
    return getFallbackSuggestedQuestions();
  }
}

/**
 * 4. Hàm trợ giúp lưu câu hỏi vào PostgreSQL (Upsert)
 */
async function saveQuestionsToDb(lessonId, questions) {
  const query = `
    INSERT INTO lesson_suggested_questions (lesson_id, questions, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (lesson_id)
    DO UPDATE SET
      questions = EXCLUDED.questions,
      updated_at = NOW()
    RETURNING *;
  `;
  await db.query(query, [lessonId, JSON.stringify(questions)]);
}

module.exports = {
  buildTranscriptText,
  isLegacyGenericQuestionSet,
  normalizeSuggestedQuestions,
  getFallbackSuggestedQuestions,
  getSuggestedQuestionsByLessonId,
  generateAndSaveSuggestedQuestions,
  saveQuestionsToDb
};
