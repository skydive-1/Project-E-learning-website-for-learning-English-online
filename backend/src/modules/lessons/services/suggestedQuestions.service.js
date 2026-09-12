/**
 * Lesson Suggested Questions Service (Udemy-like AI Assistant Feature)
 * - Tự động sinh và lưu trữ 4 câu hỏi gợi ý cho từng bài học bám sát 100% nội dung bài giảng như Udemy
 * - Sử dụng Gemini AI để phân tích Course, Section, Lesson Title và Transcript thực tế
 * - Cơ chế Deterministic Fallback ngữ cảnh thông minh (0 token, 0ms) khi offline/hết quota
 * - Tự động phát hiện và làm mới các bộ câu hỏi generic hoặc filler words cũ trong database
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
const suggestedQuestionGenerationJobs = new Map();

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
  /loi thuong gap/,
  /giao vien giai thich gi ve/i,
  /bai giang neu diem nao lien quan den/i,
  /noi dung ve .* duoc trinh bay nhu the nao/i,
  /bai giang nhan manh dieu gi khi noi ve/i,
  /dinh nghia va nguyen ly cua/i,
  /noi dung cot loi cua/i,
  /vi du minh hoa tieu bieu cho/i,
  /cach ap dung .* trong giao tiep thuc te/i,
  /“(con|thi|chung|nguoi|minh|nha|cau|toi|ban|hai|phan|thu|cho|voi|de|ma|o|co|la|phat|sinh|nguy|vung|sound)”/i
];

const GROUNDING_STOP_WORDS = new Set([
  // Tiếng Việt: Hư từ, đại từ xưng hô, chỉ từ, trợ từ, liên từ, số đếm, từ cảm thán & âm tiết rời rạc
  'bai', 'hoc', 'nay', 'trong', 'cua', 'nhung', 'mot', 'cac', 'cho', 'voi', 'the', 'nao',
  'nghia', 'giai', 'thich', 'tom', 'tat', 'noi', 'dung', 'chinh', 'kien', 'thuc', 'quan',
  'duoc', 'dung', 'khi', 'dau', 'vi', 'sao', 'con', 'thi', 'chung', 'nguoi', 'minh', 'nha',
  'cau', 'toi', 'ta', 'ban', 'em', 'anh', 'chi', 'thay', 'co', 'ho', 'no', 'khong', 'co',
  'la', 'o', 'ma', 'de', 'va', 'da', 'dang', 'se', 'roi', 'lai', 'ra', 'vao', 'den', 'di',
  've', 'rat', 'lam', 'nhe', 'nha', 'ha', 'day', 'do', 'kia', 'ay', 'cai', 'chiec', 'buc',
  'tam', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi', 'cung', 'deu',
  'hon', 'nhat', 'chi', 'moi', 'nua', 'het', 'chu', 'nhu', 'khoang', 'ai', 'gi', 'nao',
  'hoi', 'noi', 'nghe', 'doc', 'viet', 'xem', 'thay', 'biet', 'muon', 'can', 'phai', 'nen',
  'bi', 'boi', 'tu', 'tai', 'theo', 'nhieu', 'it', 'truoc', 'sau', 'giua', 'tren', 'duoi',
  'day', 'nhe', 'nhi', 'a', 'oi', 'u', 'da', 'vang', 'thua', 'chao', 'cam', 'on', 'tam', 'biet',
  'chac', 'danh', 'nganh', 'chuy', 'truy', 'mang', 'sinh', 'nguy', 'nghi', 'khoa', 'chim',
  'manh', 'nhau', 'vung', 'thanh', 'huong', 'phuong', 'giang', 'nghiem', 'duong', 'luong',
  'tieng', 'thao', 'loan', 'thuan', 'quyen', 'khoan', 'phien', 'doan', 'bien', 'kiem',
  'diem', 'buoc', 'chuc', 'hoat', 'xuat', 'phat', 'chat', 'luat', 'toan', 'thoi', 'ngay',
  'dem', 'sang', 'chieu', 'trua', 'tuan', 'thang', 'nam', 'dong', 'chay', 'ngoi', 'nhin',
  'hieu', 'quen', 'chua', 'luon', 'nham', 'giong', 'khac', 'rieng', 'tong', 'hop', 'bang',
  'hinh', 'anh', 'thong', 'tin', 'chia', 'cap', 'sound',

  // English: pronouns, prepositions, articles, auxiliary verbs, common particles
  'the', 'a', 'an', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'to', 'at', 'in', 'on', 'by', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will',
  'just', 'should', 'now', 'you', 'your', 'we', 'our', 'they', 'their', 'he',
  'his', 'she', 'her', 'it', 'its', 'this', 'that', 'these', 'those', 'lesson',
  'course', 'video', 'and', 'but', 'or', 'if', 'because', 'as', 'until', 'while'
]);

function markGenerationUsage(
  questions,
  generatedByAi = false,
  contentAvailable = null,
  refreshing = false,
  transcriptStatus = null
) {
  const result = Array.isArray(questions) ? questions : [];
  Object.defineProperty(result, 'generatedByAi', { value: generatedByAi, enumerable: false });
  Object.defineProperty(result, 'contentAvailable', { value: contentAvailable, enumerable: false });
  Object.defineProperty(result, 'refreshing', { value: refreshing, enumerable: false });
  Object.defineProperty(result, 'transcriptStatus', { value: transcriptStatus, enumerable: false });
  return result;
}

function queueSuggestedQuestionGeneration(lessonId, cues = null) {
  const jobKey = String(parseInt(lessonId, 10));
  if (suggestedQuestionGenerationJobs.has(jobKey)) {
    return suggestedQuestionGenerationJobs.get(jobKey);
  }

  const job = Promise.resolve()
    .then(() => generateAndSaveSuggestedQuestions(lessonId, cues))
    .catch((error) => {
      console.warn(`[SuggestedQuestions] Làm mới nền thất bại cho lessonId=${lessonId}:`, error.message);
      return [];
    })
    .finally(() => {
      if (suggestedQuestionGenerationJobs.get(jobKey) === job) {
        suggestedQuestionGenerationJobs.delete(jobKey);
      }
    });

  suggestedQuestionGenerationJobs.set(jobKey, job);
  return job;
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

/**
 * Xây dựng văn bản transcript liên tục, chuẩn hóa song ngữ và lọc nhiễu âm nhạc
 * Giữ nguyên tính liên tục của lời thoại, không nhảy cóc làm đứt nghĩa câu
 */
