const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const {
  createRateLimiter,
  setRateLimitEnabled,
  isRateLimitEnabled,
  toggleRateLimit,
  aiLimiter,
  apiLimiter
} = require('../src/middleware/rateLimit.middleware');

const restoreEnvironmentVariable = (name, value) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

const startTestApp = async ({ limit = 2 } = {}) => {
  const app = express();
  app.use(express.json());

  const limiter = createRateLimiter({
    name: 'rate-limit-test',
    windowMs: 60_000,
    limit,
    keyGenerator: () => 'test-client'
  });

  app.get('/limited', limiter, (req, res) => res.json({ success: true }));
  app.get('/api/general', apiLimiter, (req, res) => res.json({ success: true }));
  app.post('/api/chatbot/ask', aiLimiter, (req, res) => res.json({ success: true }));
  app.post('/api/quizzes/submit-audio', aiLimiter, (req, res) => res.json({ success: true }));

  const server = app.listen(0);
  await once(server, 'listening');

  const port = server.address().port;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`
  };
};

test('1. rate limiter returns JSON 429 after configured request limit is exceeded', async (t) => {
  setRateLimitEnabled(true);
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  const { server, baseUrl } = await startTestApp({ limit: 2 });
  t.after(async () => {
    restoreEnvironmentVariable('NODE_ENV', previousNodeEnv);
    setRateLimitEnabled(true);
    await new Promise((resolve) => server.close(resolve));
  });

  const url = `${baseUrl}/limited`;
  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(url)).status, 200);

  const blocked = await fetch(url);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));

  const body = await blocked.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
});

test('2. dynamic toggle setRateLimitEnabled(false) bypasses rate limiting', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  const { server, baseUrl } = await startTestApp({ limit: 1 });
  t.after(async () => {
    restoreEnvironmentVariable('NODE_ENV', previousNodeEnv);
    setRateLimitEnabled(true);
    await new Promise((resolve) => server.close(resolve));
  });

  // Turn ON: 1st req passes, 2nd req is 429
  setRateLimitEnabled(true);
  assert.equal(isRateLimitEnabled(), true);
  assert.equal((await fetch(`${baseUrl}/limited`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/limited`)).status, 429);

  // Turn OFF: rate limit bypassed
  setRateLimitEnabled(false);
  assert.equal(isRateLimitEnabled(), false);
  assert.equal((await fetch(`${baseUrl}/limited`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/limited`)).status, 200);

  // Toggle back ON: state reflects enabled
  toggleRateLimit();
  assert.equal(isRateLimitEnabled(), true);
});

test('3. AI endpoints (/api/chatbot/ask, /api/quizzes/submit-audio) are protected by strict aiLimiter', async (t) => {
  setRateLimitEnabled(true);
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  const { server, baseUrl } = await startTestApp({ limit: 2 });
  t.after(async () => {
    restoreEnvironmentVariable('NODE_ENV', previousNodeEnv);
    setRateLimitEnabled(true);
    await new Promise((resolve) => server.close(resolve));
  });

  const chatbotRes = await fetch(`${baseUrl}/api/chatbot/ask`, { method: 'POST' });
  assert.equal(chatbotRes.status, 200);

  const audioRes = await fetch(`${baseUrl}/api/quizzes/submit-audio`, { method: 'POST' });
  assert.equal(audioRes.status, 200);
});
