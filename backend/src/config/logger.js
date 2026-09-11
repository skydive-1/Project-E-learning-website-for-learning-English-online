/**
 * Structured Durable Logger using Pino
 * Features:
 * - Rotating file persistence (logs/app.log) so logs survive container recycling
 * - Stdout streaming for Docker / Kubernetes logging drivers
 * - Strict redaction of secrets, tokens, cookies, passwords, and authorization headers
 *
 * Authors:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const fs = require('fs');
const path = require('path');
const pino = require('pino');

const LOGS_DIR = path.resolve(__dirname, '../../logs');

if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (err) {
    console.warn(`[Logger] Failed to create logs directory: ${err.message}`);
  }
}

const REDACTED_PATHS = [
  'password',
  '*.password',
  'user.password',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'pin_code',
  '*.pin_code',
  'apiKey',
  '*.apiKey',
  'secret',
  '*.secret',
  'DATABASE_URL',
  'JWT_SECRET',
  'req.headers.authorization',
  'req.headers.cookie',
  'authorization',
  'cookie'
];

const SENSITIVE_ENV_KEY_PATTERN = /(?:secret|password|passwd|token|api[_-]?key|database_url|redis(?:_tls)?_url|private[_-]?key)/i;

const FREE_TEXT_SECRET_PATTERNS = [
  {
    pattern: /\b(Bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi,
    replacement: '$1 [REDACTED]'
  },
  {
    pattern: /((?:password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|authorization|cookie|jwt_secret|database_url)\s*(?:=|:)\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    replacement: '$1[REDACTED]'
  },
  {
    pattern: /\b((?:postgres(?:ql)?|redis|rediss):\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi,
    replacement: '$1[REDACTED]$3'
  }
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pino's path redaction cannot inspect free-form strings. Sanitize messages and
 * stacks before logging so credentials embedded in provider/database errors do
 * not bypass the structured-field redact list.
 */
function sanitizeLogText(value) {
  if (typeof value !== 'string' || value.length === 0) return value;

  let sanitized = value;
  const sensitiveEnvValues = Object.entries(process.env)
    .filter(([key, envValue]) => (
      SENSITIVE_ENV_KEY_PATTERN.test(key)
      && typeof envValue === 'string'
      && envValue.length >= 6
    ))
    .map(([, envValue]) => envValue)
    .sort((a, b) => b.length - a.length);

  for (const envValue of sensitiveEnvValues) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(envValue), 'g'), '[REDACTED]');
  }

  for (const { pattern, replacement } of FREE_TEXT_SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

function buildLogger(options = {}) {
  const isTest = process.env.NODE_ENV === 'test';
  const level = options.level || process.env.LOG_LEVEL || (isTest ? 'warn' : 'info');
  const targetDir = options.logDir || LOGS_DIR;

  const streams = [];

  // 1. Stdout destination (always available unless explicitly silent)
  if (!options.silent) {
    streams.push({ stream: process.stdout, level });
  }

  // 2. File destination (durable persistence)
  if (!isTest || options.enableFileLogging) {
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const fileStream = fs.createWriteStream(path.join(targetDir, 'app.log'), {
        flags: 'a',
        encoding: 'utf8'
      });
      streams.push({ stream: fileStream, level });
    } catch (err) {
      console.warn(`[Logger] File logging disabled: ${err.message}`);
    }
  }

  const pinoOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]'
    },
    formatters: {
      level: (label) => ({ level: label })
    }
  };

  if (streams.length === 0) {
    return pino({ ...pinoOptions, level: 'silent' });
  }

  return pino(pinoOptions, pino.multistream(streams));
}

const logger = buildLogger();

module.exports = {
  logger,
  buildLogger,
  sanitizeLogText,
  REDACTED_PATHS,
  LOGS_DIR
};
