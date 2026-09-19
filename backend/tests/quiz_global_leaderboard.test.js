const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const quizzesService = require('../src/modules/quizzes/services/quizzes.service');
const quizzesController = require('../src/modules/quizzes/controllers/quizzes.controller');
const db = require('../src/config/database');

describe('Quiz Global Leaderboard (Fair Scoring & Multi-Role)', () => {
  it('quizzesService.getGlobalLeaderboard queries DB with proper time filters and limits', async () => {
    const originalQuery = db.query;
    let capturedSql = '';
    let capturedParams = [];

    db.query = async (sql, params) => {
      capturedSql = sql;
      capturedParams = params;
      return {
        rows: [
          {
            rank: 1,
            user_id: 10,
            user_name: 'Nguyễn Văn A',
            avatar: null,
            role_id: 3,
            total_quizzes_taken: 5,
            total_score: 480,
            average_score: 96.0,
            perfect_scores: 4,
            last_activity_at: new Date('2026-09-15T10:00:00Z')
          },
          {
            rank: 2,
            user_id: 12,
            user_name: 'Trần Thị B',
            avatar: 'https://example.com/avatar.jpg',
            role_id: 2,
            total_quizzes_taken: 3,
            total_score: 290,
            average_score: 96.7,
            perfect_scores: 2,
            last_activity_at: new Date('2026-09-16T12:00:00Z')
          }
        ]
      };
    };

    try {
      // Test 1: timeframe = 'all', default limit = 20
      const resAll = await quizzesService.getGlobalLeaderboard();
      assert.equal(resAll.length, 2);
      assert.equal(resAll[0].rank, 1);
      assert.equal(resAll[0].total_score, 480);
      assert.equal(capturedParams[0], 20);
      assert.ok(!capturedSql.includes("INTERVAL '7 days'"));
      assert.ok(!capturedSql.includes("INTERVAL '30 days'"));
      assert.ok(capturedSql.includes('u.profile_picture_url AS avatar'), 'Must select u.profile_picture_url AS avatar');
      assert.ok(!capturedSql.includes('u.avatar,'), 'Must not use nonexistent u.avatar column');

      // Test 2: timeframe = 'week'
      await quizzesService.getGlobalLeaderboard({ timeframe: 'week', limit: 10 });
      assert.equal(capturedParams[0], 10);
      assert.ok(capturedSql.includes("qa.completed_at >= NOW() - INTERVAL '7 days'"));

      // Test 3: timeframe = 'month'
      await quizzesService.getGlobalLeaderboard({ timeframe: 'month', limit: 100 });
      assert.equal(capturedParams[0], 50); // clamped to 50
      assert.ok(capturedSql.includes("qa.completed_at >= NOW() - INTERVAL '30 days'"));
    } finally {
      db.query = originalQuery;
    }
  });

  it('quizzesController.getGlobalLeaderboard returns 200 with leaderboard payload', async () => {
    const originalQuery = db.query;
    db.query = async () => ({
      rows: [
        {
          rank: 1,
          user_id: 1,
          user_name: 'Top Scorer',
          avatar: null,
          role_id: 3,
          total_quizzes_taken: 8,
          total_score: 750,
          average_score: 93.8,
          perfect_scores: 5,
          last_activity_at: new Date()
        }
      ]
    });

    try {
      const req = { query: { timeframe: 'month', limit: '15' } };
      let statusCode = 0;
      let jsonBody = null;
      const res = {
        status(code) { statusCode = code; return this; },
        json(body) { jsonBody = body; return this; }
      };

      await quizzesController.getGlobalLeaderboard(req, res, () => {});
      assert.equal(statusCode, 200);
      assert.equal(jsonBody.success, true);
      assert.equal(jsonBody.data.length, 1);
      assert.equal(jsonBody.data[0].user_name, 'Top Scorer');
    } finally {
      db.query = originalQuery;
    }
  });

  it('quizzesController.getGlobalLeaderboard propagates errors to next()', async () => {
    const originalQuery = db.query;
    db.query = async () => {
      throw new Error('Database connection failed');
    };

    try {
      const req = { query: {} };
      let capturedErr = null;
      const res = {
        status() { return this; },
        json() { return this; }
      };

      await quizzesController.getGlobalLeaderboard(req, res, (err) => {
        capturedErr = err;
      });

      assert.ok(capturedErr);
      assert.equal(capturedErr.message, 'Database connection failed');
    } finally {
      db.query = originalQuery;
    }
  });

  it('quizzes.routes registers /leaderboard/global BEFORE /:quizId/leaderboard to prevent collision', () => {
    const router = require('../src/modules/quizzes/quizzes.routes');
    const globalIdx = router.stack.findIndex(layer => layer.route && layer.route.path === '/leaderboard/global');
    const quizLeaderboardIdx = router.stack.findIndex(layer => layer.route && layer.route.path === '/:quizId/leaderboard');

    assert.ok(globalIdx >= 0, 'Route /leaderboard/global must be registered');
    assert.ok(quizLeaderboardIdx >= 0, 'Route /:quizId/leaderboard must be registered');
    assert.ok(globalIdx < quizLeaderboardIdx, 'Route /leaderboard/global must be defined before /:quizId/leaderboard');
  });
});

