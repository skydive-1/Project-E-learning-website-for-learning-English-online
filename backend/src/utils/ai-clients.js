/**
 * AI Clients Wrapper (Pinecone & Google Gemini API)
 * - Tách biệt kết nối hạ tầng AI khỏi Business Service.
 * - Tuân thủ nguyên tắc Single Responsibility.
 * - Sử dụng Google AI Studio (Gemini Developer API) MIỄN PHÍ 100% (Không cần Billing/Thẻ).
 * - Tự động ghi nhận mức sử dụng token thực tế từ usageMetadata vào bảng ai_usage_events.
 * 
 * Phụ trách hạ tầng:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { AsyncLocalStorage } = require('node:async_hooks');
const { GoogleGenAI } = require("@google/genai");
const { Pinecone } = require("@pinecone-database/pinecone");
const dotenv = require("dotenv");
dotenv.config();

const db = require('../config/database');
const {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS
} = require('../config/ai-model');

const geminiApiKey = process.env.GEMINI_API_KEY;
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || "elearning-rag";
const DEFAULT_GEMINI_SPEAKING_MODEL = DEFAULT_GEMINI_MODEL;

// ─── AsyncLocalStorage for userId / purpose context ────────────────────────
const aiContextStore = new AsyncLocalStorage();

/**
 * Run `fn` with AI usage context so that any Gemini API call inside
 * automatically records usage tagged with userId and purpose.
 * @param {{ userId?: number|null, purpose?: string }} ctx
 * @param {Function} fn
 */
function runWithAiContext(ctx, fn) {
  return aiContextStore.run(
    { userId: ctx.userId ?? null, purpose: ctx.purpose ?? 'chat' },
    fn
  );
}

function getAiContext() {
  return aiContextStore.getStore() || { userId: null, purpose: 'chat' };
}

// ─── Gemini API Pricing Constants ──────────────────────────────────────────
// Source: Gemini Developer API pricing — https://ai.google.dev/gemini-api/docs/pricing
// Date verified: 2026-09-02 (giá trước đó trong file này bị sai ~10 lần, đã
// nhầm với giá cache-read $0.075/1M thay vì giá input chuẩn).
// Date verified: 2026-09-02 (re-checked; giá trước đó trong file này bị sai ~10 lần,
// đã nhầm với giá cache-read $0.075/1M thay vì giá input chuẩn).
// Giá ưu đãi (introductory pricing) áp dụng tới hết 31/12/2026, sau đó Google tăng
// gấp đôi từ 01/01/2027 — cần cập nhật lại nếu chạy sau mốc đó.
// NOTE: This project uses the free tier (actual cost = $0).  estimated_cost_usd
//       records what the usage WOULD cost at standard paid rates — useful for
//       capacity planning and thesis defense, not because it is being billed.
const COST_PER_M_TOKENS = Object.freeze({
  'gemini-3.7-flash':      { input: 0.75, output: 3.75 },
  'gemini-3.6-flash':      { input: 0.75, output: 3.75 },
  'gemini-3.5-flash-lite': { input: 0.30, output: 2.50 },
  'gemini-embedding-001':  { input: 0.15, output: 0 },
});
const DEFAULT_COST_RATE = Object.freeze({ input: 0.75, output: 3.75 });

// ─── Usage Recording ───────────────────────────────────────────────────────

/**
 * Open a provider-request event before calling Gemini. This makes RPM/RPD reflect
 * every attempt, including failed requests and embedding responses without token
 * metadata. Tracking is best-effort and must never break user-facing features.
 *
 * @param {{ userId?: number|null, purpose: string, model: string }} opts
 */
