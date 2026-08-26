const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');

describe('Quiz question type data contract', () => {
  it('returns question_type when loading a quiz by id', async () => {
    const originalQuery = db.query;
    const queries = [];

    db.query = async (sql) => {
      queries.push(sql);
      if (queries.length === 1) {
        return { rows: [{ quiz_id: 7, title: 'Creative quiz' }] };
      }
      return {
        rows: [{
          question_id: 21,
          quiz_id: 7,
          question_text: 'Please read this sentence aloud.',
          options: [],
          correct_answer: 'Practice makes perfect.',
          explanation: '',
          question_type: 'pronunciation'
        }]
      };
    };

    try {
      const quiz = await quizzesService.getQuizById(7);
      assert.match(queries[1], /\bquestion_type\b/);
      assert.equal(quiz.questions[0].question_type, 'pronunciation');
    } finally {
      db.query = originalQuery;
    }
  });

  it('selects question_type for course and PIN quiz loaders', async () => {
    const originalQuery = db.query;

    try {
      for (const load of [
        () => quizzesService.getQuizzesByCourseId('free'),
        () => quizzesService.getQuizByPin('ABCD')
      ]) {
        const queries = [];
        db.query = async (sql) => {
          queries.push(sql);
          return queries.length === 1
            ? { rows: [{ quiz_id: 8, title: 'Mixed skills quiz' }] }
            : { rows: [] };
        };

        await load();
        assert.match(queries[1], /\bquestion_type\b/);
      }
    } finally {
      db.query = originalQuery;
    }
  });
});
