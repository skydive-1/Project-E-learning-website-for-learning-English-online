/**
 * Shared Redis Configuration for Distributed Rate Limiting & Caching
 *
 * Authors:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const Redis = require('ioredis');
const { RedisStore } = require('rate-limit-redis');

let redisClient = null;
let isConnected = false;
let initAttempted = false;
let lastMissingStoreMode = null;

const getRedisUrl = () => process.env.REDIS_URL || process.env.REDIS_TLS_URL;
const requiresSharedStore = () => ['1', 'true'].includes(
  String(process.env.RATE_LIMIT_REQUIRE_SHARED_STORE || '').toLowerCase()
);

function getRedisClient() {
  if (redisClient) return redisClient;

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    const missingStoreMode = requiresSharedStore() ? 'shared-required' : 'single-instance';
    if (process.env.NODE_ENV === 'production' && lastMissingStoreMode !== missingStoreMode) {
      if (missingStoreMode === 'shared-required') {
        console.warn(
          '⚠️ [RateLimit] Shared-store mode is required but REDIS_URL is missing. ' +
          'Do not scale this service beyond one instance until a shared store is configured.'
        );
      } else {
        console.info(
          'ℹ️ [RateLimit] Zero-cost single-instance mode active: using the in-memory store. ' +
          'Set RATE_LIMIT_REQUIRE_SHARED_STORE=true only when deploying multiple backend instances.'
        );
      }
      lastMissingStoreMode = missingStoreMode;
    }
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 2500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('✅ Connected to shared Redis store successfully.');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      console.warn(`⚠️ [Redis Warning] Redis connection issue: ${err.message}`);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    return redisClient;
  } catch (err) {
    console.error(`❌ [Redis Error] Failed to initialize Redis client: ${err.message}`);
    return null;
  }
}

async function initRedis() {
  if (initAttempted) return isConnected;
  initAttempted = true;

  const client = getRedisClient();
  if (!client) return false;

  try {
    // Timeout 2500ms so server boot is never stalled
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis connection timed out after 2500ms')), 2500)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    isConnected = true;
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`⚠️ [Redis Warning] Failed to connect to Redis (${err.message}). Falling back to memory store.`);
    return false;
  }
}

/**
 * Factory for express-rate-limit store
 * Returns RedisStore if Redis is active, undefined (MemoryStore) otherwise
 */
function createDistributedRateLimitStore(prefix = 'global') {
  const client = getRedisClient();
  if (!client || !isConnected) {
    return undefined; // express-rate-limit defaults to MemoryStore
  }

  return new RedisStore({
    sendCommand: (...args) => client.call(...args),
    prefix: `rl:${prefix}:`
  });
}

function isRedisReady() {
  return isConnected;
}

module.exports = {
  getRedisClient,
  initRedis,
  isRedisReady,
  createDistributedRateLimitStore
};
