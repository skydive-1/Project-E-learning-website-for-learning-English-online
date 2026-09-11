'use strict';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');
const express = require('express');
const { RedisStore } = require('rate-limit-redis');
const {
  createDistributedRateLimitStore,
  getRedisClient,
  initRedis
} = require('../src/config/redis');
const { createRateLimiter } = require('../src/middleware/rateLimit.middleware');

describe('Shared & Distributed Rate Limiting', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_TLS_URL: process.env.REDIS_TLS_URL
  };

  function restoreEnv(name, value) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnv)) {
      restoreEnv(name, value);
    }
    mock.restoreAll();
  });

  it('falls back gracefully to memory storage when Redis is unavailable', () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS_URL;

    assert.equal(createDistributedRateLimitStore('test-scope'), undefined);
  });

  it('logs a prominent security warning when production has no Redis URL', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS_URL;

    const warnings = [];
    mock.method(console, 'warn', (...args) => warnings.push(args));

    getRedisClient();

    assert.ok(warnings.some(args => (
      String(args[0]).includes('REDIS_URL is not set in production')
    )));
  });

  it('initRedis resolves false without throwing when Redis is not configured', async () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS_URL;

    assert.equal(await initRedis(), false);
  });

  it('returns 429 RATE_LIMIT_EXCEEDED after the configured request limit', async () => {
    const app = express();
    const { ipKeyGenerator } = require('express-rate-limit');
    const testLimiter = createRateLimiter({
      name: 'test-limiter',
      windowMs: 60 * 1000,
      limit: 2,
      keyGenerator: req => ipKeyGenerator(req.ip)
    });

    app.get('/test-limit', testLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'ok' });
    });

    const server = await new Promise(resolve => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
    });
    const { port } = server.address();

    try {
      const firstResponse = await fetch(`http://127.0.0.1:${port}/test-limit`);
      const secondResponse = await fetch(`http://127.0.0.1:${port}/test-limit`);
      const limitedResponse = await fetch(`http://127.0.0.1:${port}/test-limit`);

      assert.equal(firstResponse.status, 200);
      assert.equal(secondResponse.status, 200);
      assert.equal(limitedResponse.status, 429);
      assert.deepEqual(await limitedResponse.json(), {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfter: '60'
      });
    } finally {
      await new Promise((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }
  });

  it('constructs a RedisStore with the expected command contract', () => {
    const mockCall = mock.fn(async () => [1, 1000]);
    const mockClient = { call: mockCall };
    const store = new RedisStore({
      sendCommand: (...args) => mockClient.call(...args),
      prefix: 'rl:auth:'
    });

    assert.ok(store);
    assert.equal(typeof store.init, 'function');
    assert.equal(typeof store.increment, 'function');
  });
});
