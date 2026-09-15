'use strict';

const DEFAULT_RETRY_PROFILES = Object.freeze({
  interactive: Object.freeze({
    name: 'interactive',
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 4_000,
    maxElapsedMs: 5_000,
    jitterRatio: 0.25
  }),
  speaking: Object.freeze({
    name: 'speaking',
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 4_000,
    maxElapsedMs: 5_000,
    jitterRatio: 0.2
  }),
  background: Object.freeze({
    name: 'background',
    maxRetries: 5,
    baseDelayMs: 1_000,
    maxDelayMs: 60_000,
    maxElapsedMs: 180_000,
    jitterRatio: 0.25
  })
});

const toNonNegativeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const resolveRetryProfile = ({ purpose = '', operation = '' } = {}) => {
  const normalizedPurpose = String(purpose).trim().toLowerCase();
  const normalizedOperation = String(operation).trim().toLowerCase();

  if (normalizedOperation === 'speaking') return { ...DEFAULT_RETRY_PROFILES.speaking };
  if (normalizedPurpose.startsWith('rag_ingestion_') || normalizedPurpose.startsWith('subtitle_')) {
    return { ...DEFAULT_RETRY_PROFILES.background };
  }
  return { ...DEFAULT_RETRY_PROFILES.interactive };
};

const calculateBackoffDelay = ({
  retryAttempt,
  baseDelayMs,
  maxDelayMs,
  jitterRatio,
  retryAfterMs = 0,
  random = Math.random
}) => {
  const safeRetryAttempt = Math.max(1, Math.floor(Number(retryAttempt) || 1));
  const safeBaseDelayMs = Math.max(1, toNonNegativeNumber(baseDelayMs, 500));
  const safeMaxDelayMs = Math.max(safeBaseDelayMs, toNonNegativeNumber(maxDelayMs, 4_000));
  const safeJitterRatio = Math.min(1, toNonNegativeNumber(jitterRatio, 0.25));
  const exponentialMs = Math.min(
    safeMaxDelayMs,
    safeBaseDelayMs * (2 ** (safeRetryAttempt - 1))
  );
  const jitterMs = Math.floor(exponentialMs * safeJitterRatio * Math.max(0, Math.min(1, random())));
  const exponentialWithJitterMs = Math.min(safeMaxDelayMs, exponentialMs + jitterMs);
  const providerDelayMs = Math.max(0, Math.ceil(Number(retryAfterMs) || 0));

  return {
    delayMs: Math.max(exponentialWithJitterMs, providerDelayMs),
    exponentialMs,
    jitterMs,
    providerDelayMs,
    source: providerDelayMs > exponentialWithJitterMs ? 'provider_retry_after' : 'exponential_backoff'
  };
};

/**
 * Execute a transient provider operation with bounded exponential backoff.
 * `shouldRetry` may return a boolean or a decision object containing
 * { retryable, retryAfterMs, reason }.
 */
async function executeWithExponentialBackoff(task, options = {}) {
  if (typeof task !== 'function') throw new TypeError('Retry task must be a function.');

  const profile = {
    ...DEFAULT_RETRY_PROFILES.interactive,
    ...options
  };
  const maxRetries = Math.max(0, Math.floor(toNonNegativeNumber(profile.maxRetries, 2)));
  const maxElapsedMs = Math.max(0, toNonNegativeNumber(profile.maxElapsedMs, 5_000));
  const sleep = typeof profile.sleep === 'function'
    ? profile.sleep
    : (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));
  const now = typeof profile.now === 'function' ? profile.now : Date.now;
  const shouldRetry = typeof profile.shouldRetry === 'function'
    ? profile.shouldRetry
    : () => false;
  const startedAt = now();

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await task({ attempt, maxAttempts: maxRetries + 1 });
    } catch (error) {
      const rawDecision = await shouldRetry(error, { attempt, maxRetries });
      const decision = typeof rawDecision === 'object' && rawDecision !== null
        ? rawDecision
        : { retryable: Boolean(rawDecision) };

      if (!decision.retryable || attempt > maxRetries) throw error;

      const retryAttempt = attempt;
      const backoff = calculateBackoffDelay({
        retryAttempt,
        baseDelayMs: profile.baseDelayMs,
        maxDelayMs: profile.maxDelayMs,
        jitterRatio: profile.jitterRatio,
        retryAfterMs: decision.retryAfterMs,
        random: profile.random
      });
      const elapsedMs = Math.max(0, now() - startedAt);
      const exceedsSingleDelay = backoff.delayMs > profile.maxDelayMs;
      const exceedsElapsedBudget = elapsedMs + backoff.delayMs > maxElapsedMs;

      if (exceedsSingleDelay || exceedsElapsedBudget) {
        if (typeof profile.onRetrySkipped === 'function') {
          await profile.onRetrySkipped({
            error,
            attempt,
            retryAttempt,
            elapsedMs,
            reason: exceedsSingleDelay ? 'retry_after_exceeds_max_delay' : 'elapsed_budget_exhausted',
            decision,
            ...backoff
          });
        }
        throw error;
      }

      if (typeof profile.onRetry === 'function') {
        await profile.onRetry({
          error,
          attempt,
          retryAttempt,
          nextAttempt: attempt + 1,
          maxAttempts: maxRetries + 1,
          elapsedMs,
          decision,
          ...backoff
        });
      }
      await sleep(backoff.delayMs);
    }
  }

  throw new Error('Retry loop exited unexpectedly.');
}

module.exports = {
  DEFAULT_RETRY_PROFILES,
  calculateBackoffDelay,
  executeWithExponentialBackoff,
  resolveRetryProfile
};
