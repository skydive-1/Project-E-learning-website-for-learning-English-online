const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateQuestionDistribution } = require('../src/modules/quizzes/controllers/quizzes.controller');

describe('calculateQuestionDistribution - Fair Distribution Model', () => {
  it('handles 3 questions with 3 selected types evenly (1 per type, no omitted types)', () => {
    const types = ['open_cloze', 'multiple_choice', 'listening'];
    const result = calculateQuestionDistribution(3, types);
    assert.equal(result.totalQuestions, 3);
    assert.deepEqual(result.distribution, {
      open_cloze: 1,
      multiple_choice: 1,
      listening: 1
    });
  });

  it('handles 3 questions with 2 selected types (2 + 1 = 3)', () => {
    const types = ['multiple_choice', 'writing'];
    const result = calculateQuestionDistribution(3, types);
    assert.equal(result.totalQuestions, 3);
    assert.deepEqual(result.distribution, {
      multiple_choice: 2,
      writing: 1
    });
  });

  it('keeps the requested total when questions are fewer than selected types (N < K)', () => {
    // Four types are allowed, but a three-question quiz still remains exactly three questions.
    const types = ['multiple_choice', 'writing', 'open_cloze', 'listening'];
    const result = calculateQuestionDistribution(3, types);
    assert.equal(result.totalQuestions, 3);
    assert.deepEqual(result.distribution, {
      multiple_choice: 1,
      writing: 1,
      open_cloze: 1,
      listening: 0
    });
  });

  it('handles 5 questions with 3 selected types (2 + 2 + 1 = 5)', () => {
    const types = ['open_cloze', 'multiple_choice', 'listening'];
    const result = calculateQuestionDistribution(5, types);
    assert.equal(result.totalQuestions, 5);
    assert.deepEqual(result.distribution, {
      open_cloze: 2,
      multiple_choice: 2,
      listening: 1
    });
  });

  it('handles 5 questions with 5 selected types (1 + 1 + 1 + 1 + 1 = 5)', () => {
    const types = ['multiple_choice', 'writing', 'pronunciation', 'open_cloze', 'listening'];
    const result = calculateQuestionDistribution(5, types);
    assert.equal(result.totalQuestions, 5);
    types.forEach(t => {
      assert.equal(result.distribution[t], 1);
    });
  });

  it('handles 10 questions with 4 selected types (3 + 3 + 2 + 2 = 10)', () => {
    const types = ['multiple_choice', 'writing', 'open_cloze', 'listening'];
    const result = calculateQuestionDistribution(10, types);
    assert.equal(result.totalQuestions, 10);
    assert.deepEqual(result.distribution, {
      multiple_choice: 3,
      writing: 3,
      open_cloze: 2,
      listening: 2
    });
  });

  it('handles 10 questions with 6 selected types (2*4 + 1*2 = 10)', () => {
    const types = ['multiple_choice', 'writing', 'pronunciation', 'open_cloze', 'listening', 'reading'];
    const result = calculateQuestionDistribution(10, types);
    assert.equal(result.totalQuestions, 10);
    assert.deepEqual(result.distribution, {
      multiple_choice: 2,
      writing: 2,
      pronunciation: 2,
      open_cloze: 2,
      listening: 1,
      reading: 1
    });
  });

  it('handles 15 questions with 6 selected types (3*3 + 2*3 = 15)', () => {
    const types = ['multiple_choice', 'writing', 'pronunciation', 'open_cloze', 'listening', 'reading'];
    const result = calculateQuestionDistribution(15, types);
    assert.equal(result.totalQuestions, 15);
    assert.deepEqual(result.distribution, {
      multiple_choice: 3,
      writing: 3,
      pronunciation: 3,
      open_cloze: 2,
      listening: 2,
      reading: 2
    });
  });

  it('safely parses JSON string questionTypes array', () => {
    const jsonTypes = JSON.stringify(['listening', 'reading']);
    const result = calculateQuestionDistribution(6, jsonTypes);
    assert.equal(result.totalQuestions, 6);
    assert.deepEqual(result.distribution, {
      listening: 3,
      reading: 3
    });
  });

  it('falls back to multiple_choice when types array is empty', () => {
    const result = calculateQuestionDistribution(5, []);
    assert.equal(result.totalQuestions, 5);
    assert.deepEqual(result.distribution, {
      multiple_choice: 5
    });
  });
});

