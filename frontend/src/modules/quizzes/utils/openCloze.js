const GAP_MARKER_PATTERN = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g;

export const extractClozeGapIds = (template = '') => {
  const ids = [];
  GAP_MARKER_PATTERN.lastIndex = 0;
  let match;
  while ((match = GAP_MARKER_PATTERN.exec(String(template))) !== null) {
    ids.push(String(match[1]));
  }
  return ids;
};

export const syncClozeGaps = (template, currentGaps = []) => {
  const existingById = new Map((Array.isArray(currentGaps) ? currentGaps : [])
    .filter(gap => gap && typeof gap === 'object')
    .map(gap => [String(gap.id), gap]));

  return [...new Set(extractClozeGapIds(template))].map(id => ({
    id,
    answer: String(existingById.get(id)?.answer || ''),
    acceptedAnswers: Array.isArray(existingById.get(id)?.acceptedAnswers)
      ? existingById.get(id).acceptedAnswers
      : [],
    hint: String(existingById.get(id)?.hint || '')
  }));
};

export const tokenizeClozeTemplate = (template = '') => {
  const tokens = [];
  const text = String(template);
  let cursor = 0;
  let match;

  GAP_MARKER_PATTERN.lastIndex = 0;
  while ((match = GAP_MARKER_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) tokens.push({ type: 'text', value: text.slice(cursor, match.index) });
    tokens.push({ type: 'gap', id: String(match[1]) });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });

  return tokens;
};

export const validateClozeDraft = (question) => {
  const gapIds = extractClozeGapIds(question?.questionText || question?.question_text || '');
  if (gapIds.length === 0) return 'Hãy thêm ít nhất một chỗ trống bằng cú pháp {{1}}.';
  if (new Set(gapIds).size !== gapIds.length) return 'Mỗi mã chỗ trống phải là duy nhất.';

  const gaps = Array.isArray(question?.options) ? question.options : [];
  const gapsById = new Map(gaps.map(gap => [String(gap.id), gap]));
  const missing = gapIds.filter(id => !String(gapsById.get(id)?.answer || '').trim());
  return missing.length > 0 ? `Chưa nhập đáp án cho ô ${missing.join(', ')}.` : '';
};

export const normalizeQuestion = (q) => {
  if (!q) return null;
  const rawType = String(q.question_type || q.questionType || 'multiple_choice').toLowerCase().trim();
  
  // Normalize type
  let type = 'multiple_choice';
  if (['pronunciation', 'speaking', 'speech', 'voice'].includes(rawType)) {
    type = 'pronunciation';
  } else if (['writing', 'essay', 'paragraph', 'text'].includes(rawType)) {
    type = 'writing';
  } else if (['open_cloze', 'cloze', 'fill_in_the_blank', 'fill_blank'].includes(rawType)) {
    type = 'open_cloze';
  } else if (['listening', 'listen', 'audio_choice'].includes(rawType)) {
    type = 'listening';
  } else if (['reading', 'read', 'passage', 'comprehension'].includes(rawType)) {
    type = 'reading';
  }

  const text = String(q.question_text || q.questionText || q.question || '').trim();
  const explanation = String(q.explanation || '').trim();

  if (type === 'multiple_choice' || type === 'listening' || type === 'reading') {
    // Clean and normalize options
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    let cleanOptions = rawOptions.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return String(opt.text || opt.value || opt.label || '').trim();
      }
      return String(opt || '').replace(/^[A-D]\s*[\.\:\-\)]\s*/i, '').trim();
    }).filter(opt => opt.length > 0);

    // If options are fewer than 4, provide reasonable default fillers
    while (cleanOptions.length < 4) {
      cleanOptions.push(`Lựa chọn ${String.fromCharCode(65 + cleanOptions.length)}`);
    }
    cleanOptions = cleanOptions.slice(0, 4);

    // Resolve correct answer (must be strictly 'A', 'B', 'C', or 'D')
    const rawAnswer = String(q.correct_answer ?? q.correctAnswer ?? '').trim();
    let correctAnswer = 'A';
    
    // Check if rawAnswer starts with A, B, C, D
    const letterMatch = rawAnswer.match(/^([A-D])(\.|\:|\s|\-|\)|$)/i);
    if (letterMatch) {
      correctAnswer = letterMatch[1].toUpperCase();
    } else {
      // Check if rawAnswer matches one of the option texts
      const matchIdx = cleanOptions.findIndex(opt => opt.toLowerCase() === rawAnswer.toLowerCase());
      if (matchIdx >= 0) {
        correctAnswer = ['A', 'B', 'C', 'D'][matchIdx];
      } else {
        correctAnswer = 'A';
      }
    }

    return {
      question_text: text,
      question_type: type,
      options: cleanOptions,
      correct_answer: correctAnswer,
      explanation,
      audio_url: type === 'listening' ? String(q.audio_url || q.audioUrl || '').trim() : null,
      passage_text: type === 'reading' ? String(q.passage_text || q.passageText || '').trim() : null
    };
  }

  if (type === 'pronunciation') {
    let rawAnswer = String(q.correct_answer ?? q.correctAnswer ?? '').trim();
    if (!rawAnswer) {
      rawAnswer = text.replace(/^Read the following sentence.*?:\s*/i, '').trim() || text;
    }
    return {
      question_text: text,
      question_type: 'pronunciation',
      options: [],
      correct_answer: rawAnswer,
      explanation,
      audio_url: null,
      passage_text: null
    };
  }

  if (type === 'writing') {
    return {
      question_text: text,
      question_type: 'writing',
      options: [],
      correct_answer: '',
      explanation,
      audio_url: null,
      passage_text: null
    };
  }

  if (type === 'open_cloze') {
    const gaps = syncClozeGaps(text, Array.isArray(q.options) ? q.options : []);
    return {
      question_text: text,
      question_type: 'open_cloze',
      options: gaps,
      correct_answer: '',
      explanation,
      audio_url: null,
      passage_text: null
    };
  }

  return {
    question_text: text,
    question_type: type,
    options: Array.isArray(q.options) ? q.options : [],
    correct_answer: String(q.correct_answer ?? q.correctAnswer ?? ''),
    explanation,
    audio_url: q.audio_url || q.audioUrl || null,
    passage_text: q.passage_text || q.passageText || null
  };
};

export const normalizeQuestionsList = (list) => {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeQuestion).filter(Boolean);
};
