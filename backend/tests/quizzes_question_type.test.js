const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');
const coursesService = require('../src/modules/courses/services/courses.service');

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
        assert.match(queries[0], /\blesson_id\b/);
        assert.match(queries[1], /\bquestion_type\b/);
      }
    } finally {
      db.query = originalQuery;
    }
  });

  it('persists a nested lesson quiz with the real database lesson id', async () => {
    const queries = [];
    const client = {
      query: async (sql, params) => {
        const text = String(sql);
        queries.push({ text, params });
        if (text.includes('SELECT quiz_id FROM quizzes')) return { rows: [] };
        if (text.includes('INSERT INTO quizzes')) return { rows: [{ quiz_id: 44 }] };
        return { rows: [] };
      }
    };

    await coursesService._syncLessonQuiz(client, 9, 123, {
      title: 'Lesson one',
      quizTitle: 'Checkpoint',
      quizTimeLimit: 12,
      quizQuestions: [{
        question_text: 'Choose the correct answer.',
        question_type: 'multiple_choice',
        options: ['A1', 'B1', 'C1', 'D1'],
        correct_answer: 'B'
      }]
    });

    const quizInsert = queries.find(query => query.text.includes('INSERT INTO quizzes'));
    const questionInsert = queries.find(query => query.text.includes('INSERT INTO questions'));
    assert.deepEqual(quizInsert.params.slice(0, 2), [9, 123]);
    assert.equal(questionInsert.params[0], 44);
    assert.equal(questionInsert.params[1], 'Choose the correct answer.');
  });

  it('does not delete a persisted quiz just because quiz loading returned an empty list', async () => {
    const queries = [];
    const client = {
      query: async (sql, params) => {
        queries.push({ text: String(sql), params });
        return { rows: [] };
      }
    };

    await coursesService._syncLessonQuiz(client, 9, 123, { quizQuestions: [] });
    assert.equal(queries.length, 0);

    await coursesService._syncLessonQuiz(client, 9, 123, {
      quizQuestions: [],
      quizDeleted: true
    });
    assert.equal(queries.length, 1);
    assert.match(queries[0].text, /DELETE FROM quizzes/);
    assert.deepEqual(queries[0].params, [9, 123]);
  });

  it('updates the existing lesson quiz instead of creating a duplicate', async () => {
    const originalConnect = db.pool.connect;
    const queries = [];
    let released = false;
    const client = {
      query: async (sql, params) => {
        const text = String(sql);
        queries.push({ text, params });
        if (text.includes('FROM lessons l JOIN sections')) {
          return { rows: [{ lesson_id: 123, course_id: 9 }] };
        }
        if (text.includes('SELECT quiz_id FROM quizzes')) {
          return { rows: [{ quiz_id: 55 }] };
        }
        return { rows: [] };
      },
      release: () => { released = true; }
    };
    db.pool.connect = async () => client;

    try {
      const result = await quizzesService.createQuiz(
        'Updated checkpoint', '', 'Medium', 15,
        [{ question_text: 'Updated question', options: ['1', '2', '3', '4'], correct_answer: 'A' }],
        false, null, 9, 123
      );
      assert.equal(result.quizId, 55);
      assert.equal(queries.some(query => query.text.includes('UPDATE quizzes')), true);
      assert.equal(queries.some(query => query.text.includes('INSERT INTO quizzes')), false);
      assert.equal(queries.some(query => query.text.includes('DELETE FROM questions')), true);
      assert.equal(queries.some(query => query.text === 'COMMIT'), true);
      assert.equal(released, true);
    } finally {
      db.pool.connect = originalConnect;
    }
  });
});
