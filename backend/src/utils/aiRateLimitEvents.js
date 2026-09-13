const { EventEmitter } = require('node:events');

const RATE_LIMITS_CHANGED_EVENT = 'rate-limits-changed';
const emitter = new EventEmitter();

// Mỗi Admin đang mở bảng rate limit giữ một listener SSE riêng.
emitter.setMaxListeners(100);

const notifyAiRateLimitsChanged = (source = 'unknown') => {
  emitter.emit(RATE_LIMITS_CHANGED_EVENT, {
    source,
    occurredAt: new Date().toISOString()
  });
};

const subscribeAiRateLimitsChanged = (listener) => {
  emitter.on(RATE_LIMITS_CHANGED_EVENT, listener);
  return () => emitter.off(RATE_LIMITS_CHANGED_EVENT, listener);
};

module.exports = {
  notifyAiRateLimitsChanged,
  subscribeAiRateLimitsChanged
};
