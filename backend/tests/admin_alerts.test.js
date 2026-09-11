const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const db = require('../src/config/database');
const adminService = require('../src/modules/admin/services/admin.service');
const adminAlertsService = require('../src/modules/admin/services/adminAlerts.service');
const adminAlertsController = require('../src/modules/admin/controllers/adminAlerts.controller');
const { notifyOperationalAlertsChanged } = require('../src/utils/operationalAlertEvents');

describe('Admin operational alerts', () => {
  test('builds actionable alerts only from observed backend data', async () => {
    const originalQuery = db.pool.query;
    const originalGetRateLimitStatus = adminService.getRateLimitStatus;

    db.pool.query = async (sql) => {
      if (sql.includes("FROM media_assets")) {
        return {
          rows: [{
            media_id: 'media-1', status: 'FAILED', object_key: 'courses/demo-7/lesson.mp4',
            original_filename: 'lesson.mp4', updated_at: '2026-09-10T01:00:00.000Z',
            lesson_id: 12, lesson_title: 'Listening 1', course_id: 7, course_name: 'IELTS'
          }]
        };
      }
      if (/FROM pending_media_uploads p\s*\n/.test(sql)) {
        return {
          rows: [{ upload_id: 'upload-1', instructor_id: 22, storage_key: 'courses/demo-7/upload.mp4', status: 'PENDING', created_at: '2026-09-10T01:01:00.000Z', expires_at: '2026-09-10T01:30:00.000Z', course_id: null, lesson_id: null, lesson_title: null }]
        };
      }
      if (/FROM failed_storage_deletions d\s*\n/.test(sql)) return { rows: [] };
      if (sql.includes('FROM lesson_subtitles')) {
        return { rows: [{ subtitle_id: 3, lesson_id: 12, lesson_title: 'Listening 1', course_id: 7, error_code: 'TRANSCRIPT_FAILED', updated_at: '2026-09-10T01:02:00.000Z' }] };
      }
      if (sql.includes('FROM courses c')) return { rows: [{ course_id: 8, course_name: 'Empty course', updated_at: '2026-09-10T01:03:00.000Z' }] };
      if (sql.includes('FROM quizzes q')) return { rows: [{ quiz_id: 9, course_id: 7, lesson_id: 12, title: 'Empty quiz', updated_at: '2026-09-10T01:04:00.000Z' }] };
      if (sql.includes('FROM user_token_limits')) {
        return { rows: [{ user_id: 25, full_name: 'Test User', remaining_tokens: 0, updated_at: '2026-09-10T01:05:00.000Z' }] };
      }
      if (sql.includes('FROM ai_usage_events')) {
        assert.match(sql, /DISTINCT ON \(e\.user_id, e\.purpose\)/);
        assert.match(sql, /e\.request_status IN \('success', 'error'\)/);
        assert.match(sql, /WHERE e\.request_status = 'error'/);
        return {
          rows: [{ id: 31, user_id: 25, full_name: 'Test User', purpose: 'chat', model: 'gemini-test', error_code: '429', created_at: '2026-09-10T01:06:00.000Z' }]
        };
      }
      if (sql.includes('FROM ai_provider_incidents')) {
        return { rows: [] };
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
      assert.ok(ids.has('media-media-1'));
      assert.ok(ids.has('pending-upload-upload-1'));
      assert.ok(ids.has('subtitle-3'));
      assert.ok(ids.has('empty-course-8'));
      assert.ok(ids.has('empty-quiz-9'));
      assert.ok(ids.has('exhausted-quota-25'));
      assert.ok(ids.has('ai-request-31'));
      assert.ok(ids.has('ai-rate-limit-gemini-test'));
      assert.ok(snapshot.alerts.every((alert) => alert.source && alert.actionUrl));
      const alertsWithoutEntityId = snapshot.alerts
        .filter((alert) => !alert.id.startsWith('ai-rate-limit') && !alert.entity?.id)
        .map((alert) => alert.id);
      assert.deepEqual(alertsWithoutEntityId, []);
      assert.equal(snapshot.alerts.find((alert) => alert.id === 'subtitle-3').actionUrl, '/instructor/edit-course/7?tab=curriculum&lessonId=12&issue=subtitle-failed');
      assert.equal(snapshot.alerts.find((alert) => alert.id === 'pending-upload-upload-1').actionUrl, '/admin/dashboard?tab=users&userId=22&uploadId=upload-1');
      assert.equal(snapshot.alerts.find((alert) => alert.id === 'pending-upload-upload-1').entity.courseId, null);
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
      if (/FROM pending_media_uploads p\s*\n/.test(sql)) return { rows: [] };
      if (/FROM failed_storage_deletions d\s*\n/.test(sql)) return { rows: [] };
      if (sql.includes('FROM lesson_subtitles')) return { rows: [] };
      if (sql.includes('FROM courses c')) return { rows: [] };
      if (sql.includes('FROM quizzes q')) return { rows: [] };
      if (sql.includes('FROM user_token_limits')) return { rows: [] };
      if (sql.includes('FROM ai_usage_events')) return { rows: [] };
      if (sql.includes('FROM ai_provider_incidents')) return { rows: [] };
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

  test('SSE controller pushes a fresh snapshot immediately when operational state changes', async () => {
    const originalGetSnapshot = adminAlertsService.getAdminAlertsSnapshot;
    let activeAlerts = [{ id: 'test-alert', severity: 'medium', message: 'Observed issue', timestamp: '2026-09-10T00:00:00.000Z' }];
    const snapshotOptions = [];
    adminAlertsService.getAdminAlertsSnapshot = async (options = {}) => {
      snapshotOptions.push(options);
      return {
        alerts: activeAlerts,
        generatedAt: '2026-09-10T00:00:00.000Z'
      };
    };

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
      activeAlerts = [];
      notifyOperationalAlertsChanged('test-recovered');
      await new Promise((resolve) => setImmediate(resolve));
      req.emit('close');

      const output = chunks.join('');
      assert.equal(headers['Content-Type'], 'text/event-stream; charset=utf-8');
      assert.match(output, /event: connected/);
      assert.match(output, /event: alerts/);
      assert.match(output, /test-alert/);
      assert.match(output, /"alerts":\[\]/);
      assert.equal(snapshotOptions.length, 2);
      assert.ok(snapshotOptions.every((options) => options.fresh === true));
    } finally {
      req.emit('close');
      adminAlertsService.getAdminAlertsSnapshot = originalGetSnapshot;
    }
  });
});
