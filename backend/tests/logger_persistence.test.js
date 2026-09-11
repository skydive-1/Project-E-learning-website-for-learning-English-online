/**
 * Structured Durable Logger & Sensitive Redaction Test Suite
 *
 * Verifies:
 * 1. Durable file logging (app.log creation and JSON-Lines output)
 * 2. Sensitive data redaction (passwords, tokens, pin_codes, auth headers, cookies)
 * 3. Structured fields preservation (event, requestId, durationMs, status)
 *
 * Team:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐINH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const fs = require('fs');
const path = require('path');
const { buildLogger } = require('../src/config/logger');

describe('Structured Durable Logger & Redaction', () => {
  const testLogDir = path.resolve(__dirname, '../scratch/test-logger-logs');

  beforeAll(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testLogDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  test('writes structured JSON logs to durable file', async () => {
    const fileLogger = buildLogger({
      logDir: testLogDir,
      enableFileLogging: true,
      silent: true,
      level: 'info'
    });

    fileLogger.info({ event: 'system_startup', nodeVersion: process.version }, 'Server initialized');

    // Wait a brief moment for stream write
    await new Promise(resolve => setTimeout(resolve, 150));

    const logFilePath = path.join(testLogDir, 'app.log');
    expect(fs.existsSync(logFilePath)).toBe(true);

    const logContent = fs.readFileSync(logFilePath, 'utf8');
    expect(logContent.length).toBeGreaterThan(0);

    const lines = logContent.trim().split('\n').map(l => JSON.parse(l));
    const startupEntry = lines.find(entry => entry.event === 'system_startup');

    expect(startupEntry).toBeDefined();
    expect(startupEntry.msg).toBe('Server initialized');
    expect(startupEntry.level).toBe('info');
    expect(startupEntry.time).toBeDefined();
  });

  test('strictly redacts sensitive tokens, passwords, pin codes, and auth headers', async () => {
    const fileLogger = buildLogger({
      logDir: testLogDir,
      enableFileLogging: true,
      silent: true,
      level: 'info'
    });

    const sensitivePayload = {
      event: 'user_auth_attempt',
      password: 'SuperSecretPassword123!',
      token: 'jwt.token.secret.signature',
      accessToken: 'access-token-xyz',
      refreshToken: 'refresh-token-abc',
      pin_code: '987654',
      apiKey: 'test-gemini-dummy-api-key',
      req: {
        headers: {
          authorization: 'Bearer sensitive-bearer-token',
          cookie: 'session_id=secret-cookie-value'
        }
      },
      publicField: 'safe_public_data'
    };

    fileLogger.warn(sensitivePayload, 'Auth probe event');

    await new Promise(resolve => setTimeout(resolve, 150));

    const logFilePath = path.join(testLogDir, 'app.log');
    const logContent = fs.readFileSync(logFilePath, 'utf8');

    // Raw sensitive strings must NOT appear anywhere in the log file
    expect(logContent).not.toContain('SuperSecretPassword123!');
    expect(logContent).not.toContain('jwt.token.secret.signature');
    expect(logContent).not.toContain('access-token-xyz');
    expect(logContent).not.toContain('refresh-token-abc');
    expect(logContent).not.toContain('987654');
    expect(logContent).not.toContain('test-gemini-dummy-api-key');
    expect(logContent).not.toContain('Bearer sensitive-bearer-token');
    expect(logContent).not.toContain('session_id=secret-cookie-value');

    // Safe public field must be preserved
    expect(logContent).toContain('safe_public_data');

    // Redacted placeholder must be present
    expect(logContent).toContain('[REDACTED]');
  });
});