function buildTranscriptText(cues = [], maxChars = 12000) {
  if (typeof cues === 'string') return cues.trim().slice(0, maxChars);
  if (!Array.isArray(cues) || cues.length === 0) return '';

  const cleanLines = [];
  let currentLength = 0;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!cue) continue;

    const en = String(cue.en || '').trim();
    const vi = String(cue.vi || '').trim();
    const text = String(cue.text || '').trim();

    let selected = '';
    if (vi && en && vi !== en) {
      const normVi = normalizeForMatch(vi);
      const normEn = normalizeForMatch(en);
      if (normVi === normEn) {
        selected = vi;
      } else {
        const viTokens = new Set(normVi.split(/\s+/).filter(Boolean));
        const enTokens = new Set(normEn.split(/\s+/).filter(Boolean));
        let common = 0;
        for (const t of viTokens) {
          if (enTokens.has(t)) common++;
        }
        const overlap = common / Math.max(viTokens.size, enTokens.size, 1);
        if (overlap >= 0.4) {
          selected = vi.length >= en.length ? vi : en;
        } else {
          selected = `${en} (${vi})`;
        }
      }
    } else {
      selected = vi || en || text;
    }

    selected = selected.replace(/\s+/g, ' ').trim();
    if (!selected || /^\[.*?\]$/.test(selected) || /^>>\s*\[.*?\]$/.test(selected)) {
      continue;
    }
    selected = selected.replace(/^>>\s*/, '');

    if (currentLength + selected.length + 1 > maxChars) {
      break;
    }

    cleanLines.push(selected);
    currentLength += selected.length + 1;
  }

  return cleanLines.join(' ');
}

/**
 * Trích xuất thuật ngữ chuyên môn có giá trị học thuật từ transcript
 * Ưu tiên các từ vựng tiếng Anh (English terms) hoặc danh từ chuyên môn, loại bỏ hư từ
 */
