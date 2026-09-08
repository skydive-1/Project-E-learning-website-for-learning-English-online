const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const adminService = require('../src/modules/admin/services/admin.service');
const adminController = require('../src/modules/admin/controllers/admin.controller');
const {
  parseGeminiQuotaViolation,
  recordGeminiQuotaSignal,
  recordAiProviderIncident
} = require('../src/utils/ai-clients');

describe('Admin Gemini rate-limit status', () => {
  test('disables HTTP caching for live status responses', async () => {
    const originalGetRateLimitStatus = adminService.getRateLimitStatus;
    const headers = {};
    let payload = null;
    adminService.getRateLimitStatus = async () => ({ generatedAt: '2026-09-08T00:00:00.000Z' });
    const res = {
      setHeader: (name, value) => { headers[name] = value; },
      status: () => res,
      json: (body) => { payload = body; return res; }
    };

    try {
      await adminController.getAiRateLimitStatus({}, res, (error) => { throw error; });
      assert.match(headers['Cache-Control'], /no-store/);
      assert.equal(headers.Pragma, 'no-cache');
      assert.equal(payload.success, true);
    } finally {
      adminService.getRateLimitStatus = originalGetRateLimitStatus;
    }
  });

  test('maps rolling RPM/TPM/RPD usage and computes percentages from admin caps', async () => {
    const originalQuery = db.pool.query;
    const capturedSql = [];
    const capturedParams = [];

    db.pool.query = async (text, params) => {
      capturedSql.push(text);
      capturedParams.push(params);
      if (text.includes('FROM ai_rate_limit_discrepancies')) return { rows: [] };
      return {
        rows: [{
          model: 'gemini-3.7-flash',
          rpm_current: 7,
          rpm_success: 5,
          rpm_error: 2,
          rpm_pending: 0,
          tpm_current: '125000',
          rpd_current: 225,
          rpd_success: 210,
          rpd_error: 15,
          rpd_pending: 0,
          rpm_cap: 10,
          tpm_cap: 250000,
          rpd_cap: 250,
          updated_at: '2026-09-02T00:00:00.000Z',
          updated_by: 1,
          updated_by_name: 'Admin'
        }, {
          model: 'gemini-embedding-001',
          rpm_current: 2,
          rpm_success: 2,
          rpm_error: 0,
          rpm_pending: 0,
          tpm_current: '1200',
          rpd_current: 12,
          rpd_success: 12,
          rpd_error: 0,
          rpd_pending: 0,
          rpm_cap: null,
          tpm_cap: null,
          rpd_cap: null,
          updated_at: null,
          updated_by: null,
          updated_by_name: null
        }]
      };
    };

    try {
      const status = await adminService.getRateLimitStatus();

      assert.match(capturedSql[0], /INTERVAL '60 seconds'/i);
      assert.match(capturedSql[0], /INTERVAL '24 hours'/i);
      assert.match(capturedSql[0], /America\/Los_Angeles/i);
      assert.match(capturedSql[0], /ai_model_rate_limit_settings/i);
      assert.match(capturedSql[0], /UNNEST\(\$1::text\[\]\)/i);
      assert.match(capturedSql[0], /request_status = 'error'/i);
      assert.ok(capturedParams[0][0].includes('gemini-3.7-flash'));
      assert.ok(capturedParams[0][0].includes('gemini-embedding-001'));
      assert.equal(status.windows.rpdTimezone, 'America/Los_Angeles');
      assert.deepEqual(status.models[0].usage, { rpm: 7, tpm: 125000, rpd: 225 });
      assert.deepEqual(status.models[0].requestStatus.rpm, { success: 5, error: 2, pending: 0 });
      assert.deepEqual(status.models[0].percentUsed, { rpm: 70, tpm: 50, rpd: 90 });
      assert.equal(status.models[0].riskLevel, 'critical');
      assert.deepEqual(status.models[0].headroom, { rpm: 3, tpm: 125000, rpd: 25 });
      assert.equal(status.models[0].configured, true);
      assert.deepEqual(status.models[1].percentUsed, { rpm: null, tpm: null, rpd: null });
      assert.equal(status.models[1].configured, false);
      assert.equal(status.guard.criticalModels, 1);
      assert.equal(status.guard.unconfiguredModels, 1);
    } finally {
      db.pool.query = originalQuery;
    }
  });

  test('upserts only positive integer caps and records the admin user', async () => {
    const originalQuery = db.pool.query;
    let capturedParams = null;

    db.pool.query = async (_text, params) => {
      capturedParams = params;
      return {
        rows: [{
          model: params[0],
          rpm_cap: params[1],
          tpm_cap: params[2],
          rpd_cap: params[3],
          updated_at: '2026-09-02T00:00:00.000Z',
          updated_by: params[4]
        }]
      };
    };

    try {
      const saved = await adminService.updateAiRateLimitCaps({
        model: ' gemini-3.7-flash ',
        rpmCap: 10,
        tpmCap: 250000,
        rpdCap: 250,
        updatedBy: 9
      });

      assert.deepEqual(capturedParams, ['gemini-3.7-flash', 10, 250000, 250, 9]);
      assert.equal(saved.model, 'gemini-3.7-flash');
      assert.equal(saved.updatedBy, 9);

      await assert.rejects(
        () => adminService.updateAiRateLimitCaps({
          model: 'gemini-3.7-flash', rpmCap: 0, tpmCap: 100, rpdCap: 100, updatedBy: 9
        }),
        (error) => error.status === 400 && error.code === 'INVALID_RATE_LIMIT_CAP'
      );

    } finally {
      db.pool.query = originalQuery;
    }
  });
});