async function beginAiUsageEvent({ userId = null, purpose, model }) {
  try {
    const result = await db.query(
      `INSERT INTO ai_usage_events
         (user_id, purpose, model, request_status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [userId || null, purpose || 'unknown', model]
    );
    return result.rows?.[0]?.id || null;
  } catch (err) {
    console.error('[AI Usage Recording] Failed to open usage event (non-fatal):', err.message);
    return null;
  }
}

/**
 * Complete a Gemini API usage event. When eventId is absent this preserves the
 * legacy insert path used by direct callers and older integrations.
 *
 * @param {{ eventId?: number|null, userId?: number|null, purpose: string, model: string, usageMetadata?: object }} opts
 */
async function recordAiUsage({ eventId = null, userId = null, purpose, model, usageMetadata }) {
  try {
    if (!usageMetadata && !eventId) return;

    // Field names vary across SDK versions — check both shapes.
    const input  = usageMetadata?.promptTokenCount   ?? usageMetadata?.inputTokens  ?? 0;
    const output = usageMetadata?.candidatesTokenCount ?? usageMetadata?.outputTokens ?? 0;
    const total  = usageMetadata?.totalTokenCount     ?? usageMetadata?.totalTokens  ?? (input + output);
    if (!eventId && total === 0 && input === 0 && output === 0) return;

    const rates = COST_PER_M_TOKENS[model] || DEFAULT_COST_RATE;
    const cost  = ((input * rates.input) + (output * rates.output)) / 1_000_000;

    if (eventId) {
      await db.query(
        `UPDATE ai_usage_events
         SET input_tokens = $2,
             output_tokens = $3,
             total_tokens = $4,
             estimated_cost_usd = $5,
             request_status = 'success',
             error_code = NULL,
             completed_at = NOW()
         WHERE id = $1`,
        [eventId, input, output, total, cost]
      );
    } else {
      await db.query(
        `INSERT INTO ai_usage_events
           (user_id, purpose, model, input_tokens, output_tokens, total_tokens,
            estimated_cost_usd, request_status, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', NOW())`,
        [userId || null, purpose, model, input, output, total, cost]
      );
    }

    // 2. Increment user_token_limits.used_tokens (upsert)
    if (userId && total > 0) {
      await db.query(
        `INSERT INTO user_token_limits (user_id, max_tokens, used_tokens)
         VALUES ($1, 6000, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           used_tokens = user_token_limits.used_tokens + $2,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, total]
      );
    }
  } catch (err) {
    console.error('[AI Usage Recording] Failed to record usage (non-fatal):', err.message);
  }
}

// ─── Gemini Client Initialization ──────────────────────────────────────────

function getGeminiFallbackModels(preferredModel) {
  return Array.from(new Set([
    preferredModel,
    GEMINI_MODELS.primary,
    ...GEMINI_MODELS.fallbacks
  ].filter(Boolean)));
}

// Map lưu trữ thời điểm hết hạn quota (cooldown) của từng model khi gặp lỗi 429
const modelQuotaCooldown = new Map();

function markModelQuotaExhausted(model, durationMs = 10 * 60 * 1000) {
  if (!model) return;
  modelQuotaCooldown.set(String(model).trim(), Date.now() + durationMs);
}

function getPrioritizedFallbackModels(preferredModel) {
  const models = getGeminiFallbackModels(preferredModel);
  const now = Date.now();
  const available = [];
  const coolingDown = [];

  for (const m of models) {
    const expiresAt = modelQuotaCooldown.get(m);
    if (expiresAt && now < expiresAt) {
      coolingDown.push(m);
    } else {
      available.push(m);
    }
  }

  // Nếu tất cả các model đều đang trong cooldown, vẫn thử lại theo thứ tự ban đầu
  if (available.length === 0) {
    return models;
  }

  return [...available, ...coolingDown];
}

const isGeminiQuotaError = (error) => {
  const message = String(error?.message || '');
  return error?.status === 429
    || error?.code === 429
    || error?.code === 'RESOURCE_EXHAUSTED'
    || /\b429\b|resource[_ ]exhausted|quota exceeded|rate limit exceeded/i.test(message);
};

const isRetryableGeminiError = (error) => {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  const message = String(error?.message || '');
  return [404, 408, 429, 500, 502, 503, 504].includes(status)
    || ['ETIMEDOUT', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE'].includes(code)
    || /not found|no longer available|timed?\s*out|deadline exceeded|socket hang up|network error|temporarily unavailable|resource[_ ]exhausted|quota exceeded/i.test(message);
};

const normalizeGeminiError = (error) => {
  if (!isGeminiQuotaError(error)) return error;

  const quotaError = new Error(
    'Dịch vụ Gemini hiện đã chạm hạn mức sử dụng tạm thời. Vui lòng thử lại sau khi Google đặt lại hạn mức.'
  );
  quotaError.name = 'GeminiQuotaError';
  quotaError.status = 503;
  quotaError.code = 'GEMINI_QUOTA_EXHAUSTED';
  quotaError.cause = error;
  const retryMatch = String(error?.message || '').match(/retry in\s+(\d+(?:\.\d+)?)s/i)
    || String(error?.message || '').match(/retry(?:Delay)?[\\"'\s:=]+(\d+(?:\.\d+)?)s/i);
  if (retryMatch) quotaError.retryAfterMs = Math.ceil(Number(retryMatch[1]) * 1000);
  return quotaError;
};

const isRagPurpose = (purpose) => /^rag_[a-z0-9_]+$/i.test(String(purpose || '').trim());

async function recordAiProviderIncident({ error, model, purpose }) {
  if (!isRagPurpose(purpose)) return;
  try {
    const normalized = normalizeGeminiError(error);
    const status = Number(error?.status || error?.statusCode || error?.response?.status || normalized?.status || 0) || null;
    const code = String(normalized?.code || error?.code || error?.response?.data?.error?.status || 'GEMINI_PROVIDER_ERROR').slice(0, 100);
    const message = String(normalized?.message || 'Dịch vụ Gemini gặp lỗi khi xử lý tác vụ RAG.').slice(0, 600);
    const retryAfterMs = Number(normalized?.retryAfterMs || 0) || null;
    await db.query(`
      INSERT INTO ai_provider_incidents
        (workload, purpose, model, error_code, http_status, message, retry_after_ms,
         occurrence_count, first_seen_at, last_seen_at, resolved_at)
      VALUES ('rag', $1, $2, $3, $4, $5, $6, 1, NOW(), NOW(), NULL)
      ON CONFLICT (workload, purpose, model, error_code) WHERE resolved_at IS NULL
      DO UPDATE SET
        http_status = EXCLUDED.http_status,
        message = EXCLUDED.message,
        retry_after_ms = EXCLUDED.retry_after_ms,
        occurrence_count = ai_provider_incidents.occurrence_count + 1,
        last_seen_at = NOW()
    `, [String(purpose), String(model || 'unknown'), code, status, message, retryAfterMs]);
  } catch (incidentError) {
    console.warn('[RAG Incident] Không thể lưu sự cố Gemini (non-fatal):', incidentError.message);
  }
}

/** Mark an opened request as failed without leaking provider error details. */
async function failAiUsageEvent({ eventId, error }) {
  if (!eventId) return;

  try {
    const rawCode = error?.code
      || error?.response?.data?.error?.status
      || error?.status
      || error?.statusCode
      || error?.name
      || 'PROVIDER_ERROR';
    const errorCode = String(rawCode).trim().slice(0, 100) || 'PROVIDER_ERROR';

    await db.query(
      `UPDATE ai_usage_events
       SET request_status = 'error',
           error_code = $2,
           completed_at = NOW()
       WHERE id = $1`,
      [eventId, errorCode]
    );
  } catch (err) {
    console.error('[AI Usage Recording] Failed to close failed event (non-fatal):', err.message);
  }
}

async function resolveAiProviderIncident({ model, purpose }) {
  if (!isRagPurpose(purpose)) return;
  try {
    await db.query(`
      UPDATE ai_provider_incidents
      SET resolved_at = NOW()
      WHERE workload = 'rag'
        AND purpose = $1
        AND model = $2
        AND resolved_at IS NULL
    `, [String(purpose), String(model || 'unknown')]);
  } catch (incidentError) {
    console.warn('[RAG Incident] Không thể đánh dấu sự cố đã phục hồi (non-fatal):', incidentError.message);
  }
}

const sanitizeQuotaDetail = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') {
    if (typeof value === 'string') return value.slice(0, 4000);
    if (typeof value === 'bigint') return value.toString();
    return value;
  }
  if (depth >= 7) return '[max-depth]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeQuotaDetail(item, depth + 1, seen));
  }

  const sanitized = {};
  for (const [key, item] of Object.entries(value).slice(0, 60)) {
    if (/api.?key|authorization|cookie|credential|secret/i.test(key)
      || /^(contents?|prompt|request(body)?|input)$/i.test(key)) {
      sanitized[key] = '[redacted]';
    } else {
      sanitized[key] = sanitizeQuotaDetail(item, depth + 1, seen);
    }
  }
  return sanitized;
};

const flattenQuotaDetail = (value, path = '', output = []) => {
  if (value === null || value === undefined) return output;
  if (typeof value !== 'object') {
    output.push({ path, value: String(value) });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenQuotaDetail(item, `${path}[${index}]`, output));
    return output;
  }
  Object.entries(value).forEach(([key, item]) => {
    flattenQuotaDetail(item, path ? `${path}.${key}` : key, output);
  });
  return output;
};

/**
 * Parser phòng thủ: không phụ thuộc một schema SDK cứng, chỉ nhận tín hiệu
 * khi payload thật có đủ dimension/model rõ ràng.
 */
function parseGeminiQuotaViolation(error, fallbackModel = null) {
  if (!isGeminiQuotaError(error)) return null;

  const source = error?.response?.data
    ?? error?.body
    ?? error?.details
    ?? error?.error
    ?? { message: error?.message, status: error?.status, code: error?.code };
  const rawDetail = sanitizeQuotaDetail(source);
  const entries = flattenQuotaDetail(rawDetail);
  const searchable = entries.map((entry) => `${entry.path}=${entry.value}`).join('\n');
  const normalized = searchable.toLowerCase().replace(/[\s_.:/-]+/g, '');

  let dimension = null;
  if (/tpm|tokens?perminute/.test(normalized)) dimension = 'tpm';
  else if (/rpd|requests?perday|dailyrequests?/.test(normalized)) dimension = 'rpd';
  else if (/rpm|requests?perminute/.test(normalized)) dimension = 'rpm';
  if (!dimension) return null;

  const modelEntry = entries.find((entry) => /(^|\.)model(name)?$/i.test(entry.path));
  const modelMatch = searchable.match(/gemini-[a-z0-9._-]+/i);
  const model = String(modelEntry?.value || modelMatch?.[0] || fallbackModel || '').trim();
  if (!model) return null;

  const limitEntry = entries.find((entry) => (
    /quota(value|limit)|limit(value)?|allowed(value)?|maximum/i.test(entry.path)
    && /^\d+$/.test(entry.value)
    && Number(entry.value) > 0
  ));

  return {
    model,
    dimension,
    providerLimit: limitEntry ? Number(limitEntry.value) : null,
    rawDetail
  };
}

/**
 * Fire-and-forget an toàn: lỗi parser/DB không bao giờ làm thay đổi luồng Gemini.
 */
const quotaLogLastAt = new Map();

async function recordGeminiQuotaSignal({ error, model }) {
  try {
    if (!isGeminiQuotaError(error)) return;

    markModelQuotaExhausted(model, 10 * 60 * 1000);

    const parsed = parseGeminiQuotaViolation(error, model);
    if (parsed?.model) {
      markModelQuotaExhausted(parsed.model, 10 * 60 * 1000);
    }

    const logKey = `${parsed?.model || model || 'unknown'}:${parsed?.dimension || 'unknown'}`;
    const now = Date.now();
    if (now - (quotaLogLastAt.get(logKey) || 0) >= 60_000) {
      quotaLogLastAt.set(logKey, now);
      console.warn(
        `[Gemini Quota 429] model=${parsed?.model || model || 'unknown'}, `
        + `dimension=${parsed?.dimension || 'unknown'}, providerLimit=${parsed?.providerLimit ?? 'unknown'}.`
      );
    }

    if (!parsed) {
      console.warn('[Gemini Quota 429] Không xác định được model/dimension; bỏ qua notice.');
      return;
    }

    const settingsResult = await db.query(
      `SELECT rpm_cap, tpm_cap, rpd_cap
       FROM ai_model_rate_limit_settings
       WHERE model = $1`,
      [parsed.model]
    );
    if (settingsResult.rows.length === 0) return;

    const usageResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 seconds')::int AS rpm,
        COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '60 seconds'), 0)::bigint AS tpm,
        COUNT(*) FILTER (
          WHERE date_trunc('day', created_at AT TIME ZONE 'America/Los_Angeles')
            = date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles')
        )::int AS rpd
      FROM ai_usage_events
      WHERE model = $1
    `, [parsed.model]);

    const setting = settingsResult.rows[0];
    const cap = Number(setting[`${parsed.dimension}_cap`]);
    const observed = Number(usageResult.rows[0]?.[parsed.dimension] || 0);
    const providerDiffers = Number.isFinite(parsed.providerLimit)
      && parsed.providerLimit > 0
      && parsed.providerLimit !== cap;
    const observedDiffersClearly = cap > 0
      && (observed < cap * 0.85 || observed > cap * 1.15);
    if (!providerDiffers && !observedDiffersClearly) return;

    await db.query(`
      INSERT INTO ai_rate_limit_discrepancies
        (model, dimension, configured_cap, observed_usage, provider_limit, raw_detail,
         detected_at, last_seen_at, occurrence_count)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW(), 1)
      ON CONFLICT (model, dimension) DO UPDATE SET
        configured_cap = EXCLUDED.configured_cap,
        observed_usage = EXCLUDED.observed_usage,
        provider_limit = EXCLUDED.provider_limit,
        raw_detail = EXCLUDED.raw_detail,
        last_seen_at = NOW(),
        occurrence_count = ai_rate_limit_discrepancies.occurrence_count + 1
    `, [
      parsed.model,
      parsed.dimension,
      cap,
      observed,
      parsed.providerLimit,
      JSON.stringify(parsed.rawDetail)
    ]);

    console.warn(
      `[Gemini Quota 429] Phát hiện cap có thể lệch: ${parsed.model}/${parsed.dimension}`,
      { configuredCap: cap, observedUsage: observed, providerLimit: parsed.providerLimit }
    );
  } catch (signalError) {
    console.warn('[Gemini Quota 429] Không thể phân tích/lưu tín hiệu (non-fatal):', signalError.message);
  }
}

// Khởi tạo Google Gen AI client theo chế độ Gemini Developer API (100% Miễn phí qua Google AI Studio)
let ai = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey
  });
  console.log(`[AI Infrastructure] ✅ Đã kết nối Google Gemini API (Chế độ Miễn phí 100% qua Google AI Studio)`);
} else {
  console.warn(`[AI Infrastructure Warning] ⚠️ Chưa cấu hình GEMINI_API_KEY trong file .env. Vui lòng lấy key miễn phí tại: https://aistudio.google.com/app/apikey`);
}

