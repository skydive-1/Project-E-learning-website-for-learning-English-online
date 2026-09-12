'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  DurableJobQueue,
  DurableJobWorker
} = require('../src/utils/durableJobQueue.service');

describe('PostgreSQL durable background jobs', () => {
  it('enqueues one deduplicated job without storing transcript/media payloads', async () => {
    const calls = [];
    const fakeDb = {
      query: async (sql, params) => {
        calls.push({ sql: String(sql), params });
        return { rows: [{ job_id: 7, status: 'queued', payload: JSON.parse(params[3]) }] };
      }
    };
    const queue = new DurableJobQueue(fakeDb, { instanceId: 'test-worker' });
    const job = await queue.enqueue({
      jobType: 'subtitle_generation',
      dedupeKey: 'lesson:131',
      lessonId: 131,
      payload: { lessonId: 131, sourceContentUrl: 'courses/43/source.mp4' },
      priority: 100,
      replaceActive: false
    });

    assert.equal(job.job_id, 7);
    assert.match(calls[0].sql, /ON CONFLICT \(job_type, dedupe_key\)/);
    assert.deepEqual(job.payload, {
      lessonId: 131,
      sourceContentUrl: 'courses/43/source.mp4'
    });
    assert.equal(calls[0].params[7], false);
  });

  it('claims atomically with SKIP LOCKED and a renewable lease token', async () => {
    const calls = [];
    const fakeDb = {
      query: async (sql, params) => {
        calls.push({ sql: String(sql), params });
        return {
          rows: [{
            job_id: 8,
            job_type: 'subtitle_generation',
            status: 'processing',
            attempts: 1,
            lease_token: params[2]
          }]
        };
      }
    };
    const queue = new DurableJobQueue(fakeDb, { instanceId: 'server-a' });
    const job = await queue.claimNext(['subtitle_generation'], { leaseMs: 60_000 });

    assert.match(calls[0].sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(calls[0].sql, /lease_expires_at <= CURRENT_TIMESTAMP/);
    assert.equal(calls[0].params[1], 'server-a');
    assert.match(job.lease_token, /^[0-9a-f-]{36}$/i);
  });

  it('uses bounded exponential retry and becomes terminal at max attempts', async () => {
    const updates = [];
    const fakeDb = {
      query: async (sql, params) => {
        updates.push({ sql: String(sql), params });
        return { rows: [{ status: params[2], available_at: new Date() }] };
      }
    };
    const queue = new DurableJobQueue(fakeDb, { instanceId: 'server-a' });
    const retry = await queue.fail(
      { job_id: 9, lease_token: '00000000-0000-4000-8000-000000000001', attempts: 2, max_attempts: 5 },
      Object.assign(new Error('quota'), { code: 'RATE_LIMITED' }),
      { retryable: true, retryBaseMs: 1_000, retryMaxMs: 10_000 }
    );
    const terminal = await queue.fail(
      { job_id: 10, lease_token: '00000000-0000-4000-8000-000000000002', attempts: 5, max_attempts: 5 },
      new Error('still failing'),
      { retryable: true, retryBaseMs: 1_000, retryMaxMs: 10_000 }
    );

    assert.equal(retry.status, 'retry');
    assert.equal(updates[0].params[3], 2_000);
    assert.equal(terminal.status, 'failed');
    assert.equal(updates[1].params[3], 0);
  });

  it('worker records retry instead of losing a failed claimed job', async () => {
    const events = [];
    const job = {
      job_id: 11,
      job_type: 'subtitle_generation',
      lesson_id: 131,
      payload: { lessonId: 131 },
      lease_token: '00000000-0000-4000-8000-000000000003',
      attempts: 1,
      max_attempts: 5
    };
    const fakeQueue = {
      heartbeat: async () => true,
      complete: async () => events.push('complete'),
      fail: async (_job, error, options) => {
        events.push({ error: error.message, retryable: options.retryable });
        return { ...job, status: 'retry' };
      }
    };
    const worker = new DurableJobWorker({
      queue: fakeQueue,
      handlers: { subtitle_generation: async () => { throw new Error('temporary outage'); } },
      classifyError: () => true,
      onJobFailed: async failedJob => events.push(failedJob.status),
      logger: { warn: () => {} }
    });

    await worker.process(job);
    assert.deepEqual(events, [
      { error: 'temporary outage', retryable: true },
      'retry'
    ]);
  });

  it('graceful shutdown releases the active lease for immediate restart recovery', async () => {
    const events = [];
    let finishHandler;
    const handlerGate = new Promise(resolve => { finishHandler = resolve; });
    const job = {
      job_id: 12,
      job_type: 'subtitle_generation',
      lease_token: '00000000-0000-4000-8000-000000000004'
    };
    const fakeQueue = {
      heartbeat: async () => true,
      complete: async () => events.push('complete-attempted'),
      fail: async () => null,
      release: async (jobId, leaseToken) => {
        events.push({ jobId, leaseToken });
        return { ...job, status: 'retry' };
      }
    };
    const worker = new DurableJobWorker({
      queue: fakeQueue,
      handlers: { subtitle_generation: async () => handlerGate },
      logger: { warn: () => {} }
    });

    const processing = worker.process(job);
    await new Promise(resolve => setImmediate(resolve));
    await worker.stop();
    finishHandler();
    await processing;

    assert.deepEqual(events[0], {
      jobId: 12,
      leaseToken: '00000000-0000-4000-8000-000000000004'
    });
  });

  it('migration publishes subtitle and downstream jobs transactionally and has retention indexes', () => {
    const migration = fs.readFileSync(
      path.join(__dirname, '../migrations/20260912_durable_background_jobs.sql'),
      'utf8'
    );
    assert.match(migration, /CREATE TABLE IF NOT EXISTS background_jobs/);
    assert.match(migration, /CONSTRAINT uq_background_jobs_type_key UNIQUE/);
    assert.match(migration, /CREATE TRIGGER trg_lesson_subtitles_publish_jobs/);
    assert.match(migration, /'subtitle_generation'/);
    assert.match(migration, /'rag_ingestion'/);
    assert.match(migration, /'suggested_questions'/);
    assert.match(migration, /idx_background_jobs_retention/);
    assert.match(migration, /octet_length\(payload::text\) <= 65536/);
  });
});