describe('Best-effort Gemini 429 calibration', () => {
  const synthetic429 = {
    status: 429,
    response: {
      data: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          details: [{
            quotaMetric: 'generate_content_free_tier_requests_per_minute_per_project_per_model',
            quotaValue: '10',
            quotaDimensions: { model: 'gemini-3.7-flash' }
          }]
        }
      }
    }
  };

  test('extracts model, dimension and provider limit from a structured synthetic fixture', () => {
    const parsed = parseGeminiQuotaViolation(synthetic429);
    assert.equal(parsed.model, 'gemini-3.7-flash');
    assert.equal(parsed.dimension, 'rpm');
    assert.equal(parsed.providerLimit, 10);
  });

  test('stores a non-blocking discrepancy when the parsed provider limit differs', async () => {
    const originalQuery = db.query;
    const queries = [];
    db.query = async (text, params) => {
      queries.push({ text, params });
      if (text.includes('FROM ai_model_rate_limit_settings')) {
        return { rows: [{ rpm_cap: 20, tpm_cap: 250000, rpd_cap: 250 }] };
      }
      if (text.includes('FROM ai_usage_events')) {
        return { rows: [{ rpm: 8, tpm: '100000', rpd: 120 }] };
      }
      return { rows: [] };
    };

    try {
      await assert.doesNotReject(() => recordGeminiQuotaSignal({
        error: synthetic429,
        model: 'gemini-3.7-flash'
      }));
      const insert = queries.find((query) => query.text.includes('INSERT INTO ai_rate_limit_discrepancies'));
      assert.ok(insert);
      assert.deepEqual(insert.params.slice(0, 5), ['gemini-3.7-flash', 'rpm', 20, 8, 10]);
    } finally {
      db.query = originalQuery;
    }
  });

  test('swallows parser/database failures so Gemini handling remains unchanged', async () => {
    const originalQuery = db.query;
    db.query = async () => { throw new Error('database unavailable'); };
    try {
      await assert.doesNotReject(() => recordGeminiQuotaSignal({
        error: synthetic429,
        model: 'gemini-3.7-flash'
      }));
    } finally {
      db.query = originalQuery;
    }
  });

  test('records provider incidents only for explicitly tagged RAG purposes', async () => {
    const originalQuery = db.query;
    const queries = [];
    db.query = async (text, params) => {
      queries.push({ text, params });
      return { rows: [] };
    };

    try {
      const quotaError = new Error('429 RESOURCE_EXHAUSTED. Please retry in 9.25s.');
      quotaError.status = 429;
      await recordAiProviderIncident({
        error: quotaError,
        model: 'gemini-embedding-001',
        purpose: 'rag_ingestion_embedding'
      });
      await recordAiProviderIncident({
        error: quotaError,
        model: 'gemini-3.7-flash',
        purpose: 'chat'
      });

      assert.equal(queries.length, 1);
      assert.match(queries[0].text, /INSERT INTO ai_provider_incidents/);
      assert.deepEqual(queries[0].params.slice(0, 4), [
        'rag_ingestion_embedding',
        'gemini-embedding-001',
        'GEMINI_QUOTA_EXHAUSTED',
        429
      ]);
      assert.equal(queries[0].params[5], 9250);
    } finally {
      db.query = originalQuery;
    }
  });
});