function getAiClient() {
  if (ai) return ai;
  const currentKey = process.env.GEMINI_API_KEY;
  if (currentKey) {
    ai = new GoogleGenAI({
      apiKey: currentKey
    });
    return ai;
  }
  throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env. Vui lòng lấy key miễn phí từ https://aistudio.google.com/app/apikey và dán vào backend/.env");
}

/**
 * Helper chuẩn hóa tham số đầu vào cho @google/genai
 */
function normalizeRequest(request) {
  let contents;
  let config = {};
  let model;
  let purpose;
  let userId;

  if (typeof request === "string") {
    contents = request;
  } else if (typeof request === "object" && request !== null) {
    model = request.model;
    purpose = request.purpose;
    userId = request.userId;
    if (request.contents) {
      contents = request.contents;
    } else if (request.prompt) {
      contents = request.prompt;
    } else {
      contents = request;
    }

    const srcConfig = request.generationConfig || request.config || {};
    // Chỉ chuyển tiếp các thuộc tính GenerateContentConfig đã được SDK hỗ trợ.
    // Trước đây adapter làm rơi responseJsonSchema/temperature, vì vậy dù service
    // yêu cầu JSON thì Gemini vẫn có thể trả JSON tự do và làm hỏng cả batch.
    const passthroughConfigKeys = [
      'responseMimeType',
      'responseSchema',
      'responseJsonSchema',
      'temperature',
      'topP',
      'topK',
      'candidateCount',
      'maxOutputTokens',
      'stopSequences',
      'seed'
    ];
    for (const key of passthroughConfigKeys) {
      if (srcConfig[key] !== undefined) config[key] = srcConfig[key];
    }
    if (srcConfig.thinkingConfig && typeof srcConfig.thinkingConfig === 'object') {
      config.thinkingConfig = { ...srcConfig.thinkingConfig };
    }
  }

  return { contents, config: Object.keys(config).length > 0 ? config : undefined, model, purpose, userId };
}

