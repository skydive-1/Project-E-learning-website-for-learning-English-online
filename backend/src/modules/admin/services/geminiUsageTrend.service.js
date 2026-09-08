const { GoogleAuth } = require('google-auth-library');
const { pool } = require('../../../config/database');

const GOOGLE_MONITORING_SCOPE = 'https://www.googleapis.com/auth/monitoring.read';
const GOOGLE_MONITORING_BASE_URL = 'https://monitoring.googleapis.com/v3';
const GOOGLE_CACHE_TTL_MS = 60_000;
const GOOGLE_EXPECTED_DELAY_SECONDS = 150;

const RANGE_CONFIGS = Object.freeze({
  '1h': { durationMs: 60 * 60 * 1000, bucketSeconds: 300 },
  '6h': { durationMs: 6 * 60 * 60 * 1000, bucketSeconds: 900 },
  '12h': { durationMs: 12 * 60 * 60 * 1000, bucketSeconds: 1800 },
  '1d': { durationMs: 24 * 60 * 60 * 1000, bucketSeconds: 3600 },
  '2d': { durationMs: 2 * 24 * 60 * 60 * 1000, bucketSeconds: 3600 },
  '4d': { durationMs: 4 * 24 * 60 * 60 * 1000, bucketSeconds: 14_400 },
  '7d': { durationMs: 7 * 24 * 60 * 60 * 1000, bucketSeconds: 86_400 },
  '14d': { durationMs: 14 * 24 * 60 * 60 * 1000, bucketSeconds: 86_400 },
  '30d': { durationMs: 30 * 24 * 60 * 60 * 1000, bucketSeconds: 86_400 }
});

const METRIC_CONFIGS = Object.freeze({
  tokens: {
    googleMetricTypes: [
      'generativelanguage.googleapis.com/quota/generate_content_free_tier_input_token_count/usage',
      'generativelanguage.googleapis.com/generate_content_usage_output_token_count',
      'generativelanguage.googleapis.com/quota/embed_content_free_tier_tokens/usage'
    ],
    backendValueSql: "COALESCE(SUM(total_tokens) FILTER (WHERE request_status = 'success'), 0)",
    historicalValueColumn: 'total_tokens',
    unit: 'tokens'
  },
  requests: {
    googleMetricTypes: [
      'generativelanguage.googleapis.com/quota/generate_content_free_tier_requests/usage',
      'generativelanguage.googleapis.com/quota/embed_content_free_tier_requests/usage'
    ],
    backendValueSql: 'COUNT(*)',
    historicalValueColumn: 'request_count',
    unit: 'requests'
  },
  quota_errors: {
    googleMetricTypes: [
      'generativelanguage.googleapis.com/quota/generate_content_free_tier_requests/exceeded',
      'generativelanguage.googleapis.com/quota/generate_content_free_tier_input_token_count/exceeded',
      'generativelanguage.googleapis.com/quota/embed_content_free_tier_requests/exceeded',
      'generativelanguage.googleapis.com/quota/embed_content_free_tier_tokens/exceeded'
    ],
    backendValueSql: `COUNT(*) FILTER (
      WHERE request_status = 'error'
        AND (
          error_code = '429'
          OR UPPER(COALESCE(error_code, '')) LIKE '%RESOURCE_EXHAUSTED%'
          OR UPPER(COALESCE(error_code, '')) LIKE '%QUOTA%'
        )
    )`,
    historicalValueColumn: null,
    unit: 'quota_errors'
  }
});

const ALLOWED_SOURCES = new Set(['auto', 'google', 'backend']);
const googleCache = new Map();

