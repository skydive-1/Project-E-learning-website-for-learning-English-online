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
const { notifyOperationalAlertsChanged } = require('./operationalAlertEvents');
const { notifyAiRateLimitsChanged } = require('./aiRateLimitEvents');
const {
  DEFAULT_RETRY_PROFILES,
  executeWithExponentialBackoff,
  resolveRetryProfile
} = require('./exponentialBackoff');
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
    notifyAiRateLimitsChanged('ai-usage-started');
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
  let eventPersisted = false;
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
    eventPersisted = true;

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
  } finally {
    if (eventPersisted) {
      notifyOperationalAlertsChanged('ai-usage-success');
      notifyAiRateLimitsChanged('ai-usage-success');
    }
  }
}

// ─── Gemini Client Initialization ──────────────────────────────────────────

let activePreferredModel = null;
const manuallyLockedModels = new Set();

async function initPreferredGeminiModelFromDb() {
  try {
    const res = await db.query(
      `SELECT model, is_preferred, is_locked FROM ai_model_rate_limit_settings`
    );
    for (const row of res.rows || []) {
      const model = String(row.model || '').trim();
      if (!model) continue;
      if (row.is_preferred) {
        activePreferredModel = model;
        console.log(`[AI Model Routing] Khởi tạo model ưu tiên từ DB: ${activePreferredModel}`);
      }
      if (row.is_locked) {
        manuallyLockedModels.add(model);
        console.log(`[AI Model Routing] Khởi tạo model bị khóa thủ công từ DB: ${model}`);
      }
    }
  } catch (_err) {
    // Non-fatal if column or table not available
  }
}
initPreferredGeminiModelFromDb();

function getActivePreferredModel() {
  return activePreferredModel || GEMINI_MODELS.routingPrimary;
}

function getGeminiFallbackModels(preferredModel) {
  const primaryModel = preferredModel || getActivePreferredModel();
  return Array.from(new Set([
    primaryModel,
    GEMINI_MODELS.routingPrimary,
    GEMINI_MODELS.primary,
    ...GEMINI_MODELS.fallbacks
  ].filter(Boolean)));
}

const DEFAULT_MODEL_QUOTA_COOLDOWN_MS = 60 * 1000;
const MIN_MODEL_QUOTA_COOLDOWN_MS = 5 * 1000;
const MAX_MODEL_QUOTA_COOLDOWN_MS = 26 * 60 * 60 * 1000;
const TRANSIENT_QUOTA_BACKOFF_BASE_MS = 30 * 1000;
const TRANSIENT_QUOTA_BACKOFF_MAX_MS = 5 * 60 * 1000;
const TRANSIENT_QUOTA_STREAK_TTL_MS = 5 * 60 * 1000;
const TRANSIENT_QUOTA_JITTER_MAX_MS = 1000;
const RPD_ROUTING_REFRESH_MS = 15 * 1000;

const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const pacificDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PACIFIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Trạng thái này chỉ điều phối request trong process hiện tại; không tạo probe Gemini riêng.
const modelQuotaCooldown = new Map();
const modelQuotaFailureStreak = new Map();
const observedRpdUsage = new Map();
let rpdRoutingRefreshExpiresAt = 0;
let rpdRoutingRefreshModelsKey = '';
let rpdRoutingRefreshPromise = null;
let pacificResetCache = { day: null, resetAt: 0 };
let lastSuccessfulGeminiModel = null;
let lastSuccessfulGeminiAt = null;
let lastManualRoutingResetAt = null;
let lastFallbackEvent = null;

function getPacificDayKey(timestamp = Date.now()) {
  return pacificDayFormatter.format(new Date(timestamp));
}

function getNextPacificRpdResetAt(now = Date.now()) {
  const currentDay = getPacificDayKey(now);
  if (pacificResetCache.day === currentDay && pacificResetCache.resetAt > now) {
    return pacificResetCache.resetAt;
  }
  let cursor = Math.floor(now / 60_000) * 60_000 + 60_000;
  const searchLimit = now + MAX_MODEL_QUOTA_COOLDOWN_MS;

  while (cursor <= searchLimit) {
    if (getPacificDayKey(cursor) !== currentDay) {
      pacificResetCache = { day: currentDay, resetAt: cursor };
      return cursor;
    }
    cursor += 60_000;
  }

  return now + 24 * 60 * 60 * 1000;
}

function normalizeModelCooldownDuration(durationMs = DEFAULT_MODEL_QUOTA_COOLDOWN_MS) {
  const parsed = Number(durationMs);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MODEL_QUOTA_COOLDOWN_MS;
  return Math.min(MAX_MODEL_QUOTA_COOLDOWN_MS, Math.max(MIN_MODEL_QUOTA_COOLDOWN_MS, Math.ceil(parsed)));
}

function markModelQuotaExhausted(
  model,
  durationMs = DEFAULT_MODEL_QUOTA_COOLDOWN_MS,
  source = 'default',
  metadata = {}
) {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel) return;
  const now = Date.now();
  const cooldownMs = normalizeModelCooldownDuration(durationMs);
  const nextState = {
    markedAt: now,
    retryAt: now + cooldownMs,
    cooldownMs,
    source,
    dimension: metadata.dimension || null,
    observedUsage: Number.isFinite(Number(metadata.observedUsage))
      ? Number(metadata.observedUsage)
      : null,
    cap: Number.isFinite(Number(metadata.cap)) ? Number(metadata.cap) : null
  };
  const existing = modelQuotaCooldown.get(normalizedModel);

  // Không để một lỗi RPM ngắn ghi đè trạng thái đã biết là hết RPD đến nửa đêm Pacific.
  if (existing?.dimension === 'rpd'
    && existing.retryAt > nextState.retryAt
    && nextState.dimension !== 'rpd') {
    return;
  }

  modelQuotaCooldown.set(normalizedModel, nextState);
  notifyAiRateLimitsChanged('model-cooldown-set');
}

