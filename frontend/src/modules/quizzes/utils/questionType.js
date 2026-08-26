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
  multiple_choice: 'multiple_choice',
  multiplechoice: 'multiple_choice',
  mcq: 'multiple_choice'
};

const SPEAKING_PROMPT_PATTERN = /\b(?:speak|speaking|say|pronounce|pronunciation|repeat(?:\s+after\s+me)?|read\b[\s\S]*?\baloud|oral\s+(?:answer|response)|record\s+(?:your\s+)?(?:voice|answer)|answer\s+(?:out\s+)?loud)\b|phát\s*âm|đọc[\s\S]*?(?:thành\s*tiếng|to\s+(?:và\s+)?rõ)|\b(?:nói|ghi\s*âm|thu\s*âm)\b/iu;

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
  if (explicitType === 'writing' || explicitType === 'pronunciation') {
    return explicitType;
  }

  const options = Array.isArray(question.options) ? question.options.filter(Boolean) : [];
  if (options.length > 0) return 'multiple_choice';

  const expectedAnswer = String(question.correctAnswer || question.correct_answer || '').trim();
  const isOptionKey = /^[A-D](?:[.)])?$/i.test(expectedAnswer);
  if (expectedAnswer && !isOptionKey) return 'pronunciation';

  const promptAndGuide = [
    question.question,
    question.question_text,
    question.explanation
  ].filter(Boolean).join(' ').toLowerCase();

  if (SPEAKING_PROMPT_PATTERN.test(promptAndGuide)) return 'pronunciation';

  return 'writing';
};

export default getEffectiveQuestionType;
