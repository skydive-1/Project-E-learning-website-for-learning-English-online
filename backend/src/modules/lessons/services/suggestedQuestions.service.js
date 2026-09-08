/**
 * Lesson Suggested Questions Service (Udemy-like AI Assistant Feature)
 * - Tự động sinh và lưu trữ 4 câu hỏi gợi ý cho từng bài học bám sát nội dung bài giảng như Udemy
 * - Sử dụng Gemini AI để phân tích Course, Section, Lesson Title và Transcript
 * - Cơ chế Deterministic Fallback theo ngữ cảnh (0 token, 0ms) khi offline/lỗi
 * - Tự động phát hiện và làm mới các bộ câu hỏi generic cũ trong database
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
  /tom tat nhung kien thuc cot loi/,
  /bai nay co nhung y chinh nao/,
  /khai niem nao can ghi nho/,
  /tu nao xuat hien trong bai/,
  /kiem tra nhanh kien thuc bai nay/,
  /nghia la gi trong bai/,
  /bai dung .* khi nao/,
  /vi du nao co/,
  /y chinh ve .* la gi/,
  /nhung loi sai can tranh/,
  /loi sai pho bien/,
  /loi thuong gap/
];
const GROUNDING_STOP_WORDS = new Set([
  'bai', 'hoc', 'nay', 'trong', 'cua', 'nhung', 'mot', 'cac', 'cho', 'voi', 'the', 'nao',
  'nghia', 'giai', 'thich', 'tom', 'tat', 'noi', 'dung', 'chinh', 'kien', 'thuc', 'quan',
  'trong', 'duoc', 'dung', 'khi', 'dau', 'vi', 'sao', 'what', 'when', 'where', 'which',
  'how', 'why', 'this', 'that', 'lesson', 'course', 'about', 'from', 'with', 'into', 'your',
  'you', 'the', 'and', 'for', 'are', 'was', 'were', 'have', 'has', 'can', 'will'
]);

function markGenerationUsage(questions, generatedByAi = false, contentAvailable = null) {
  const result = Array.isArray(questions) ? questions : [];
  Object.defineProperty(result, 'generatedByAi', { value: generatedByAi, enumerable: false });
  Object.defineProperty(result, 'contentAvailable', { value: contentAvailable, enumerable: false });
  return result;
}

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
    .match(/[a-z0-9][a-z0-9'-]*/g)?.filter(token => token.length >= 2 && !GROUNDING_STOP_WORDS.has(token)) || [];
}

function buildTranscriptText(cues = [], maxChars = 8000) {
  if (typeof cues === 'string') return cues.trim().slice(0, maxChars);
  if (!Array.isArray(cues) || cues.length === 0) return '';

  const sampleSize = Math.min(cues.length, 120);
  const sampledCues = sampleSize === cues.length
    ? cues
    : Array.from({ length: sampleSize }, (_, index) => cues[Math.floor(index * (cues.length - 1) / (sampleSize - 1))]);

  return sampledCues
    .map(cue => {
      const parts = [];
      if (cue?.en) parts.push(cue.en);
      if (cue?.vi && cue.vi !== cue.en) parts.push(cue.vi);
      if (cue?.text && !parts.includes(cue.text)) parts.push(cue.text);
      return parts.join(' ');
    })
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
  if (!Array.isArray(questions) || !String(sourceText).trim()) return [];

  const sourceTokens = new Set(getMeaningfulTokens(sourceText));
  const requireGrounding = sourceTokens.size > 0;
  const normalizedSource = normalizeForMatch(sourceText);
  const sourceHasMistakeTerms = /loi|sai|mistake|error|fault|wrong/.test(normalizedSource);
  const seen = new Set();

  return questions.reduce((result, rawQuestion) => {
    const rawText = typeof rawQuestion === 'string' ? rawQuestion : rawQuestion?.question;
    if (result.length >= QUESTION_COUNT || typeof rawText !== 'string') return result;

    let question = rawText.replace(/\s+/g, ' ').trim();
    if (!question || question.length > MAX_QUESTION_LENGTH) return result;
    if (!question.endsWith('?')) question = `${question.replace(/[.!]+$/, '')}?`;

    const normalized = normalizeForMatch(question);
    if (seen.has(normalized) || LEGACY_QUESTION_PATTERNS.some(pattern => pattern.test(normalized))) {
      return result;
    }

    // Double-Guardrail: Nếu câu hỏi hỏi về lỗi sai nhưng video không nhắc đến lỗi sai -> Loại bỏ ngay
    const questionAsksMistake = /loi|sai|nham|mistake|error|wrong/.test(normalized);
    if (questionAsksMistake && !sourceHasMistakeTerms) {
      console.warn(`[SuggestedQuestions Grounding] 🛑 Loại bỏ câu hỏi không có trong video: "${question}"`);
      return result;
    }

    if (requireGrounding) {
      const qTokens = getMeaningfulTokens(question);
      const matchedTokens = qTokens.filter(token => sourceTokens.has(token));
      // Bắt buộc câu hỏi phải có ít nhất 1-2 từ khóa then chốt xuất hiện trong bài giảng
      if (matchedTokens.length === 0) {
        console.warn(`[SuggestedQuestions Grounding] 🛑 Loại bỏ câu hỏi không khớp transcript: "${question}"`);
        return result;
      }
    }

    seen.add(normalized);
    result.push(question);
    return result;
  }, []);
}