function extractGroundedTerms(sourceText = '', limit = QUESTION_COUNT) {
  if (!sourceText || typeof sourceText !== 'string') return [];

  const frequency = new Map();
  const rawWords = String(sourceText).match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];

  for (let i = 0; i < rawWords.length; i++) {
    const raw = rawWords[i];
    const norm = normalizeForMatch(raw);

    if (GROUNDING_STOP_WORDS.has(norm)) continue;
    if (/^\d+$/.test(norm)) continue;

    const isSpecialShort = ['ipa', 'ielts', 'toeic'].includes(norm);
    if (norm.length < 4 && !isSpecialShort) continue;

    // Ưu tiên cao hơn cho từ vựng tiếng Anh hoặc tên riêng viết hoa
    const isEnglishWord = /^[a-zA-Z]{4,24}$/.test(raw);
    const isCapitalized = /^[A-Z]/.test(raw);
    const priorityBonus = isEnglishWord ? 3 : (isCapitalized ? 1 : 0);

    const current = frequency.get(norm) || {
      count: 0,
      priorityBonus,
      firstIndex: i,
      display: raw
    };
    current.count += 1;
    frequency.set(norm, current);
  }

  return [...frequency.entries()]
    .sort((a, b) => {
      const scoreA = a[1].count * 2 + a[1].priorityBonus * 3;
      const scoreB = b[1].count * 2 + b[1].priorityBonus * 3;
      return scoreB - scoreA || a[1].firstIndex - b[1].firstIndex;
    })
    .slice(0, limit)
    .map(([, meta]) => meta.display);
}

/**
 * Kiểm tra xem bộ câu hỏi có chứa các mẫu câu hỏi generic cũ hoặc filler words vô nghĩa không
 */
function isLegacyGenericQuestionSet(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) return true;
  return questions.some(rawQuestion => {
    const text = typeof rawQuestion === 'string' ? rawQuestion : rawQuestion?.question || '';
    const normalized = normalizeForMatch(text);
    return LEGACY_QUESTION_PATTERNS.some(pattern => pattern.test(normalized));
  });
}

