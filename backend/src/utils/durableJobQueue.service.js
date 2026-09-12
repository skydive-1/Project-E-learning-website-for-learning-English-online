'use strict';

const crypto = require('crypto');
const os = require('os');
const db = require('../config/database');

const DEFAULT_LEASE_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_BASE_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_MAX_MS = 6 * 60 * 60 * 1000;
const DEFAULT_POLL_MS = 5 * 1000;

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeError = (error) => ({
  code: String(error?.code || 'BACKGROUND_JOB_FAILED').slice(0, 100),
  message: String(error?.message || 'Background job failed').slice(0, 1000)
});

class DurableJobQueue {
  constructor(database = db, options = {}) {
    this.db = database;
    this.instanceId = options.instanceId || [
      os.hostname(),
      process.pid,
      crypto.randomUUID().slice(0, 8)
    ].join(':').slice(0, 160);
  }

  async enqueue({
    jobType,
    dedupeKey,
    lessonId = null,
    payload = {},
    priority = 0,
    maxAttempts = 5,
    availableAt = null,
    replaceActive = true
  }) {
    if (!jobType || !dedupeKey) throw new Error('jobType và dedupeKey là bắt buộc.');
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const result = await this.db.query(
      `INSERT INTO background_jobs (
         job_type, dedupe_key, lesson_id, payload, status, priority,
         attempts, max_attempts, available_at, updated_at
       )
       VALUES ($1, $2, $3, $4::jsonb, 'queued', $5, 0, $6,
               COALESCE($7::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
       ON CONFLICT (job_type, dedupe_key) DO UPDATE SET
         lesson_id = EXCLUDED.lesson_id,
         payload = EXCLUDED.payload,
         priority = EXCLUDED.priority,
         max_attempts = EXCLUDED.max_attempts,
         status = CASE
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND background_jobs.status IN ('queued', 'retry')
             THEN background_jobs.status
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND background_jobs.status = 'processing'
            AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
             THEN background_jobs.status
           ELSE 'queued'
         END,
         attempts = CASE
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND (
              background_jobs.status IN ('queued', 'retry')
              OR (background_jobs.status = 'processing' AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP)
            ) THEN background_jobs.attempts
           ELSE 0
         END,
         available_at = CASE
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND background_jobs.status IN ('queued', 'retry')
             THEN background_jobs.available_at
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND background_jobs.status = 'processing'
            AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
             THEN background_jobs.available_at
           ELSE EXCLUDED.available_at
         END,
         lease_owner = CASE
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND background_jobs.status = 'processing'
            AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
             THEN background_jobs.lease_owner
           ELSE NULL
         END,
         lease_token = CASE
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND background_jobs.status = 'processing'
            AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
             THEN background_jobs.lease_token
           ELSE NULL
         END,
         lease_expires_at = CASE
           WHEN NOT $8
            AND background_jobs.payload = EXCLUDED.payload
            AND background_jobs.status = 'processing'
            AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
             THEN background_jobs.lease_expires_at
           ELSE NULL
         END,
         completed_at = NULL,
         last_error_code = CASE WHEN $8 OR background_jobs.payload <> EXCLUDED.payload THEN NULL ELSE background_jobs.last_error_code END,
         last_error_message = CASE WHEN $8 OR background_jobs.payload <> EXCLUDED.payload THEN NULL ELSE background_jobs.last_error_message END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        String(jobType).slice(0, 80),
        String(dedupeKey).slice(0, 300),
        lessonId ? Number.parseInt(lessonId, 10) : null,
        JSON.stringify(safePayload),
        clampInteger(priority, 0, -32768, 32767),
        clampInteger(maxAttempts, 5, 1, 20),
        availableAt,
        Boolean(replaceActive)
      ]
    );
    return result.rows[0] || null;
  }

  async claimNext(jobTypes, { leaseMs = DEFAULT_LEASE_MS } = {}) {
    const types = [...new Set((Array.isArray(jobTypes) ? jobTypes : [jobTypes]).filter(Boolean).map(String))];
    if (types.length === 0) return null;
    const safeLeaseMs = clampInteger(leaseMs, DEFAULT_LEASE_MS, 30_000, 2 * 60 * 60 * 1000);
    const leaseToken = crypto.randomUUID();
    const result = await this.db.query(
      `WITH candidate AS (
         SELECT job_id
         FROM background_jobs
         WHERE job_type = ANY($1::text[])
           AND (
             (status IN ('queued', 'retry') AND available_at <= CURRENT_TIMESTAMP)
             OR (status = 'processing' AND lease_expires_at <= CURRENT_TIMESTAMP)
           )
         ORDER BY priority DESC, available_at ASC, job_id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE background_jobs job
       SET status = 'processing',
           attempts = job.attempts + 1,
           lease_owner = $2,
           lease_token = $3,
           lease_expires_at = CURRENT_TIMESTAMP + ($4 * INTERVAL '1 millisecond'),
           started_at = COALESCE(job.started_at, CURRENT_TIMESTAMP),
           completed_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       FROM candidate
       WHERE job.job_id = candidate.job_id
       RETURNING job.*`,
      [types, this.instanceId, leaseToken, safeLeaseMs]
    );
    return result.rows[0] || null;
  }

  async heartbeat(jobId, leaseToken, leaseMs = DEFAULT_LEASE_MS) {
    const safeLeaseMs = clampInteger(leaseMs, DEFAULT_LEASE_MS, 30_000, 2 * 60 * 60 * 1000);
    const result = await this.db.query(
      `UPDATE background_jobs
       SET lease_expires_at = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'),
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1 AND lease_token = $2 AND status = 'processing'
       RETURNING job_id`,
      [jobId, leaseToken, safeLeaseMs]
    );
    return result.rows.length > 0;
  }

  async complete(jobId, leaseToken) {
    const result = await this.db.query(
      `UPDATE background_jobs
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
           lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
           last_error_code = NULL, last_error_message = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1 AND lease_token = $2 AND status = 'processing'
       RETURNING *`,
      [jobId, leaseToken]
    );
    return result.rows[0] || null;
  }

  async release(jobId, leaseToken, reason = 'Worker is shutting down') {
    const normalized = normalizeError(Object.assign(new Error(reason), { code: 'WORKER_SHUTDOWN' }));
    const result = await this.db.query(
      `UPDATE background_jobs
       SET status = 'retry', available_at = CURRENT_TIMESTAMP,
           lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
           last_error_code = $3, last_error_message = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1 AND lease_token = $2 AND status = 'processing'
       RETURNING *`,
      [jobId, leaseToken, normalized.code, normalized.message]
    );
    return result.rows[0] || null;
  }

  async acknowledgeByKey(jobType, dedupeKey, payloadMatch = {}) {
    const result = await this.db.query(
      `UPDATE background_jobs
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
           lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
           last_error_code = NULL, last_error_message = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_type = $1
         AND dedupe_key = $2
         AND status IN ('queued', 'retry')
         AND payload @> $3::jsonb
       RETURNING *`,
      [String(jobType), String(dedupeKey), JSON.stringify(payloadMatch || {})]
    );
    return result.rows[0] || null;
  }

  async fail(job, error, {
    retryable = true,
    retryBaseMs = DEFAULT_RETRY_BASE_MS,
    retryMaxMs = DEFAULT_RETRY_MAX_MS
  } = {}) {
    const attempts = Number(job?.attempts) || 1;
    const maxAttempts = Number(job?.max_attempts) || 5;
    const shouldRetry = Boolean(retryable) && attempts < maxAttempts;
    const safeBase = clampInteger(retryBaseMs, DEFAULT_RETRY_BASE_MS, 1_000, 24 * 60 * 60 * 1000);
    const safeMax = clampInteger(retryMaxMs, DEFAULT_RETRY_MAX_MS, safeBase, 7 * 24 * 60 * 60 * 1000);
    const delayMs = shouldRetry ? Math.min(safeMax, safeBase * (2 ** Math.max(0, attempts - 1))) : 0;
    const normalized = normalizeError(error);
    const result = await this.db.query(
      `UPDATE background_jobs
       SET status = $3,
           available_at = CASE
             WHEN $3 = 'retry' THEN CURRENT_TIMESTAMP + ($4 * INTERVAL '1 millisecond')
             ELSE available_at
           END,
           lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
           completed_at = CASE WHEN $3 = 'failed' THEN CURRENT_TIMESTAMP ELSE NULL END,
           last_error_code = $5, last_error_message = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1 AND lease_token = $2 AND status = 'processing'
       RETURNING *`,
      [job.job_id, job.lease_token, shouldRetry ? 'retry' : 'failed', delayMs, normalized.code, normalized.message]
    );
    return result.rows[0] || null;
  }

  async purgeTerminalJobs({ completedDays = 14, failedDays = 90, limit = 1000 } = {}) {
    const result = await this.db.query(
      `WITH expired AS (
         SELECT job_id
         FROM background_jobs
         WHERE (
           status = 'completed' AND completed_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
         ) OR (
           status IN ('failed', 'cancelled') AND updated_at < CURRENT_TIMESTAMP - ($2 * INTERVAL '1 day')
         )
         ORDER BY job_id
         LIMIT $3
       )
       DELETE FROM background_jobs job
       USING expired
       WHERE job.job_id = expired.job_id
       RETURNING job.job_id`,
      [
        clampInteger(completedDays, 14, 1, 365),
        clampInteger(failedDays, 90, 7, 730),
        clampInteger(limit, 1000, 1, 5000)
      ]
    );
    return result.rows.length;
  }

  async getStats(jobTypes = []) {
    const types = [...new Set((Array.isArray(jobTypes) ? jobTypes : [jobTypes]).filter(Boolean).map(String))];
    const result = await this.db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM background_jobs
       WHERE (cardinality($1::text[]) = 0 OR job_type = ANY($1::text[]))
       GROUP BY status`,
      [types]
    );
    return Object.fromEntries(result.rows.map(row => [row.status, Number(row.count) || 0]));
  }
}

class DurableJobWorker {
  constructor({
    queue,
    handlers,
    pollMs = DEFAULT_POLL_MS,
    leaseMs = DEFAULT_LEASE_MS,
    retention = {},
    classifyError = () => true,
    onJobFailed = null,
    logger = console
  }) {
    this.queue = queue;
    this.handlers = handlers || {};
    this.pollMs = clampInteger(pollMs, DEFAULT_POLL_MS, 1_000, 5 * 60 * 1000);
    this.leaseMs = clampInteger(leaseMs, DEFAULT_LEASE_MS, 30_000, 2 * 60 * 60 * 1000);
    this.retention = retention;
    this.classifyError = classifyError;
    this.onJobFailed = onJobFailed;
    this.logger = logger;
    this.timer = null;
    this.running = false;
    this.stopped = true;
    this.lastPurgeAt = 0;
    this.currentJob = null;
  }

