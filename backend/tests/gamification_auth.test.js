const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');

const gamificationRoutes = require('../src/modules/gamification/gamification.routes');
const gamificationController = require('../src/modules/gamification/controllers/gamification.controller');
const gamificationService = require('../src/modules/gamification/services/gamification.service');
const db = require('../src/config/database');

describe('Gamification authentication boundary', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use('/api/gamification', gamificationRoutes);
    server = http.createServer(app);

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('GET /badges rejects anonymous requests even when user_id is supplied', async () => {
    const response = await fetch(`${baseUrl}/api/gamification/badges?user_id=999999`);
    const body = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(body.code, 'AUTH_REQUIRED');
  });

  it('GET /streak rejects anonymous requests even when user_id is supplied', async () => {
    const response = await fetch(`${baseUrl}/api/gamification/streak?user_id=999999`);
    const body = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(body.code, 'AUTH_REQUIRED');
  });

  it('GET /summary rejects anonymous requests', async () => {
    const response = await fetch(`${baseUrl}/api/gamification/summary`);
    const body = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(body.code, 'AUTH_REQUIRED');
  });

  it('controllers use only req.user.id and ignore query user_id', async () => {
    const originalCalculateStreak = gamificationService.calculateStreak;
    const originalGetUserBadges = gamificationService.getUserBadges;
    const originalGetSummary = gamificationService.getGamificationSummary;
    const requestedIds = [];
    const response = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };

    gamificationService.calculateStreak = async userId => {
      requestedIds.push(userId);
      return { currentStreak: 0 };
    };
    gamificationService.getUserBadges = async userId => {
      requestedIds.push(userId);
      return [];
    };
    gamificationService.getGamificationSummary = async userId => {
      requestedIds.push(userId);
      return { streak: { currentStreak: 0 }, badges: [] };
    };

    try {
      const req = { user: { id: 42 }, query: { user_id: '999999' } };
      await gamificationController.getStreak(req, response);
      await gamificationController.getBadges(req, response);
      await gamificationController.getSummary(req, response);

      assert.deepStrictEqual(requestedIds, [42, 42, 42]);
      assert.strictEqual(response.statusCode, 200);
    } finally {
      gamificationService.calculateStreak = originalCalculateStreak;
      gamificationService.getUserBadges = originalGetUserBadges;
      gamificationService.getGamificationSummary = originalGetSummary;
    }
  });

  it('badge calculation propagates database errors instead of returning default badges', async () => {
    const originalQuery = db.query;
    db.query = async () => {
      throw new Error('Database unavailable');
    };

    try {
      await assert.rejects(
        () => gamificationService.getUserBadges(42),
        /Database unavailable/
      );
    } finally {
      db.query = originalQuery;
    }
  });

  it('does not mark achievements as unlocked when the database has no activity', async () => {
    const originalQuery = db.query;
    db.query = async sql => {
      if (sql.includes('WITH completed_progress')) {
        return {
          rows: [{
            completed_lessons: 0,
            first_lesson_day: null,
            perfect_quizzes: 0,
            quiz_master_day: null,
            ai_questions: 0,
            ai_interactive_day: null,
            grammar_total: 0,
            grammar_completed: 0,
            grammar_completed_day: null,
            max_daily_completions: 0,
            speed_learner_day: null
          }]
        };
      }
      if (sql.includes('SELECT DISTINCT')) return { rows: [] };
      throw new Error(`Unexpected query in test: ${sql}`);
    };

    try {
      const badges = await gamificationService.getUserBadges(42);
      assert.ok(badges.length > 0);
      assert.ok(badges.every(badge => badge.unlocked === false));
    } finally {
      db.query = originalQuery;
    }
  });

  it('calculates streaks across week boundaries and records milestone dates', () => {
    const activityDays = [
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04'
    ];

    const result = gamificationService.analyzeActivityDays(
      activityDays,
      new Date('2026-09-04T10:00:00.000Z')
    );

    assert.strictEqual(result.currentStreak, 7);
    assert.strictEqual(result.longestStreak, 7);
    assert.strictEqual(result.thresholdDates[3], '2026-08-31');
    assert.strictEqual(result.thresholdDates[7], '2026-09-04');
  });

  it('unlocks every badge from real learning tables and returns measured progress', async () => {
    const originalQuery = db.query;
    const sqlCalls = [];
    const today = new Date(Date.now() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const end = new Date(`${today}T00:00:00.000Z`);
    const activityDays = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(end);
      day.setUTCDate(end.getUTCDate() - (29 - index));
      return { day: day.toISOString().slice(0, 10) };
    });

    db.query = async sql => {
      sqlCalls.push(sql);
      if (sql.includes('WITH completed_progress')) {
        return {
          rows: [{
            completed_lessons: 12,
            first_lesson_day: activityDays[0].day,
            perfect_quizzes: 5,
            quiz_master_day: activityDays[10].day,
            ai_questions: 10,
            ai_interactive_day: activityDays[11].day,
            grammar_total: 4,
            grammar_completed: 4,
            grammar_completed_day: activityDays[12].day,
            max_daily_completions: 3,
            speed_learner_day: activityDays[13].day
          }]
        };
      }
      if (sql.includes('SELECT DISTINCT')) return { rows: activityDays };
      throw new Error(`Unexpected query in test: ${sql}`);
    };

    try {
      const summary = await gamificationService.getGamificationSummary(42);

      assert.strictEqual(summary.streak.longestStreak, 30);
      assert.deepStrictEqual(
        summary.badges.filter(badge => !badge.unlocked).map(badge => badge.id),
        []
      );
      assert.deepStrictEqual(
        summary.badges.find(badge => badge.id === 'quiz_master').progress,
        { current: 5, target: 5, unit: 'quiz' }
      );
      assert.deepStrictEqual(
        summary.badges.find(badge => badge.id === 'grammar_guru').progress,
        { current: 4, target: 4, unit: 'bài học', available: true }
      );

      const metricsSql = sqlCalls.find(sql => sql.includes('WITH completed_progress'));
      assert.match(metricsSql, /FROM user_progress/);
      assert.match(metricsSql, /FROM quiz_attempts/);
      assert.match(metricsSql, /qa\.score = 100/);
      assert.match(metricsSql, /FROM ai_chat/);
      assert.match(metricsSql, /ac\.sender_type = 'user'/);
      assert.match(metricsSql, /JOIN subjects/);
    } finally {
      db.query = originalQuery;
    }
  });
});
