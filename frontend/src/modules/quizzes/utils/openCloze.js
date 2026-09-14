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

  let text = String(q.question_text || q.questionText || q.question || '').trim();
  let explanation = String(q.explanation || '').trim();

  // Strip phantom visual artifacts from multiple choice, reading, listening:
  if (['multiple_choice', 'reading', 'listening', 'open_cloze'].includes(type)) {
    text = text
      .replace(/\b(?:According to|Based on|Look at)\s+the\s+(?:chart|graph|diagram|table|figure|image|picture)\s+(?:below|above|attached)?,?\s*/gi, '')
      .replace(/\bthe\s+(?:chart|graph|diagram|table|figure|image|picture)\s+(?:below|above|attached)\s+(?:shows|illustrates|indicates|reveals|presents)\s+(?:that\s+)?/gi, '')
      .trim();
    if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  }

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

    const audioUrl = type === 'listening' ? String(q.audio_url || q.audioUrl || '').trim() : null;
    const passageText = type === 'reading' ? String(q.passage_text || q.passageText || '').trim() : null;

    return {
      id: q.id ? String(q.id) : undefined,
      question_text: text,
      questionText: text,
      question: text,
      question_type: type,
      questionType: type,
      options: cleanOptions,
      correct_answer: correctAnswer,
      correctAnswer: correctAnswer,
      explanation,
      audio_url: audioUrl,
      audioUrl: audioUrl,
      passage_text: passageText,
      passageText: passageText
    };
  }

  if (type === 'pronunciation') {
    let rawAnswer = String(q.correct_answer ?? q.correctAnswer ?? '').trim();
    if (!rawAnswer) {
      rawAnswer = text.replace(/^Read the following sentence.*?:\s*/i, '').trim() || text;
    }
    return {
      id: q.id ? String(q.id) : undefined,
      question_text: text,
      questionText: text,
      question: text,
      question_type: 'pronunciation',
      questionType: 'pronunciation',
      options: [],
      correct_answer: rawAnswer,
      correctAnswer: rawAnswer,
      explanation,
      audio_url: null,
      audioUrl: null,
      passage_text: null,
      passageText: null
    };
  }

  if (type === 'writing') {
    let cleanText = text;
    let cleanExplanation = explanation;
    const hasPhantomChart = /\b(?:the|this)\s+(?:chart|line\s+graph|bar\s+chart|pie\s+chart|graph|diagram|table|figure|image|picture)\s+(?:below|above|attached)\b/i.test(cleanText)
      || /\blook\s+at\s+the\s+(?:chart|graph|diagram|image|picture|table)\b/i.test(cleanText);

    if (hasPhantomChart && !cleanText.includes('|')) {
      cleanText = `Write an essay of at least 150 words discussing your perspective on the given topic. Present the key advantages, discuss potential challenges, and conclude with your personal viewpoint. Support your arguments with specific reasons and examples.`;
      if (/chart|graph|table/i.test(cleanExplanation)) {
        cleanExplanation = 'Dàn ý bài viết: Mở bài nêu vấn đề và quan điểm; Thân bài phân tích các luận điểm và ví dụ; Kết bài tổng kết. Đánh giá dựa trên độ mạch lạc, từ vựng học thuật và ngữ pháp.';
      }
    }

    return {
      id: q.id ? String(q.id) : undefined,
      question_text: cleanText,
      questionText: cleanText,
      question: cleanText,
      question_type: 'writing',
      questionType: 'writing',
      options: [],
      correct_answer: '',
      correctAnswer: '',
      explanation: cleanExplanation,
      audio_url: null,
      audioUrl: null,
      passage_text: null,
      passageText: null
    };
  }

  if (type === 'open_cloze') {
    const gaps = syncClozeGaps(text, Array.isArray(q.options) ? q.options : []);
    return {
      id: q.id ? String(q.id) : undefined,
      question_text: text,
      questionText: text,
      question: text,
      question_type: 'open_cloze',
      questionType: 'open_cloze',
      options: gaps,
      correct_answer: '',
      correctAnswer: '',
      explanation,
      audio_url: null,
      audioUrl: null,
      passage_text: null,
      passageText: null
    };
  }

  return {
    id: q.id ? String(q.id) : undefined,
    question_text: text,
    questionText: text,
    question: text,
    question_type: type,
    questionType: type,
    options: Array.isArray(q.options) ? q.options : [],
    correct_answer: String(q.correct_answer ?? q.correctAnswer ?? '').trim(),
    correctAnswer: String(q.correct_answer ?? q.correctAnswer ?? '').trim(),
    explanation,
    audio_url: null,
    audioUrl: null,
    passage_text: null,
    passageText: null
  };
};

export const normalizeQuestionsList = (list, allowedTypes = null) => {
  if (!Array.isArray(list)) return [];
  const allowedSet = Array.isArray(allowedTypes) && allowedTypes.length > 0
    ? new Set(allowedTypes.map(t => String(t).toLowerCase().trim()))
    : null;
  return list
    .map(normalizeQuestion)
    .filter(Boolean)
    .filter(q => !allowedSet || allowedSet.has(q.question_type));
};