/**
 * Helper gọi generateContent với retry và fallback giữa các model Flash.
 * Sau khi gọi thành công, tự động ghi nhận usageMetadata vào ai_usage_events.
 */
async function executeGenerate(client, contents, config, modelOverride = null, customCtx = {}) {
  const preferredModel = modelOverride || GEMINI_MODELS.primary;
  const fallbackModels = getPrioritizedFallbackModels(preferredModel);
  const triedModels = new Set();
  let lastError = null;

  for (const model of fallbackModels) {
    if (triedModels.has(model)) continue;
    triedModels.add(model);
    const ctx = getAiContext();
    const finalUserId = customCtx.userId !== undefined ? customCtx.userId : ctx.userId;
    const finalPurpose = customCtx.purpose || ctx.purpose || 'chat';
    const usageEventId = await beginAiUsageEvent({
      userId: finalUserId,
      purpose: finalPurpose,
      model
    });

    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config
      });

      // Record real usage from Gemini response
      resolveAiProviderIncident({ model, purpose: finalPurpose });
      await recordAiUsage({
        eventId: usageEventId,
        userId: finalUserId,
        purpose: finalPurpose,
        model,
        usageMetadata: response.usageMetadata
      });

      return response;
    } catch (err) {
      lastError = err;
      await failAiUsageEvent({ eventId: usageEventId, error: err });
      recordAiProviderIncident({ error: err, model, purpose: finalPurpose });
      recordGeminiQuotaSignal({ error: err, model });
      if (isRetryableGeminiError(err)) {
        console.warn(`[Gemini Fallback] ${model} thất bại, đang thử model kế tiếp.`);
        continue;
      }
      throw err;
    }
  }
  throw normalizeGeminiError(lastError || new Error('Không thể kết nối đến mô hình Gemini Flash khả dụng.'));
}

