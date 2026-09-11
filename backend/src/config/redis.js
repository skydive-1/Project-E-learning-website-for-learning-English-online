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

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

function getRedisClient() {
  if (redisClient) return redisClient;

  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️ [Security Warning] REDIS_URL is not set in production! ' +
        'Rate limiter is falling back to in-memory store. ' +
        'Limits will NOT be shared across multi-instance / scaled deployments.'
      );
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
