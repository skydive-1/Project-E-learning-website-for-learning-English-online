'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, it, mock } = require('node:test');
const {
  buildLogger,
  logger,
  sanitizeLogText
} = require('../src/config/logger');
const errorHandler = require('../src/middleware/error.middleware');

async function flushLogger(targetLogger) {
  await new Promise((resolve, reject) => {
    targetLogger.flush(error => (error ? reject(error) : resolve()));
  });
  await new Promise(resolve => setTimeout(resolve, 50));
}

describe('Structured Durable Logger & Redaction', () => {
  let testLogDir;

  before(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-learning-logger-'));
  });

  after(() => {
    mock.restoreAll();
    if (testLogDir?.startsWith(os.tmpdir())) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  it('writes structured JSON logs to a durable file', async () => {
    const fileLogger = buildLogger({
      logDir: testLogDir,
      enableFileLogging: true,
      silent: true,
      level: 'info'
    });

    fileLogger.info(
      { event: 'system_startup', nodeVersion: process.version },
      'Server initialized'
    );
    await flushLogger(fileLogger);

    const logFilePath = path.join(testLogDir, 'app.log');
    assert.equal(fs.existsSync(logFilePath), true);

    const entries = fs.readFileSync(logFilePath, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const startupEntry = entries.find(entry => entry.event === 'system_startup');

    assert.ok(startupEntry);
    assert.equal(startupEntry.msg, 'Server initialized');
    assert.equal(startupEntry.level, 'info');
    assert.ok(startupEntry.time);
  });

  it('redacts sensitive structured fields while preserving public data', async () => {
    const fileLogger = buildLogger({
      logDir: testLogDir,
      enableFileLogging: true,
      silent: true,
      level: 'info'
    });
    const secrets = [
      'SuperSecretPassword123!',
      'jwt.token.secret.signature',
      'access-token-xyz',
      'refresh-token-abc',
      '987654',
      'test-gemini-dummy-api-key',
      'Bearer sensitive-bearer-token',
      'session_id=secret-cookie-value'
    ];

    fileLogger.warn({
      event: 'user_auth_attempt',
      password: secrets[0],
      token: secrets[1],
      accessToken: secrets[2],
      refreshToken: secrets[3],
      pin_code: secrets[4],
      apiKey: secrets[5],
      req: {
        headers: {
          authorization: secrets[6],
          cookie: secrets[7]
        }
      },
      publicField: 'safe_public_data'
    }, 'Auth probe event');
    await flushLogger(fileLogger);

    const logContent = fs.readFileSync(path.join(testLogDir, 'app.log'), 'utf8');
    for (const secret of secrets) {
      assert.equal(logContent.includes(secret), false, `log làm lộ secret: ${secret}`);
    }
    assert.match(logContent, /safe_public_data/);
    assert.match(logContent, /\[REDACTED\]/);
  });

  it('sanitizes secrets embedded in free-form messages and connection URLs', () => {
    const previousToken = process.env.TEST_SERVICE_TOKEN;
    process.env.TEST_SERVICE_TOKEN = 'environment-secret-value';

    try {
      const unsafeText = [
        'authorization: Bearer abc.def.secret',
        'password=plain-text-password',
        'DATABASE_URL=postgresql://service:database-password@db.example/app',
        'provider returned environment-secret-value'
      ].join(' | ');
      const sanitized = sanitizeLogText(unsafeText);

      assert.doesNotMatch(sanitized, /abc\.def\.secret/);
      assert.doesNotMatch(sanitized, /plain-text-password/);
      assert.doesNotMatch(sanitized, /database-password/);
      assert.doesNotMatch(sanitized, /environment-secret-value/);
      assert.match(sanitized, /\[REDACTED\]/);
    } finally {
      if (previousToken === undefined) delete process.env.TEST_SERVICE_TOKEN;
      else process.env.TEST_SERVICE_TOKEN = previousToken;
    }
  });

  it('sanitizes error message and stack before error middleware writes them', () => {
    const previousSecret = process.env.TEST_ERROR_SECRET;
    process.env.TEST_ERROR_SECRET = 'middleware-secret-value';
    const calls = [];
    const errorMock = mock.method(logger, 'error', (...args) => calls.push(args));
    const error = new Error(
      'Request failed with token=raw-token-value and middleware-secret-value'
    );
    const request = {
      requestId: 'request-123',
      method: 'GET',
      path: '/api/private'
    };
    let statusCode;
    let responseBody;
    const response = {
      status(value) {
        statusCode = value;
        return this;
      },
      json(value) {
        responseBody = value;
        return this;
      }
    };

    try {
      errorHandler(error, request, response, () => {});

      assert.equal(calls.length, 1);
      const [fields, message] = calls[0];
      const serializedLog = JSON.stringify({ fields, message });
      assert.doesNotMatch(serializedLog, /raw-token-value/);
      assert.doesNotMatch(serializedLog, /middleware-secret-value/);
      assert.match(serializedLog, /\[REDACTED\]/);
      assert.equal(statusCode, 500);
      assert.equal(responseBody.message, 'Lỗi nội bộ máy chủ.');
    } finally {
      errorMock.mock.restore();
      if (previousSecret === undefined) delete process.env.TEST_ERROR_SECRET;
      else process.env.TEST_ERROR_SECRET = previousSecret;
    }
  });
});
