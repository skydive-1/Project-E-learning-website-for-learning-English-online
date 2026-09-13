'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const supabaseStorage = require('../../../utils/supabaseStorage');
const orphanCleanupService = require('../../../utils/orphanCleanup.service');
const { packageVideoToDash } = require('../../../utils/dashPackager.util');
const { durableJobQueue } = require('../../../utils/durableJobQueue.service');

const DASH_PACKAGING_JOB = 'dash_packaging';

function createProcessingError(message, code = 'DASH_PACKAGING_FAILED') {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function writeResponseBodyToFile(response, destination) {
  if (!response?.ok || !response.body) {
    throw createProcessingError('Không thể tải tệp nguồn từ R2 để đóng gói DASH.', 'MEDIA_SOURCE_DOWNLOAD_FAILED');
  }
  const readable = typeof response.body.getReader === 'function'
    ? Readable.fromWeb(response.body)
    : response.body;
  await pipeline(readable, fs.createWriteStream(destination));
}

class MediaProcessingService {
  constructor({
    storage = supabaseStorage,
    cleanup = orphanCleanupService,
    packager = packageVideoToDash,
    queue = durableJobQueue
  } = {}) {
    this.storage = storage;
    this.cleanup = cleanup;
    this.packager = packager;
    this.queue = queue;
    this.wakeWorker = null;
  }

  setWorkerWakeHandler(handler) {
    this.wakeWorker = typeof handler === 'function' ? handler : null;
  }

  async enqueueDashPackaging({ uploadId, sourceStorageKey, storageBucket, assetPrefix, assetId }) {
    if (!uploadId || !sourceStorageKey || !storageBucket || !assetPrefix || !assetId) {
      throw createProcessingError('Thiếu metadata để tạo tác vụ đóng gói DASH.', 'INVALID_MEDIA_JOB_PAYLOAD');
    }
    const job = await this.queue.enqueue({
      jobType: DASH_PACKAGING_JOB,
      dedupeKey: `upload:${uploadId}`,
      payload: { uploadId, sourceStorageKey, storageBucket, assetPrefix, assetId },
      priority: 200,
      maxAttempts: 5,
      replaceActive: false
    });
    this.wakeWorker?.();
    return job;
  }

  async processDashPackaging(job) {
    const { uploadId, sourceStorageKey, storageBucket, assetPrefix, assetId } = job?.payload || {};
    if (!uploadId || !sourceStorageKey || !storageBucket || !assetPrefix || !assetId) {
      throw createProcessingError('Tác vụ DASH thiếu metadata bắt buộc.', 'INVALID_MEDIA_JOB_PAYLOAD');
    }

    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'elearning-dash-'));
    const sourcePath = path.join(tempDirectory, 'source.mp4');
    const uploadedOutputs = [];

    try {
      await this.cleanup.updatePendingUploadStage(uploadId, 'downloading_source');
      const sourceResponse = await this.storage.fetchPrivateObject(
        sourceStorageKey,
        storageBucket,
        null,
        'r2'
      );
      await writeResponseBodyToFile(sourceResponse, sourcePath);

      await this.cleanup.updatePendingUploadStage(uploadId, 'packaging_dash');
      const packageResult = await this.packager(sourcePath, assetId);
      if (!packageResult.success) {
        throw createProcessingError(`Không thể đóng gói video DASH: ${packageResult.error}`);
      }

      const rawManifest = await fs.promises.readFile(packageResult.mpdPath, 'utf8');
      const rewrittenManifest = rawManifest
        .replaceAll(path.basename(packageResult.videoPath), 'video.mp4')
        .replaceAll(path.basename(packageResult.audioPath), 'audio.mp4');

      await this.cleanup.updatePendingUploadStage(uploadId, 'uploading_streams');
      const [videoUpload, audioUpload] = await Promise.all([
        this.storage.uploadPrivateObject(
          packageResult.videoPath,
          `${assetPrefix}/video.mp4`,
          'videos',
          'video/mp4'
        ),
        this.storage.uploadPrivateObject(
          packageResult.audioPath,
          `${assetPrefix}/audio.mp4`,
          'videos',
          'audio/mp4'
        )
      ]);
      uploadedOutputs.push(...[videoUpload, audioUpload].filter(item => item?.storageKey));
      if (!videoUpload.success || !audioUpload.success) {
        throw createProcessingError(
          videoUpload.error || audioUpload.error || 'Không thể tải luồng DASH lên R2.',
          'DASH_STORAGE_UPLOAD_FAILED'
        );
      }

      // Manifest is deliberately published last, after both streams exist.
      await this.cleanup.updatePendingUploadStage(uploadId, 'publishing_manifest');
      const manifestUpload = await this.storage.uploadPrivateObject(
        Buffer.from(rewrittenManifest, 'utf8'),
        `${assetPrefix}/manifest.mpd`,
        'videos',
        'application/dash+xml'
      );
      if (manifestUpload.storageKey) uploadedOutputs.push(manifestUpload);
      if (!manifestUpload.success) {
        throw createProcessingError(
          manifestUpload.error || 'Không thể công bố manifest DASH.',
          'DASH_STORAGE_UPLOAD_FAILED'
        );
      }

      await this.cleanup.updatePendingUploadStage(uploadId, 'verifying');
      const requiredKeys = [videoUpload.storageKey, audioUpload.storageKey, manifestUpload.storageKey];
      const existence = await Promise.all(requiredKeys.map(key => (
        this.storage.checkObjectExists(key, manifestUpload.storageBucket, 'r2')
      )));
      if (existence.some(exists => !exists)) {
        throw createProcessingError('Bộ DASH chưa đầy đủ sau khi tải lên R2.', 'DASH_BUNDLE_VERIFICATION_FAILED');
      }

      return this.cleanup.finalizeProcessedUpload(uploadId, manifestUpload, {
        sourceStorageKey
      });
    } catch (error) {
      if (uploadedOutputs.length > 0) {
        await this.cleanup.rollbackUploadedAssetBundle(uploadedOutputs);
      }
      throw error;
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true }).catch((error) => {
        console.warn(`[MediaProcessing] Không thể dọn thư mục tạm ${tempDirectory}: ${error.message}`);
      });
    }
  }

  isRetryable(error) {
    return !new Set([
      'INVALID_MEDIA_JOB_PAYLOAD',
      'MEDIA_UPLOAD_NOT_PROCESSING'
    ]).has(String(error?.code || ''));
  }
}

const mediaProcessingService = new MediaProcessingService();

module.exports = mediaProcessingService;
module.exports.DASH_PACKAGING_JOB = DASH_PACKAGING_JOB;
module.exports.MediaProcessingService = MediaProcessingService;
module.exports.writeResponseBodyToFile = writeResponseBodyToFile;
