const adminAlertsService = require('../services/adminAlerts.service');

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

exports.getAlerts = async (req, res, next) => {
  try {
    disableCache(res);
    const snapshot = await adminAlertsService.getAdminAlertsSnapshot({
      fresh: req.query.fresh === '1' || req.query.fresh === 'true'
    });
    res.status(200).json({ success: true, data: snapshot });
  } catch (error) {
    next(error);
  }
};

exports.streamAlerts = async (req, res) => {
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
  let lastSignature = null;
  let refreshInterval = null;
  let heartbeatInterval = null;

  const close = () => {
    if (closed) return;
    closed = true;
    if (refreshInterval) clearInterval(refreshInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  };

  req.on('close', close);
  res.on('close', close);

  const publishSnapshot = async (force = false) => {
    if (closed || refreshInProgress) return;
    refreshInProgress = true;

    try {
      const snapshot = await adminAlertsService.getAdminAlertsSnapshot();
      const signature = JSON.stringify(snapshot.alerts.map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp
      })));

      if (force || signature !== lastSignature) {
        writeEvent(res, 'alerts', snapshot);
        lastSignature = signature;
      }
    } catch (error) {
      writeEvent(res, 'stream-error', {
        message: 'Không thể cập nhật cảnh báo từ backend',
        timestamp: new Date().toISOString()
      });
    } finally {
      refreshInProgress = false;
    }
  };

  writeEvent(res, 'connected', {
    timestamp: new Date().toISOString(),
    refreshIntervalMs: STREAM_REFRESH_MS
  });
  await publishSnapshot(true);

  if (closed) return;

  refreshInterval = setInterval(() => {
    publishSnapshot(false);
  }, STREAM_REFRESH_MS);

  heartbeatInterval = setInterval(() => {
    writeEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
  }, HEARTBEAT_MS);
};

exports.cleanupAlerts = async (req, res, next) => {
  try {
    const orphanCleanupService = require('../../../utils/orphanCleanup.service');
    const expiredRes = await orphanCleanupService.cleanupExpiredPendingUploads(100);
    const failedRes = await orphanCleanupService.processFailedStorageDeletions(100);
    adminAlertsService.resetCache();
    const freshSnapshot = await adminAlertsService.getAdminAlertsSnapshot({ fresh: true });

    return res.status(200).json({
      success: true,
      message: `Dọn dẹp rác cảnh báo thành công. Đã giải phóng ${expiredRes.cleanedCount} tệp tải lên tạm và xử lý ${failedRes.processedCount} mục lưu trữ.`,
      data: {
        cleanedPendingCount: expiredRes.cleanedCount,
        processedFailedCount: failedRes.processedCount,
        snapshot: freshSnapshot
      }
    });
  } catch (error) {
    next(error);
  }
};

