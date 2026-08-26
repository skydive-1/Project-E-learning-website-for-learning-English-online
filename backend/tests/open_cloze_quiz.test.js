const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');
const quizzesController = require('../src/modules/quizzes/controllers/quizzes.controller');
const {
  sanitizeOpenClozeGaps,
  scoreOpenClozeAnswers,
  validateOpenClozeQuestion
} = require('../src/modules/quizzes/utils/openCloze.util');

const sampleGaps = [
  { id: '1', answer: 'changes', acceptedAnswers: [], hint: 'verb' },
  { id: '2', answer: 'organize', acceptedAnswers: ['organise'], hint: 'verb' }
];

describe('Open Cloze quiz contract', () => {
  it('validates markers and preserves their passage order', () => {
    const validated = validateOpenClozeQuestion({
      questionText: 'AI {{2}} data and {{1}} business.',
      gaps: sampleGaps
    });

    assert.deepEqual(validated.markerIds, ['2', '1']);
    assert.deepEqual(validated.gaps.map(gap => gap.id), ['2', '1']);
  });

  it('rejects missing answers and duplicate markers', () => {
    assert.throws(
      () => validateOpenClozeQuestion({
        questionText: 'AI {{1}} and {{1}}.',
        gaps: [{ id: '1', answer: '' }]
      }),
      error => error.code === 'INVALID_OPEN_CLOZE'
    );

    assert.throws(
      () => validateOpenClozeQuestion({
        questionText: 'AI {{1}} work.',
        gaps: [
          { id: '1', answer: 'changes' },
          { id: '1', answer: 'transforms' }
        ]
      }),
      error => error.code === 'INVALID_OPEN_CLOZE' && /một cấu hình/.test(error.message)
    );
  });

  it('scores each gap case-insensitively and accepts configured alternatives', () => {
    const result = scoreOpenClozeAnswers(sampleGaps, {
      1: ' Changes ',
      2: 'organise'
    });

    assert.equal(result.score, 100);
    assert.equal(result.correctCount, 2);
    assert.ok(result.results.every(item => item.isCorrect));
  });

  it('removes answers before sending an Open Cloze question to a learner', () => {
    const sanitized = sanitizeOpenClozeGaps(sampleGaps);
    assert.deepEqual(sanitized.map(gap => gap.id), ['1', '2']);
    assert.ok(sanitized.every(gap => !Object.hasOwn(gap, 'answer')));
    assert.ok(sanitized.every(gap => !Object.hasOwn(gap, 'acceptedAnswers')));
  });

  it('returns detailed server-side scoring for a submitted question', async () => {
    const originalQuery = db.query;
    db.query = async () => ({
      rows: [{
        question_id: 10,
        quiz_id: 4,
        question_text: 'AI {{1}} how firms {{2}} data.',
        options: sampleGaps,
        explanation: 'Kiểm tra động từ trong ngữ cảnh.',
        question_type: 'open_cloze'
      }]
    });

    try {
      const result = await quizzesService.evaluateOpenCloze(4, 10, {
        1: 'changes',
        2: 'wrong'
      });
      assert.equal(result.score, 50);
      assert.equal(result.correctCount, 1);
      assert.equal(result.results[1].correctAnswer, 'organize');
    } finally {
      db.query = originalQuery;
    }
  });

  it('counts each question only once when a submission repeats question_id', async () => {
    const originalQuery = db.query;
    let queryCount = 0;
    db.query = async () => {
      queryCount += 1;
      if (queryCount === 1) {
        return {
          rows: [{
            question_id: 10,
            correct_answer: '',
            question_type: 'open_cloze',
            options: sampleGaps
          }]
        };
      }
      return { rows: [{ attempt_id: 99, score: 100 }] };
    };

    const duplicatedAnswer = {
      question_id: 10,
      answer: { type: 'open_cloze', answers: { 1: 'changes', 2: 'organize' } }
    };

    try {
      const result = await quizzesService.submitQuiz(null, 4, [duplicatedAnswer, duplicatedAnswer]);
      assert.equal(result.score, 100);
      assert.equal(result.correct_count, 1);
    } finally {
      db.query = originalQuery;
    }
  });

  it('keeps question_type in the quiz detail query', async () => {
    const originalQuery = db.query;
    const queries = [];
    db.query = async sql => {
      queries.push(sql);
      return queries.length === 1
        ? { rows: [{ quiz_id: 4, title: 'Mixed skills' }] }
        : { rows: [] };
    };

    try {
      await quizzesService.getQuizById(4);
      assert.match(queries[1], /\bquestion_type\b/);
    } finally {
      db.query = originalQuery;
    }
  });

  it('sanitizes Open Cloze answers in the public quiz-by-id response', async () => {
    const originalGetQuizById = quizzesService.getQuizById;
    quizzesService.getQuizById = async () => ({
      quiz_id: 4,
      questions: [{
        question_id: 10,
        question_text: 'AI {{1}} business.',
        options: sampleGaps,
        correct_answer: '',
        explanation: '',
        question_type: 'open_cloze'
      }]
    });

    const response = {
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };

    try {
      await quizzesController.getQuizById({ params: { quizId: '4' } }, response, error => { throw error; });
      const question = response.body.data.questions[0];
      assert.equal(response.statusCode, 200);
      assert.equal(question.question_type, 'open_cloze');
      assert.equal(question.correct_answer, '');
      assert.ok(question.options.every(gap => !Object.hasOwn(gap, 'answer')));
    } finally {
      quizzesService.getQuizById = originalGetQuizById;
    }
  });
});