function normalizeSuggestedItems(items = [], transcriptText = '') {
  if (!Array.isArray(items) || !String(transcriptText).trim()) return [];
  const normalizedTranscript = normalizeForMatch(transcriptText).replace(/\s+/g, ' ').trim();
  const validated = [];

  for (const item of items) {
    if (validated.length >= QUESTION_COUNT || !item || typeof item !== 'object') continue;
    const evidence = typeof item.evidence === 'string' ? item.evidence.replace(/\s+/g, ' ').trim() : '';
    const normalizedEvidence = normalizeForMatch(evidence).replace(/\s+/g, ' ').trim();
    if (normalizedEvidence.length < 12 || !normalizedTranscript.includes(normalizedEvidence)) {
      console.warn('[SuggestedQuestions Grounding] Loại câu hỏi có evidence không tồn tại trong transcript.');
      continue;
    }
    const normalizedQuestion = normalizeSuggestedQuestions([item.question], transcriptText)[0];
    if (!normalizedQuestion || validated.some(entry => normalizeForMatch(entry.question) === normalizeForMatch(normalizedQuestion))) continue;
    validated.push({ question: normalizedQuestion, evidence });
  }
  return validated;
}

/**
 * 1. Trả về 4 câu hỏi gợi ý bám sát bài học theo ngữ cảnh (Fallback an toàn 0 token, 0ms)
 * @param {string} lessonTitle 
 * @param {string} courseName 
 * @param {string} sourceText
 * @returns {Array<string>} 4 câu hỏi gợi ý
 */
function getFallbackSuggestedQuestions(lessonTitle = '', courseName = '', sourceText = '') {
  const groundedTerms = extractGroundedTerms(sourceText);
  if (groundedTerms.length > 0) {
    const templates = [
      term => `Giáo viên giải thích gì về “${term}” trong bài?`,
      term => `Bài giảng nêu điểm nào liên quan đến “${term}”?`,
      term => `Nội dung về “${term}” được trình bày như thế nào?`,
      term => `Bài giảng nhấn mạnh điều gì khi nói về “${term}”?`
    ];

    return templates.map((template, index) => template(groundedTerms[index % groundedTerms.length]));
  }

  return [];
}

/**
 * 2. Lấy 4 câu hỏi gợi ý cho một bài học từ Database (tự động làm mới nếu là câu hỏi generic cũ)
 * @param {number|string} lessonId 
 * @param {boolean} forceRefresh - Bắt buộc tạo lại câu hỏi mới với Gemini
 * @returns {Promise<Array<string>>}
 */