const normalizeRange = (value) => RANGE_CONFIGS[value] ? value : '30d';
const normalizeMetric = (value) => METRIC_CONFIGS[value] ? value : 'tokens';
const normalizeSource = (value) => ALLOWED_SOURCES.has(value) ? value : 'backend';
const normalizeModel = (value) => {
  const normalized = String(value || 'all').trim().replace(/^models\//, '');
  return normalized && normalized.length <= 160 ? normalized : 'all';
};

const parseServiceAccountCredentials = () => {
  const encoded = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();
  const rawJson = encoded
    ? Buffer.from(encoded, 'base64').toString('utf8')
    : String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();

  if (!rawJson) {
    const error = new Error('Google Cloud Monitoring chưa được cấu hình service account.');
    error.code = 'GOOGLE_MONITORING_NOT_CONFIGURED';
    throw error;
  }

  let credentials;
  try {
    credentials = JSON.parse(rawJson);
  } catch {
    const error = new Error('Service account JSON không hợp lệ.');
    error.code = 'GOOGLE_MONITORING_INVALID_CREDENTIALS';
    throw error;
  }

  if (
    credentials?.type !== 'service_account'
    || !credentials?.client_email
    || !credentials?.private_key
    || !credentials?.project_id
  ) {
    const error = new Error('Service account thiếu trường bắt buộc.');
    error.code = 'GOOGLE_MONITORING_INVALID_CREDENTIALS';
    throw error;
  }

  const configuredProjectId = String(process.env.GOOGLE_CLOUD_PROJECT_ID || '').trim();
  if (configuredProjectId && configuredProjectId !== credentials.project_id) {
    const error = new Error('Project ID không khớp với service account.');
    error.code = 'GOOGLE_MONITORING_PROJECT_MISMATCH';
    throw error;
  }

  return {
    credentials,
    projectId: configuredProjectId || credentials.project_id
  };
};

const normalizeGoogleModel = (value, metricType) => {
  const model = String(value || '').trim().replace(/^models\//, '');
  if (model) return model;
  return metricType.includes('embed_content') ? 'gemini-embedding' : 'gemini-generate-content';
};

const numericPointValue = (value = {}) => {
  if (value.int64Value !== undefined) return Number(value.int64Value) || 0;
  if (value.doubleValue !== undefined) return Number(value.doubleValue) || 0;
  if (value.boolValue !== undefined) return value.boolValue ? 1 : 0;
  return 0;
};

const floorToBucketIso = (value, bucketSeconds) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const bucketMs = bucketSeconds * 1000;
  return new Date(Math.floor(timestamp / bucketMs) * bucketMs).toISOString();
};

const classifyGoogleError = (error) => {
  const status = Number(error?.response?.status || error?.status || error?.code);
  const providerMessage = String(
    error?.response?.data?.error?.message || error?.message || ''
  ).toLowerCase();
  if (
    providerMessage.includes('requires billing to be enabled')
    || providerMessage.includes('billing must be enabled')
    || providerMessage.includes('billing_disabled')
  ) {
    return 'GOOGLE_MONITORING_BILLING_REQUIRED';
  }
  if (status === 401) return 'GOOGLE_MONITORING_AUTH_ERROR';
  if (status === 403) return 'GOOGLE_MONITORING_PERMISSION_DENIED';
  if (status === 429) return 'GOOGLE_MONITORING_RATE_LIMITED';
  if (String(error?.code || '').startsWith('GOOGLE_MONITORING_')) return error.code;
  return 'GOOGLE_MONITORING_UNAVAILABLE';
};

const readGoogleMetric = async ({ client, projectId, metricType, startTime, endTime, bucketSeconds }) => {
  const rows = [];
  let pageToken;

  do {
    const response = await client.request({
      url: `${GOOGLE_MONITORING_BASE_URL}/projects/${encodeURIComponent(projectId)}/timeSeries`,
      method: 'GET',
      params: {
        filter: `metric.type = "${metricType}"`,
        'interval.startTime': startTime,
        'interval.endTime': endTime,
        view: 'FULL',
        'aggregation.alignmentPeriod': `${Math.max(60, bucketSeconds)}s`,
        'aggregation.perSeriesAligner': 'ALIGN_SUM',
        'aggregation.crossSeriesReducer': 'REDUCE_SUM',
        'aggregation.groupByFields': 'metric.labels.model',
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {})
      }
    });

    for (const timeSeries of response.data?.timeSeries || []) {
      const model = normalizeGoogleModel(timeSeries.metric?.labels?.model, metricType);
      for (const point of timeSeries.points || []) {
        const timestamp = floorToBucketIso(
          point.interval?.endTime || point.interval?.startTime,
          bucketSeconds
        );
        if (!timestamp) continue;
        rows.push({ timestamp, model, value: numericPointValue(point.value) });
      }
    }

    pageToken = response.data?.nextPageToken;
  } while (pageToken);

  return rows;
};

