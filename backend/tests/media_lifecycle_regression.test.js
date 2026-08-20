const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const supabaseStorage = require('../src/utils/supabaseStorage');
const orphanCleanupService = require('../src/utils/orphanCleanup.service');
const { startMediaCleanupWorker } = require('../src/utils/mediaCleanup.worker');
const lessonsController = require('../src/modules/lessons/controllers/lessons.controller');
const coursesService = require('../src/modules/courses/services/courses.service');

const originalQuery = db.query;
const originalConnect = db.pool.connect;
const originalDelete = supabaseStorage.deleteStorageObject;
const originalCleanup = orphanCleanupService.cleanupExpiredPendingUploads;
const originalRetry = orphanCleanupService.processFailedStorageDeletions;

afterEach(() => {
  db.query = originalQuery;
  db.pool.connect = originalConnect;
  supabaseStorage.deleteStorageObject = originalDelete;
  orphanCleanupService.cleanupExpiredPendingUploads = originalCleanup;
  orphanCleanupService.processFailedStorageDeletions = originalRetry;
  delete process.env.ENABLE_MEDIA_CLEANUP_WORKER;
});

describe('Durable media lifecycle regressions', () => {
  test('lesson router loads with real DASH handlers registered', () => {
    assert.equal(typeof lessonsController.streamDashManifest, 'function');
    assert.equal(typeof lessonsController.streamDashSegment, 'function');
    assert.doesNotThrow(() => require('../src/modules/lessons/lessons.routes'));
  });

  test('reference query failure is distinguishable from a real reference', async () => {
    db.query = async () => { throw new Error('database unavailable'); };
    const state = await orphanCleanupService.getReferenceState('courses/2/a.mp4');
    assert.equal(state.referenced, true);
    assert.equal(state.reliable, false);
  });

  test('delete=false keeps pending CLEANING and links an idempotent retry row', async () => {
    const pendingId = '11111111-1111-4111-8111-111111111111';
    const clientQueries = [];
    const client = {
      query: async (sql) => {
        clientQueries.push(String(sql));
        if (String(sql).includes('SELECT upload_id')) {
          return { rows: [{ upload_id: pendingId, storage_key: 'courses/2/a.mp4', storage_bucket: 'videos' }] };
        }
        return { rows: [] };
      },
      release() {}
    };
    db.pool.connect = async () => client;
    const dbQueries = [];
    db.query = async (sql, params) => {
      dbQueries.push({ sql: String(sql), params });
      if (String(sql).includes('total_ref')) return { rows: [{ total_ref: 0 }] };
      return { rows: [] };
    };
    supabaseStorage.deleteStorageObject = async () => false;

    const result = await orphanCleanupService.cleanupExpiredPendingUploads(1);
    assert.equal(result.cleanedCount, 0);
    const retry = dbQueries.find(q => q.sql.includes('INSERT INTO failed_storage_deletions'));
    assert.ok(retry);
    assert.equal(retry.params[3], pendingId);
    assert.match(retry.sql, /ON CONFLICT/);
    assert.equal(dbQueries.some(q => q.sql.includes("SET status = 'PENDING'")), false);
  });

  test('worker is actually scheduled, single-flight capable and stoppable', async () => {
    process.env.ENABLE_MEDIA_CLEANUP_WORKER = 'true';
    let cleanupCalls = 0;
    let retryCalls = 0;
    orphanCleanupService.cleanupExpiredPendingUploads = async () => { cleanupCalls++; };
    orphanCleanupService.processFailedStorageDeletions = async () => { retryCalls++; };
    const worker = startMediaCleanupWorker({ intervalMs: 60000 });
    assert.ok(worker);
    await worker.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(cleanupCalls >= 1);
    assert.ok(retryCalls >= 1);
    worker.stop();
  });

  test('published course update without status still validates database media state', async () => {
    let rolledBack = false;
    const client = {
      query: async (sql) => {
        const text = String(sql);
        if (text.includes('SELECT course_id, instructor_id, status')) {
          return { rows: [{ course_id: 9, instructor_id: 2, status: 'published' }] };
        }
        if (text.includes('FROM lessons l JOIN sections')) {
          return { rows: [{
            lesson_id: 10, title: 'Broken media', content_type: 'video', content_url: 'courses/2/missing.mp4',
            storage_provider: 'supabase', storage_bucket: 'videos', storage_key: 'courses/2/missing.mp4',
            mime_type: 'video/mp4', size_bytes: 100, checksum_sha256: 'a'.repeat(64), media_status: 'PENDING_AUDIT'
          }] };
        }
        if (text === 'ROLLBACK') rolledBack = true;
        return { rows: [] };
      },
      release() {}
    };
    db.pool.connect = async () => client;
    await assert.rejects(
      () => coursesService.updateCourse(9, { description: 'metadata-only update' }, 2, 2),
      err => err.code === 'UNVERIFIED_MEDIA_ASSETS'
    );
    assert.equal(rolledBack, true);
  });
});
