const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const adminController = require('../src/modules/admin/controllers/admin.controller');
const adminService = require('../src/modules/admin/services/admin.service');
const trendService = require('../src/modules/admin/services/geminiUsageTrend.service');

describe('Gemini usage trend monitoring', () => {
  test('validates range, metric, source and model query values', () => {
    assert.equal(trendService.normalizeRange('6h'), '6h');
    assert.equal(trendService.normalizeRange('999d'), '30d');
    assert.equal(trendService.normalizeMetric('requests'), 'requests');
    assert.equal(trendService.normalizeMetric('cost'), 'tokens');
    assert.equal(trendService.normalizeSource('google'), 'google');
    assert.equal(trendService.normalizeSource('external'), 'backend');
    assert.equal(trendService.normalizeModel('models/gemini-embedding-001'), 'gemini-embedding-001');
  });

  test('reads numeric Cloud Monitoring point shapes safely', () => {
    assert.equal(trendService.numericPointValue({ int64Value: '1250' }), 1250);
    assert.equal(trendService.numericPointValue({ doubleValue: 2.5 }), 2.5);
    assert.equal(trendService.numericPointValue({ boolValue: true }), 1);
    assert.equal(trendService.numericPointValue({}), 0);
  });

  test('distinguishes billing-required responses from missing IAM permissions', () => {
    assert.equal(trendService.classifyGoogleError({
      response: {
        status: 403,
        data: { error: { message: 'This API method requires billing to be enabled.' } }
      }
    }), 'GOOGLE_MONITORING_BILLING_REQUIRED');
    assert.equal(trendService.classifyGoogleError({ response: { status: 403 } }), 'GOOGLE_MONITORING_PERMISSION_DENIED');
  });

  test('queries one Cloud Monitoring metric at a time and preserves the model label', async () => {
    let requestOptions;
    const client = {
      request: async (options) => {
        requestOptions = options;
        return {
          data: {
            timeSeries: [{
              metric: { labels: { model: 'gemini-3.7-flash' } },
              points: [{
                interval: { endTime: '2026-09-08T04:05:00.000Z' },
                value: { int64Value: '12' }
              }]
            }]
          }
        };
      }
    };

    const rows = await trendService.readGoogleMetric({
      client,
      projectId: 'gen-lang-client-0226685569',
      metricType: 'generativelanguage.googleapis.com/quota/generate_content_free_tier_requests/usage',
      startTime: '2026-09-08T03:00:00.000Z',
      endTime: '2026-09-08T04:10:00.000Z',
      bucketSeconds: 300
    });

    assert.match(requestOptions.params.filter, /^metric\.type = "/);
    assert.equal(requestOptions.params['aggregation.groupByFields'], 'metric.labels.model');
    assert.equal(requestOptions.params['aggregation.perSeriesAligner'], 'ALIGN_SUM');
    assert.deepEqual(rows, [{
      timestamp: '2026-09-08T04:05:00.000Z',
      model: 'gemini-3.7-flash',
      value: 12
    }]);
  });

  test('falls back to backend telemetry when Google credentials are absent', async () => {
    const originalQuery = db.pool.query;
    const originalBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    const originalJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const originalProject = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const sqlCalls = [];

    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0226685569';
    db.pool.query = async (text) => {
      sqlCalls.push(text);
      if (text.includes('ai_usage_daily_model_history')) return { rows: [] };
      return {
        rows: [{
          timestamp: '2026-09-08T03:00:00.000Z',
          model: 'gemini-embedding-001',
          value: '321'
        }]
      };
    };

    try {
      const result = await trendService.getGeminiUsageTrend({
        range: '1h',
        metric: 'tokens',
        source: 'auto',
        model: 'all'
      });

      assert.equal(result.sourceUsed, 'backend');
      assert.equal(result.providerStatus, 'fallback');
      assert.equal(result.fallbackReason, 'GOOGLE_MONITORING_NOT_CONFIGURED');
      assert.equal(result.bucketSeconds, 300);
      assert.equal(result.series[0].model, 'gemini-embedding-001');
      assert.equal(result.series[0].value, 321);
      assert.match(sqlCalls[0], /request_status = 'success'/i);
    } finally {
      db.pool.query = originalQuery;
      if (originalBase64 === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
      else process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = originalBase64;
      if (originalJson === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalJson;
      if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT_ID;
      else process.env.GOOGLE_CLOUD_PROJECT_ID = originalProject;
    }
  });

  test('rejects a service account from the wrong Google Cloud project without exposing secrets', () => {
    const originalBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    const originalProject = process.env.GOOGLE_CLOUD_PROJECT_ID;
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0226685569';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(JSON.stringify({
      type: 'service_account',
      project_id: 'wrong-project',
      client_email: 'monitor@example.iam.gserviceaccount.com',
      private_key: 'private-value-that-must-not-leak'
    })).toString('base64');

    try {
      assert.throws(
        () => trendService.parseServiceAccountCredentials(),
        (error) => error.code === 'GOOGLE_MONITORING_PROJECT_MISMATCH'
          && !error.message.includes('private-value-that-must-not-leak')
      );
    } finally {
      if (originalBase64 === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
      else process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = originalBase64;
      if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT_ID;
      else process.env.GOOGLE_CLOUD_PROJECT_ID = originalProject;
    }
  });

  test('disables caching on the admin trend endpoint', async () => {
    const originalMethod = adminService.getGeminiUsageTrend;
    const headers = {};
    let payload;
    const res = {
      setHeader: (name, value) => { headers[name] = value; },
      status: () => res,
      json: (body) => { payload = body; return res; }
    };
    adminService.getGeminiUsageTrend = async (options) => ({ sourceUsed: 'backend', options });

    try {
      await adminController.getGeminiUsageTrend({
        query: { range: '6h', metric: 'requests', source: 'backend', model: 'all', fresh: '1' }
      }, res, (error) => { throw error; });
      assert.match(headers['Cache-Control'], /no-store/);
      assert.equal(payload.success, true);
      assert.equal(payload.data.options.fresh, true);
    } finally {
      adminService.getGeminiUsageTrend = originalMethod;
    }
  });
});