function clearModelQuotaCooldown(model) {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel) return false;
  db.query(
    `UPDATE ai_model_rate_limit_settings
     SET rpd_exhausted_until = NULL
     WHERE model = $1`,
    [normalizedModel]
  ).catch(() => {});
  const deleted = modelQuotaCooldown.delete(normalizedModel);
  if (deleted) {
    notifyAiRateLimitsChanged('model-cooldown-cleared');
  }
  return deleted;
}

function noteModelQuotaFailure(model, now = Date.now()) {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel) return 1;
  const previous = modelQuotaFailureStreak.get(normalizedModel);
  const count = previous && now - previous.lastFailureAt <= TRANSIENT_QUOTA_STREAK_TTL_MS
    ? Math.min(previous.count + 1, 8)
    : 1;
  modelQuotaFailureStreak.set(normalizedModel, { count, lastFailureAt: now });
  return count;
}

function recordSuccessfulGeminiModel(model) {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel) return;
  modelQuotaFailureStreak.delete(normalizedModel);
  const cooldown = modelQuotaCooldown.get(normalizedModel);
  if (cooldown?.dimension !== 'rpd') clearModelQuotaCooldown(normalizedModel);
  lastSuccessfulGeminiModel = normalizedModel;
  lastSuccessfulGeminiAt = new Date().toISOString();
}

function pruneExpiredModelCooldowns(now = Date.now()) {
  for (const [model, state] of modelQuotaCooldown.entries()) {
    if (!state?.retryAt || state.retryAt <= now) modelQuotaCooldown.delete(model);
  }
}

function getPrioritizedFallbackModels(preferredModel) {
  const models = getGeminiFallbackModels(preferredModel);
  const now = Date.now();
  pruneExpiredModelCooldowns(now);
  const available = [];
  const coolingDown = [];

  for (const m of models) {
    // Nếu model bị Admin khóa thủ công thì không đưa vào danh sách khả dụng hay coolingDown
    if (manuallyLockedModels.has(m)) {
      continue;
    }
    const cooldown = modelQuotaCooldown.get(m);
    if (cooldown?.retryAt && now < cooldown.retryAt) {
      coolingDown.push({ model: m, retryAt: cooldown.retryAt });
    } else {
      available.push(m);
    }
  }

  // Không gọi lại model đã biết đang bị quota trong khi vẫn còn model khả dụng.
  if (available.length > 0) return available;

  // Nếu mọi model khả dụng đều cooldown, chỉ thử model sắp được mở lại nhất để tránh nhân request lỗi.
  if (coolingDown.length > 0) {
    return coolingDown
      .sort((a, b) => a.retryAt - b.retryAt)
      .slice(0, 1)
      .map((item) => item.model);
  }

  // Nếu tất cả model đều bị khóa thủ công, trả về danh sách fallback để tránh sập cứng app
  return models;
}

function getGeminiModelRoutingStatus() {
  const now = Date.now();
  pruneExpiredModelCooldowns(now);
  const preferred = getActivePreferredModel();
  const fallbackOrder = getGeminiFallbackModels(preferred);
  const effectiveOrder = getPrioritizedFallbackModels(preferred);
  const coolingDown = fallbackOrder
    .map((model) => ({ model, ...modelQuotaCooldown.get(model) }))
    .filter((item) => Number.isFinite(item.retryAt) && item.retryAt > now)
    .map((item) => ({
      model: item.model,
      markedAt: new Date(item.markedAt).toISOString(),
      retryAt: new Date(item.retryAt).toISOString(),
      remainingMs: Math.max(0, item.retryAt - now),
      cooldownMs: item.cooldownMs,
      source: item.source,
      dimension: item.dimension || null,
      observedUsage: item.observedUsage,
      cap: item.cap
    }));

  const effectiveModel = effectiveOrder[0] || preferred;
  const isFallbackActive = Boolean(preferred && effectiveModel && effectiveModel !== preferred);
  const preferredCooldown = coolingDown.find((c) => c.model === preferred);
  const isPreferredLocked = manuallyLockedModels.has(preferred);

  let fallbackReason = null;
  if (isFallbackActive) {
    if (preferredCooldown) {
      if (preferredCooldown.dimension === '503_unavailable' || preferredCooldown.source === 'provider_503_service_error' || preferredCooldown.source === 'admin_simulated_503') {
        fallbackReason = `Model ưu tiên (${preferred}) gặp sự cố gián đoạn (Mã lỗi 503: Service Unavailable / Quá tải)`;
      } else if (preferredCooldown.dimension === 'rpd') {
        fallbackReason = `Model ưu tiên (${preferred}) đã chạm hạn mức ngày (RPD) của Google API`;
      } else {
        fallbackReason = `Model ưu tiên (${preferred}) đang trong thời gian chờ cooldown tạm thời`;
      }
    } else if (isPreferredLocked) {
      fallbackReason = `Model ưu tiên (${preferred}) đang bị Admin khóa thủ công`;
    } else if (lastFallbackEvent && lastFallbackEvent.fromModel === preferred) {
      fallbackReason = lastFallbackEvent.reason;
    } else {
      fallbackReason = `Model ưu tiên (${preferred}) tạm thời gián đoạn, hệ thống tự động chuyển sang model dự phòng`;
    }
  }

  return {
    scope: 'process_instance',
    preferredModel: preferred,
    effectiveModel,
    fallbackOrder,
    effectiveOrder,
    lastSuccessfulModel: lastSuccessfulGeminiModel,
    lastSuccessfulAt: lastSuccessfulGeminiAt,
    lastManualResetAt: lastManualRoutingResetAt,
    isCustomPreferred: Boolean(activePreferredModel && activePreferredModel !== GEMINI_MODELS.routingPrimary),
    defaultPreferredModel: GEMINI_MODELS.routingPrimary,
    lockedModels: Array.from(manuallyLockedModels),
    coolingDown,
    isFallbackActive,
    activeFallbackModel: isFallbackActive ? effectiveModel : null,
    fallbackReason,
    lastFallbackEvent
  };
}

