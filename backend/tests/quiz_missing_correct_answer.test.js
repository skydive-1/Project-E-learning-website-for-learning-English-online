const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');
const quizzesController = require('../src/modules/quizzes/controllers/quizzes.controller');

describe('Quizzes Missing Correct Answer Validation (BUG 1)', () => {
  function setupMockClient() {
    const queries = [];
    let released = false;
    const client = {
      query: async (sql, params) => {
        const text = String(sql);
        queries.push({ text, params });
        if (text.includes('INSERT INTO quizzes')) {
          return { rows: [{ quiz_id: 999 }] };
        }
        if (text.includes('SELECT quiz_id FROM quizzes')) {
          return { rows: [] };
        }
        if (text.includes('FROM lessons l JOIN sections')) {
          return { rows: [{ lesson_id: 1, course_id: 1 }] };
        }
        return { rows: [] };
      },
      release: () => { released = true; }
    };
    return { client, queries, isReleased: () => released };
  }

  it('rejects multiple_choice question without correct_answer with HTTP 400 and rolls back transaction', async () => {
    const originalConnect = db.pool.connect;
    const { client, queries, isReleased } = setupMockClient();
    db.pool.connect = async () => client;

    try {
      await assert.rejects(
        async () => {
          await quizzesService.createQuiz(
            'Test Quiz',
            'Description',
            'Easy',
            15,
            [
              {
                question_text: 'What is the synonym of fast?',
                question_type: 'multiple_choice',
                options: ['Quick', 'Slow', 'Tired', 'Late'],
                correct_answer: '' // Missing correct answer
              }
            ]
          );
        },
        (err) => {
          assert.equal(err.status, 400);
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /chưa có đáp án đúng/);
          assert.match(err.message, /multiple_choice/);
          return true;
        }
      );

      // Verify transaction was rolled back and never committed
      assert.equal(queries.some(q => q.text === 'BEGIN'), true);
      assert.equal(queries.some(q => q.text === 'ROLLBACK'), true);
      assert.equal(queries.some(q => q.text === 'COMMIT'), false);
      assert.equal(isReleased(), true);
    } finally {
      db.pool.connect = originalConnect;
    }
  });

  it('rejects listening question without correct_answer with HTTP 400 and rolls back transaction', async () => {
    const originalConnect = db.pool.connect;
    const { client, queries, isReleased } = setupMockClient();
    db.pool.connect = async () => client;

    try {
      await assert.rejects(
        async () => {
          await quizzesService.createQuiz(
            'Listening Quiz',
            'Description',
            'Medium',
            20,
            [
              {
                question_text: 'Listen and answer what the speaker wants.',
                question_type: 'listening',
                audio_url: 'https://r2.cdn.example.com/audio/sample.mp3',
                options: ['A', 'B', 'C', 'D'],
                // correct_answer omitted completely
              }
            ]
          );
        },
        (err) => {
          assert.equal(err.status, 400);
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /chưa có đáp án đúng/);
          assert.match(err.message, /listening/);
          return true;
        }
      );

      assert.equal(queries.some(q => q.text === 'ROLLBACK'), true);
      assert.equal(queries.some(q => q.text === 'COMMIT'), false);
      assert.equal(isReleased(), true);
    } finally {
      db.pool.connect = originalConnect;
    }
  });

  it('rejects reading question without correct_answer with HTTP 400 and rolls back transaction', async () => {
    const originalConnect = db.pool.connect;
    const { client, queries, isReleased } = setupMockClient();
    db.pool.connect = async () => client;

    try {
      await assert.rejects(
        async () => {
          await quizzesService.createQuiz(
            'Reading Quiz',
            'Description',
            'Hard',
            30,
            [
              {
                question_text: 'What does the third paragraph imply?',
                passage_text: 'Sample passage text...',
                question_type: 'reading',
                options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                correct_answer: null
              }
            ]
          );
        },
        (err) => {
          assert.equal(err.status, 400);
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /chưa có đáp án đúng/);
          assert.match(err.message, /reading/);
          return true;
        }
      );

      assert.equal(queries.some(q => q.text === 'ROLLBACK'), true);
      assert.equal(queries.some(q => q.text === 'COMMIT'), false);
      assert.equal(isReleased(), true);
    } finally {
      db.pool.connect = originalConnect;
    }
  });

  it('formats previewText as "Không có tiêu đề" if question_text is empty or blank', async () => {
    const originalConnect = db.pool.connect;
    const { client } = setupMockClient();
    db.pool.connect = async () => client;

    try {
      await assert.rejects(
        async () => {
          await quizzesService.createQuiz(
            'Blank Question Quiz',
            '',
            'Easy',
            10,
            [
              {
                question_text: '   ',
                question_type: 'multiple_choice',
                options: ['1', '2'],
                correct_answer: ''
              }
            ]
          );
        },
        (err) => {
          assert.equal(err.status, 400);
          assert.match(err.message, /Không có tiêu đề/);
          return true;
        }
      );
    } finally {
      db.pool.connect = originalConnect;
    }
  });

  it('quizzesController.createQuiz forwards error with status 400 to error middleware', async () => {
    const originalCreateQuiz = quizzesService.createQuiz;
    const mockError = new Error('Câu hỏi "Test" (loại multiple_choice) chưa có đáp án đúng. Vui lòng chọn đáp án trước khi lưu.');
    mockError.status = 400;
    mockError.statusCode = 400;

    quizzesService.createQuiz = async () => {
      throw mockError;
    };

    let passedError = null;
    const req = {
      body: {
        title: 'Quiz with error',
        questions: [{ question_text: 'Test', question_type: 'multiple_choice' }]
      }
    };
    const res = {
      status: () => res,
      json: () => res
    };
    const next = (err) => {
      passedError = err;
    };

    try {
      await quizzesController.createQuiz(req, res, next);
      assert.notEqual(passedError, null);
      assert.equal(passedError.status, 400);
      assert.match(passedError.message, /chưa có đáp án đúng/);
    } finally {
      quizzesService.createQuiz = originalCreateQuiz;
    }
  });

  it('commits successfully when all multiple_choice, listening and reading questions have valid correct answers', async () => {
    const originalConnect = db.pool.connect;
    const { client, queries, isReleased } = setupMockClient();
    db.pool.connect = async () => client;

    try {
      const result = await quizzesService.createQuiz(
        'Valid Comprehensive Quiz',
        'All answers specified',
        'Medium',
        25,
        [
          {
            question_text: 'Question 1',
            question_type: 'multiple_choice',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 'A'
          },
          {
            question_text: 'Question 2',
            question_type: 'listening',
            audio_url: 'https://r2.cdn.example.com/audio/sample.mp3',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 'B'
          },
          {
            question_text: 'Question 3',
            question_type: 'reading',
            passage_text: 'Passage text...',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 'C'
          }
        ]
      );

      assert.equal(result.quizId, 999);
      assert.equal(queries.some(q => q.text === 'COMMIT'), true);
      assert.equal(queries.some(q => q.text === 'ROLLBACK'), false);
      assert.equal(isReleased(), true);
    } finally {
      db.pool.connect = originalConnect;
    }
  });
});