/**
 * Helper gọi generateContentStream với fallback tự động.
 * Returns { responseStream, modelUsed } so the wrapper can record usage
 * after the stream is fully consumed.
 */
async function executeGenerateStream(client, contents, config, modelOverride = null, customCtx = {}) {
  const preferredModel = modelOverride || GEMINI_MODELS.primary;
  const fallbackModels = getPrioritizedFallbackModels(preferredModel);
  const triedModels = new Set();
  let lastError = null;

  for (const model of fallbackModels) {
    if (triedModels.has(model)) continue;
    triedModels.add(model);
    const ctx = getAiContext();
    const finalUserId = customCtx.userId !== undefined ? customCtx.userId : ctx.userId;
    const finalPurpose = customCtx.purpose || ctx.purpose || 'chat';
    const usageEventId = await beginAiUsageEvent({
      userId: finalUserId,
      purpose: finalPurpose,
      model
    });

    try {
      const responseStream = await client.models.generateContentStream({
        model,
        contents,
        config
      });
      return { responseStream, modelUsed: model, usageEventId, finalUserId, finalPurpose };
    } catch (err) {
      lastError = err;
      await failAiUsageEvent({ eventId: usageEventId, error: err });
      recordAiProviderIncident({ error: err, model, purpose: finalPurpose });
      recordGeminiQuotaSignal({ error: err, model });
      if (isRetryableGeminiError(err)) {
        console.warn(`[Gemini Stream Fallback] ${model} thất bại, đang thử model kế tiếp.`);
        continue;
      }
      throw err;
    }
  }
  throw normalizeGeminiError(lastError || new Error('Không thể kết nối đến mô hình Gemini Flash Stream khả dụng.'));
}

