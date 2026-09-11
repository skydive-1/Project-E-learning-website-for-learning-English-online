const { EventEmitter } = require('node:events');

const ALERTS_CHANGED_EVENT = 'alerts-changed';
const emitter = new EventEmitter();

// Mỗi Admin đang mở dashboard giữ một listener SSE riêng.
emitter.setMaxListeners(100);

const notifyOperationalAlertsChanged = (source = 'unknown') => {
  emitter.emit(ALERTS_CHANGED_EVENT, {
    source,
    occurredAt: new Date().toISOString()
  });
};

const subscribeOperationalAlertsChanged = (listener) => {
  emitter.on(ALERTS_CHANGED_EVENT, listener);
  return () => emitter.off(ALERTS_CHANGED_EVENT, listener);
};

module.exports = {
  notifyOperationalAlertsChanged,
  subscribeOperationalAlertsChanged
};