function resetGeminiModelRouting({ all = false, force = false } = {}) {
  const preferred = getActivePreferredModel();
  if (all || force) {
    modelQuotaCooldown.clear();
    modelQuotaFailureStreak.clear();
    observedRpdUsage.clear();
    rpdRoutingRefreshExpiresAt = 0;
    rpdRoutingRefreshModelsKey = '';
    db.query(`UPDATE ai_model_rate_limit_settings SET rpd_exhausted_until = NULL WHERE rpd_exhausted_until IS NOT NULL`).catch(() => {});
  }
  else {
    clearModelQuotaCooldown(preferred);
    modelQuotaFailureStreak.delete(preferred);
  }
  lastManualRoutingResetAt = new Date().toISOString();
  lastFallbackEvent = null;
  notifyAiRateLimitsChanged('ai-routing-reset');
  return getGeminiModelRoutingStatus();
}

function simulateAiModelFallback({ model, simulatedError = 503 } = {}) {
  const targetModel = String(model || getActivePreferredModel()).trim();
  const fallbackModels = getGeminiFallbackModels(targetModel);
  const fallbackCandidate = fallbackModels.find((m) => m !== targetModel && !manuallyLockedModels.has(m)) || fallbackModels[1] || 'gemini-3.6-flash';

  const durationMs = 60 * 1000;
  markModelQuotaExhausted(targetModel, durationMs, 'admin_simulated_503', {
    dimension: '503_unavailable'
  });

  lastFallbackEvent = {
    fromModel: targetModel,
    toModel: fallbackCandidate,
    reason: `Mô phỏng phản biện: Lỗi ${simulatedError} (Service Unavailable / Quá tải)`,
    errorCode: Number(simulatedError) || 503,
    at: new Date().toISOString()
  };

  notifyAiRateLimitsChanged('model-fallback-simulated');

  return {
    success: true,
    fromModel: targetModel,
    toModel: fallbackCandidate,
    errorCode: Number(simulatedError) || 503,
    reason: lastFallbackEvent.reason,
    routing: getGeminiModelRoutingStatus()
  };
}

async function setPreferredGeminiModel(model, { adminUserId = null } = {}) {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel) {
    const error = new Error('Tên model không được để trống.');
    error.status = 400;
    throw error;
  }

  activePreferredModel = normalizedModel;

  // Khi admin chủ động chọn model ưu tiên, xóa ngay mọi cooldown tạm thời của model đó
  clearModelQuotaCooldown(normalizedModel);

  try {
    await db.query(
      `UPDATE ai_model_rate_limit_settings SET is_preferred = (model = $1)`,
      [normalizedModel]
    );
  } catch (dbErr) {
    console.warn('[AI Model Routing] Không thể lưu is_preferred vào DB (non-fatal):', dbErr.message);
  }

  console.info(`[AI Model Routing] Admin ${adminUserId || 'unknown'} đã chọn model ưu tiên điều phối: ${normalizedModel}`);
  return getGeminiModelRoutingStatus();
}

async function setAiModelManualLock(model, locked, { adminUserId = null, reason = null } = {}) {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel) {
    const error = new Error('Tên model không được để trống.');
    error.status = 400;
    throw error;
  }

  const isLocking = Boolean(locked);
  if (isLocking) {
    manuallyLockedModels.add(normalizedModel);
    clearModelQuotaCooldown(normalizedModel);
  } else {
    manuallyLockedModels.delete(normalizedModel);
    clearModelQuotaCooldown(normalizedModel);
  }

  try {
    await db.query(
      `UPDATE ai_model_rate_limit_settings
       SET is_locked = $1,
           locked_at = (CASE WHEN $1 THEN NOW() ELSE NULL END),
           locked_by = (CASE WHEN $1 THEN $2::int ELSE NULL END),
           lock_reason = (CASE WHEN $1 THEN $3::text ELSE NULL END),
           rpd_exhausted_until = NULL
       WHERE model = $4`,
      [isLocking, adminUserId ? Number(adminUserId) : null, reason ? String(reason).trim().slice(0, 500) : null, normalizedModel]
    );
  } catch (dbErr) {
    console.warn('[AI Model Routing] Không thể lưu is_locked vào DB (non-fatal):', dbErr.message);
  }

  console.info(`[AI Model Routing] Admin ${adminUserId || 'unknown'} đã ${isLocking ? 'KHÓA' : 'MỞ KHÓA'} model: ${normalizedModel}`);
  return getGeminiModelRoutingStatus();
}

function isAiModelManuallyLocked(model) {
  return manuallyLockedModels.has(String(model || '').trim());
}