function normalizeSuggestedQuestions(questions = [], sourceText = '') {
  if (!Array.isArray(questions) || !String(sourceText).trim()) return [];

  const sourceTokens = new Set(getMeaningfulTokens(sourceText));
  const requireGrounding = sourceTokens.size > 0;
  const normalizedSource = normalizeForMatch(sourceText);
  const sourceHasMistakeTerms = /loi|sai|nham|mistake|error|fault|wrong/.test(normalizedSource);
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
      // Bắt buộc câu hỏi phải có ít nhất 1 từ khóa có ý nghĩa xuất hiện trong bài giảng
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

/**
 * Kiểm tra tính xác thực (Grounding) của Evidence:
 * - Khớp chính xác chuỗi con (Exact match)
 * - Hoặc khớp từ khóa mờ (Fuzzy token overlap >= 65%)
 */
function isEvidenceGrounded(evidence = '', transcriptText = '', normalizedTranscript = '') {
  if (!evidence || typeof evidence !== 'string') return false;
  const cleanEvidence = evidence.trim();
  if (cleanEvidence.length < 6) return false;

  const normEv = normalizeForMatch(cleanEvidence).replace(/\s+/g, ' ').trim();
  if (normEv.length < 6) return false;

  // 1. Kiểm tra khớp chuỗi tuyệt đối
  if (normalizedTranscript.includes(normEv)) return true;

  // 2. Kiểm tra khớp từ khóa mờ (Fuzzy token overlap)
  const evTokens = normEv.split(/\s+/).filter(t => t.length >= 3 && !GROUNDING_STOP_WORDS.has(t));
  if (evTokens.length === 0) {
    return normEv.length >= 10 && normalizedTranscript.includes(normEv.slice(0, 10));
  }

  const matchedTokens = evTokens.filter(t => normalizedTranscript.includes(t));
  const ratio = matchedTokens.length / evTokens.length;

  if (evTokens.length <= 2) {
    return matchedTokens.length === evTokens.length;
  }

  return ratio >= 0.65;
}

function normalizeSuggestedItems(items = [], transcriptText = '') {
  if (!Array.isArray(items) || !String(transcriptText).trim()) return [];
  const normalizedTranscript = normalizeForMatch(transcriptText).replace(/\s+/g, ' ').trim();
  const validated = [];

  for (const item of items) {
    if (validated.length >= QUESTION_COUNT || !item || typeof item !== 'object') continue;
    const evidence = typeof item.evidence === 'string' ? item.evidence.replace(/\s+/g, ' ').trim() : '';

    if (!isEvidenceGrounded(evidence, transcriptText, normalizedTranscript)) {
      console.warn(`[SuggestedQuestions Grounding] 🛑 Loại câu hỏi có evidence không khớp transcript: "${evidence}"`);
      continue;
    }

    const normalizedQuestion = normalizeSuggestedQuestions([item.question], transcriptText)[0];
    if (!normalizedQuestion) continue;
    if (validated.some(entry => normalizeForMatch(entry.question) === normalizeForMatch(normalizedQuestion))) continue;

    validated.push({ question: normalizedQuestion, evidence });
  }

  return validated;
}

/**
 * 1. Trả về 4 câu hỏi gợi ý thông minh bám sát bài học theo ngữ cảnh (Fallback an toàn 0 token, 0ms)
 * @param {string} lessonTitle 
 * @param {string} courseName 
 * @param {string} sourceText 
 * @param {string} sectionTitle 
 * @returns {Array<string>} 4 câu hỏi bám sát transcript, hoặc mảng rỗng nếu không có căn cứ
 */
function getFallbackSuggestedQuestions(lessonTitle = '', courseName = '', sourceText = '', sectionTitle = '') {
  const groundedTerms = extractGroundedTerms(sourceText, QUESTION_COUNT);
  if (groundedTerms.length === 0) return [];

  const templates = [
    term => /^[a-zA-Z]{3,}$/.test(term)
      ? `Từ vựng “${term}” trong bài giảng mang ý nghĩa gì?`
      : `Trọng tâm và ví dụ chính về “${term}” trong bài là gì?`,
    term => /^[a-zA-Z]{3,}$/.test(term)
      ? `Giáo viên hướng dẫn cách dùng “${term}” như thế nào?`
      : `Điểm then chốt cần chú ý liên quan đến “${term}” là gì?`,
    term => `Ngữ cảnh và ví dụ xuất hiện của “${term}” trong bài là gì?`,
    term => `Nội dung bài giảng hướng dẫn ứng dụng “${term}” ra sao?`
  ];

  return templates.slice(0, QUESTION_COUNT).map((template, index) =>
    template(groundedTerms[index % groundedTerms.length])
  );
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
      SELECT l.title AS lesson_title, s.title AS section_title, c.course_name,
             l.content_type, l.content_url,
             ls.cues, ls.subtitle_status, q.questions
      FROM lessons l
      LEFT JOIN sections s ON l.section_id = s.section_id
      LEFT JOIN courses c ON s.course_id = c.course_id
      LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
      LEFT JOIN lesson_suggested_questions q ON q.lesson_id = l.lesson_id
      WHERE l.lesson_id = $1
      LIMIT 1
    `, [parsedLessonId]);

    if (res.rows.length === 0) return markGenerationUsage(getFallbackSuggestedQuestions());

    const {
      lesson_title, section_title, course_name,
      content_type, content_url,
      cues, subtitle_status, questions: dbQuestions
    } = res.rows[0];

    let transcriptCues = cues || [];
    let transcriptText = buildTranscriptText(transcriptCues);

    // Không giữ request của học viên để chờ bóc băng. Pipeline phụ đề chạy nền,
    // còn endpoint trả trạng thái để frontend tự cập nhật khi transcript sẵn sàng.
    let transcriptStatus = subtitle_status || 'none';
    const isVideoLesson = ['video', 'youtube'].includes(content_type) && Boolean(content_url);
    if (!transcriptText && isVideoLesson) {
      const shouldQueue = !['pending', 'processing', 'failed'].includes(transcriptStatus)
        || (transcriptStatus === 'failed' && forceRefresh);
      if (shouldQueue) {
        try {
          const subtitlesService = require('./subtitles.service');
          const queued = await subtitlesService.queueAutoGeneration(parsedLessonId);
          if (queued) transcriptStatus = 'pending';
        } catch (error) {
          console.warn(`[SuggestedQuestions] Chuẩn bị transcript nền thất bại cho lessonId=${parsedLessonId}:`, error.message);
        }
      }
    }

    if (!transcriptText) {
      // Nếu video đang được xếp hàng xử lý (pending / processing)
      if (subtitle_status === 'pending' || subtitle_status === 'processing') {
        console.log(`[SuggestedQuestions] Bài học ${parsedLessonId} đang xử lý phụ đề (status=${subtitle_status}).`);
      }
      return markGenerationUsage(
        [],
        false,
        false,
        transcriptStatus === 'pending' || transcriptStatus === 'processing',
        transcriptStatus
      );
    }

    if (dbQuestions) {
      let questions = dbQuestions;
      if (typeof questions === 'string') {
        try { questions = JSON.parse(questions); } catch (_) {}
      }

      const questionTexts = Array.isArray(questions)
        ? questions.map(q => (typeof q === 'string' ? q : q?.question || ''))
        : [];

      const isLegacy = isLegacyGenericQuestionSet(questionTexts);
      if (!isLegacy) {
        const normalizedItems = normalizeSuggestedItems(questions, transcriptText);
        if (normalizedItems.length === QUESTION_COUNT) {
          if (forceRefresh) queueSuggestedQuestionGeneration(parsedLessonId, transcriptCues);
          return markGenerationUsage(
            normalizedItems.map(item => item.question),
            false,
            true,
            forceRefresh,
            'ready'
          );
        }
      } else {
        console.log(`[SuggestedQuestions] 🔄 Phát hiện câu hỏi generic cũ trong DB cho lessonId=${parsedLessonId}, tự động làm mới...`);
      }
    }

    // Đường nhanh: trả câu hỏi deterministic bám transcript ngay sau một DB read.
    // Gemini chỉ nâng cấp và lưu bộ câu hỏi ở nền, không chặn màn hình bài học.
    const fallbackQuestions = getFallbackSuggestedQuestions(
      lesson_title,
      course_name,
      transcriptText,
      section_title
    );
    if (fallbackQuestions.length === QUESTION_COUNT) {
      queueSuggestedQuestionGeneration(parsedLessonId, transcriptCues);
      return markGenerationUsage(fallbackQuestions, false, true, true, 'ready');
    }

    return markGenerationUsage([], false, true, false, 'ready');
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
      try {
        const subtitlesService = require('./subtitles.service');
        subtitlesService.queueAutoGeneration(parsedLessonId);
      } catch (_) {}
      return markGenerationUsage([], false, false);
    }

    // 3. Xây dựng Prompt chuyên sâu: 100% DỰA TRÊN LỜI THOẠI/VIDEO THỰC TẾ
    const prompt = `Bạn là Trợ lý AI giáo dục chuyên sâu tại E-Learn Academy.
Dưới đây là TOÀN BỘ LỜI THOẠI / TRANSCRIPT THỰC TẾ ĐƯỢC BÓC BĂNG TỪ VIDEO BÀI HỌC:
- Khóa học: ${course_name || 'Khóa học tiếng Anh'}
- Chương: ${section_title || 'Chương học'}
- Bài học: ${lesson_title || 'Bài học'}
--- TRANSCRIPT VIDEO THỰC TẾ ---
${transcriptText}
-------------------------------

QUY TẮC BẮT BUỘC 100% (VI PHẠM LÀ LỖI NGHIÊM TRỌNG):
1. 100% CÂU HỎI PHẢI RÚT RA TỪ NỘI DUNG VÀ KIẾN THỨC CÓ THỰC TRONG TRANSCRIPT TRÊN.
2. MỖI CÂU HỎI PHẢI CÓ CÂU TRẢ LỜI RÕ RÀNG TRONG LỜI GIẢNG CỦA GIÁO VIÊN.
3. Hãy tạo ĐÚNG 5 CÂU HỎI chất lượng cao, tự nhiên và kích thích tư duy học tập:
   - Dạng 1: Nghĩa, cách dùng hoặc ngữ cảnh của một từ vựng / thuật ngữ cụ thể được dạy trong video (ví dụ: từ vựng tiếng Anh quan trọng).
   - Dạng 2: Quy tắc, cấu trúc câu hoặc cách phát âm/luyện nghe được giáo viên chỉ dẫn trong video.
   - Dạng 3: Ví dụ thực tế, tình huống minh họa hoặc mẹo/bước làm bài mà giáo viên nêu ra.
   - Dạng 4: Thông điệp cốt lõi, ý nghĩa trọng tâm hoặc câu hỏi kiểm tra độ hiểu bài dựa trên lời giảng.
   - Dạng 5: Cách phân biệt, liên hệ hoặc ứng dụng kiến thức bài giảng vào thực hành.
4. TUYỆT ĐỐI KHÔNG đặt câu hỏi chung chung vô thưởng vô phạt như: "Đoạn video này giải thích điều gì?", "Video này nói về cái gì?", "Nội dung bài học là gì?".
5. Mỗi câu hỏi dài từ 6 đến 16 từ (dưới 85 ký tự) và bắt buộc kết thúc bằng dấu '?'.
6. Trả về DUY NHẤT một JSON hợp lệ theo schema sau (kèm evidence là 1 cụm từ hoặc câu ngắn 4-15 từ trích nguyên văn từ transcript):
{
  "items": [
    { "question": "Câu hỏi 1?", "evidence": "cụm từ trích nguyên văn từ transcript" },
    { "question": "Câu hỏi 2?", "evidence": "cụm từ trích nguyên văn từ transcript" },
    { "question": "Câu hỏi 3?", "evidence": "cụm từ trích nguyên văn từ transcript" },
    { "question": "Câu hỏi 4?", "evidence": "cụm từ trích nguyên văn từ transcript" },
    { "question": "Câu hỏi 5?", "evidence": "cụm từ trích nguyên văn từ transcript" }
  ]
}`;

    // 4. Gọi Gemini với Timeout 45s
    let generatedItems = null;
    let generationTimeout = null;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        generationTimeout = setTimeout(
          () => reject(new Error('Suggested Questions Generation Timeout (45000ms)')),
          45000
        );
      });

      const aiResponse = await Promise.race([
        geminiModel.generateContent({
          purpose: 'rag_suggested_questions',
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
    } finally {
      if (generationTimeout) clearTimeout(generationTimeout);
    }

    // Nếu AI trả về ít hơn 4 câu hỏi hợp lệ:
    // Giữ lại các câu hỏi hợp lệ của AI (nếu có) và bổ sung bằng smart fallback
    if (!generatedItems || generatedItems.length < QUESTION_COUNT) {
      const existingCount = generatedItems ? generatedItems.length : 0;
      console.log(`[SuggestedQuestions] ⚠️ AI trả về ${existingCount}/${QUESTION_COUNT} câu hỏi hợp lệ cho lessonId=${parsedLessonId}, bổ sung fallback thông minh...`);
      const neededCount = QUESTION_COUNT - existingCount;
      const fallbackQuestions = getFallbackSuggestedQuestions(lesson_title, course_name, transcriptText, section_title)
        .slice(0, neededCount);
      const evidence = transcriptText.slice(0, 240).trim();
      const supplementalItems = fallbackQuestions.map(question => ({ question, evidence }));
      generatedItems = [...(generatedItems || []), ...supplementalItems];
    }

    // Lấy đúng 4 câu hỏi tốt nhất
    generatedItems = generatedItems.slice(0, QUESTION_COUNT);

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

/**
 * 5. Tự động sinh câu hỏi gợi ý từ tài liệu bài học (PDF) nếu bài học chưa có câu hỏi video
 */
async function generateQuestionsFromMaterialIfNeeded(lessonId, materialText, fileName = '') {
  const parsedLessonId = parseInt(lessonId, 10);
  if (!parsedLessonId || !materialText || materialText.trim().length < 50) return;

  try {
    const existRes = await db.query(
      'SELECT questions FROM lesson_suggested_questions WHERE lesson_id = $1',
      [parsedLessonId]
    );
    if (existRes.rows.length > 0) {
      let q = existRes.rows[0].questions;
      if (typeof q === 'string') {
        try { q = JSON.parse(q); } catch (_) {}
      }
      const texts = Array.isArray(q) ? q.map(item => typeof item === 'string' ? item : item?.question) : [];
      if (!isLegacyGenericQuestionSet(texts) && texts.length === QUESTION_COUNT) {
        return; // Đã có bộ câu hỏi chất lượng cao
      }
    }

    const infoRes = await db.query(`
      SELECT l.title AS lesson_title, s.title AS section_title, c.course_name
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE l.lesson_id = $1
    `, [parsedLessonId]);

    if (infoRes.rows.length === 0) return;
    const { lesson_title, section_title, course_name } = infoRes.rows[0];

    console.log(`[SuggestedQuestions] 📄 Tự động sinh câu hỏi từ tài liệu "${fileName}" cho lessonId=${parsedLessonId}...`);
    const cleanMaterialText = materialText.slice(0, 10000).trim();

    const prompt = `Bạn là Trợ lý AI giáo dục chuyên sâu tại E-Learn Academy.
Dưới đây là NỘI DUNG TÀI LIỆU HỌC TẬP ĐÍNH KÈM CỦA BÀI HỌC:
- Khóa học: ${course_name || 'Khóa học tiếng Anh'}
- Chương: ${section_title || 'Chương học'}
- Bài học: ${lesson_title || 'Bài học'}
- Tên tài liệu: ${fileName || 'Tài liệu bài học'}
--- NỘI DUNG TÀI LIỆU ---
${cleanMaterialText}
-----------------------

QUY TẮC BẮT BUỘC 100%:
1. 100% CÂU HỎI PHẢI RÚT RA TỪ NỘI DUNG VÀ KIẾN THỨC CÓ THỰC TRONG TÀI LIỆU TRÊN.
2. MỖI CÂU HỎI PHẢI CÓ CÂU TRẢ LỜI RÕ RÀNG TRONG TÀI LIỆU.
3. Hãy tạo ĐÚNG 5 CÂU HỎI chất lượng cao bám sát từ vựng, quy tắc ngữ pháp hoặc ví dụ trong tài liệu.
4. Mỗi câu hỏi dài từ 6 đến 16 từ (dưới 85 ký tự) và kết thúc bằng dấu '?'.
5. Trả về DUY NHẤT một JSON hợp lệ:
{
  "items": [
    { "question": "Câu hỏi 1?", "evidence": "cụm từ ngắn trích nguyên văn từ tài liệu" },
    { "question": "Câu hỏi 2?", "evidence": "cụm từ ngắn trích nguyên văn từ tài liệu" },
    { "question": "Câu hỏi 3?", "evidence": "cụm từ ngắn trích nguyên văn từ tài liệu" },
    { "question": "Câu hỏi 4?", "evidence": "cụm từ ngắn trích nguyên văn từ tài liệu" },
    { "question": "Câu hỏi 5?", "evidence": "cụm từ ngắn trích nguyên văn từ tài liệu" }
  ]
}`;

    const aiResponse = await geminiModel.generateContent({
      purpose: 'rag_suggested_questions',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    let text = aiResponse.response ? aiResponse.response.text() : '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);

    if (parsed && Array.isArray(parsed.items)) {
      const valid = normalizeSuggestedItems(parsed.items, cleanMaterialText);
      if (valid.length >= QUESTION_COUNT) {
        await saveQuestionsToDb(parsedLessonId, valid.slice(0, QUESTION_COUNT));
        console.log(`[SuggestedQuestions] ✅ Đã lưu thành công 4 câu hỏi từ tài liệu cho lessonId=${parsedLessonId}`);
      }
    }
  } catch (err) {
    console.warn(`[SuggestedQuestions] Lỗi sinh câu hỏi từ tài liệu lessonId=${parsedLessonId}:`, err.message);
  }
}

module.exports = {
  buildTranscriptText,
  isLegacyGenericQuestionSet,
  normalizeSuggestedQuestions,
  normalizeSuggestedItems,
  getFallbackSuggestedQuestions,
  getSuggestedQuestionsByLessonId,
  generateAndSaveSuggestedQuestions,
  queueSuggestedQuestionGeneration,
  generateQuestionsFromMaterialIfNeeded,
  saveQuestionsToDb,
  extractGroundedTerms,
  GROUNDING_STOP_WORDS
};
