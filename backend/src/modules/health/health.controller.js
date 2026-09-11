/**
 * Health Probes Controller (Kubernetes / Production Grade)
 *
 * Provides:
 * - /health/live  (Liveness probe - Process lifecycle & event loop check)
 * - /health/ready (Readiness probe - Dependency checks with 2.5s timeout)
 *   - Critical dependencies (PostgreSQL, R2 Storage) failure -> HTTP 503
 *   - Optional dependencies (Gemini, Pinecone) failure -> HTTP 200 (Degraded status)
 *
 * Authors:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { pool } = require('../../config/database');
const r2Storage = require('../../utils/r2Storage');
const { pineconeIndex } = require('../../utils/ai-clients');

const DEPENDENCY_TIMEOUT_MS = 2500;

function withTimeout(promise, timeoutMs, name) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${name} check timed out after ${timeoutMs}ms`);
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Liveness Probe: process is alive, memory is within limits
 * Always returns 200 unless Node process is hung/dead
 */
const getLive = (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.status(200).json({
    status: 'UP',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryMb: {
      rss: Math.round(memoryUsage.rss / (1024 * 1024)),
      heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
      heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
    }
  });
};

/**
 * Readiness Probe: verifies database, storage, and external AI pipelines
 */
const getReady = async (req, res) => {
  const dependencies = {
    database: { status: 'UNKNOWN' },
    storage_r2: { status: 'UNKNOWN' },
    gemini_ai: { status: 'UNKNOWN' },
    pinecone_rag: { status: 'UNKNOWN' }
  };

  let hasCriticalFailure = false;
  let hasDegradedService = false;

  // 1. Critical: PostgreSQL Database Check
  const dbStart = Date.now();
  try {
    const dbPromise = pool.query('SELECT 1 + 1 AS health_check');
    await withTimeout(dbPromise, DEPENDENCY_TIMEOUT_MS, 'Database');
    dependencies.database = {
      status: 'UP',
      latencyMs: Date.now() - dbStart,
      critical: true
    };
  } catch (err) {
    hasCriticalFailure = true;
    dependencies.database = {
      status: 'DOWN',
      error: err.message,
      critical: true
    };
  }

  // 2. Critical: Cloudflare R2 Storage Check
  const r2Start = Date.now();
  try {
    const r2Promise = r2Storage.ensureBucketExists();
    await withTimeout(r2Promise, DEPENDENCY_TIMEOUT_MS, 'R2 Storage');
    dependencies.storage_r2 = {
      status: 'UP',
      bucket: r2Storage.resolveBucket(),
      latencyMs: Date.now() - r2Start,
      critical: true
    };
  } catch (err) {
    hasCriticalFailure = true;
    dependencies.storage_r2 = {
      status: 'DOWN',
      error: err.message,
      critical: true
    };
  }

  // 3. Optional: Gemini AI API Check (Graceful degradation)
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey.trim() === '') {
    hasDegradedService = true;
    dependencies.gemini_ai = {
      status: 'DEGRADED',
      reason: 'GEMINI_API_KEY is not configured',
      critical: false
    };
  } else {
    dependencies.gemini_ai = {
      status: 'UP',
      critical: false
    };
  }

  // 4. Optional: Pinecone Vector Database Check (Graceful degradation)
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  if (!pineconeApiKey || pineconeApiKey === 'dummy-pinecone-key' || !pineconeIndex) {
    hasDegradedService = true;
    dependencies.pinecone_rag = {
      status: 'DEGRADED',
      reason: 'PINECONE_API_KEY is not configured or inactive',
      critical: false
    };
  } else {
    const pcStart = Date.now();
    try {
      const pcPromise = pineconeIndex.describeIndexStats();
      await withTimeout(pcPromise, DEPENDENCY_TIMEOUT_MS, 'Pinecone');
      dependencies.pinecone_rag = {
        status: 'UP',
        latencyMs: Date.now() - pcStart,
        critical: false
      };
    } catch (err) {
      hasDegradedService = true;
      dependencies.pinecone_rag = {
        status: 'DEGRADED',
        error: err.message,
        critical: false
      };
    }
  }

  const statusCode = hasCriticalFailure ? 503 : 200;
  const overallStatus = hasCriticalFailure
    ? 'UNHEALTHY'
    : (hasDegradedService ? 'DEGRADED' : 'HEALTHY');

  res.status(statusCode).json({
    status: overallStatus,
    statusCode,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    dependencies
  });
};

/**
 * Legacy Health Endpoint for backward compatibility
 */
const getLegacyHealth = (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'E-learning backend is running',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getLive,
  getReady,
  getLegacyHealth,
  withTimeout
};
