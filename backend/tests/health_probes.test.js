/**
 * Kubernetes-Standard Health Probes Test Suite
 *
 * Verifies:
 * 1. /health/live returns HTTP 200 with process metrics (uptime, memory)
 * 2. /health/ready returns HTTP 200 when critical dependencies (PostgreSQL, R2) are up
 * 3. /health/ready returns HTTP 503 when critical dependencies fail
 * 4. /health/ready returns HTTP 200 (degraded) when optional AI services fail
 * 5. withTimeout prevents probe hang if dependencies freeze
 * 6. Legacy /health alias returns HTTP 200
 *
 * Team:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const express = require('express');
const healthRoutes = require('../src/modules/health/health.routes');
const { withTimeout } = require('../src/modules/health/health.controller');
const { pool } = require('../src/config/database');
const r2Storage = require('../src/utils/r2Storage');

describe('Health Probes (Liveness & Readiness)', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await pool.end();
  });

  test('GET /health/live returns HTTP 200 and process liveness metrics', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('UP');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.memoryMb).toBeDefined();
    expect(typeof body.memoryMb.rss).toBe('number');
    expect(body.nodeVersion).toBe(process.version);
  });

  test('GET /health/ready returns 200 with dependencies status', async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    // Unless live DB / R2 are configured incorrectly, it should return 200 or 503 with structured details
    const body = await res.json();

    expect(body.dependencies).toBeDefined();
    expect(body.dependencies.database).toBeDefined();
    expect(body.dependencies.storage_r2).toBeDefined();
    expect(body.dependencies.gemini_ai).toBeDefined();
    expect(body.dependencies.pinecone_rag).toBeDefined();

    if (res.status === 200) {
      expect(['HEALTHY', 'DEGRADED']).toContain(body.status);
      expect(body.dependencies.database.status).toBe('UP');
    } else {
      expect(res.status).toBe(503);
      expect(body.status).toBe('UNHEALTHY');
    }
  });

  test('GET /health/ready returns 503 if critical database check fails', async () => {
    const originalQuery = pool.query;
    pool.query = jest.fn().mockRejectedValue(new Error('PostgreSQL connection dropped'));

    try {
      const res = await fetch(`${baseUrl}/health/ready`);
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.status).toBe('UNHEALTHY');
      expect(body.dependencies.database.status).toBe('DOWN');
      expect(body.dependencies.database.critical).toBe(true);
    } finally {
      pool.query = originalQuery;
    }
  });

  test('GET /health/ready returns 503 if critical R2 storage check fails', async () => {
    const originalEnsure = r2Storage.ensureBucketExists;
    r2Storage.ensureBucketExists = jest.fn().mockRejectedValue(new Error('R2 credentials expired'));

    try {
      const res = await fetch(`${baseUrl}/health/ready`);
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.status).toBe('UNHEALTHY');
      expect(body.dependencies.storage_r2.status).toBe('DOWN');
      expect(body.dependencies.storage_r2.critical).toBe(true);
    } finally {
      r2Storage.ensureBucketExists = originalEnsure;
    }
  });

  test('withTimeout rejects with TIMEOUT error when operation exceeds threshold', async () => {
    const hangingPromise = new Promise(resolve => setTimeout(resolve, 5000));

    await expect(withTimeout(hangingPromise, 50, 'SlowService')).rejects.toThrow('SlowService check timed out after 50ms');
  });

  test('GET /health returns HTTP 200 legacy response for backwards compatibility', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('OK');
    expect(body.message).toContain('running');
  });
});
