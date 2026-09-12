import { normalizeQuestionsList } from './openCloze';

export const AI_QUESTION_TYPE_LABELS = {
  multiple_choice: 'Trắc nghiệm',
  writing: 'Tự luận',
  pronunciation: 'Phát âm',
  open_cloze: 'Điền từ',
  listening: 'Nghe hiểu',
  reading: 'Đọc hiểu'
};

export const calculateExpectedAiDistribution = (count, questionTypes) => {
  const types = [...new Set(
    (Array.isArray(questionTypes) ? questionTypes : [])
      .map(type => String(type || '').toLowerCase().trim())
      .filter(type => Object.hasOwn(AI_QUESTION_TYPE_LABELS, type))
  )];

  if (types.length === 0) types.push('multiple_choice');

  const requestedCount = Number.parseInt(count, 10) || 5;
  const total = Math.max(requestedCount, 1);
  const base = Math.floor(total / types.length);
  const remainder = total % types.length;
  const distribution = Object.fromEntries(
    types.map((type, index) => [type, base + (index < remainder ? 1 : 0)])
  );

  return { total, types, distribution };
};

const createFallbackQuestion = (type, topic, index) => {
  const cleanTopic = String(topic || 'English').trim() || 'English';
  const base = {
    id: `ai-recovery-${type}-${index}`,
    question_type: type,
    questionType: type,
    audio_url: null,
    audioUrl: null,
    passage_text: null,
    passageText: null
  };

  if (type === 'listening') {
    const text = `What is one important benefit of studying ${cleanTopic}?`;
    return {
      ...base,
      question_text: text,
      questionText: text,
      question: text,
      options: [
        'A. It explains how the past can influence the present',
        'B. It removes the need to examine evidence',
        'C. It is useful only for memorizing dates',
        'D. It prevents learners from comparing different ideas'
      ],
      correct_answer: 'A',
      correctAnswer: 'A',
      explanation: 'Việc học cẩn thận giúp người học hiểu các ý tưởng và sự kiện trước đây ảnh hưởng đến hiện tại như thế nào.'
    };
  }

  if (type === 'reading') {
    const passage = `${cleanTopic} gives learners an opportunity to examine important ideas, causes, and consequences. By comparing evidence from different sources, students can understand how earlier developments continue to shape the modern world.`;
    const text = `What is the main benefit of studying ${cleanTopic} mentioned in the passage?`;
    return {
      ...base,
      passage_text: passage,
      passageText: passage,
      question_text: text,
      questionText: text,
      question: text,
      options: [
        'A. Understanding links between earlier developments and the modern world',
        'B. Avoiding the comparison of different sources',
        'C. Memorizing information without considering causes',
        'D. Replacing evidence with personal guesses'
      ],
      correct_answer: 'A',
      correctAnswer: 'A',
      explanation: 'Đoạn văn nhấn mạnh việc so sánh bằng chứng để hiểu quá khứ tiếp tục định hình thế giới hiện đại như thế nào.'
    };
  }

  if (type === 'open_cloze') {
    const text = `Studying ${cleanTopic} {{1}} learners understand important changes and {{2}} stronger critical-thinking skills.`;
    return {
      ...base,
      question_text: text,
      questionText: text,
      question: text,
      options: [
        { id: '1', answer: 'helps', acceptedAnswers: ['allows', 'enables'], hint: 'verb' },
        { id: '2', answer: 'develop', acceptedAnswers: ['build'], hint: 'verb' }
      ],
      correct_answer: '',
      correctAnswer: '',
      explanation: 'Ô thứ nhất cần động từ phù hợp với chủ ngữ số ít; ô thứ hai cần động từ nguyên mẫu sau cấu trúc song song.'
    };
  }

  if (type === 'writing') {
    const text = `Write 2-3 sentences explaining why learning about ${cleanTopic} is useful today.`;
    return {
      ...base,
      question_text: text,
      questionText: text,
      question: text,
      options: [],
      correct_answer: '',
      correctAnswer: '',
      explanation: 'Nêu một ý chính rõ ràng, đưa ra lý do phù hợp và sử dụng từ vựng liên quan đến chủ đề.'
    };
  }

  if (type === 'pronunciation') {
    const sentence = `Learning about ${cleanTopic} helps us understand the world more clearly.`;
    const text = `Read the following sentence aloud with clear pronunciation and natural intonation:\n"${sentence}"`;
    return {
      ...base,
      question_text: text,
      questionText: text,
      question: text,
      options: [],
      correct_answer: sentence,
      correctAnswer: sentence,
      explanation: 'Đọc rõ từng từ, giữ trọng âm câu tự nhiên và xuống giọng ở cuối câu trần thuật.'
    };
  }

  const text = `Which statement best explains an important idea related to ${cleanTopic}?`;
  return {
    ...base,
    question_type: 'multiple_choice',
    questionType: 'multiple_choice',
    question_text: text,
    questionText: text,
    question: text,
    options: [
      'A. It connects key ideas with their causes and effects',
      'B. It requires ignoring all available evidence',
      'C. It has no relationship with the modern world',
      'D. It can only be understood through memorization'
    ],
    correct_answer: 'A',
    correctAnswer: 'A',
    explanation: 'Đáp án A thể hiện đúng cách tiếp cận chủ đề thông qua ý tưởng chính, nguyên nhân và hệ quả.'
  };
};