function applyObservedGeminiRpdUsage(models = [], { now = Date.now() } = {}) {
  const resetAt = getNextPacificRpdResetAt(now);
  const pacificDay = getPacificDayKey(now);

  for (const item of models) {
    const model = String(item?.model || '').trim();
    const usage = Number(item?.usage?.rpd ?? item?.rpdCurrent ?? item?.rpd_current);
    const cap = Number(item?.caps?.rpd ?? item?.rpdCap ?? item?.rpd_cap);
    const rpdExhaustedUntil = item?.rpdExhaustedUntil ?? item?.rpd_exhausted_until;

    if (rpdExhaustedUntil) {
      const retryAt = new Date(rpdExhaustedUntil).getTime();
      if (Number.isFinite(retryAt) && retryAt > now) {
        markModelQuotaExhausted(
          model,
          Math.max(MIN_MODEL_QUOTA_COOLDOWN_MS, retryAt - now),
          'db_persisted_rpd_exhaustion',
          { dimension: 'rpd', observedUsage: usage, cap }
        );
      }
    }

    if (!model || !Number.isFinite(cap) || cap <= 0 || !Number.isFinite(usage) || usage < 0) {
      continue;
    }

    observedRpdUsage.set(model, { usage, cap, resetAt, pacificDay });
    const currentCooldown = modelQuotaCooldown.get(model);

    // ai_usage_events là số lần backend thử gọi, gồm cả request bị Google từ chối.
    // Vì vậy usage nội bộ chỉ dùng để hiển thị telemetry, không được tự kết luận
    // project đã hết RPD. Chỉ phản hồi quota có cấu trúc từ provider mới điều phối cooldown.
    if (currentCooldown?.source === 'backend_observed_rpd_cap') {
      clearModelQuotaCooldown(model);
    }
  }

  return getGeminiModelRoutingStatus();
}

function noteObservedGeminiAttempt(model, now = Date.now()) {
  const normalizedModel = String(model || '').trim();
  const state = observedRpdUsage.get(normalizedModel);
  if (!state) return;

  if (state.pacificDay !== getPacificDayKey(now) || state.resetAt <= now) {
    observedRpdUsage.delete(normalizedModel);
    const cooldown = modelQuotaCooldown.get(normalizedModel);
    if (cooldown?.source === 'backend_observed_rpd_cap') clearModelQuotaCooldown(normalizedModel);
    return;
  }

  state.usage += 1;
}

async function refreshObservedGeminiRpdRouting(models) {
  const normalizedModels = Array.from(new Set(
    (models || []).map((model) => String(model || '').trim()).filter(Boolean)
  ));
  const modelsKey = normalizedModels.slice().sort().join('|');
  const now = Date.now();

  if (!modelsKey || (modelsKey === rpdRoutingRefreshModelsKey && now < rpdRoutingRefreshExpiresAt)) {
    return;
  }
  if (rpdRoutingRefreshPromise) {
    await rpdRoutingRefreshPromise;
    return;
  }

  rpdRoutingRefreshPromise = (async () => {
    try {
      const result = await db.query(`
        WITH bounds AS (
          SELECT date_trunc('day', NOW() AT TIME ZONE '${PACIFIC_TIME_ZONE}') AS pacific_today
        )
        SELECT
          s.model,
          s.rpd_cap,
          s.rpd_exhausted_until,
          COUNT(e.id)::int AS rpd_current
        FROM ai_model_rate_limit_settings s
        CROSS JOIN bounds b
        LEFT JOIN ai_usage_events e
          ON e.model = s.model
         AND date_trunc('day', e.created_at AT TIME ZONE '${PACIFIC_TIME_ZONE}') = b.pacific_today
        WHERE s.model = ANY($1::text[])
        GROUP BY s.model, s.rpd_cap, s.rpd_exhausted_until
      `, [normalizedModels]);

      for (const row of result.rows || []) {
        if (row.rpd_exhausted_until) {
          const retryAt = new Date(row.rpd_exhausted_until).getTime();
          if (Number.isFinite(retryAt) && retryAt > now) {
            markModelQuotaExhausted(
              row.model,
              Math.max(MIN_MODEL_QUOTA_COOLDOWN_MS, retryAt - now),
              'db_persisted_rpd_exhaustion',
              { dimension: 'rpd', cap: row.rpd_cap }
            );
          }
        }
      }

      applyObservedGeminiRpdUsage(result.rows || [], { now: Date.now() });
      rpdRoutingRefreshModelsKey = modelsKey;
      rpdRoutingRefreshExpiresAt = Date.now() + RPD_ROUTING_REFRESH_MS;
    } catch (error) {
      // Telemetry nội bộ chỉ là lớp phòng ngừa. Khi DB lỗi, fallback 429 của Google vẫn hoạt động.
      console.warn('[Gemini RPD Guard] Không đọc được usage nội bộ; tiếp tục dùng provider fallback:', error.message);
      rpdRoutingRefreshExpiresAt = Date.now() + RPD_ROUTING_REFRESH_MS;
    } finally {
      rpdRoutingRefreshPromise = null;
    }
  })();

  await rpdRoutingRefreshPromise;
}

async function getQuotaAwareFallbackModels(preferredModel) {
  const models = getGeminiFallbackModels(preferredModel);
  await refreshObservedGeminiRpdRouting(models);
  return getPrioritizedFallbackModels(preferredModel);
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

const getGeminiHttpStatus = (error) => {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.response?.data?.error?.code,
    error?.cause?.status,
    error?.cause?.statusCode
  ];
  const status = candidates.map(Number).find((value) => Number.isInteger(value) && value >= 100 && value <= 599);
  return status || null;
};

