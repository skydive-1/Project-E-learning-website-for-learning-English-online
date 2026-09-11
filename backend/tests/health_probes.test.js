'use strict';

const assert = require('node:assert/strict');
const { after, afterEach, before, beforeEach, describe, it } = require('node:test');
const express = require('express');
const healthRoutes = require('../src/modules/health/health.routes');
const { withTimeout } = require('../src/modules/health/health.controller');
const { pool } = require('../src/config/database');
const r2Storage = require('../src/utils/r2Storage');

describe('Health Probes (Liveness & Readiness)', () => {
  let server;
  let baseUrl;
  let originalPoolQuery;
  let originalEnsureBucketExists;
  let originalGeminiApiKey;
  let originalPineconeApiKey;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);

    server = await new Promise(resolve => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(() => {
    originalPoolQuery = pool.query;
    originalEnsureBucketExists = r2Storage.ensureBucketExists;
    originalGeminiApiKey = process.env.GEMINI_API_KEY;
    originalPineconeApiKey = process.env.PINECONE_API_KEY;

    pool.query = async () => ({ rows: [{ health_check: 2 }] });
    r2Storage.ensureBucketExists = async () => true;
    delete process.env.GEMINI_API_KEY;
    process.env.PINECONE_API_KEY = 'dummy-pinecone-key';
  });

  afterEach(() => {
    pool.query = originalPoolQuery;
    r2Storage.ensureBucketExists = originalEnsureBucketExists;

    if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiApiKey;

    if (originalPineconeApiKey === undefined) delete process.env.PINECONE_API_KEY;
    else process.env.PINECONE_API_KEY = originalPineconeApiKey;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }
  });

  it('GET /health/live returns HTTP 200 and process liveness metrics', async () => {
    const response = await fetch(`${baseUrl}/health/live`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'UP');
    assert.equal(typeof body.uptimeSeconds, 'number');
    assert.ok(body.memoryMb);
    assert.equal(typeof body.memoryMb.rss, 'number');
    assert.equal(body.nodeVersion, process.version);
  });

  it('GET /health/ready reports healthy critical dependencies without network calls', async () => {
    const response = await fetch(`${baseUrl}/health/ready`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'DEGRADED');
    assert.equal(body.dependencies.database.status, 'UP');
    assert.equal(body.dependencies.storage_r2.status, 'UP');
    assert.equal(body.dependencies.gemini_ai.status, 'DEGRADED');
    assert.equal(body.dependencies.pinecone_rag.status, 'DEGRADED');
  });

  it('GET /health/ready returns 503 if the critical database check fails', async () => {
    pool.query = async () => {
      throw new Error('PostgreSQL connection dropped');
    };

    const response = await fetch(`${baseUrl}/health/ready`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.status, 'UNHEALTHY');
    assert.equal(body.dependencies.database.status, 'DOWN');
    assert.equal(body.dependencies.database.critical, true);
  });

  it('GET /health/ready returns 503 if critical R2 storage fails', async () => {
    r2Storage.ensureBucketExists = async () => {
      throw new Error('R2 credentials expired');
    };

    const response = await fetch(`${baseUrl}/health/ready`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.status, 'UNHEALTHY');
    assert.equal(body.dependencies.storage_r2.status, 'DOWN');
    assert.equal(body.dependencies.storage_r2.critical, true);
  });

  it('withTimeout rejects when an operation exceeds its threshold', async () => {
    const hangingPromise = new Promise(resolve => setTimeout(resolve, 5000));

    await assert.rejects(
      withTimeout(hangingPromise, 50, 'SlowService'),
      error => error?.code === 'TIMEOUT'
        && error.message === 'SlowService check timed out after 50ms'
    );
  });

  it('GET /health preserves the legacy response contract', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'OK');
    assert.match(body.message, /running/i);
  });
});
