'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  MediaProcessingService,
  DASH_PACKAGING_JOB
} = require('../src/modules/courses/services/mediaProcessing.service');
const coursesController = require('../src/modules/courses/controllers/courses.controller');
const mediaProcessingService = require('../src/modules/courses/services/mediaProcessing.service');
const orphanCleanupService = require('../src/utils/orphanCleanup.service');
const storageSingleton = require('../src/utils/supabaseStorage');

describe('Durable asynchronous DASH processing', () => {
  it('returns 202 after the source is durable instead of packaging inside the upload request', async () => {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'async-upload-test-'));
    const sourcePath = path.join(tempDirectory, 'lesson.mp4');
    const mp4 = Buffer.alloc(64);
    mp4.writeUInt32BE(24, 0);
    mp4.write('ftyp', 4, 'ascii');
    await fs.promises.writeFile(sourcePath, mp4);

    const originalPackagingFlag = process.env.ENABLE_DASH_PACKAGING;
    const originalUpload = storageSingleton.uploadVideoToSupabase;
    const originalRegister = orphanCleanupService.registerPendingUpload;
    const originalMark = orphanCleanupService.markPendingUploadProcessing;
    const originalEnqueue = mediaProcessingService.enqueueDashPackaging;
    let enqueuedPayload = null;

    process.env.ENABLE_DASH_PACKAGING = 'true';
    storageSingleton.uploadVideoToSupabase = async (_file, key) => ({
      success: true,
      storageProvider: 'r2',
      storageBucket: 'elearning-media',
      storageKey: key,
      mimeType: 'video/mp4',
      sizeBytes: mp4.length,
      checksumSha256: 'a'.repeat(64)
    });
    orphanCleanupService.registerPendingUpload = async payload => ({ upload_id: payload.uploadId });
    orphanCleanupService.markPendingUploadProcessing = async () => true;
    mediaProcessingService.enqueueDashPackaging = async payload => {
      enqueuedPayload = payload;
      return { status: 'queued' };
    };

    let statusCode = null;
    let payload = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { payload = body; return body; }
    };
    try {
      await coursesController.uploadFile({
        file: {
          path: sourcePath,
          originalname: 'lesson.mp4',
          mimetype: 'video/mp4',
          size: mp4.length
        },
        user: { id: 7, roleId: 2 },
        body: { courseName: 'Demo', sectionName: 'Unit 1', lessonName: 'Lesson 1' }
      }, res, error => { throw error; });

      assert.equal(statusCode, 202);
      assert.equal(payload.processingStatus, 'processing');
      assert.match(payload.pendingUploadId, /^[0-9a-f-]{36}$/i);
      assert.equal(payload.pendingUploadId, enqueuedPayload.uploadId);
      assert.equal(payload.storageKey, undefined, 'manifest metadata is only exposed after packaging');
      assert.ok(enqueuedPayload.sourceStorageKey.endsWith('/source.mp4'));
      assert.equal(fs.existsSync(sourcePath), false, 'multer temp file is cleaned after the source upload');
    } finally {
      if (originalPackagingFlag === undefined) delete process.env.ENABLE_DASH_PACKAGING;
      else process.env.ENABLE_DASH_PACKAGING = originalPackagingFlag;
      storageSingleton.uploadVideoToSupabase = originalUpload;
      orphanCleanupService.registerPendingUpload = originalRegister;
      orphanCleanupService.markPendingUploadProcessing = originalMark;
      mediaProcessingService.enqueueDashPackaging = originalEnqueue;
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it('enqueues a small metadata-only job and wakes the worker', async () => {
    let enqueued = null;
    let wakeCount = 0;
    const service = new MediaProcessingService({
      queue: {
        enqueue: async payload => {
          enqueued = payload;
          return { job_id: 91, status: 'queued' };
        }
      }
    });
    service.setWorkerWakeHandler(() => { wakeCount += 1; });

    const job = await service.enqueueDashPackaging({
      uploadId: 'upload-1',
      sourceStorageKey: 'courses/demo/videos/a/source.mp4',
      storageBucket: 'elearning-media',
      assetPrefix: 'courses/demo/videos/a',
      assetId: 'asset-1'
    });

    assert.equal(job.status, 'queued');
    assert.equal(enqueued.jobType, DASH_PACKAGING_JOB);
    assert.equal(enqueued.dedupeKey, 'upload:upload-1');
    assert.equal(enqueued.payload.sourceStorageKey, 'courses/demo/videos/a/source.mp4');
    assert.equal(wakeCount, 1);
  });

  it('downloads source, uploads video/audio in parallel, publishes manifest last and finalizes', async () => {
    const events = [];
    let activeStreamUploads = 0;
    let maximumActiveStreamUploads = 0;
    const storage = {
      fetchPrivateObject: async () => new Response(Buffer.from('source-video')),
      uploadPrivateObject: async (input, key, _bucket, mimeType) => {
        events.push(`start:${path.basename(key)}`);
        if (key.endsWith('video.mp4') || key.endsWith('audio.mp4')) {
          activeStreamUploads += 1;
          maximumActiveStreamUploads = Math.max(maximumActiveStreamUploads, activeStreamUploads);
          await new Promise(resolve => setTimeout(resolve, 10));
          activeStreamUploads -= 1;
        }
        events.push(`end:${path.basename(key)}`);
        return {
          success: true,
          storageProvider: 'r2',
          storageBucket: 'elearning-media',
          storageKey: key,
          mimeType,
          sizeBytes: Buffer.isBuffer(input) ? input.length : fs.statSync(input).size,
          checksumSha256: `sha-${path.basename(key)}`
        };
      },
      checkObjectExists: async () => true
    };
    const stages = [];
    let finalized = null;
    const cleanup = {
      updatePendingUploadStage: async (_id, stage) => stages.push(stage),
      finalizeProcessedUpload: async (id, result, options) => {
        finalized = { id, result, options };
        return { upload_id: id, storage_key: result.storageKey };
      },
      rollbackUploadedAssetBundle: async () => assert.fail('Successful job must not roll back')
    };
    const packager = async sourcePath => {
      const directory = path.dirname(sourcePath);
      const videoPath = path.join(directory, 'out-video.mp4');
      const audioPath = path.join(directory, 'out-audio.mp4');
      const mpdPath = path.join(directory, 'out.mpd');
      await Promise.all([
        fs.promises.writeFile(videoPath, 'video'),
        fs.promises.writeFile(audioPath, 'audio'),
        fs.promises.writeFile(mpdPath, '<MPD>out-video.mp4 out-audio.mp4</MPD>')
      ]);
      return { success: true, videoPath, audioPath, mpdPath };
    };
    const service = new MediaProcessingService({ storage, cleanup, packager });

    const result = await service.processDashPackaging({
      payload: {
        uploadId: 'upload-2',
        sourceStorageKey: 'courses/demo/videos/b/source.mp4',
        storageBucket: 'elearning-media',
        assetPrefix: 'courses/demo/videos/b',
        assetId: 'asset-2'
      }
    });

    assert.equal(result.storage_key, 'courses/demo/videos/b/manifest.mpd');
    assert.ok(maximumActiveStreamUploads >= 2, 'video and audio should upload concurrently');
    assert.ok(events.indexOf('start:manifest.mpd') > events.indexOf('end:video.mp4'));
    assert.ok(events.indexOf('start:manifest.mpd') > events.indexOf('end:audio.mp4'));
    assert.deepEqual(stages, [
      'downloading_source', 'packaging_dash', 'uploading_streams',
      'publishing_manifest', 'verifying'
    ]);
    assert.equal(finalized.options.sourceStorageKey, 'courses/demo/videos/b/source.mp4');
  });
});
