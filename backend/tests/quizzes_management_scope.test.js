const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');

describe('Quizzes Management Scope (Free & Standalone Quizzes Only)', () => {
  it('getAllQuizzesForManagement returns only standalone quizzes and excludes lesson quizzes', async () => {
    // Mock db.query to return a mixed set of standalone quizzes and lesson quizzes
    const originalQuery = db.query;
    try {
      let executedSql = '';
      db.query = async (sql, params) => {
        executedSql = sql;
        if (sql.includes('FROM quizzes')) {
          // Verify that query includes the filter for standalone quizzes
          assert.match(sql, /course_id IS NULL/i);
          assert.match(sql, /lesson_id IS NULL/i);

          return {
            rows: [
              { quiz_id: 10, course_id: null, lesson_id: null, title: 'Standalone Quiz 1', is_private: false, pin_code: null },
              { quiz_id: 11, course_id: null, lesson_id: null, title: 'Private PIN Quiz', is_private: true, pin_code: '123456' }
            ]
          };
        }
        if (sql.includes('FROM questions')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      const result = await quizzesService.getAllQuizzesForManagement();
      assert.equal(result.length, 2);
      assert.equal(result[0].quiz_id, 10);
      assert.equal(result[0].course_id, null);
      assert.equal(result[0].lesson_id, null);
      assert.equal(result[1].quiz_id, 11);
      assert.equal(result[1].pin_code, '123456');
    } finally {
      db.query = originalQuery;
    }
  });

  it('deleteQuiz blocks deletion of quizzes attached to a course or lesson', async () => {
    const originalQuery = db.query;
    try {
      db.query = async (sql, params) => {
        if (sql.includes('SELECT course_id, lesson_id FROM quizzes')) {
          // Return a quiz that is attached to a lesson
          return { rows: [{ course_id: 45, lesson_id: 144 }] };
        }
        return { rows: [] };
      };

      await assert.rejects(
        async () => {
          await quizzesService.deleteQuiz(59);
        },
        (err) => {
          assert.match(err.message, /Không thể xóa đề thi thuộc bài học/i);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    } finally {
      db.query = originalQuery;
    }
  });

  it('deleteQuiz permits deletion of standalone quizzes', async () => {
    const originalQuery = db.query;
    let deleteExecuted = false;
    try {
      db.query = async (sql, params) => {
        if (sql.includes('SELECT course_id, lesson_id FROM quizzes')) {
          // Standalone quiz
          return { rows: [{ course_id: null, lesson_id: null }] };
        }
        if (sql.includes('DELETE FROM quizzes')) {
          deleteExecuted = true;
          return { rowCount: 1 };
        }
        return { rows: [] };
      };

      const success = await quizzesService.deleteQuiz(10);
      assert.equal(success, true);
      assert.equal(deleteExecuted, true);
    } finally {
      db.query = originalQuery;
    }
  });
});