const mergeSeries = (rows) => {
  const merged = new Map();
  for (const row of rows) {
    const key = `${row.timestamp}\u0000${row.model}`;
    const current = merged.get(key) || { timestamp: row.timestamp, model: row.model, value: 0 };
    current.value += Number(row.value || 0);
    merged.set(key, current);
  }
  return [...merged.values()].sort((a, b) => (
    a.timestamp.localeCompare(b.timestamp) || a.model.localeCompare(b.model)
  ));
};

const fetchGoogleTrend = async ({ range, metric, model, fresh = false, now = new Date() }) => {
  const rangeConfig = RANGE_CONFIGS[range];
  const cacheKey = `${range}:${metric}`;
  const cached = googleCache.get(cacheKey);
  if (!fresh && cached && Date.now() - cached.cachedAt < GOOGLE_CACHE_TTL_MS) {
    const allSeries = cached.series;
    return {
      ...cached.payload,
      series: model === 'all' ? allSeries : allSeries.filter((row) => row.model === model),
      cacheHit: true
    };
  }

  const { credentials, projectId } = parseServiceAccountCredentials();
  const auth = new GoogleAuth({
    credentials,
    projectId,
    scopes: [GOOGLE_MONITORING_SCOPE]
  });
  const client = await auth.getClient();
  const endTime = now.toISOString();
  const startTime = new Date(now.getTime() - rangeConfig.durationMs).toISOString();

  const metricRows = await Promise.all(
    METRIC_CONFIGS[metric].googleMetricTypes.map((metricType) => readGoogleMetric({
      client,
      projectId,
      metricType,
      startTime,
      endTime,
      bucketSeconds: rangeConfig.bucketSeconds
    }))
  );
  const allSeries = mergeSeries(metricRows.flat());
  const availableModels = [...new Set(allSeries.map((row) => row.model))].sort();
  const sampledAt = allSeries.reduce(
    (latest, row) => !latest || row.timestamp > latest ? row.timestamp : latest,
    null
  );
  const payload = {
    projectId,
    startTime,
    endTime,
    sampledAt,
    availableModels,
    expectedDelaySeconds: GOOGLE_EXPECTED_DELAY_SECONDS,
    stale: Boolean(sampledAt && now.getTime() - new Date(sampledAt).getTime() > 5 * 60 * 1000)
  };
  googleCache.set(cacheKey, { cachedAt: Date.now(), payload, series: allSeries });

  return {
    ...payload,
    series: model === 'all' ? allSeries : allSeries.filter((row) => row.model === model),
    cacheHit: false
  };
};