const getGeminiErrorCode = (error) => {
  const status = getGeminiHttpStatus(error);
  if (status) return String(status);
  const rawCode = error?.code
    || error?.response?.data?.error?.status
    || error?.cause?.code
    || error?.name
    || 'PROVIDER_ERROR';
  return String(rawCode).trim().slice(0, 100) || 'PROVIDER_ERROR';
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
  let structuredDetail = '';
  try {
    structuredDetail = JSON.stringify(error?.response?.data || error?.errorDetails || error?.details || '');
  } catch (_serializationError) {
    structuredDetail = '';
  }
  const retryText = `${String(error?.message || '')} ${structuredDetail}`;
  const retryMatch = retryText.match(/retry in\s+(\d+(?:\.\d+)?)s/i)
    || retryText.match(/retry(?:Delay)?[\\"'\s:=]+(\d+(?:\.\d+)?)s/i);
  if (retryMatch) quotaError.retryAfterMs = Math.ceil(Number(retryMatch[1]) * 1000);
  return quotaError;
};

const getGeminiQuotaCooldown = (
  error,
  fallbackModel = null,
  { transientFailureCount = 1, jitterMs = 0 } = {}
) => {
  const normalized = normalizeGeminiError(error);
  const retryAfterMs = Number(normalized?.retryAfterMs);
  const parsed = parseGeminiQuotaViolation(error, fallbackModel);
  const isRpdExhausted = parsed?.dimension === 'rpd';

  if (isRpdExhausted) {
    const now = Date.now();
    const providerResetAt = Number(parsed?.providerResetAt);
    if (Number.isFinite(providerResetAt) && providerResetAt > now) {
      const resetAt = providerResetAt + 1000;
      return {
        durationMs: normalizeModelCooldownDuration(resetAt - now),
        source: 'provider_rpd_reset_timestamp',
        dimension: 'rpd',
        retryAt: resetAt
      };
    }

    // RetryInfo là chỉ dẫn trực tiếp cho request vừa thất bại. Tôn trọng chỉ dẫn này
    // để model có cơ hội half-open bằng request thật, kể cả khi quotaId ghi RPD.
    // Nếu Google tiếp tục trả 429, model sẽ lại cooldown và fallback vẫn phục vụ user.
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      const resetAt = now + retryAfterMs + 1000;
      return {
        durationMs: normalizeModelCooldownDuration(resetAt - now),
        source: 'provider_rpd_retry_after',
        dimension: 'rpd',
        retryAt: resetAt
      };
    }

    const pacificResetAt = getNextPacificRpdResetAt(now) + 1000;
    return {
      durationMs: normalizeModelCooldownDuration(pacificResetAt - now),
      source: 'provider_rpd_pacific_reset',
      dimension: 'rpd',
      retryAt: pacificResetAt
    };
  }

  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    // Chừa một giây nhỏ để không gọi đúng sát biên retry-after của provider.
    return {
      durationMs: normalizeModelCooldownDuration(retryAfterMs + 1000),
      source: 'provider_retry_after',
      dimension: parsed?.dimension || null
    };
  }
  const failureCount = Math.max(1, Math.min(8, Math.floor(Number(transientFailureCount) || 1)));
  const exponentialDelay = Math.min(
    TRANSIENT_QUOTA_BACKOFF_MAX_MS,
    TRANSIENT_QUOTA_BACKOFF_BASE_MS * (2 ** (failureCount - 1))
  );
  const safeJitterMs = Math.max(
    0,
    Math.min(TRANSIENT_QUOTA_JITTER_MAX_MS, Math.floor(Number(jitterMs) || 0))
  );
  return {
    durationMs: normalizeModelCooldownDuration(exponentialDelay + safeJitterMs),
    source: 'provider_transient_backoff',
    dimension: parsed?.dimension || null
  };
};

const getGeminiRetryDecision = (error, model = null) => {
  if (!isRetryableGeminiError(error)) {
    return { retryable: false, reason: 'non_retryable_error', retryAfterMs: 0 };
  }

  if (getGeminiHttpStatus(error) === 404) {
    return { retryable: false, reason: 'model_not_available', retryAfterMs: 0 };
  }

  const parsedQuota = isGeminiQuotaError(error)
    ? parseGeminiQuotaViolation(error, model)
    : null;
  if (parsedQuota?.dimension === 'rpd') {
    return { retryable: false, reason: 'daily_quota_exhausted', retryAfterMs: 0 };
  }

  const normalized = normalizeGeminiError(error);
  return {
    retryable: true,
    reason: parsedQuota?.dimension === 'rpm'
      ? 'rate_limit_rpm'
      : getGeminiHttpStatus(error) === 429 || isGeminiQuotaError(error)
        ? 'rate_limit_transient'
        : 'provider_transient',
    retryAfterMs: Math.max(0, Number(normalized?.retryAfterMs || 0))
  };
};

const getGeminiRetryPolicySnapshot = () => ({
  source: 'backend_runtime_policy',
  algorithm: 'bounded_exponential_backoff_with_jitter',
  profiles: Object.fromEntries(
    Object.entries(DEFAULT_RETRY_PROFILES).map(([key, value]) => [key, { ...value }])
  ),
  retryableHttpStatuses: [408, 429, 500, 502, 503, 504],
  nonRetryableQuotaDimension: 'rpd',
  honorsProviderRetryAfter: true
});

