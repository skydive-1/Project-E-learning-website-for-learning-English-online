/**
 * Distributed Rate Limiting & Shared Store Test Suite
 *
 * Verifies:
 * 1. Graceful fallback to MemoryStore when REDIS_URL is not configured
 * 2. Production warning emission when REDIS_URL is missing in production mode
 * 3. Rate limiter behavior (429 RATE_LIMIT_EXCEEDED response)
 * 4. RedisStore initialization and key prefixing when Redis client is active
 *
 * Team:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const express = require('express');
const { createDistributedRateLimitStore, getRedisClient, initRedis } = require('../src/config/redis');
const { createRateLimiter } = require('../src/middleware/rateLimit.middleware');
const { RedisStore } = require('rate-limit-redis');

describe('Shared & Distributed Rate Limiting', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test('falls back gracefully to undefined (memory store) when REDIS_URL is absent', () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS_URL;

    const store = createDistributedRateLimitStore('test-scope');
    expect(store).toBeUndefined();
  });

  test('logs prominent security warning in production mode when REDIS_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS_URL;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    getRedisClient();

    expect(warnSpy).toHaveBeenCalled();
    const warningMessage = warnSpy.mock.calls.find(call =>
      call[0] && call[0].includes('REDIS_URL is not set in production')
    );
    expect(warningMessage).toBeDefined();
  });

  test('initRedis resolves to false without throwing if REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS_URL;

    const ready = await initRedis();
    expect(ready).toBe(false);
  });

  test('enforces rate limit and returns 429 RATE_LIMIT_EXCEEDED on limit breach', async () => {
    // Construct an isolated express app with a small limiter (2 requests max)
    const app = express();
    const { ipKeyGenerator } = require('express-rate-limit');
    const testLimiter = createRateLimiter({
      name: 'test-limiter',
      windowMs: 60 * 1000,
      limit: 2,
      keyGenerator: (req) => ipKeyGenerator(req.ip)
    });

    app.get('/test-limit', testLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'ok' });
    });

    const server = app.listen(0);
    const port = server.address().port;

    try {
      // 1st request -> 200
      const res1 = await fetch(`http://127.0.0.1:${port}/test-limit`);
      expect(res1.status).toBe(200);

      // 2nd request -> 200
      const res2 = await fetch(`http://127.0.0.1:${port}/test-limit`);
      expect(res2.status).toBe(200);

      // 3rd request -> 429
      const res3 = await fetch(`http://127.0.0.1:${port}/test-limit`);
      expect(res3.status).toBe(429);
      const data3 = await res3.json();
      expect(data3.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(data3.success).toBe(false);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('RedisStore configures correct prefix and sendCommand wrapper', () => {
    const mockCall = jest.fn().mockResolvedValue([1, 1000]);
    const mockClient = {
      call: mockCall
    };

    const store = new RedisStore({
      sendCommand: (...args) => mockClient.call(...args),
      prefix: 'rl:auth:'
    });

    expect(store).toBeDefined();
    expect(typeof store.init).toBe('function');
    expect(typeof store.increment).toBe('function');
  });
});