  start() {
    if (this.timer) return this;
    this.stopped = false;
    this.timer = setInterval(() => this.wake(), this.pollMs);
    this.timer.unref?.();
    this.wake();
    return this;
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const activeJob = this.currentJob;
    if (activeJob) {
      try {
        await this.queue.release(
          activeJob.job_id,
          activeJob.lease_token,
          'Worker dừng trước khi hoàn tất; job được trả lại hàng đợi.'
        );
      } catch (error) {
        this.logger.warn(`[DurableJobs] Không thể trả job ${activeJob.job_id} về hàng đợi: ${error.message}`);
      }
    }
  }

  wake() {
    if (this.stopped || this.running) return;
    setImmediate(() => this.drain().catch(error => {
      this.logger.warn(`[DurableJobs] Worker loop failed: ${error.message}`);
    }));
  }

  async drain() {
    if (this.stopped || this.running) return 0;
    this.running = true;
    let processed = 0;
    try {
      while (!this.stopped) {
        const job = await this.queue.claimNext(Object.keys(this.handlers), { leaseMs: this.leaseMs });
        if (!job) break;
        await this.process(job);
        processed += 1;
      }

      const now = Date.now();
      if (now - this.lastPurgeAt >= 24 * 60 * 60 * 1000) {
        this.lastPurgeAt = now;
        this.queue.purgeTerminalJobs(this.retention).catch(error => {
          this.logger.warn(`[DurableJobs] Retention cleanup failed: ${error.message}`);
        });
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  async process(job) {
    const handler = this.handlers[job.job_type];
    if (!handler) return;
    this.currentJob = job;
    const heartbeatMs = Math.max(10_000, Math.floor(this.leaseMs / 3));
    const heartbeatTimer = setInterval(() => {
      this.queue.heartbeat(job.job_id, job.lease_token, this.leaseMs).catch(error => {
        this.logger.warn(`[DurableJobs] Lease heartbeat failed for job ${job.job_id}: ${error.message}`);
      });
    }, heartbeatMs);
    heartbeatTimer.unref?.();

    try {
      await handler(job);
      await this.queue.complete(job.job_id, job.lease_token);
    } catch (error) {
      const retryable = this.classifyError(error, job) !== false;
      const failedJob = await this.queue.fail(job, error, { retryable });
      if (this.onJobFailed) {
        await this.onJobFailed(failedJob || job, error, {
          retryable,
          leaseUpdated: Boolean(failedJob)
        });
      }
      this.logger.warn(
        `[DurableJobs] ${job.job_type} job=${job.job_id} failed` +
        `${failedJob?.status === 'retry' ? `; retry scheduled after attempt ${job.attempts}` : '; no more retries'}: ${error.message}`
      );
    } finally {
      clearInterval(heartbeatTimer);
      if (this.currentJob?.job_id === job.job_id) this.currentJob = null;
    }
  }
}

const durableJobQueue = new DurableJobQueue();

module.exports = {
  DurableJobQueue,
  DurableJobWorker,
  durableJobQueue,
  normalizeError,
  DEFAULT_LEASE_MS,
  DEFAULT_RETRY_BASE_MS,
  DEFAULT_RETRY_MAX_MS
};
