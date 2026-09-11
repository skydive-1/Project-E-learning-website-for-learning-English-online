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
  REDACTED_PATHS,
  LOGS_DIR
};
