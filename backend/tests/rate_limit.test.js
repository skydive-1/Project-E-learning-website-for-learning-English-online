const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const { createRateLimiter } = require('../src/middleware/rateLimit.middleware');

const restoreEnvironmentVariable = (name, value) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

const startTestApp = async ({ limit = 2 } = {}) => {
  const app = express();
  const limiter = createRateLimiter({
    name: 'rate-limit-test',
    windowMs: 60_000,
    limit,
    keyGenerator: () => 'test-client'
  });

  app.get('/limited', limiter, (req, res) => res.json({ success: true }));

  const server = app.listen(0);
  await once(server, 'listening');

  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/limited`
  };
};

test('rate limiter returns JSON 429 after the configured request limit', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDisableFlag = process.env.DISABLE_RATE_LIMIT;
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_RATE_LIMIT = 'false';

  const { server, url } = await startTestApp({ limit: 2 });
  t.after(async () => {
    restoreEnvironmentVariable('NODE_ENV', previousNodeEnv);
    restoreEnvironmentVariable('DISABLE_RATE_LIMIT', previousDisableFlag);
    await new Promise((resolve) => server.close(resolve));
  });

  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(url)).status, 200);

  const blocked = await fetch(url);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));

  const body = await blocked.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
});

test('DISABLE_RATE_LIMIT cannot disable protection in production', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDisableFlag = process.env.DISABLE_RATE_LIMIT;
  process.env.NODE_ENV = 'production';
  process.env.DISABLE_RATE_LIMIT = 'true';

  const { server, url } = await startTestApp({ limit: 1 });
  t.after(async () => {
    restoreEnvironmentVariable('NODE_ENV', previousNodeEnv);
    restoreEnvironmentVariable('DISABLE_RATE_LIMIT', previousDisableFlag);
    await new Promise((resolve) => server.close(resolve));
  });

  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(url)).status, 429);
});