async function runTrackedGeminiOperation({
  model,
  purpose,
  operation,
  userId,
  invoke,
  policyOverrides = {}
}) {
  const profile = {
    ...resolveRetryProfile({ purpose, operation }),
    ...policyOverrides
  };
  let failedUsageEventId = null;

  return executeWithExponentialBackoff(async () => {
    noteObservedGeminiAttempt(model);
    const usageEventId = await beginAiUsageEvent({ userId, purpose, model });
    try {
      const value = await invoke();
      return { value, usageEventId };
    } catch (error) {
      failedUsageEventId = usageEventId;
      await failAiUsageEvent({ eventId: usageEventId, error });
      recordAiProviderIncident({ error, model, purpose });
      recordGeminiQuotaSignal({ error, model });
      throw error;
    }
  }, {
    ...profile,
    shouldRetry: (error) => getGeminiRetryDecision(error, model),
    onRetry: async ({ error, retryAttempt, delayMs, source, decision }) => {
      await recordAiRetryEvent({
        usageEventId: failedUsageEventId,
        userId,
        purpose,
        operation,
        model,
        retryAttempt,
        maxRetries: profile.maxRetries,
        delayMs,
        delaySource: source,
        reason: decision.reason,
        error
      });
      console.warn(
        `[Gemini Retry] operation=${operation}, model=${model}, attempt=${retryAttempt}/${profile.maxRetries}, `
        + `delayMs=${delayMs}, reason=${decision.reason}.`
      );
    },
    onRetrySkipped: ({ reason, delayMs, decision }) => {
      console.warn(
        `[Gemini Retry] Bỏ qua retry operation=${operation}, model=${model}, `
        + `delayMs=${delayMs}, reason=${reason}, providerReason=${decision.reason}.`
      );
    }
  });
}

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
    const errorCode = getGeminiErrorCode(error);

    await db.query(
      `UPDATE ai_usage_events
       SET request_status = 'error',
           error_code = $2,
           completed_at = NOW()
       WHERE id = $1`,
      [eventId, errorCode]
    );
    notifyOperationalAlertsChanged('ai-usage-error');
    notifyAiRateLimitsChanged('ai-usage-error');
  } catch (err) {
    console.error('[AI Usage Recording] Failed to close failed event (non-fatal):', err.message);
  }
}

