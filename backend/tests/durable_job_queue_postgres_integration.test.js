'use strict';

/**
 * PostgreSQL Durable Background Jobs Integration Test
 *
 * Tests the real PostgreSQL queries executed by DurableJobQueue, particularly
 * verifying that parameter casting (such as $3::varchar in fail()) does not cause
 * "inconsistent types deduced for parameter $3" errors on PostgreSQL.
 *
 * Requirements:
 * - Requires a running PostgreSQL instance accessible via DATABASE_URL or DB_* environment variables.
 * - Runs all test operations inside an isolated transaction that is rolled back at the end.
 * - Automatically skips if PostgreSQL is unreachable or DATABASE_URL is not configured.
 *
 * Authors:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const { DurableJobQueue } = require('../src/utils/durableJobQueue.service');

describe('PostgreSQL durable job queue integration (@integration-postgres)', () => {
  let client = null;
  let queue = null;
  let isDbAvailable = false;

  before(async () => {
    try {
      client = await db.getClient();
      const checkTable = await client.query(`
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'background_jobs'
        LIMIT 1
      `);
      if (checkTable.rows.length > 0) {
        isDbAvailable = true;
        await client.query('BEGIN');
        queue = new DurableJobQueue(client, { instanceId: 'test-postgres-worker' });
      } else {
        console.warn('⚠️ [Postgres Integration Test] Bảng background_jobs chưa tồn tại; bỏ qua test.');
        client.release();
        client = null;
      }
    } catch (error) {
      console.warn(`⚠️ [Postgres Integration Test] Không thể kết nối PostgreSQL (${error.message}); bỏ qua test.`);
      if (client) {
        try { client.release(); } catch (_) {}
        client = null;
      }
      isDbAvailable = false;
    }
  });

  after(async () => {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      try {
        client.release();
      } catch (_) {}
      client = null;
    }
  });

  it('fails with retry status without throwing parameter deduction error on PostgreSQL', async (t) => {
    if (!isDbAvailable) return t.skip('PostgreSQL database or background_jobs table is not available.');

    const dedupeKey = `test:postgres:retry:${Date.now()}`;
    const enqueued = await queue.enqueue({
      jobType: 'subtitle_generation',
      dedupeKey,
      payload: { lessonId: 999901 },
      priority: 10,
      replaceActive: true
    });
    assert.ok(enqueued?.job_id);

    const claimed = await queue.claimNext(['subtitle_generation'], { leaseMs: 30_000 });
    assert.ok(claimed);
    assert.equal(claimed.dedupe_key, dedupeKey);

    // This fail() call previously threw: "inconsistent types deduced for parameter $3"
    const failedRetry = await queue.fail(
      claimed,
      Object.assign(new Error('YouTube temporarily blocked this egress'), {
        code: 'YOUTUBE_TRANSCRIPT_ACCESS_BLOCKED'
      }),
      { retryable: true, retryBaseMs: 1_000, retryMaxMs: 10_000 }
    );

    assert.ok(failedRetry);
    assert.equal(failedRetry.status, 'retry');
    assert.equal(failedRetry.last_error_code, 'YOUTUBE_TRANSCRIPT_ACCESS_BLOCKED');
    assert.equal(failedRetry.lease_owner, null);
    assert.equal(failedRetry.lease_token, null);
  });

  it('fails with terminal status and sets completed_at without parameter deduction error', async (t) => {
    if (!isDbAvailable) return t.skip('PostgreSQL database or background_jobs table is not available.');

    const dedupeKey = `test:postgres:terminal:${Date.now()}`;
    await queue.enqueue({
      jobType: 'subtitle_generation',
      dedupeKey,
      payload: { lessonId: 999902 },
      priority: 20,
      replaceActive: true
    });

    const claimed = await queue.claimNext(['subtitle_generation'], { leaseMs: 30_000 });
    assert.ok(claimed);
    assert.equal(claimed.dedupe_key, dedupeKey);

    const terminalFailed = await queue.fail(
      claimed,
      Object.assign(new Error('Video has no transcript'), {
        code: 'YOUTUBE_NO_CAPTIONS_AVAILABLE'
      }),
      { retryable: false }
    );

    assert.ok(terminalFailed);
    assert.equal(terminalFailed.status, 'failed');
    assert.equal(terminalFailed.last_error_code, 'YOUTUBE_NO_CAPTIONS_AVAILABLE');
    assert.ok(terminalFailed.completed_at);
  });

  it('executes lifecycle methods (heartbeat, complete, release, acknowledgeByKey, getStats, purge)', async (t) => {
    if (!isDbAvailable) return t.skip('PostgreSQL database or background_jobs table is not available.');

    // 1. Enqueue & Heartbeat & Complete
    const dedupeComplete = `test:postgres:complete:${Date.now()}`;
    await queue.enqueue({
      jobType: 'rag_ingestion',
      dedupeKey: dedupeComplete,
      payload: { lessonId: 999903 }
    });
    const jobToComplete = await queue.claimNext(['rag_ingestion']);
    assert.ok(jobToComplete);

    const hbOk = await queue.heartbeat(jobToComplete.job_id, jobToComplete.lease_token, 45_000);
    assert.equal(hbOk, true);

    const completed = await queue.complete(jobToComplete.job_id, jobToComplete.lease_token);
    assert.equal(completed?.status, 'completed');

    // 2. Enqueue & Release
    const dedupeRelease = `test:postgres:release:${Date.now()}`;
    await queue.enqueue({
      jobType: 'rag_ingestion',
      dedupeKey: dedupeRelease,
      payload: { lessonId: 999904 }
    });
    const jobToRelease = await queue.claimNext(['rag_ingestion']);
    assert.ok(jobToRelease);

    const released = await queue.release(jobToRelease.job_id, jobToRelease.lease_token, 'Worker shutting down');
    assert.equal(released?.status, 'retry');

    // 3. AcknowledgeByKey
    const dedupeAck = `test:postgres:ack:${Date.now()}`;
    await queue.enqueue({
      jobType: 'rag_ingestion',
      dedupeKey: dedupeAck,
      payload: { lessonId: 999905, match: true }
    });
    const acked = await queue.acknowledgeByKey('rag_ingestion', dedupeAck, { lessonId: 999905 });
    assert.equal(acked?.status, 'completed');

    // 4. getStats
    const stats = await queue.getStats(['rag_ingestion', 'subtitle_generation']);
    assert.equal(typeof stats, 'object');

    // 5. purgeTerminalJobs
    const purged = await queue.purgeTerminalJobs({ completedDays: 0, failedDays: 0, limit: 10 });
    assert.equal(typeof purged, 'number');
  });
});