/**
 * Adapter cho mô hình Generative Gemini Flash
 * Cung cấp đầy đủ interface: generateContent, generateContentStream, countTokens
 * Tương thích 100% với toàn bộ 6 file nghiệp vụ gọi Gemini.
 */
const geminiModel = {
  async generateContent(request) {
    const client = getAiClient();
    const { contents, config, model, purpose, userId } = normalizeRequest(request);

    try {
      const response = await executeGenerate(client, contents, config, model, { purpose, userId });
      const responseText = response.text || "";

      // Trả về cấu trúc tương thích cả SDK mới và cú pháp cũ (result.response.text())
      return {
        text: () => responseText,
        response: {
          text: () => responseText,
          candidates: response.candidates || [],
          usageMetadata: response.usageMetadata || null
        },
        candidates: response.candidates || [],
        usageMetadata: response.usageMetadata || null
      };
    } catch (error) {
      console.error(`[Gemini Model Error] Lỗi khi gọi generateContent:`, error.message);
      throw error;
    }
  },

  async generateContentStream(request) {
    const client = getAiClient();
    const { contents, config, model, purpose, userId } = normalizeRequest(request);

    try {
      const {
        responseStream,
        modelUsed,
        usageEventId,
        finalUserId,
        finalPurpose
      } = await executeGenerateStream(client, contents, config, model, { purpose, userId });
      resolveAiProviderIncident({ model: modelUsed, purpose: finalPurpose });

      // Tạo Async Generator bọc các chunk, ghi nhận usage khi stream kết thúc
      async function* wrapStream() {
        let lastUsageMetadata = null;
        try {
          for await (const chunk of responseStream) {
            const chunkText = typeof chunk.text === "function" ? chunk.text() : (chunk.text || "");
            // Capture usageMetadata from the last chunk that has it
            if (chunk.usageMetadata) lastUsageMetadata = chunk.usageMetadata;
            yield {
              text: () => chunkText,
              candidates: chunk.candidates || [],
              usageMetadata: chunk.usageMetadata || null
            };
          }
          // Responses without usageMetadata still close the request successfully.
          await recordAiUsage({
            eventId: usageEventId,
            userId: finalUserId,
            purpose: finalPurpose,
            model: modelUsed,
            usageMetadata: lastUsageMetadata
          });
        } catch (streamError) {
          await failAiUsageEvent({ eventId: usageEventId, error: streamError });
          throw streamError;
        }
      }

      const streamIterable = wrapStream();

      return {
        stream: streamIterable,
        [Symbol.asyncIterator]() {
          return streamIterable[Symbol.asyncIterator]();
        }
      };
    } catch (error) {
      console.error(`[Gemini Model Error] Lỗi khi gọi generateContentStream:`, error.message);
      throw error;
    }
  },

  async countTokens(request) {
    let contents;
    if (typeof request === "string") {
      contents = request;
    } else if (request && request.contents) {
      contents = request.contents;
    } else {
      contents = request || "";
    }

    try {
      const client = getAiClient();
      const modelName = GEMINI_MODELS.primary;
      const response = await client.models.countTokens({
        model: modelName,
        contents
      });

      return {
        totalTokens: response.totalTokens !== undefined ? response.totalTokens : 0
      };
    } catch (error) {
      recordGeminiQuotaSignal({ error, model: GEMINI_MODELS.primary });
      // Fallback an toàn ước lượng token (1 token ~ 4 ký tự)
      const strLength = typeof contents === "string" ? contents.length : JSON.stringify(contents).length;
      return { totalTokens: Math.max(1, Math.ceil(strLength / 4)) };
    }
  }
};

