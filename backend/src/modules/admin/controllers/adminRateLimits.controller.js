const adminService = require('../services/admin.service');
const { subscribeAiRateLimitsChanged } = require('../../../utils/aiRateLimitEvents');

const STREAM_REFRESH_MS = 15_000;
const HEARTBEAT_MS = 10_000;

const disableCache = (res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
};

const writeEvent = (res, event, data) => {
  if (res.destroyed || res.writableEnded) return false;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
  return true;
};

const getStatusSignature = (status) => JSON.stringify({
  models: (status.models || []).map((model) => ({
    model: model.model,
    usage: model.usage,
    requestStatus: model.requestStatus,
    caps: model.caps,
    riskLevel: model.riskLevel,
    updatedAt: model.updatedAt
  })),
  guard: status.guard,
  routing: status.routing,
  notices: status.notices,
  nextRpdResetAt: status.windows?.nextRpdResetAt
});

exports.streamAiRateLimits = async (req, res) => {
  disableCache(res);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write('retry: 10000\n\n');

  if (res.socket) {
    res.socket.setTimeout(0);
    res.socket.setKeepAlive(true);
  }

  let closed = false;
  let refreshInProgress = false;
  let refreshQueued = false;
  let lastSignature = null;
  let refreshInterval = null;
  let heartbeatInterval = null;
  let unsubscribe = null;

  const close = () => {
    if (closed) return;
    closed = true;
    if (refreshInterval) clearInterval(refreshInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (unsubscribe) unsubscribe();
  };

  req.on('close', close);
  res.on('close', close);

  const publishSnapshot = async ({ force = false } = {}) => {
    if (closed) return;
    if (refreshInProgress) {
      refreshQueued = true;
      return;
    }
    refreshInProgress = true;

    try {
      const status = await adminService.getRateLimitStatus();
      const signature = getStatusSignature(status);
      if (force || signature !== lastSignature) {
        writeEvent(res, 'rate-limits', status);
        lastSignature = signature;
      }
    } catch (error) {
      writeEvent(res, 'stream-error', {
        message: 'Không thể cập nhật telemetry rate limit từ backend',
        timestamp: new Date().toISOString()
      });
    } finally {
      refreshInProgress = false;
      if (refreshQueued && !closed) {
        refreshQueued = false;
        queueMicrotask(() => publishSnapshot());
      }
    }
  };

  writeEvent(res, 'connected', {
    timestamp: new Date().toISOString(),
    source: 'backend_observed_telemetry',
    fallbackRefreshMs: STREAM_REFRESH_MS
  });

  unsubscribe = subscribeAiRateLimitsChanged(() => publishSnapshot());

  await publishSnapshot({ force: true });
  if (closed) return;

  // Số liệu cửa sổ trượt vẫn phải giảm khi event cũ rời khỏi mốc 60 giây.
  refreshInterval = setInterval(() => publishSnapshot(), STREAM_REFRESH_MS);
  heartbeatInterval = setInterval(() => {
    writeEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
  }, HEARTBEAT_MS);
};