async function getSuggestedQuestionsByLessonId(lessonId, forceRefresh = false) {
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
    return markGenerationUsage(getFallbackSuggestedQuestions());
  }

  try {
    const res = await db.query(`
      SELECT l.title AS lesson_title, s.title AS section_title, c.course_name, ls.cues, q.questions
      FROM lessons l
      LEFT JOIN sections s ON l.section_id = s.section_id
      LEFT JOIN courses c ON s.course_id = c.course_id
      LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
      LEFT JOIN lesson_suggested_questions q ON q.lesson_id = l.lesson_id
      WHERE l.lesson_id = $1
      LIMIT 1
    `, [parsedLessonId]);

    if (res.rows.length === 0) return markGenerationUsage(getFallbackSuggestedQuestions());

    const { lesson_title, section_title, course_name, cues, questions: dbQuestions } = res.rows[0];
    const transcriptCues = cues || [];
    const transcriptText = buildTranscriptText(transcriptCues);
    if (!transcriptText) return markGenerationUsage([], false, false);

    if (!forceRefresh && dbQuestions) {
      let questions = dbQuestions;
      if (typeof questions === 'string') {
        try { questions = JSON.parse(questions); } catch (_) {}
      }
      const normalizedItems = normalizeSuggestedItems(questions, transcriptText);
      if (normalizedItems.length === QUESTION_COUNT) {
        return markGenerationUsage(normalizedItems.map(item => item.question), false, true);
      }
    }

    // Nếu forceRefresh, hoặc questions là dạng generic cũ, hoặc chưa có câu hỏi -> tạo mới và lưu DB
    return generateAndSaveSuggestedQuestions(parsedLessonId, transcriptCues);
  } catch (err) {
    console.warn(`[SuggestedQuestions Warning] Lỗi đọc DB lessonId=${lessonId}:`, err.message);
    return markGenerationUsage(getFallbackSuggestedQuestions());
  }
}

/**
 * 3. Tự động sinh và lưu 4 câu hỏi gợi ý bám sát 100% video transcript của bài học
 * @param {number|string} lessonId 
 * @param {Array<Object>|null} cues - Mảng phụ đề cues [{ start, end, en, vi }]
 * @returns {Promise<Array<string>>}
 */
