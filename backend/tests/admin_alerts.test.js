const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const db = require('../src/config/database');
const adminService = require('../src/modules/admin/services/admin.service');
const adminAlertsService = require('../src/modules/admin/services/adminAlerts.service');
const adminAlertsController = require('../src/modules/admin/controllers/adminAlerts.controller');

describe('Admin operational alerts', () => {
  test('builds actionable alerts only from observed backend data', async () => {
    const originalQuery = db.pool.query;
    const originalGetRateLimitStatus = adminService.getRateLimitStatus;

    db.pool.query = async (sql) => {
      if (sql.includes("FROM media_assets")) {
        return {
          rows: [{ status: 'FAILED', issue_count: 2, latest_at: '2026-09-10T01:00:00.000Z' }]
        };
      }
      if (sql.includes('FROM pending_media_uploads')) {
        return {
          rows: [{
            stale_uploads: 1,
            latest_stale_upload: '2026-09-10T01:01:00.000Z',
            failed_deletions: 0,
            latest_failed_deletion: null,
            permanent_deletions: 0
          }]
        };
      }
      if (sql.includes('FROM lesson_subtitles')) {
        return { rows: [{ failed_count: 1, latest_at: '2026-09-10T01:02:00.000Z' }] };
      }
      if (sql.includes('published_without_lessons')) {
        return {
          rows: [{
            published_without_lessons: 1,
            latest_empty_course: '2026-09-10T01:03:00.000Z',
            quizzes_without_questions: 1,
            latest_empty_quiz: '2026-09-10T01:04:00.000Z'
          }]
        };
      }
      if (sql.includes('FROM user_token_limits')) {
        return { rows: [{ exhausted_count: 3, latest_at: '2026-09-10T01:05:00.000Z' }] };
      }
      if (sql.includes('FROM ai_usage_events')) {
        return {
          rows: [{ error_count: 2, affected_models: 1, latest_at: '2026-09-10T01:06:00.000Z' }]
        };
      }
      if (sql.includes('FROM ai_provider_incidents')) {
        return { rows: [{ incident_count: 0, occurrences: 0, latest_at: null }] };
      }
      throw new Error(`Unexpected query in admin alerts test: ${sql}`);
    };

    adminService.getRateLimitStatus = async () => ({
      models: [{
        model: 'gemini-test',
        riskLevel: 'critical',
        peakPercent: 91,
        updatedAt: '2026-09-10T01:07:00.000Z'
      }],
      notices: []
    });

    try {
      adminAlertsService.resetCache();
      const snapshot = await adminAlertsService.getAdminAlertsSnapshot({ fresh: true });
      const ids = new Set(snapshot.alerts.map((alert) => alert.id));

      assert.equal(snapshot.source, 'PostgreSQL và telemetry runtime của backend');
      assert.equal(snapshot.transport.primary, 'sse');
      assert.ok(ids.has('media-failed'));
      assert.ok(ids.has('media-stale-uploads'));
      assert.ok(ids.has('subtitle-generation-failures'));
      assert.ok(ids.has('published-courses-without-lessons'));
      assert.ok(ids.has('quizzes-without-questions'));
      assert.ok(ids.has('users-with-exhausted-token-quota'));
      assert.ok(ids.has('recent-ai-request-errors'));
      assert.ok(ids.has('ai-rate-limit-gemini-test'));
      assert.ok(snapshot.alerts.every((alert) => alert.source && alert.actionUrl));
      assert.equal(snapshot.summary.total, snapshot.alerts.length);
    } finally {
      db.pool.query = originalQuery;
      adminService.getRateLimitStatus = originalGetRateLimitStatus;
      adminAlertsService.resetCache();
    }
  });

  test('returns no problem cards when every observed source is healthy', async () => {
    const originalQuery = db.pool.query;
    const originalGetRateLimitStatus = adminService.getRateLimitStatus;

    db.pool.query = async (sql) => {
      if (sql.includes("FROM media_assets")) return { rows: [] };
      if (sql.includes('FROM pending_media_uploads')) {
        return { rows: [{ stale_uploads: 0, failed_deletions: 0, permanent_deletions: 0 }] };
      }
      if (sql.includes('FROM lesson_subtitles')) return { rows: [{ failed_count: 0 }] };
      if (sql.includes('published_without_lessons')) {
        return { rows: [{ published_without_lessons: 0, quizzes_without_questions: 0 }] };
      }
      if (sql.includes('FROM user_token_limits')) return { rows: [{ exhausted_count: 0 }] };
      if (sql.includes('FROM ai_usage_events')) return { rows: [{ error_count: 0, affected_models: 0 }] };
      if (sql.includes('FROM ai_provider_incidents')) return { rows: [{ incident_count: 0, occurrences: 0 }] };
      throw new Error(`Unexpected query in healthy alerts test: ${sql}`);
    };
    adminService.getRateLimitStatus = async () => ({ models: [], notices: [] });

    try {
      adminAlertsService.resetCache();
      const snapshot = await adminAlertsService.getAdminAlertsSnapshot({ fresh: true });
      assert.deepEqual(snapshot.alerts, []);
      assert.deepEqual(snapshot.summary, { total: 0, high: 0, medium: 0, low: 0 });
    } finally {
      db.pool.query = originalQuery;
      adminService.getRateLimitStatus = originalGetRateLimitStatus;
      adminAlertsService.resetCache();
    }
  });

  test('REST controller disables caching and returns the snapshot contract', async () => {
    const originalGetSnapshot = adminAlertsService.getAdminAlertsSnapshot;
    const headers = {};
    let payload = null;
    adminAlertsService.getAdminAlertsSnapshot = async () => ({
      alerts: [],
      generatedAt: '2026-09-10T00:00:00.000Z'
    });

    const res = {
      setHeader: (name, value) => { headers[name] = value; },
      status: () => res,
      json: (body) => { payload = body; return res; }
    };

    try {
      await adminAlertsController.getAlerts({ query: {} }, res, (error) => { throw error; });
      assert.match(headers['Cache-Control'], /no-store/);
      assert.equal(payload.success, true);
      assert.deepEqual(payload.data.alerts, []);
    } finally {
      adminAlertsService.getAdminAlertsSnapshot = originalGetSnapshot;
    }
  });

  test('SSE controller sends connected and alerts events, then cleans up on close', async () => {
    const originalGetSnapshot = adminAlertsService.getAdminAlertsSnapshot;
    adminAlertsService.getAdminAlertsSnapshot = async () => ({
      alerts: [{ id: 'test-alert', severity: 'medium', message: 'Observed issue', timestamp: '2026-09-10T00:00:00.000Z' }],
      generatedAt: '2026-09-10T00:00:00.000Z'
    });

    const req = new EventEmitter();
    const res = new EventEmitter();
    const headers = {};
    const chunks = [];
    res.destroyed = false;
    res.writableEnded = false;
    res.socket = { setTimeout: () => {}, setKeepAlive: () => {} };
    res.setHeader = (name, value) => { headers[name] = value; };
    res.status = () => res;
    res.flushHeaders = () => {};
    res.flush = () => {};
    res.write = (chunk) => { chunks.push(chunk); return true; };

    try {
      await adminAlertsController.streamAlerts(req, res);
      req.emit('close');

      const output = chunks.join('');
      assert.equal(headers['Content-Type'], 'text/event-stream; charset=utf-8');
      assert.match(output, /event: connected/);
      assert.match(output, /event: alerts/);
      assert.match(output, /test-alert/);
    } finally {
      req.emit('close');
      adminAlertsService.getAdminAlertsSnapshot = originalGetSnapshot;
    }
  });
});