const fetchBackendTrend = async ({ range, metric, model, now = new Date() }) => {
  const rangeConfig = RANGE_CONFIGS[range];
  const startTime = new Date(now.getTime() - rangeConfig.durationMs).toISOString();
  const endTime = now.toISOString();
  const metricConfig = METRIC_CONFIGS[metric];

  const liveResult = await pool.query(`
    SELECT
      to_timestamp(
        floor(extract(epoch FROM created_at) / $2::int) * $2::int
      ) AS timestamp,
      model,
      (${metricConfig.backendValueSql})::bigint AS value
    FROM ai_usage_events
    WHERE created_at >= $1::timestamptz
      AND created_at <= $3::timestamptz
    GROUP BY timestamp, model
    ORDER BY timestamp ASC, model ASC
  `, [startTime, rangeConfig.bucketSeconds, endTime]);

  const rows = liveResult.rows.map((row) => ({
    timestamp: new Date(row.timestamp).toISOString(),
    model: normalizeGoogleModel(row.model, ''),
    value: Number(row.value || 0)
  }));

  if (rangeConfig.bucketSeconds === 86_400 && metricConfig.historicalValueColumn) {
    const historyResult = await pool.query(`
      SELECT
        h.usage_date::timestamptz AS timestamp,
        h.model,
        COALESCE(SUM(h.${metricConfig.historicalValueColumn}), 0)::bigint AS value
      FROM ai_usage_daily_model_history h
      WHERE h.usage_date >= $1::timestamptz::date
        AND h.usage_date <= $2::timestamptz::date
        AND h.is_trusted = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM ai_usage_events live
          WHERE live.created_at::date = h.usage_date
            AND live.model = h.model
        )
      GROUP BY h.usage_date, h.model
      ORDER BY h.usage_date ASC, h.model ASC
    `, [startTime, endTime]);

    rows.push(...historyResult.rows.map((row) => ({
      timestamp: new Date(row.timestamp).toISOString(),
      model: normalizeGoogleModel(row.model, ''),
      value: Number(row.value || 0)
    })));
  }

  const allSeries = mergeSeries(rows);
  const availableModels = [...new Set(allSeries.map((row) => row.model))].sort();
  const sampledAt = allSeries.reduce(
    (latest, row) => !latest || row.timestamp > latest ? row.timestamp : latest,
    null
  );

  return {
    projectId: null,
    startTime,
    endTime,
    sampledAt,
    availableModels,
    expectedDelaySeconds: 0,
    stale: false,
    cacheHit: false,
    series: model === 'all' ? allSeries : allSeries.filter((row) => row.model === model)
  };
};

const getGeminiUsageTrend = async (options = {}) => {
  const range = normalizeRange(options.range);
  const metric = normalizeMetric(options.metric);
  const sourceRequested = normalizeSource(options.source);
  const model = normalizeModel(options.model);
  const rangeConfig = RANGE_CONFIGS[range];
  let fallbackReason = null;

  if (sourceRequested !== 'backend') {
    try {
      const google = await fetchGoogleTrend({ range, metric, model, fresh: options.fresh });
      return {
        range,
        metric,
        unit: METRIC_CONFIGS[metric].unit,
        model,
        bucketSeconds: rangeConfig.bucketSeconds,
        sourceRequested,
        sourceUsed: 'google',
        providerStatus: google.stale ? 'stale' : 'connected',
        fallbackReason: null,
        generatedAt: new Date().toISOString(),
        ...google
      };
    } catch (error) {
      fallbackReason = classifyGoogleError(error);
      console.warn(`[Gemini Usage Trend] Google Monitoring unavailable (${fallbackReason}); using backend telemetry.`);
    }
  }

  const backend = await fetchBackendTrend({ range, metric, model });
  return {
    range,
    metric,
    unit: METRIC_CONFIGS[metric].unit,
    model,
    bucketSeconds: rangeConfig.bucketSeconds,
    sourceRequested,
    sourceUsed: 'backend',
    providerStatus: fallbackReason ? 'fallback' : 'connected',
    fallbackReason,
    generatedAt: new Date().toISOString(),
    ...backend
  };
};

module.exports = {
  RANGE_CONFIGS,
  METRIC_CONFIGS,
  normalizeRange,
  normalizeMetric,
  normalizeSource,
  normalizeModel,
  numericPointValue,
  classifyGoogleError,
  readGoogleMetric,
  parseServiceAccountCredentials,
  getGeminiUsageTrend
};