export const reconcileAiQuizResponse = ({ questions, count, questionTypes, topic }) => {
  const expected = calculateExpectedAiDistribution(count, questionTypes);
  const normalized = normalizeQuestionsList(questions);
  const sourcePool = [...normalized];
  const desiredSlots = [];
  const maxPerType = Math.max(...expected.types.map(type => expected.distribution[type] || 0));

  for (let round = 0; round < maxPerType; round += 1) {
    expected.types.forEach(type => {
      if (round < (expected.distribution[type] || 0)) desiredSlots.push(type);
    });
  }

  let recoveredCount = 0;
  const reconciledQuestions = desiredSlots.map((type, index) => {
    const matchingIndex = sourcePool.findIndex(question => question.question_type === type);
    if (matchingIndex >= 0) {
      const [question] = sourcePool.splice(matchingIndex, 1);
      return question;
    }

    recoveredCount += 1;
    return createFallbackQuestion(type, topic, index + 1);
  });

  return {
    questions: reconciledQuestions,
    distribution: expected.distribution,
    recoveredCount,
    repaired: recoveredCount > 0 || normalized.length !== expected.total
  };
};

export const validateAiQuizResponse = ({ questions, count, questionTypes, distribution }) => {
  const expected = calculateExpectedAiDistribution(count, questionTypes);
  const normalized = normalizeQuestionsList(questions, expected.types);
  const serverDistribution = distribution && typeof distribution === 'object'
    ? distribution
    : expected.distribution;
  const exactDistribution = expected.types.every(type => (
    Number(serverDistribution[type]) === expected.distribution[type]
  )) ? serverDistribution : expected.distribution;

  const actualCounts = Object.fromEntries(expected.types.map(type => [type, 0]));
  normalized.forEach(question => {
    if (Object.hasOwn(actualCounts, question.question_type)) {
      actualCounts[question.question_type] += 1;
    }
  });

  const deficits = expected.types
    .map(type => ({
      type,
      missing: Math.max(0, Number(exactDistribution[type] || 0) - actualCounts[type])
    }))
    .filter(item => item.missing > 0);

  const valid = normalized.length === expected.total && deficits.length === 0;
  if (valid) {
    return { valid: true, questions: normalized, distribution: exactDistribution };
  }

  const missingSummary = deficits
    .map(({ type, missing }) => `${missing} câu ${AI_QUESTION_TYPE_LABELS[type]}`)
    .join(', ');
  const details = [
    normalized.length !== expected.total ? `chỉ nhận ${normalized.length}/${expected.total} câu` : '',
    missingSummary ? `thiếu ${missingSummary}` : ''
  ].filter(Boolean).join(' và ');

  return {
    valid: false,
    questions: normalized,
    distribution: exactDistribution,
    message: `Kết quả AI chưa đầy đủ (${details}). Danh sách câu hỏi hiện tại được giữ nguyên; vui lòng thử lại sau.`
  };
};
