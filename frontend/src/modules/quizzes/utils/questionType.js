const TYPE_ALIASES = {
  writing: 'writing',
  written: 'writing',
  essay: 'writing',
  tu_luan: 'writing',
  'tự_luận': 'writing',
  pronunciation: 'pronunciation',
  speaking: 'pronunciation',
  audio: 'pronunciation',
  oral: 'pronunciation',
  read_aloud: 'pronunciation',
  open_cloze: 'open_cloze',
  cloze: 'open_cloze',
  gap_fill: 'open_cloze',
  fill_in_the_blanks: 'open_cloze',
  listening: 'listening',
  listen: 'listening',
  reading: 'reading',
  read: 'reading',
  multiple_choice: 'multiple_choice',
  multiplechoice: 'multiple_choice',
  mcq: 'multiple_choice'
};

const SPEAKING_PROMPT_PATTERN = /\b(?:speak|speaking|say|pronounce|pronunciation|repeat(?:\s+after\s+me)?|read\b[\s\S]*?\baloud|oral\s+(?:answer|response)|record\s+(?:your\s+)?(?:voice|answer)|answer\s+(?:out\s+)?loud)\b|phát\s*âm|đọc[\s\S]*?(?:thành\s*tiếng|to\s+(?:và\s+)?rõ)|\b(?:nói|ghi\s*âm|thu\s*âm)\b/iu;
const WRITING_PROMPT_PATTERN = /\b(?:write|writing|essay|paragraph|respond in writing|describe)\b|viết\s*(?:đoạn|câu|bài|tự\s*luận)?|\btự\s*luận\b/iu;

const normalizeType = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TYPE_ALIASES[normalized] || '';
};

/**
 * Chuẩn hóa loại câu hỏi từ metadata mới và dữ liệu quiz cũ.
 * Hợp đồng dữ liệu: câu trắc nghiệm có options; câu phát âm thường có câu mẫu
 * trong correctAnswer; câu viết không có options và không có đáp án cố định.
 */
export const getEffectiveQuestionType = (question) => {
  if (!question) return 'multiple_choice';

  const explicitType = normalizeType(question.questionType || question.question_type);
  if (explicitType && explicitType !== 'multiple_choice') return explicitType;

  if (question.audio_url || question.audioUrl) return 'listening';
  if (question.passage_text || question.passageText) return 'reading';

  const promptText = String(question.question || question.question_text || question.questionText || '');

  // Detect listening if audio script or dialogue tag exists in prompt
  if (/\[(?:Audio Script|Dialogue|Listening)\]/i.test(promptText) || /\b(?:Speaker [A-Z]|Audio Script|Listen to the conversation)\b/i.test(promptText)) {
    return 'listening';
  }

  // Detect reading if passage tag exists
  if (/\[(?:Reading Passage|Passage)\]/i.test(promptText)) {
    return 'reading';
  }

  if (/\{\{\s*[A-Za-z0-9_-]+\s*\}\}/.test(promptText)) {
    return 'open_cloze';
  }

  const options = Array.isArray(question.options) ? question.options.filter(Boolean) : [];
  if (options.length > 0) return 'multiple_choice';

  const promptAndGuide = [question.question, question.question_text, question.explanation]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (SPEAKING_PROMPT_PATTERN.test(promptAndGuide)) return 'pronunciation';
  if (WRITING_PROMPT_PATTERN.test(promptAndGuide)) return 'writing';
  if (question.correctAnswer || question.correct_answer) return 'pronunciation';
  return 'writing';
};

/**
 * Trích xuất câu mẫu tiếng Anh mục tiêu cần đọc từ câu hỏi phát âm (pronunciation).
 * Xử lý tất cả các trường hợp: câu nằm trong correctAnswer, câu nằm trong dấu ngoặc kép,
 * câu nằm sau dấu hai chấm / xuống dòng, loại bỏ tiền tố hiệu lệnh như "Read the following sentence aloud:".
 */
export const getSpeakingTargetSentence = (question) => {
  if (!question) return '';

  const explicitAnswer = String(question.correctAnswer || question.correct_answer || '').trim();
  if (explicitAnswer && !/^(?:read|pronounce|say|repeat)\s+(?:the\s+following|this)\b/i.test(explicitAnswer)) {
    return explicitAnswer;
  }

  const promptText = String(question.question || question.question_text || question.questionText || '').trim();

  // 1. Trích xuất câu trong dấu ngoặc kép (ví dụ: ...:\n"Artificial intelligence is transforming...")
  const quoteMatch = promptText.match(/["“]([^"”]+)["”]/);
  if (quoteMatch && quoteMatch[1].trim()) {
    return quoteMatch[1].trim();
  }

  // 2. Nếu có xuống dòng và dòng đầu là hiệu lệnh, lấy từ dòng 2 trở đi
  const lines = promptText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 1 && /^(?:read|pronounce|say|repeat)\b/i.test(lines[0])) {
    return lines.slice(1).join(' ').replace(/^["'“”]|["'“”]$/g, '').trim();
  }

  // 3. Nếu có dấu hai chấm sau câu hiệu lệnh (ví dụ: "Read the following sentence aloud: Cloud computing...")
  const colonMatch = promptText.match(/^(?:read|pronounce|say|repeat)\b[^:]*:\s*(.+)$/i);
  if (colonMatch && colonMatch[1].trim()) {
    return colonMatch[1].replace(/^["'“”]|["'“”]$/g, '').trim();
  }

  return explicitAnswer || promptText;
};

/**
 * Trích xuất câu hiệu lệnh mở đầu của bài thi phát âm (ví dụ: "Read the following sentence aloud with correct pronunciation and intonation:").
 * Dùng để giọng British tự động đọc hướng dẫn khi học viên vừa bắt đầu chuyển tới câu hỏi speaking.
 */
export const getSpeakingInstruction = (question) => {
  if (!question) return 'Read the following sentence aloud with clear pronunciation and natural intonation.';

  const promptText = String(question.question || question.question_text || question.questionText || '').trim();

  // 1. Nếu có ngoặc kép: lấy phần trước dấu ngoặc kép
  const quoteIndex = promptText.search(/["“]/);
  if (quoteIndex > 0) {
    const prefix = promptText.substring(0, quoteIndex).trim().replace(/:\s*$/, '');
    if (prefix && /^(?:read|pronounce|say|repeat)\b/i.test(prefix)) {
      return `${prefix}.`;
    }
  }

  // 2. Nếu có xuống dòng: lấy dòng đầu tiên nếu dòng đầu là hiệu lệnh
  const lines = promptText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 1 && /^(?:read|pronounce|say|repeat)\b/i.test(lines[0])) {
    return lines[0].replace(/:\s*$/, '') + '.';
  }

  // 3. Nếu có dấu hai chấm: lấy phần trước dấu hai chấm nếu là hiệu lệnh
  const colonMatch = promptText.match(/^((?:read|pronounce|say|repeat)\b[^:]*):/i);
  if (colonMatch && colonMatch[1].trim()) {
    return colonMatch[1].trim() + '.';
  }

  return 'Read the following sentence aloud with clear pronunciation and natural intonation.';
};

export default getEffectiveQuestionType;
