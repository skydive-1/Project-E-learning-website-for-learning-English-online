const orphanCleanupService = require('./orphanCleanup.service');

function startMediaCleanupWorker(options = {}) {
  if (String(process.env.ENABLE_MEDIA_CLEANUP_WORKER || '').toLowerCase() !== 'true') return null;
  const intervalMs = Number(options.intervalMs || process.env.MEDIA_CLEANUP_INTERVAL_MS || 300000);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await orphanCleanupService.cleanupExpiredPendingUploads();
      await orphanCleanupService.processFailedStorageDeletions();
    } catch (error) {
      console.error('[MediaCleanupWorker] Vòng cleanup thất bại:', error.message);
    } finally { running = false; }
  };
  const timer = setInterval(run, Math.max(intervalMs, 1000));
  timer.unref?.();
  run();
  return { stop: () => clearInterval(timer), run };
}

module.exports = { startMediaCleanupWorker };
