const adminAlertsService = require('../services/adminAlerts.service');
const {
  notifyOperationalAlertsChanged,
  subscribeOperationalAlertsChanged
} = require('../../../utils/operationalAlertEvents');

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
  let refreshQueued = false;
  let lastSignature = null;
  let refreshInterval = null;
  let heartbeatInterval = null;
  let unsubscribeAlertsChanged = null;

  const close = () => {
    if (closed) return;
    closed = true;
    if (refreshInterval) clearInterval(refreshInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (unsubscribeAlertsChanged) unsubscribeAlertsChanged();
  };

  req.on('close', close);
  res.on('close', close);

  const publishSnapshot = async ({ force = false, fresh = false } = {}) => {
    if (closed) return;
    if (refreshInProgress) {
      if (fresh) refreshQueued = true;
      return;
    }
    refreshInProgress = true;

    try {
      const snapshot = await adminAlertsService.getAdminAlertsSnapshot({ fresh });
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
      if (refreshQueued && !closed) {
        refreshQueued = false;
        queueMicrotask(() => publishSnapshot({ fresh: true }));
      }
    }
  };

  writeEvent(res, 'connected', {
    timestamp: new Date().toISOString(),
    refreshIntervalMs: STREAM_REFRESH_MS
  });
  unsubscribeAlertsChanged = subscribeOperationalAlertsChanged(() => {
    publishSnapshot({ fresh: true });
  });

  await publishSnapshot({ force: true, fresh: true });

  if (closed) return;

  refreshInterval = setInterval(() => {
    publishSnapshot();
  }, STREAM_REFRESH_MS);

  heartbeatInterval = setInterval(() => {
    writeEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
  }, HEARTBEAT_MS);
};

exports.cleanupAlerts = async (req, res, next) => {
  try {
    const orphanCleanupService = require('../../../utils/orphanCleanup.service');
    const { pool } = require('../../../config/database');
    const expiredRes = await orphanCleanupService.cleanupExpiredPendingUploads(100);
    const failedRes = await orphanCleanupService.processFailedStorageDeletions(100);

    // Tự động quét và dọn dẹp tệp mồ côi trên Cloudflare R2
    let r2ReconcileRes = null;
    try {
      const r2ReconciliationService = require('../../../utils/r2Reconciliation.service');
      r2ReconcileRes = await r2ReconciliationService.reconcile({ dryRun: false, autoDelete: true });
    } catch (r2Err) {
      console.warn('[CleanupAlerts] Quét dọn R2 tự động gặp lỗi (non-fatal):', r2Err.message);
    }

    // Tự động đánh dấu giải quyết các sự cố AI cũ (> 3 phút) khi Admin dọn rác
    try {
      await pool.query(`
        UPDATE ai_provider_incidents
        SET resolved_at = NOW()
        WHERE resolved_at IS NULL
          AND last_seen_at <= NOW() - INTERVAL '3 minutes'
      `);
    } catch (incidentCleanupErr) {
      console.warn('[CleanupAlerts] Không thể dọn dẹp ai_provider_incidents:', incidentCleanupErr.message);
    }

    adminAlertsService.resetCache();
    const freshSnapshot = await adminAlertsService.getAdminAlertsSnapshot({ fresh: true });
    notifyOperationalAlertsChanged('manual-alert-cleanup');

    const r2Message = r2ReconcileRes?.deletedCount ? ` và xóa ${r2ReconcileRes.deletedCount} tệp rác trên R2 (${r2ReconcileRes.freedMb} MB)` : '';

    return res.status(200).json({
      success: true,
      message: `Dọn dẹp rác cảnh báo thành công. Đã giải phóng ${expiredRes.cleanedCount} tệp tải lên tạm, xử lý ${failedRes.processedCount} mục lưu trữ${r2Message}.`,
      data: {
        cleanedPendingCount: expiredRes.cleanedCount,
        processedFailedCount: failedRes.processedCount,
        r2DeletedCount: r2ReconcileRes?.deletedCount || 0,
        r2FreedMb: r2ReconcileRes?.freedMb || 0,
        snapshot: freshSnapshot
      }
    });
  } catch (error) {
    next(error);
  }
};
