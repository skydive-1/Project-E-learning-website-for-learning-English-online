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

  it('controllers use only req.user.id and ignore query user_id', async () => {
    const originalCalculateStreak = gamificationService.calculateStreak;
    const originalGetUserBadges = gamificationService.getUserBadges;
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

    try {
      const req = { user: { id: 42 }, query: { user_id: '999999' } };
      await gamificationController.getStreak(req, response);
      await gamificationController.getBadges(req, response);

      assert.deepStrictEqual(requestedIds, [42, 42]);
      assert.strictEqual(response.statusCode, 200);
    } finally {
      gamificationService.calculateStreak = originalCalculateStreak;
      gamificationService.getUserBadges = originalGetUserBadges;
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
      if (sql.includes('SELECT DISTINCT')) return { rows: [] };
      if (sql.includes('SELECT longest_streak')) return { rows: [{ longest_streak: 0 }] };
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
});
