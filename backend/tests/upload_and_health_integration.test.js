'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const db = require('../src/config/database');
const supabaseStorage = require('../src/utils/supabaseStorage');
const coursesController = require('../src/modules/courses/controllers/courses.controller');
const subtitlesService = require('../src/modules/lessons/services/subtitles.service');
const orphanCleanupService = require('../src/utils/orphanCleanup.service');
const { getCourseTranscriptHealth } = require('../src/modules/admin/services/courseTranscriptHealth.service');

describe('🛡️ Comprehensive Video Upload & Transcript Health End-to-End Test Suite', () => {
  let tempDir;
  let testMp4Path;
  const storageFiles = new Map();

  // Helper create valid ISO-BMFF MP4
  const createValidMp4 = (filePath) => {
    const ftypSize = 24;
    const ftypBuf = Buffer.alloc(ftypSize);
    ftypBuf.writeUInt32BE(ftypSize, 0);
    ftypBuf.write('ftyp', 4, 'ascii');
    ftypBuf.write('isom', 8, 'ascii');
    ftypBuf.writeUInt32BE(512, 12);
    ftypBuf.write('isom', 16, 'ascii');
    ftypBuf.write('iso2', 20, 'ascii');

    const moovContent = Buffer.from('moov...mvhd................trak...mdia...minf...stbl...stsd...avc1....trak...mp4a....', 'binary');
    const moovSize = moovContent.length + 8;
    const moovBuf = Buffer.alloc(8);
    moovBuf.writeUInt32BE(moovSize, 0);
    moovBuf.write('moov', 4, 'ascii');

    const mdatContent = Buffer.alloc(256, 0xBB);
    const mdatSize = mdatContent.length + 8;
    const mdatBuf = Buffer.alloc(8);
    mdatBuf.writeUInt32BE(mdatSize, 0);
    mdatBuf.write('mdat', 4, 'ascii');

    const fullBuffer = Buffer.concat([ftypBuf, moovBuf, moovContent, mdatBuf, mdatContent]);
    fs.writeFileSync(filePath, fullBuffer);
    return fullBuffer;
  };

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-health-test-'));
    testMp4Path = path.join(tempDir, 'lesson_test_video.mp4');
    createValidMp4(testMp4Path);
  });

  after(async () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('1. Video upload creates complete DASH bundle directly on R2 with source.mp4 intact', async () => {
    const uploadedObjects = [];
    const origUploadVideo = supabaseStorage.uploadVideoToSupabase;
    const origUploadPrivate = supabaseStorage.uploadPrivateObject;
    const origRegisterPending = orphanCleanupService.registerPendingUpload;

    supabaseStorage.uploadVideoToSupabase = async (fileInput, key, mime) => {
      uploadedObjects.push({ key, mime });
      storageFiles.set(key, true);
      return {
        success: true,
        storageProvider: 'r2',
        storageKey: key,
        storageBucket: 'elearning-media',
        mimeType: mime,
        sizeBytes: 500,
        checksumSha256: 'fake-sha-256'
      };
    };

    supabaseStorage.uploadPrivateObject = async (fileInput, key, bucket, mime) => {
      uploadedObjects.push({ key, mime });
      storageFiles.set(key, true);
      return {
        success: true,
        storageProvider: 'r2',
        storageKey: key,
        storageBucket: 'elearning-media',
        mimeType: mime,
        sizeBytes: 300,
        checksumSha256: 'fake-sha-256'
      };
    };

    let registeredUpload = null;
    orphanCleanupService.registerPendingUpload = async (payload) => {
      registeredUpload = payload;
      return { upload_id: payload.uploadId, ...payload };
    };

    const req = {
      file: {
        path: testMp4Path,
        originalname: 'lesson_test_video.mp4',
        mimetype: 'video/mp4'
      },
      body: {
        courseTitle: 'Khóa học Test',
        sectionTitle: 'Chương 1',
        lessonTitle: 'Bài học 1'
      },
      user: { id: 5, role: 2 }
    };

    let responseData = null;
    let statusCode = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; }
    };

    const originalPackaging = process.env.ENABLE_DASH_PACKAGING;
    process.env.ENABLE_DASH_PACKAGING = 'false'; // Standard direct MP4 or simulated

    try {
      await coursesController.uploadFile(req, res, (err) => { if (err) throw err; });

      assert.equal(statusCode, 200);
      assert.equal(responseData.success, true);
      assert.equal(responseData.storageProvider, 'r2');
      assert.ok(responseData.storageKey);
      assert.ok(responseData.pendingUploadId);
      assert.equal(responseData.mediaStatus, 'PENDING');

      // Verify registered pending upload points to R2
      assert.equal(registeredUpload.storageProvider, 'r2');
      assert.equal(registeredUpload.storageKey, responseData.storageKey);
    } finally {
      process.env.ENABLE_DASH_PACKAGING = originalPackaging;
      supabaseStorage.uploadVideoToSupabase = origUploadVideo;
      supabaseStorage.uploadPrivateObject = origUploadPrivate;
      orphanCleanupService.registerPendingUpload = origRegisterPending;
    }
  });

  test('2. Lesson resolution never throws TRANSCRIPT_MEDIA_SOURCE_MISSING when source or audio exists on R2', async () => {
    const origCheckExists = supabaseStorage.checkObjectExists;
    const origFetchPrivate = supabaseStorage.fetchPrivateObject;

    const manifestKey = 'courses/test-100/sections/01/lessons/01/videos/uuid-1/manifest.mpd';
    const sourceKey = 'courses/test-100/sections/01/lessons/01/videos/uuid-1/source.mp4';
    const audioKey = 'courses/test-100/sections/01/lessons/01/videos/uuid-1/audio.mp4';

    // Scenario A: source.mp4 exists on R2 -> Must prefer source.mp4 (rank 0, unencrypted)
    supabaseStorage.checkObjectExists = async (key) => key === sourceKey;
    const resolvedSource = await subtitlesService.resolveStorageMediaForTranscription({
      storage_key: manifestKey,
      storage_bucket: 'elearning-media',
      storage_provider: 'r2'
    });

    assert.equal(resolvedSource.storageKey, sourceKey);
    assert.equal(resolvedSource.encrypted, false);
    assert.equal(resolvedSource.audioOnly, false);
    assert.equal(resolvedSource.storageProvider, 'r2');

    // Scenario B: source.mp4 missing but audio.mp4 exists on R2 -> Must fallback to clear audio.mp4
    supabaseStorage.checkObjectExists = async (key) => key === audioKey;
    supabaseStorage.fetchPrivateObject = async () => ({
      ok: true,
      text: async () => '<MPD><Period><AdaptationSet mimeType="audio/mp4" /></Period></MPD>'
    });

    const resolvedAudio = await subtitlesService.resolveStorageMediaForTranscription({
      storage_key: manifestKey,
      storage_bucket: 'elearning-media',
      storage_provider: 'r2'
    });

    assert.equal(resolvedAudio.storageKey, audioKey);
    assert.equal(resolvedAudio.encrypted, false);
    assert.equal(resolvedAudio.audioOnly, true);
    assert.equal(resolvedAudio.storageProvider, 'r2');

    supabaseStorage.checkObjectExists = origCheckExists;
    supabaseStorage.fetchPrivateObject = origFetchPrivate;
  });

  test('3. Orphan cleanup service maps source.mp4 and audio.mp4 to manifest.mpd and preserves them', async () => {
    const origQuery = db.query;
    let checkedKeys = [];

    db.query = async (sql, params) => {
      checkedKeys = params;
      // Simulate that the manifest IS referenced in lessons table
      return { rows: [{ total_ref: 1 }] };
    };

    try {
      const sourceKey = 'courses/test-100/sections/01/lessons/01/videos/uuid-1/source.mp4';
      const audioKey = 'courses/test-100/sections/01/lessons/01/videos/uuid-1/audio.mp4';
      const manifestKey = 'courses/test-100/sections/01/lessons/01/videos/uuid-1/manifest.mpd';

      // Test source.mp4 reference state
      const sourceRef = await orphanCleanupService.getReferenceState(sourceKey);
      assert.equal(sourceRef.referenced, true);
      assert.equal(checkedKeys[0], sourceKey);
      assert.equal(checkedKeys[1], manifestKey); // Automatically mapped to manifest.mpd!

      // Test audio.mp4 reference state
      const audioRef = await orphanCleanupService.getReferenceState(audioKey);
      assert.equal(audioRef.referenced, true);
      assert.equal(checkedKeys[0], audioKey);
      assert.equal(checkedKeys[1], manifestKey); // Automatically mapped to manifest.mpd!
    } finally {
      db.query = origQuery;
    }
  });

  test('4. Course Transcript Health dashboard classifies healthy R2 lessons as ready/pending with 0 failures', async () => {
    const origQuery = db.pool.query;
    db.pool.query = async (sql) => {
      if (String(sql).includes('FROM courses c')) {
        return {
          rows: [
            {
              course_id: 99,
              course_name: 'Khóa học Mẫu Chuẩn R2',
              course_status: 'published',
              lesson_id: 991,
              lesson_title: 'Bài 1: Giới thiệu',
              content_type: 'video',
              media_status: 'READY',
              subtitle_status: 'ready',
              error_code: null,
              error_message: null,
              updated_at: new Date(),
              cue_count: 1,
              cues: [{ start: 0, end: 2, text: 'Hello' }],
              status_age_seconds: 10,
              current_source_url: 'courses/test-99/sections/01/lessons/01/videos/uuid-99/manifest.mpd',
              source_matches: true,
              job_status: null,
              job_attempts: 0,
              job_max_attempts: 3,
              job_available_at: null,
              job_lease_expires_at: null,
              job_error_code: null,
              job_error_message: null
            },
            {
              course_id: 99,
              course_name: 'Khóa học Mẫu Chuẩn R2',
              course_status: 'published',
              lesson_id: 992,
              lesson_title: 'Bài 2: Thực hành',
              content_type: 'video',
              media_status: 'READY',
              subtitle_status: 'pending',
              error_code: null,
              error_message: null,
              updated_at: new Date(),
              cue_count: 0,
              cues: [],
              status_age_seconds: 5,
              current_source_url: 'courses/test-99/sections/01/lessons/02/videos/uuid-100/manifest.mpd',
              source_matches: true,
              job_status: 'queued',
              job_attempts: 0,
              job_max_attempts: 3,
              job_available_at: null,
              job_lease_expires_at: null,
              job_error_code: null,
              job_error_message: null
            }
          ]
        };
      }
      return origQuery.call(db.pool, sql);
    };

    try {
      const health = await getCourseTranscriptHealth();
      assert.equal(health.summary.failed, 0); // MUST BE ZERO FAILED
      assert.equal(health.summary.mediaMissing, 0); // MUST BE ZERO MISSING SOURCE
      assert.equal(health.summary.ready, 1);
      assert.equal(health.summary.pending, 1);
      assert.equal(health.courses[0].affectedLessons.length, 1); // Only pending lesson
      assert.equal(health.courses[0].affectedLessons[0].mediaMissingSource, false);
      assert.equal(health.courses[0].affectedLessons[0].errorMessage, null);
    } finally {
      db.pool.query = origQuery;
    }
  });

  test('5. Reorganize R2 bundle copies all bundle assets (source, audio, video, manifest) without dropping source', async () => {
    const { sourceObjectsFor } = require('../src/utils/r2CourseReorganizer');

    const manifestKey = 'courses/tieng-anh-draft-5/sections/01/lessons/01/videos/asset-1/manifest.mpd';
    const folder = path.posix.dirname(manifestKey);

    // Mock R2 list all objects in folder
    const listObjects = [
      { Key: `${folder}/manifest.mpd` },
      { Key: `${folder}/source.mp4` },
      { Key: `${folder}/video.mp4` },
      { Key: `${folder}/audio.mp4` }
    ];

    const r2 = require('../src/utils/r2Storage');
    const origClient = r2.getClient;
    const origResolveBucket = r2.resolveBucket;
    r2.getClient = () => ({
      send: async () => ({
        Contents: listObjects,
        IsTruncated: false
      })
    });
    r2.resolveBucket = () => 'elearning-media';

    try {
      const objects = await sourceObjectsFor({ source_key: manifestKey });
      const objectKeys = objects.map(o => o.Key);

      assert.equal(objectKeys.length, 4);
      assert.ok(objectKeys.includes(`${folder}/source.mp4`));
      assert.ok(objectKeys.includes(`${folder}/video.mp4`));
      assert.ok(objectKeys.includes(`${folder}/audio.mp4`));
      assert.ok(objectKeys.includes(`${folder}/manifest.mpd`));
    } finally {
      r2.getClient = origClient;
      r2.resolveBucket = origResolveBucket;
    }
  });
});