const { enforceAndNormalizeQuestions } = require('../src/modules/quizzes/controllers/quizzes.controller');

describe('enforceAndNormalizeQuestions - Strict Question Type Guard & Auto-Correction', () => {
  it('intercepts unrequested Writing and Pronunciation when user only chose Multiple Choice, Open Cloze, and Listening', () => {
    const requestedTypes = ['multiple_choice', 'open_cloze', 'listening'];
    const distribution = {
      multiple_choice: 2,
      open_cloze: 2,
      listening: 1
    };
    const totalQuestions = 5;
    const topic = 'history';

    // Simulated buggy Gemini output containing unrequested writing & pronunciation, and missing listening
    const rawAiOutput = [
      {
        questionType: 'multiple_choice',
        questionText: 'What year did World War II end?',
        options: ['A. 1943', 'B. 1944', 'C. 1945', 'D. 1946'],
        correctAnswer: 'C',
        explanation: 'Thế chiến thứ 2 kết thúc vào năm 1945.'
      },
      {
        questionType: 'multiple_choice',
        questionText: 'Who was the first President of the United States?',
        options: ['A. Thomas Jefferson', 'B. George Washington', 'C. Abraham Lincoln', 'D. John Adams'],
        correctAnswer: 'B',
        explanation: 'George Washington là tổng thống đầu tiên.'
      },
      {
        // BUG: Gemini returned writing when user DID NOT select writing
        questionType: 'writing',
        questionText: 'Write 2-3 sentences expressing your opinion on why learning history in school is important for young people.',
        options: [],
        correctAnswer: '',
        explanation: 'Hướng dẫn viết về tầm quan trọng của lịch sử.'
      },
      {
        // BUG: Gemini returned pronunciation/speaking when user DID NOT select pronunciation
        questionType: 'pronunciation',
        questionText: 'Read the following sentence aloud: Historical discoveries often change our understanding of ancient civilizations.',
        options: [],
        correctAnswer: 'Historical discoveries often change our understanding of ancient civilizations.',
        explanation: 'Hướng dẫn phát âm chuẩn.'
      },
      {
        questionType: 'open_cloze',
        questionText: 'Ancient civilizations {{1}} great influence on modern {{2}}.',
        options: [
          { id: '1', answer: 'had', acceptedAnswers: ['exercised'], hint: 'verb' },
          { id: '2', answer: 'society', acceptedAnswers: ['world'], hint: 'noun' }
        ],
        correctAnswer: '',
        explanation: 'Điền từ thích hợp vào chỗ trống.'
      }
    ];

    const result = enforceAndNormalizeQuestions(rawAiOutput, distribution, requestedTypes, totalQuestions, topic);

    // 1. Total questions must strictly be 5
    assert.equal(result.length, 5);

    // 2. NO question of forbidden type can exist
    const typesInResult = result.map(q => q.questionType);
    assert.equal(typesInResult.includes('writing'), false, 'Writing must NOT be present in output');
    assert.equal(typesInResult.includes('pronunciation'), false, 'Pronunciation must NOT be present in output');
    assert.equal(typesInResult.includes('reading'), false, 'Reading must NOT be present in output');

    // 3. Every single question must be one of the requested types
    result.forEach(q => {
      assert.equal(requestedTypes.includes(q.questionType), true);
      assert.equal(q.questionType, q.question_type);
    });

    // 4. Listening MUST be present as a direct question, without dialogue scaffolding
    const listeningQuestions = result.filter(q => q.questionType === 'listening');
    assert.ok(listeningQuestions.length >= 1, 'Listening question must be guaranteed');
    listeningQuestions.forEach(lq => {
      assert.doesNotMatch(lq.questionText, /Speaker\s+[A-Z]|\[Audio Script|\[Dialogue|\[Question/i);
      assert.match(lq.questionText, /\?$/);
      assert.equal(lq.options.length, 4, 'Listening question must have 4 options');
      assert.ok(['A', 'B', 'C', 'D'].includes(lq.correctAnswer), 'Listening question must have valid letter answer');
    });

    // 5. Open Cloze MUST be present and properly formatted with gaps
    const clozeQuestions = result.filter(q => q.questionType === 'open_cloze');
    assert.ok(clozeQuestions.length >= 1, 'Open cloze question must be present');
    clozeQuestions.forEach(cq => {
      assert.ok(cq.questionText.includes('{{1}}'), 'Cloze must contain gap marker');
      assert.ok(Array.isArray(cq.options) && cq.options.length > 0, 'Cloze must have gap options array');
    });
  });

  it('guarantees all requested types even if AI completely omits one of them', () => {
    const requestedTypes = ['multiple_choice', 'listening'];
    const distribution = { multiple_choice: 3, listening: 2 };
    const totalQuestions = 5;

    // AI only returned 5 multiple choice questions and completely omitted listening
    const rawAiOutput = Array(5).fill(null).map((_, idx) => ({
      questionType: 'multiple_choice',
      questionText: `Question ${idx + 1}`,
      options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'],
      correctAnswer: 'A',
      explanation: 'Explanation'
    }));

    const result = enforceAndNormalizeQuestions(rawAiOutput, distribution, requestedTypes, totalQuestions, 'Grammar');

    assert.equal(result.length, 5);
    const hasMc = result.some(q => q.questionType === 'multiple_choice');
    const hasListening = result.some(q => q.questionType === 'listening');
    assert.equal(hasMc, true);
    assert.equal(hasListening, true, 'Omitted listening must be auto-injected or adapted');
  });

  it('returns exactly 2 multiple choice, 2 listening, and 1 reading when Gemini only returns 2 multiple choice questions', () => {
    const requestedTypes = ['multiple_choice', 'listening', 'reading'];
    const distribution = { multiple_choice: 2, listening: 2, reading: 1 };
    const rawAiOutput = [
      {
        questionType: 'multiple_choice',
        questionText: 'Which event marked the beginning of the Industrial Revolution?',
        options: ['A. Steam power', 'B. Berlin Wall', 'C. America', 'D. Magna Carta'],
        correctAnswer: 'A',
        explanation: 'Steam power accelerated industrial production.'
      },
      {
        questionType: 'multiple_choice',
        questionText: 'Why were the pyramids built?',
        options: ['A. Fortresses', 'B. Tombs', 'C. Markets', 'D. Schools'],
        correctAnswer: 'B',
        explanation: 'They primarily served as royal tombs.'
      }
    ];

    const result = enforceAndNormalizeQuestions(rawAiOutput, distribution, requestedTypes, 5, 'history');
    const counts = result.reduce((acc, question) => {
      acc[question.questionType] = (acc[question.questionType] || 0) + 1;
      return acc;
    }, {});

    assert.equal(result.length, 5);
    assert.deepEqual(counts, distribution);
    result.filter(question => question.questionType === 'listening').forEach(question => {
      assert.doesNotMatch(question.questionText, /Speaker\s+[A-Z]|\[Audio Script|\[Dialogue|\[Question/i);
      assert.match(question.questionText, /\?$/);
      assert.equal(question.options.length, 4);
    });
    result.filter(question => question.questionType === 'reading').forEach(question => {
      assert.ok(String(question.passageText || '').trim().length > 0);
      assert.equal(question.options.length, 4);
    });
  });

  it('removes Speaker A/B scaffolding from Listening and Pronunciation output', () => {
    const rawAiOutput = [
      {
        questionType: 'listening',
        questionText: '[Audio Script / Dialogue]:\nSpeaker A: History shapes society.\nSpeaker B: It helps us understand change.\n\n[Question]: According to Speaker B, why is history useful?',
        options: ['A. It explains change', 'B. It prevents learning', 'C. It removes evidence', 'D. It replaces study'],
        correctAnswer: 'A',
        explanation: 'Speaker B says it helps us understand change.'
      },
      {
        questionType: 'pronunciation',
        questionText: '[Dialogue]\nSpeaker A: Read the following sentence aloud: History helps us understand change.',
        correctAnswer: 'Speaker A: History helps us understand change.',
        options: [],
        explanation: 'Đọc rõ và giữ ngữ điệu tự nhiên.'
      }
    ];

    const result = enforceAndNormalizeQuestions(
      rawAiOutput,
      { listening: 1, pronunciation: 1 },
      ['listening', 'pronunciation'],
      2,
      'history'
    );

    result.forEach(question => {
      assert.doesNotMatch(question.questionText, /Speaker\s+[A-Z]|\[Audio Script|\[Dialogue|\[Question/i);
      assert.doesNotMatch(String(question.correctAnswer || ''), /Speaker\s+[A-Z]|\[Audio Script|\[Dialogue|\[Question/i);
    });
    assert.equal(result[0].questionText, 'Why is history useful?');
  });
});
