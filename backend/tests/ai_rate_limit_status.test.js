const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const db = require('../src/config/database');
const adminService = require('../src/modules/admin/services/admin.service');
const adminController = require('../src/modules/admin/controllers/admin.controller');
const adminRateLimitsController = require('../src/modules/admin/controllers/adminRateLimits.controller');
const { notifyAiRateLimitsChanged } = require('../src/utils/aiRateLimitEvents');
const {
  parseGeminiQuotaViolation,
  recordGeminiQuotaSignal,
  recordAiProviderIncident,
  getGeminiQuotaCooldown,
  getGeminiModelRoutingStatus,
  getNextPacificRpdResetAt,
  getPrioritizedFallbackModels,
  getQuotaAwareFallbackModels,
  applyObservedGeminiRpdUsage,
  markModelQuotaExhausted,
  recordSuccessfulGeminiModel,
  resetGeminiModelRouting,
  setPreferredGeminiModel
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

  test('pushes a new SSE rate-limit snapshot immediately after an AI usage event', async () => {
    const originalGetRateLimitStatus = adminService.getRateLimitStatus;
    let rpm = 1;
    adminService.getRateLimitStatus = async () => ({
      generatedAt: new Date().toISOString(),
      models: [{
        model: 'gemini-test',
        usage: { rpm, tpm: rpm * 100, rpd: rpm },
        requestStatus: { rpm: { success: rpm, error: 0, pending: 0 } },
        caps: { rpm: 10, tpm: 1000, rpd: 100 },
        riskLevel: 'healthy',
        updatedAt: null
      }],
      guard: { checkedAt: new Date().toISOString() },
      routing: { effectiveModel: 'gemini-test' },
      notices: [],
      windows: { nextRpdResetAt: '2026-09-09T07:00:00.000Z' }
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
      await adminRateLimitsController.streamAiRateLimits(req, res);
      rpm = 2;
      notifyAiRateLimitsChanged('ai-usage-success');
      await new Promise((resolve) => setImmediate(resolve));
      req.emit('close');

      const output = chunks.join('');
      assert.equal(headers['Content-Type'], 'text/event-stream; charset=utf-8');
      assert.match(output, /event: connected/);
      assert.equal((output.match(/event: rate-limits/g) || []).length, 2);
      assert.match(output, /"rpm":2/);
      assert.match(output, /backend_observed_telemetry/);
    } finally {
      req.emit('close');
      adminService.getRateLimitStatus = originalGetRateLimitStatus;
    }
  });

  test('lets an admin restore the preferred model without sending a Gemini probe', async () => {
    const originalResetAiModelRouting = adminService.resetAiModelRouting;
    let payload = null;
    let calledWith = null;
    adminService.resetAiModelRouting = (options) => {
      calledWith = options;
      return { preferredModel: 'gemini-3.7-flash', effectiveModel: 'gemini-3.7-flash' };
    };
    const res = {
      setHeader: () => {},
      status: () => res,
      json: (body) => { payload = body; return res; }
    };

    try {
      await adminController.resetAiModelRouting(
        { user: { id: 9 } },
        res,
        (error) => { throw error; }
      );
      assert.deepEqual(calledWith, { adminUserId: 9 });
      assert.equal(payload.success, true);
      assert.equal(payload.data.routing.effectiveModel, 'gemini-3.7-flash');
    } finally {
      adminService.resetAiModelRouting = originalResetAiModelRouting;
    }
  });

  test('maps backend attempts and compares them with admin reference caps', async () => {
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
      assert.equal(status.windows.rpdResetPacificTime, '00:00');
      assert.match(status.windows.rpdResetVietnamTime, /^\d{2}:\d{2}$/);
      assert.ok(status.windows.nextRpdResetAt);
      assert.deepEqual(status.telemetry, {
        source: 'backend_observed_attempts',
        authority: 'application',
        providerUsageAvailable: false,
        countsFailedAttempts: true,
        capsAreReferenceOnly: true
      });
      assert.deepEqual(status.models[0].usage, { rpm: 7, tpm: 125000, rpd: 225 });
      assert.deepEqual(status.models[0].attempts, { rolling60Seconds: 7, pacificDay: 225 });
      assert.deepEqual(status.models[0].requestStatus.rpm, { success: 5, error: 2, pending: 0 });
      assert.equal(status.models[0].comparisonBasis, 'admin_reference_caps');
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

  test('uses provider retryDelay for cooldown and automatically restores model priority after expiry/reset', () => {
    resetGeminiModelRouting({ all: true });
    const cooldown = getGeminiQuotaCooldown({
      status: 429,
      response: {
        data: {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            details: [{ retryDelay: '30s' }]
          }
        }
      }
    });
    assert.equal(cooldown.durationMs, 31000);
    assert.equal(cooldown.source, 'provider_retry_after');

    markModelQuotaExhausted('gemini-3.7-flash', cooldown.durationMs, cooldown.source);
    assert.equal(getPrioritizedFallbackModels('gemini-3.7-flash')[0], 'gemini-3.6-flash');
    let routing = getGeminiModelRoutingStatus();
    assert.equal(routing.effectiveModel, 'gemini-3.6-flash');
    assert.equal(routing.coolingDown[0].model, 'gemini-3.7-flash');
    assert.equal(routing.coolingDown[0].source, 'provider_retry_after');

    routing = resetGeminiModelRouting();
    assert.equal(routing.effectiveModel, 'gemini-3.7-flash');
    assert.equal(routing.coolingDown.length, 0);
  });

  test('does not infer RPD from a generic free-tier metric and honors its short retryDelay', () => {
    const ambiguous429 = {
      status: 429,
      response: {
        data: {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            details: [
              {
                quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                quotaValue: '20',
                quotaDimensions: { model: 'gemini-3.7-flash' }
              },
              { retryDelay: '45s' }
            ]
          }
        }
      }
    };

    assert.equal(parseGeminiQuotaViolation(ambiguous429), null);
    const cooldown = getGeminiQuotaCooldown(ambiguous429, 'gemini-3.7-flash');
    assert.equal(cooldown.dimension, null);
    assert.equal(cooldown.source, 'provider_retry_after');
    assert.equal(cooldown.durationMs, 46000);
  });

  test('uses bounded exponential backoff for an ambiguous 429 without RetryInfo', () => {
    const ambiguous429 = {
      status: 429,
      response: {
        data: {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            message: 'Resource has been exhausted (e.g. check quota).'
          }
        }
      }
    };

    const first = getGeminiQuotaCooldown(ambiguous429, 'gemini-3.7-flash', {
      transientFailureCount: 1,
      jitterMs: 0
    });
    const second = getGeminiQuotaCooldown(ambiguous429, 'gemini-3.7-flash', {
      transientFailureCount: 2,
      jitterMs: 0
    });
    const capped = getGeminiQuotaCooldown(ambiguous429, 'gemini-3.7-flash', {
      transientFailureCount: 8,
      jitterMs: 0
    });

    assert.equal(first.source, 'provider_transient_backoff');
    assert.equal(first.dimension, null);
    assert.equal(first.durationMs, 30000);
    assert.equal(second.durationMs, 60000);
    assert.equal(capped.durationMs, 300000);
  });

  test('converts the Pacific RPD reset to 14:00 or 15:00 Vietnam time across DST', () => {
    const summerReset = getNextPacificRpdResetAt(Date.UTC(2026, 8, 12, 1, 0, 0));
    const winterReset = getNextPacificRpdResetAt(Date.UTC(2026, 0, 15, 1, 0, 0));

    assert.equal(new Date(summerReset).toISOString(), '2026-09-12T07:00:00.000Z');
    assert.equal(new Date(winterReset).toISOString(), '2026-01-15T08:00:00.000Z');
  });

  test('does not lock models from backend attempt counts', () => {
    resetGeminiModelRouting({ all: true });
    applyObservedGeminiRpdUsage([
      { model: 'gemini-3.7-flash', usage: { rpd: 20 }, caps: { rpd: 20 } },
      { model: 'gemini-3.6-flash', usage: { rpd: 28 }, caps: { rpd: 20 } },
      { model: 'gemini-3.5-flash-lite', usage: { rpd: 15 }, caps: { rpd: 500 } }
    ]);

    const routing = getGeminiModelRoutingStatus();
    assert.equal(routing.effectiveModel, 'gemini-3.7-flash');
    assert.deepEqual(routing.coolingDown, []);

    resetGeminiModelRouting({ all: true });
  });

  test('loads backend attempts without treating them as provider quota', async () => {
    const originalQuery = db.query;
    let guardQueries = 0;
    resetGeminiModelRouting({ all: true });
    db.query = async (text) => {
      if (text.includes('COUNT(e.id)::int AS rpd_current')) {
        guardQueries += 1;
        return {
          rows: [
            { model: 'gemini-3.7-flash', rpd_current: 20, rpd_cap: 20 },
            { model: 'gemini-3.6-flash', rpd_current: 28, rpd_cap: 20 },
            { model: 'gemini-3.5-flash-lite', rpd_current: 15, rpd_cap: 500 }
          ]
        };
      }
      return { rows: [] };
    };

    try {
      const firstOrder = await getQuotaAwareFallbackModels('gemini-3.7-flash');
      const cachedOrder = await getQuotaAwareFallbackModels('gemini-3.7-flash');
      assert.equal(firstOrder[0], 'gemini-3.7-flash');
      assert.equal(cachedOrder[0], 'gemini-3.7-flash');
      assert.equal(guardQueries, 1);
    } finally {
      db.query = originalQuery;
      resetGeminiModelRouting({ all: true });
    }
  });

  test('still skips a provider-confirmed RPD cooldown persisted in the database', async () => {
    const originalQuery = db.query;
    resetGeminiModelRouting({ all: true });
    db.query = async (text) => {
      if (text.includes('COUNT(e.id)::int AS rpd_current')) {
        return {
          rows: [{
            model: 'gemini-3.7-flash',
            rpd_current: 2,
            rpd_cap: 20,
            rpd_exhausted_until: new Date(Date.now() + 60_000).toISOString()
          }]
        };
      }
      return { rows: [] };
    };

    try {
      const order = await getQuotaAwareFallbackModels('gemini-3.7-flash');
      assert.equal(order[0], 'gemini-3.6-flash');
      assert.equal(getGeminiModelRoutingStatus().coolingDown[0].source, 'db_persisted_rpd_exhaustion');
    } finally {
      db.query = originalQuery;
      resetGeminiModelRouting({ all: true });
    }
  });

  test('holds a provider-confirmed RPD exhaustion until the Pacific reset window', () => {
    const rpd429 = {
      status: 429,
      response: {
        data: {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            details: [{
              quotaMetric: 'generate_content_free_tier_requests_per_day_per_project_per_model',
              quotaValue: '20',
              quotaDimensions: { model: 'gemini-3.7-flash' }
            }]
          }
        }
      }
    };

    const cooldown = getGeminiQuotaCooldown(rpd429);
    assert.equal(cooldown.dimension, 'rpd');
    assert.equal(cooldown.source, 'provider_rpd_pacific_reset');
    assert.ok(cooldown.retryAt > Date.now());
  });

  test('uses provider retryDelay before Pacific reset for an explicit RPD violation', () => {
    const rpd429 = {
      status: 429,
      response: {
        data: {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            details: [
              {
                quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
                quotaValue: '20',
                quotaDimensions: { model: 'gemini-3.7-flash' }
              },
              { retryDelay: '30s' }
            ]
          }
        }
      }
    };

    const parsed = parseGeminiQuotaViolation(rpd429);
    assert.equal(parsed.dimension, 'rpd');
    const cooldown = getGeminiQuotaCooldown(rpd429);
    assert.equal(cooldown.dimension, 'rpd');
    assert.equal(cooldown.source, 'provider_rpd_retry_after');
    assert.equal(cooldown.durationMs, 31000);
  });

  test('lets an admin force a half-open retry without sending a probe request', () => {
    resetGeminiModelRouting({ all: true });
    markModelQuotaExhausted(
      'gemini-3.7-flash',
      60_000,
      'provider_rpd_pacific_reset',
      { dimension: 'rpd', cap: 20 }
    );
    assert.equal(getGeminiModelRoutingStatus().coolingDown.length, 1);

    const routing = resetGeminiModelRouting({ force: true });
    assert.equal(routing.preferredModel, 'gemini-3.7-flash');
    assert.equal(routing.effectiveModel, 'gemini-3.7-flash');
    assert.equal(routing.coolingDown.length, 0);
  });

  test('prefers an explicit provider reset timestamp over inferred Pacific midnight', () => {
    const providerResetAt = new Date(Date.now() + 120_000).toISOString();
    const rpd429 = {
      status: 429,
      response: {
        data: {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            details: [{
              quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
              quotaValue: '20',
              quotaDimensions: { model: 'gemini-3.7-flash' },
              quotaResetTimestamp: providerResetAt
            }]
          }
        }
      }
    };

    const parsed = parseGeminiQuotaViolation(rpd429);
    assert.equal(parsed.providerResetAt, Date.parse(providerResetAt));
    const cooldown = getGeminiQuotaCooldown(rpd429);
    assert.equal(cooldown.source, 'provider_rpd_reset_timestamp');
    assert.ok(Math.abs(cooldown.retryAt - (Date.parse(providerResetAt) + 1000)) < 5);
  });

  test('clears stale cooldown immediately after a successful model response', () => {
    resetGeminiModelRouting({ all: true });
    markModelQuotaExhausted('gemini-3.7-flash', 60000);
    recordSuccessfulGeminiModel('gemini-3.7-flash');
    const routing = getGeminiModelRoutingStatus();
    assert.equal(routing.effectiveModel, 'gemini-3.7-flash');
    assert.equal(routing.lastSuccessfulModel, 'gemini-3.7-flash');
    assert.equal(routing.coolingDown.length, 0);
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
  test('allows admin to set preferred model and immediately updates routing', async () => {
    const originalQuery = db.query;
    let updatedModel = null;
    db.query = async (text, params) => {
      if (text.includes('UPDATE ai_model_rate_limit_settings SET is_preferred')) {
        updatedModel = params[0];
      }
      return { rows: [] };
    };

    try {
      const routing = await setPreferredGeminiModel('gemini-3.5-flash-lite', { adminUserId: 7 });
      assert.equal(routing.preferredModel, 'gemini-3.5-flash-lite');
      assert.equal(routing.fallbackOrder[0], 'gemini-3.5-flash-lite');
      assert.equal(updatedModel, 'gemini-3.5-flash-lite');
    } finally {
      db.query = originalQuery;
      await setPreferredGeminiModel('gemini-3.7-flash', { adminUserId: 7 });
    }
  });
});