/**
 * Adapter cho mô hình Embedding Vector (gemini-embedding-001)
 * Tạo vector 768 chiều khớp với Pinecone Index elearning-rag
 */
const embeddingModel = {
  async embedContent({ content, outputDimensionality = 768, userId, purpose = 'embedding' }) {
    const client = getAiClient();
    let textToEmbed = "";
    if (typeof content === "string") {
      textToEmbed = content;
    } else if (content && content.parts && Array.isArray(content.parts) && content.parts.length > 0) {
      textToEmbed = content.parts[0].text || "";
    } else if (typeof content === "object") {
      textToEmbed = JSON.stringify(content);
    }

    const modelName = process.env.EMBEDDING_MODEL || "gemini-embedding-001";
    const ctx = getAiContext();
    const finalUserId = userId !== undefined ? userId : ctx.userId;
    const finalPurpose = purpose || ctx.purpose || 'embedding';
    const usageEventId = await beginAiUsageEvent({
      userId: finalUserId,
      purpose: finalPurpose,
      model: modelName
    });

    try {
      const response = await client.models.embedContent({
        model: modelName,
        contents: textToEmbed,
        config: {
          outputDimensionality: outputDimensionality || 768
        }
      });

      // Record real embedding usage
      resolveAiProviderIncident({ model: modelName, purpose: finalPurpose });
      await recordAiUsage({
        eventId: usageEventId,
        userId: finalUserId,
        purpose: finalPurpose,
        model: modelName,
        usageMetadata: response.usageMetadata
      });

      // Hỗ trợ cả 2 định dạng response từ SDK (@google/genai: embeddings[0].values hoặc embedding.values)
      const values = response.embeddings?.[0]?.values || response.embedding?.values || [];
      return {
        embedding: {
          values
        }
      };
    } catch (error) {
      console.error(`[Embedding Model Error] Lỗi khi tạo vector từ ${modelName}:`, error.message);
      await failAiUsageEvent({ eventId: usageEventId, error });
      recordAiProviderIncident({ error, model: modelName, purpose: finalPurpose });
      recordGeminiQuotaSignal({ error, model: modelName });
      throw normalizeGeminiError(error);
    }
  }
};

// Khởi tạo Pinecone Client (chỉ khởi tạo khi có PINECONE_API_KEY hợp lệ để tránh lỗi 401 spam console)
let pc = null;
let pineconeIndex = null;

if (pineconeApiKey && pineconeApiKey !== 'dummy-pinecone-key' && pineconeApiKey.trim() !== '') {
  try {
    pc = new Pinecone({ apiKey: pineconeApiKey });
    pineconeIndex = pc.index(pineconeIndexName);
  } catch (err) {
    console.warn(`[Pinecone Init Warning] Không thể kết nối Pinecone Index: ${err.message}`);
  }
}

