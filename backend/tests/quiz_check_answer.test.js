const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');
const quizzesController = require('../src/modules/quizzes/controllers/quizzes.controller');
const db = require('../src/config/database');

describe('Quiz Answer Verification & Real-time Evaluation (Zero Leakage Check)', () => {
  it('checkAnswer correctly matches standard multiple_choice option letter', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      if (sql.includes('FROM questions')) {
        return {
          rows: [
            {
              question_id: 101,
              quiz_id: 5,
              question_text: 'What is the capital of England?',
              options: ['A. London', 'B. Paris', 'C. Berlin', 'D. Rome'],
              correct_answer: 'A',
              explanation: 'London is the capital of the United Kingdom.',
              question_type: 'multiple_choice'
            }
          ]
        };
      }
      return { rows: [] };
    };

    try {
      // Correct choice 'A'
      const correctRes = await quizzesService.checkAnswer(5, 101, 'A');
      assert.equal(correctRes.isCorrect, true);
      assert.equal(correctRes.correctAnswer, 'A');
      assert.equal(correctRes.fullCorrectAnswerText, 'A. London');
      assert.equal(correctRes.explanation, 'London is the capital of the United Kingdom.');

      // Correct choice 'A. London' (matching full text)
      const correctFullRes = await quizzesService.checkAnswer(5, 101, 'A. London');
      assert.equal(correctFullRes.isCorrect, true);

      // Incorrect choice 'B'
      const incorrectRes = await quizzesService.checkAnswer(5, 101, 'B');
      assert.equal(incorrectRes.isCorrect, false);
      assert.equal(incorrectRes.correctAnswer, 'A');
      assert.equal(incorrectRes.fullCorrectAnswerText, 'A. London');
    } finally {
      db.query = originalQuery;
    }
  });

  it('checkAnswer controller handles invalid quizId or questionId with HTTP 400', async () => {
    const req = { body: { quizId: null, questionId: 101 } };
    let capturedError = null;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };

    await quizzesController.checkAnswer(req, res, err => { capturedError = err; });
    assert.ok(capturedError);
    assert.equal(capturedError.status, 400);
  });

  it('submitQuiz returns detailed results array along with score and correct_count', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      if (sql.includes('FROM questions')) {
        return {
          rows: [
            {
              question_id: 201,
              quiz_id: 10,
              question_text: 'Choose the correct preposition: He is interested ___ music.',
              options: ['A. on', 'B. in', 'C. at', 'D. with'],
              correct_answer: 'B',
              explanation: 'Interested takes preposition IN.',
              question_type: 'multiple_choice'
            },
            {
              question_id: 202,
              quiz_id: 10,
              question_text: 'Choose synonym for enormous.',
              options: ['A. huge', 'B. tiny', 'C. narrow', 'D. weak'],
              correct_answer: 'A',
              explanation: 'Enormous means very large or huge.',
              question_type: 'multiple_choice'
            }
          ]
        };
      }
      if (sql.includes('INSERT INTO quiz_attempts')) {
        return {
          rows: [
            {
              attempt_id: 999,
              user_id: 1,
              quiz_id: 10,
              score: 100,
              completed_at: new Date()
            }
          ]
        };
      }
      return { rows: [] };
    };

    try {
      const answers = [
        { question_id: 201, answer: 'B' },
        { question_id: 202, answer: 'A' }
      ];
      const result = await quizzesService.submitQuiz(1, 10, answers, 'TestPlayer');

      assert.equal(result.score, 100);
      assert.equal(result.correct_count, 2);
      assert.equal(result.total_questions, 2);
      assert.ok(Array.isArray(result.results));
      assert.equal(result.results.length, 2);

      const q1 = result.results.find(r => r.question_id === 201);
      assert.equal(q1.is_correct, true);
      assert.equal(q1.correct_answer, 'B');
      assert.equal(q1.full_correct_answer_text, 'B. in');

      const q2 = result.results.find(r => r.question_id === 202);
      assert.equal(q2.is_correct, true);
      assert.equal(q2.correct_answer, 'A');
      assert.equal(q2.full_correct_answer_text, 'A. huge');
    } finally {
      db.query = originalQuery;
    }
  });
});