async function recordAiRetryEvent({
  usageEventId = null,
  userId = null,
  purpose = 'unknown',
  operation = 'generate',
  model,
  retryAttempt,
  maxRetries,
  delayMs,
  delaySource,
  reason,
  error
}) {
  try {
    await db.query(
      `INSERT INTO ai_retry_events
         (usage_event_id, user_id, purpose, operation, model, retry_attempt,
          max_retries, delay_ms, delay_source, retry_reason, error_code, http_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        usageEventId || null,
        userId || null,
        String(purpose || 'unknown').slice(0, 120),
        String(operation || 'generate').slice(0, 32),
        String(model || 'unknown').slice(0, 160),
        Math.max(1, Number(retryAttempt) || 1),
        Math.max(0, Number(maxRetries) || 0),
        Math.max(0, Math.ceil(Number(delayMs) || 0)),
        String(delaySource || 'exponential_backoff').slice(0, 40),
        String(reason || 'provider_transient').slice(0, 80),
        getGeminiErrorCode(error),
        getGeminiHttpStatus(error)
      ]
    );
    notifyAiRateLimitsChanged('ai-retry-scheduled');
  } catch (retryTelemetryError) {
    console.warn('[AI Retry Telemetry] Không thể lưu lần retry (non-fatal):', retryTelemetryError.message);
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

  const source = {
    message: error?.message,
    status: error?.status,
    code: error?.code,
    ...(error?.response?.data && typeof error?.response?.data === 'object' ? error.response.data : {}),
    ...(Array.isArray(error?.errorDetails) ? { errorDetails: error.errorDetails } : {}),
    ...(Array.isArray(error?.details) ? { details: error.details } : (error?.details && typeof error?.details === 'object' ? error.details : {})),
    ...(error?.body && typeof error?.body === 'object' ? error.body : {})
  };
  const rawDetail = sanitizeQuotaDetail(source);
  const entries = flattenQuotaDetail(rawDetail);
  const searchable = entries.map((entry) => `${entry.path}=${entry.value}`).join('\n');
  const normalized = searchable.toLowerCase().replace(/[\s_.:/-]+/g, '');

  // Chỉ xem là RPD khi provider nêu rõ "per day"/"daily"/"RPD". Tên metric
  // chung generate_content_free_tier_requests không đủ để phân biệt RPM và RPD.
  let dimension = null;
  if (/tpm|tokens?perminute/.test(normalized)) dimension = 'tpm';
  else if (/rpm|requests?perminute/.test(normalized)) dimension = 'rpm';
  else if (/rpd|requests?perday|dailyrequests?|requests?daily|perdayperproject/.test(normalized)) dimension = 'rpd';
  if (!dimension) return null;

  const knownModels = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-embedding-001'];
  const matchedKnownModel = knownModels.find((km) => new RegExp(`\\b${km.replace(/\./g, '\\.')}\\b`, 'i').test(searchable));
  const modelEntry = entries.find((entry) => /(^|\.)model(name)?$/i.test(entry.path) && String(entry.value).toLowerCase() !== 'gemini-api');
  const modelMatch = searchable.match(/gemini-(?!api\b)[a-z0-9._-]+/i);
  const rawModel = String(matchedKnownModel || modelEntry?.value || modelMatch?.[0] || fallbackModel || '').trim();
  const model = rawModel.toLowerCase() === 'gemini-api' ? (fallbackModel || '') : rawModel;
  if (!model) return null;

  const limitEntry = entries.find((entry) => (
    /quota(value|limit)|limit(value)?|allowed(value)?|maximum/i.test(entry.path)
    && /^\d+$/.test(entry.value)
    && Number(entry.value) > 0
  ));
  const messageLimitMatch = searchable.match(/limit:\s*(\d+)/i);
  const providerLimit = limitEntry ? Number(limitEntry.value) : (messageLimitMatch ? Number(messageLimitMatch[1]) : null);
  const resetEntry = entries.find((entry) => (
    /quotareset(timestamp|time|at)|reset(timestamp|time|at)/i.test(entry.path)
    && Number.isFinite(Date.parse(entry.value))
  ));
  const providerResetAt = resetEntry ? Date.parse(resetEntry.value) : null;

  return {
    model,
    dimension,
    providerLimit,
    providerResetAt,
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

    const parsed = parseGeminiQuotaViolation(error, model);
    const cooldownModel = parsed?.model || model;
    const transientFailureCount = noteModelQuotaFailure(cooldownModel);
    const jitterMs = Math.floor(Math.random() * TRANSIENT_QUOTA_JITTER_MAX_MS);
    const cooldown = getGeminiQuotaCooldown(error, model, {
      transientFailureCount,
      jitterMs
    });
    const cooldownMetadata = {
      dimension: cooldown.dimension || parsed?.dimension || null,
      observedUsage: null,
      cap: parsed?.providerLimit ?? null
    };
    markModelQuotaExhausted(model, cooldown.durationMs, cooldown.source, cooldownMetadata);

    if (parsed?.model && parsed.model !== model) {
      markModelQuotaExhausted(parsed.model, cooldown.durationMs, cooldown.source, cooldownMetadata);
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

    // Tự động căn chỉnh rpd_cap trong DB nếu Google báo giới hạn thực tế (vd 20 RPD)
    if (parsed.dimension === 'rpd' && parsed.providerLimit > 0) {
      await db.query(`
        UPDATE ai_model_rate_limit_settings
        SET rpd_cap = LEAST(rpd_cap, $1)
        WHERE model = $2
      `, [parsed.providerLimit, parsed.model]).catch(() => {});
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
 * Helper gọi generateContent với bounded exponential backoff, jitter,
 * Retry-After và fallback giữa các model Flash.
 *
 * Sau khi gọi thành công, tự động ghi nhận usageMetadata vào ai_usage_events.
 */
async function executeGenerate(client, contents, config, modelOverride = null, customCtx = {}) {
  const preferredModel = modelOverride || getActivePreferredModel();
  const fallbackModels = await getQuotaAwareFallbackModels(preferredModel);
  const triedModels = new Set();
  let lastError = null;
  const ctx = getAiContext();
  const finalUserId = customCtx.userId !== undefined ? customCtx.userId : ctx.userId;
  const finalPurpose = customCtx.purpose || ctx.purpose || 'chat';

  for (const model of fallbackModels) {
    if (triedModels.has(model)) continue;
    triedModels.add(model);
    try {
      const { value: response, usageEventId } = await runTrackedGeminiOperation({
        model,
        purpose: finalPurpose,
        operation: 'generate',
        userId: finalUserId,
        invoke: () => client.models.generateContent({ model, contents, config })
      });
      recordSuccessfulGeminiModel(model);
      await resolveAiProviderIncident({ model, purpose: finalPurpose });
      await recordAiUsage({
        eventId: usageEventId,
        userId: finalUserId,
        purpose: finalPurpose,
        model,
        usageMetadata: response.usageMetadata
      });
      return response;
    } catch (error) {
      lastError = error;
      if (isRetryableGeminiError(error)) {
        const httpStatus = getGeminiHttpStatus(error);
        const is503 = httpStatus === 503 || /503|unavailable|overloaded/i.test(String(error?.message || ''));
        const nextTarget = fallbackModels.find((m) => !triedModels.has(m)) || null;

        markModelQuotaExhausted(
          model,
          DEFAULT_MODEL_QUOTA_COOLDOWN_MS,
          is503 ? 'provider_503_service_error' : 'provider_retryable_error',
          { dimension: is503 ? '503_unavailable' : 'transient' }
        );

        if (nextTarget) {
          lastFallbackEvent = {
            fromModel: model,
            toModel: nextTarget,
            reason: is503 ? 'Lỗi 503 (Service Unavailable / Quá tải)' : `Lỗi ${httpStatus || 'tạm thời'} từ nhà cung cấp`,
            errorCode: httpStatus || (is503 ? 503 : 500),
            at: new Date().toISOString()
          };
          notifyAiRateLimitsChanged('model-fallback');
        }

        console.warn(`[Gemini Fallback] ${model} vẫn thất bại sau retry, đang thử model kế tiếp: ${nextTarget || 'hết model'}.`);
        continue;
      }
      throw error;
    }
  }
  throw normalizeGeminiError(lastError || new Error('Không thể kết nối đến mô hình Gemini Flash khả dụng.'));
}

/**
 * Helper gọi generateContentStream với bounded exponential backoff trước
 * chunk đầu tiên và fallback tự động giữa các model Flash.
 *
 * Returns { responseStream, modelUsed, usageEventId, finalUserId, finalPurpose }
 * để wrapper ghi nhận usage sau khi stream được consume hoàn toàn.
 */
async function executeGenerateStream(client, contents, config, modelOverride = null, customCtx = {}) {
  const preferredModel = modelOverride || getActivePreferredModel();
  const fallbackModels = await getQuotaAwareFallbackModels(preferredModel);
  const triedModels = new Set();
  let lastError = null;
  const ctx = getAiContext();
  const finalUserId = customCtx.userId !== undefined ? customCtx.userId : ctx.userId;
  const finalPurpose = customCtx.purpose || ctx.purpose || 'chat';

  for (const model of fallbackModels) {
    if (triedModels.has(model)) continue;
    triedModels.add(model);

    try {
      const { value: responseStream, usageEventId } = await runTrackedGeminiOperation({
        model,
        purpose: finalPurpose,
        operation: 'stream',
        userId: finalUserId,
        invoke: async () => {
          const providerStream = await client.models.generateContentStream({ model, contents, config });
          const iterator = providerStream[Symbol.asyncIterator]();
          const firstChunk = await iterator.next();

          return {
            async *[Symbol.asyncIterator]() {
              if (!firstChunk.done) yield firstChunk.value;
              while (true) {
                const nextChunk = await iterator.next();
                if (nextChunk.done) return;
                yield nextChunk.value;
              }
            }
          };
        }
      });
      return { responseStream, modelUsed: model, usageEventId, finalUserId, finalPurpose };
    } catch (error) {
      lastError = error;
      if (isRetryableGeminiError(error)) {
        const httpStatus = getGeminiHttpStatus(error);
        const is503 = httpStatus === 503 || /503|unavailable|overloaded/i.test(String(error?.message || ''));
        const nextTarget = fallbackModels.find((m) => !triedModels.has(m)) || null;

        markModelQuotaExhausted(
          model,
          DEFAULT_MODEL_QUOTA_COOLDOWN_MS,
          is503 ? 'provider_503_service_error' : 'provider_retryable_error',
          { dimension: is503 ? '503_unavailable' : 'transient' }
        );

        if (nextTarget) {
          lastFallbackEvent = {
            fromModel: model,
            toModel: nextTarget,
            reason: is503 ? 'Lỗi 503 (Service Unavailable / Quá tải)' : `Lỗi ${httpStatus || 'tạm thời'} từ nhà cung cấp`,
            errorCode: httpStatus || (is503 ? 503 : 500),
            at: new Date().toISOString()
          };
          notifyAiRateLimitsChanged('model-fallback');
        }

        console.warn(`[Gemini Stream Fallback] ${model} vẫn thất bại trước chunk đầu tiên, đang thử model kế tiếp: ${nextTarget || 'hết model'}.`);
        continue;
      }
      throw error;
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
          recordSuccessfulGeminiModel(modelUsed);
          await resolveAiProviderIncident({ model: modelUsed, purpose: finalPurpose });
          await recordAiUsage({
            eventId: usageEventId,
            userId: finalUserId,
            purpose: finalPurpose,
            model: modelUsed,
            usageMetadata: lastUsageMetadata
          });
        } catch (streamError) {
          await failAiUsageEvent({ eventId: usageEventId, error: streamError });
          recordAiProviderIncident({ error: streamError, model: modelUsed, purpose: finalPurpose });
          recordGeminiQuotaSignal({ error: streamError, model: modelUsed });
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
      const modelName = getActivePreferredModel();
      const ctx = getAiContext();
      const { value: response, usageEventId } = await runTrackedGeminiOperation({
        model: modelName,
        purpose: ctx.purpose || 'count_tokens',
        operation: 'count_tokens',
        userId: ctx.userId,
        policyOverrides: { maxRetries: 1 },
        invoke: () => client.models.countTokens({ model: modelName, contents })
      });
      await recordAiUsage({
        eventId: usageEventId,
        userId: ctx.userId,
        purpose: ctx.purpose || 'count_tokens',
        model: modelName,
        usageMetadata: null
      });

      return {
        totalTokens: response.totalTokens !== undefined ? response.totalTokens : 0
      };
    } catch (error) {
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

    try {
      const { value: response, usageEventId } = await runTrackedGeminiOperation({
        model: modelName,
        purpose: finalPurpose,
        operation: 'embedding',
        userId: finalUserId,
        invoke: () => client.models.embedContent({
          model: modelName,
          contents: textToEmbed,
          config: {
            outputDimensionality: outputDimensionality || 768
          }
        })
      });

      // Record real embedding usage
      await resolveAiProviderIncident({ model: modelName, purpose: finalPurpose });
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
    const config = {
      responseMimeType
    };

    try {
      const { value: response, usageEventId } = await runTrackedGeminiOperation({
        model,
        purpose: finalPurpose,
        operation: 'speaking',
        userId: finalUserId,
        invoke: () => client.models.generateContent({ model, contents, config })
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
  getGeminiErrorCode,
  getGeminiHttpStatus,
  getGeminiRetryDecision,
  getGeminiRetryPolicySnapshot,
  normalizeGeminiError,
  getGeminiQuotaCooldown,
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
  getPrioritizedFallbackModels,
  getQuotaAwareFallbackModels,
  getGeminiModelRoutingStatus,
  getNextPacificRpdResetAt,
  applyObservedGeminiRpdUsage,
  resetGeminiModelRouting,
  setPreferredGeminiModel,
  setAiModelManualLock,
  isAiModelManuallyLocked,
  getActivePreferredModel,
  markModelQuotaExhausted,
  recordSuccessfulGeminiModel,
  simulateAiModelFallback,
  geminiModel,
  geminiSpeakingModel,
  embeddingModel,
  pc,
  pineconeIndex,
  pineconeClient,
  geminiClient
};