async function generateAndSaveSuggestedQuestions(lessonId, cues = null) {
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
    return markGenerationUsage(getFallbackSuggestedQuestions());
  }

  try {
    console.log(`[SuggestedQuestions] 🚀 Bắt đầu sinh câu hỏi gợi ý 100% bám sát video cho lessonId=${parsedLessonId}...`);

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
      return markGenerationUsage(getFallbackSuggestedQuestions());
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

    const transcriptText = buildTranscriptText(transcriptCues);
    if (!transcriptText || transcriptText.length <= 30) {
      console.log(`[SuggestedQuestions] Không gọi Gemini vì lessonId=${parsedLessonId} chưa có transcript sử dụng được.`);
      return markGenerationUsage([], false, false);
    }

    // 3. Xây dựng Prompt nghiêm ngặt: 100% DỰA TRÊN LỜI THOẠI/VIDEO THỰC TẾ
    const prompt = `Bạn là Trợ lý AI giáo dục chuyên sâu tại E-Learn Academy.
Dưới đây là TOÀN BỘ LỜI THOẠI / TRANSCRIPT THỰC TẾ ĐƯỢC BÓC BĂNG TỪ VIDEO BÀI HỌC:
- Khóa học: ${course_name || 'Khóa học tiếng Anh'}
- Chương: ${section_title || 'Chương học'}
- Bài học: ${lesson_title || 'Bài học'}
--- TRANSCRIPT VIDEO THỰC TẾ ---
${transcriptText}
-------------------------------

QUY TẮC BẮT BUỘC 100% (VI PHẠM LÀ LỖI NGHIÊM TRỌNG):
1. 100% CÂU HỎI PHẢI ĐƯỢC RÚT RA TỪ NỘI DUNG VÀ SỰ THẬT CÓ TRONG TRANSCRIPT TRÊN.
2. MỖI CÂU HỎI BẮT BUỘC PHẢI CÓ CÂU TRẢ LỜI NẰM NGAY TRONG LỜI THOẠI CỦA GIÁO VIÊN. TUYỆT ĐỐI KHÔNG sinh ra câu hỏi mà transcript không có câu trả lời (ví dụ: TUYỆT ĐỐI KHÔNG hỏi về lỗi sai, quy tắc ngữ pháp hoặc từ vựng nếu transcript không hề đề cập tới).
3. Hãy tạo ĐÚNG 4 CÂU HỎI tự nhiên, súc tích mà học viên sẽ hỏi để hiểu sâu video:
   - Dạng 1: Khái niệm / Định nghĩa / Bản chất được giáo viên giải thích trong video.
   - Dạng 2: Ví dụ minh họa thực tế / Tình huống cụ thể được giáo viên nêu ra trong video.
   - Dạng 3: Cách phát âm, mẫu câu, hoặc quy tắc được giáo viên hướng dẫn trong video.
   - Dạng 4: Ý nghĩa trọng tâm hoặc đoạn video giải thích điều gì.
4. Mỗi câu hỏi dài từ 6 đến 16 từ (dưới 85 ký tự) và bắt buộc kết thúc bằng dấu '?'.
5. Trả về DUY NHẤT một JSON hợp lệ theo schema sau (kèm evidence là 1 câu thoại ngắn trong transcript chứng minh câu hỏi này có trong video):
{
  "items": [
    { "question": "Câu hỏi 1?", "evidence": "câu thoại trích dẫn từ transcript" },
    { "question": "Câu hỏi 2?", "evidence": "câu thoại trích dẫn từ transcript" },
    { "question": "Câu hỏi 3?", "evidence": "câu thoại trích dẫn từ transcript" },
    { "question": "Câu hỏi 4?", "evidence": "câu thoại trích dẫn từ transcript" }
  ]
}`;

    // 4. Gọi Gemini với Timeout 45s
    let generatedItems = null;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Suggested Questions Generation Timeout (45000ms)')), 45000)
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
      if (parsed && Array.isArray(parsed.items)) {
        generatedItems = normalizeSuggestedItems(parsed.items, transcriptText);
      }
    } catch (aiErr) {
      console.warn(`[SuggestedQuestions Warning] Gemini gặp lỗi/timeout cho lessonId=${parsedLessonId}:`, aiErr.message);
    }

    // Nếu AI không trả về đủ 4 câu hỏi -> Sử dụng Fallback ngữ cảnh
    if (!generatedItems || generatedItems.length !== QUESTION_COUNT) {
      console.log(`[SuggestedQuestions] ⚠️ Dùng fallback ngữ cảnh bài học (lessonId=${parsedLessonId})`);
      const evidence = transcriptText.slice(0, 240).trim();
      generatedItems = getFallbackSuggestedQuestions(lesson_title, course_name, transcriptText)
        .map(question => ({ question, evidence }));
    }

    // 5. Lưu / Ghi đè vào bảng lesson_suggested_questions
    await saveQuestionsToDb(parsedLessonId, generatedItems);
    console.log(`[SuggestedQuestions] ✅ Đã lưu thành công 4 câu hỏi gợi ý 100% bám sát video cho lessonId=${parsedLessonId} ("${lesson_title}")`);

    return markGenerationUsage(generatedItems.map(item => item.question), true, true);
  } catch (err) {
    console.error(`[SuggestedQuestions Error] Lỗi sinh câu hỏi gợi ý cho lessonId=${parsedLessonId}:`, err.message);
    return markGenerationUsage(getFallbackSuggestedQuestions());
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
  normalizeSuggestedItems,
  getFallbackSuggestedQuestions,
  getSuggestedQuestionsByLessonId,
  generateAndSaveSuggestedQuestions,
  saveQuestionsToDb
};