const pineconeClient = {
  async search(question, lessonId) {
    console.log(`[Pinecone Client] Đang tìm kiếm vector cho câu hỏi: "${question}" (lessonId: ${lessonId})`);
    try {
      if (!question) {
        return "";
      }

      // 1. Tạo embedding cho câu hỏi
      const embeddingResult = await embeddingModel.embedContent({
        content: { parts: [{ text: question }] },
        outputDimensionality: 768
      });
      const embeddingValues = embeddingResult.embedding?.values;

      if (!embeddingValues || embeddingValues.length === 0) {
        throw new Error("Không thể tạo vector embedding từ câu hỏi.");
      }

      // 2. Thiết lập query options
      const queryOptions = {
        vector: embeddingValues,
        topK: 5,
        includeMetadata: true,
      };

      // Thêm bộ lọc lesson_id nếu được cung cấp
      if (lessonId) {
        queryOptions.filter = {
          lesson_id: { $eq: Number(lessonId) }
        };
      }

      // 3. Thực hiện truy vấn trên Pinecone Index
      const queryResponse = await pineconeIndex.query(queryOptions);

      const matches = queryResponse.matches || [];
      if (matches.length === 0) {
        console.log("[Pinecone Client] Không tìm thấy tài liệu phù hợp trong vector database.");
        return "";
      }

      // 4. Trích xuất text/context từ metadata của các kết quả khớp
      const context = matches
        .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
        .filter(Boolean)
        .join("\n\n");

      return context;
    } catch (error) {
      console.error("[Pinecone Client Error]:", error);
      throw error;
    }
  }
};

const geminiClient = {
  async generateResponse(question, context) {
    console.log(`[Gemini Client] Gửi prompt lên Gemini Model...`);
    try {
      const prompt = `Bạn là một trợ lý giảng dạy tiếng Anh thông minh của hệ thống E-learning. 
Hãy trả lời câu hỏi của học viên dựa trên tài liệu học tập được cung cấp dưới đây. 
Nếu tài liệu học tập không chứa câu trả lời hoặc không liên quan, hãy trả lời một cách chính xác nhất dựa trên kiến thức tiếng Anh của bạn và lưu ý nhỏ với học viên là bạn đang giải thích thêm ngoài tài liệu bài học.

Tài liệu học tập bổ trợ (Context):
${context || "Không tìm thấy tài liệu cụ thể nào liên quan trực tiếp đến bài học này."}

Câu hỏi của học viên:
"${question}"

Hãy trả lời một cách tự nhiên, dễ hiểu, định dạng markdown đẹp mắt:`;

      const result = await geminiModel.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("[Gemini Client Error]:", error);
      throw error;
    }
  },
  async generateStreamResponse(prompt) {
    console.log(`[Gemini Client] Gửi content stream prompt lên Gemini Model...`);
    try {
      const result = await geminiModel.generateContentStream(prompt);
      return result.stream;
    } catch (error) {
      console.error("[Gemini Client Stream Error]:", error);
      throw error;
    }
  }
};

function getSpeakingModelName() {
  return GEMINI_MODELS.speaking;
}

// Log an toàn khi khởi động (không lộ key)
console.log(`[AI Speaking] Model configured: ${getSpeakingModelName()}`);

const geminiSpeakingModel = {
  async evaluateSpeaking({ contents, responseMimeType = "application/json", userId, purpose = 'speaking_stt' }) {
    const client = getAiClient();
    const model = getSpeakingModelName();
    const ctx = getAiContext();
    const finalUserId = userId !== undefined ? userId : ctx.userId;
    const finalPurpose = purpose || 'speaking_stt';
    const usageEventId = await beginAiUsageEvent({
      userId: finalUserId,
      purpose: finalPurpose,
      model
    });
    const config = {
      responseMimeType
    };

    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config
      });

      // Record real speaking assessment usage
      await recordAiUsage({
        eventId: usageEventId,
        userId: finalUserId,
        purpose: finalPurpose,
        model,
        usageMetadata: response.usageMetadata
      });

      const responseText = response.text || "";
      return {
        text: () => responseText,
        responseText,
        modelUsed: model
      };
    } catch (error) {
      console.error(`[Gemini Speaking Model Error] (${model}):`, error.message);
      await failAiUsageEvent({ eventId: usageEventId, error });
      recordGeminiQuotaSignal({ error, model });
      // Không âm thầm fallback sang model khác để bảo đảm tính nhất quán của chuẩn chấm điểm
      throw normalizeGeminiError(error);
    }
  }
};

module.exports = {
  ai,
  getAiClient,
  getSpeakingModelName,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_SPEAKING_MODEL,
  COST_PER_M_TOKENS,
  isGeminiQuotaError,
  isRetryableGeminiError,
  normalizeGeminiError,
  isRagPurpose,
  recordAiProviderIncident,
  resolveAiProviderIncident,
  parseGeminiQuotaViolation,
  recordGeminiQuotaSignal,
  runWithAiContext,
  beginAiUsageEvent,
  recordAiUsage,
  failAiUsageEvent,
  normalizeRequest,
  getGeminiFallbackModels,
  geminiModel,
  geminiSpeakingModel,
  embeddingModel,
  pc,
  pineconeIndex,
  pineconeClient,
  geminiClient
};
