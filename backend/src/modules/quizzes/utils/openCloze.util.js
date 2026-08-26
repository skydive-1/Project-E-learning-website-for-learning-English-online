const GAP_MARKER_PATTERN = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g;

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.code = 'INVALID_OPEN_CLOZE';
  return error;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const extractGapIds = (template = '') => {
  const ids = [];
  const text = String(template);
  let match;

  GAP_MARKER_PATTERN.lastIndex = 0;
  while ((match = GAP_MARKER_PATTERN.exec(text)) !== null) {
    ids.push(String(match[1]));
  }

  return ids;
};

const normalizeAcceptedAnswers = (value) => {
  const answers = Array.isArray(value)
    ? value
    : (typeof value === 'string' ? value.split(/[|,]/) : []);

  return [...new Set(answers.map(answer => String(answer).trim()).filter(Boolean))];
};

const normalizeClozeGaps = (value) => parseJsonArray(value)
  .filter(gap => gap && typeof gap === 'object' && !Array.isArray(gap))
  .map(gap => ({
    id: String(gap.id ?? '').trim(),
    answer: String(gap.answer ?? '').trim(),
    acceptedAnswers: normalizeAcceptedAnswers(gap.acceptedAnswers ?? gap.accepted_answers),
    hint: String(gap.hint ?? '').trim()
  }))
  .filter(gap => gap.id);

const validateOpenClozeQuestion = ({ questionText, gaps }) => {
  const markerIds = extractGapIds(questionText);
  const normalizedGaps = normalizeClozeGaps(gaps);

  if (markerIds.length === 0) {
    throw createValidationError('Bài điền từ phải có ít nhất một chỗ trống theo cú pháp {{1}}.');
  }
  if (markerIds.length > 30) {
    throw createValidationError('Mỗi câu Open Cloze chỉ được có tối đa 30 chỗ trống.');
  }
  if (new Set(markerIds).size !== markerIds.length) {
    throw createValidationError('Mỗi mã chỗ trống trong bài Open Cloze phải là duy nhất.');
  }

  const configuredGapIds = normalizedGaps.map(gap => gap.id);
  if (new Set(configuredGapIds).size !== configuredGapIds.length) {
    throw createValidationError('Mỗi chỗ trống Open Cloze chỉ được có một cấu hình đáp án.');
  }

  const gapsById = new Map(normalizedGaps.map(gap => [gap.id, gap]));
  const missingIds = markerIds.filter(id => !gapsById.get(id)?.answer);
  if (missingIds.length > 0) {
    throw createValidationError(`Chưa nhập đáp án cho chỗ trống: ${missingIds.join(', ')}.`);
  }

  const extraIds = normalizedGaps
    .map(gap => gap.id)
    .filter(id => !markerIds.includes(id));
  if (extraIds.length > 0) {
    throw createValidationError(`Đáp án không còn chỗ trống tương ứng: ${extraIds.join(', ')}.`);
  }

  const orderedGaps = markerIds.map(id => gapsById.get(id));
  if (orderedGaps.some(gap => gap.answer.length > 100)) {
    throw createValidationError('Mỗi đáp án Open Cloze chỉ được dài tối đa 100 ký tự.');
  }

  return { markerIds, gaps: orderedGaps };
};

const normalizeAnswer = (value) => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('en');

const normalizeSubmittedAnswers = (answers) => {
  if (Array.isArray(answers)) {
    return Object.fromEntries(answers
      .filter(item => item && item.id !== undefined)
      .map(item => [String(item.id), item.answer ?? item.value ?? '']));
  }
  return answers && typeof answers === 'object' ? answers : {};
};

const scoreOpenClozeAnswers = (gaps, answers) => {
  const normalizedGaps = normalizeClozeGaps(gaps);
  const submitted = normalizeSubmittedAnswers(answers);

  const results = normalizedGaps.map(gap => {
    const studentAnswer = String(submitted[gap.id] ?? '').trim();
    const accepted = [gap.answer, ...gap.acceptedAnswers].map(normalizeAnswer);
    const isCorrect = accepted.includes(normalizeAnswer(studentAnswer));

    return {
      id: gap.id,
      studentAnswer,
      correctAnswer: gap.answer,
      isCorrect
    };
  });

  const correctCount = results.filter(result => result.isCorrect).length;
  const totalGaps = normalizedGaps.length;

  return {
    score: totalGaps > 0 ? Math.round((correctCount / totalGaps) * 100) : 0,
    correctCount,
    totalGaps,
    results
  };
};

const sanitizeOpenClozeGaps = (gaps) => normalizeClozeGaps(gaps).map(gap => ({
  id: gap.id,
  hint: gap.hint,
  inputSize: Math.min(24, Math.max(5, gap.answer.length + 2))
}));

module.exports = {
  extractGapIds,
  normalizeClozeGaps,
  sanitizeOpenClozeGaps,
  scoreOpenClozeAnswers,
  validateOpenClozeQuestion
};
