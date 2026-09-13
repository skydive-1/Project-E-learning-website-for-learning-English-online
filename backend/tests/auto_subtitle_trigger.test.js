const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const subtitlesController = require('../src/modules/lessons/controllers/subtitles.controller');
const subtitlesService = require('../src/modules/lessons/services/subtitles.service');
const coursesService = require('../src/modules/courses/services/courses.service');
const supabaseStorage = require('../src/utils/supabaseStorage');

const originalDbQuery = db.query;
const originalGetSubtitles = subtitlesService.getSubtitlesByLessonId;
const originalGenerateSubtitles = subtitlesService.generateSubtitlesWithGemini;
const originalInternalGenerateSubtitles = subtitlesService._generateSubtitlesWithGemini;
const originalSchedule = subtitlesService.scheduleAutoGeneration;
const originalQueue = subtitlesService.queueAutoGeneration;
const originalSyncLessonQuiz = coursesService._syncLessonQuiz;
const originalCheckObjectExists = supabaseStorage.checkObjectExists;
const originalListR2Objects = subtitlesService.listR2Objects;
const originalFindR2ObjectsByAssetId = subtitlesService.findR2ObjectsByAssetId;

afterEach(() => {
  db.query = originalDbQuery;
  subtitlesService.getSubtitlesByLessonId = originalGetSubtitles;
  subtitlesService.generateSubtitlesWithGemini = originalGenerateSubtitles;
  subtitlesService._generateSubtitlesWithGemini = originalInternalGenerateSubtitles;
  subtitlesService.scheduleAutoGeneration = originalSchedule;
  subtitlesService.queueAutoGeneration = originalQueue;
  coursesService._syncLessonQuiz = originalSyncLessonQuiz;
  supabaseStorage.checkObjectExists = originalCheckObjectExists;
  subtitlesService.listR2Objects = originalListR2Objects;
  subtitlesService.findR2ObjectsByAssetId = originalFindR2ObjectsByAssetId;
  subtitlesService.r2AssetIndexCache = null;
});

describe('Automatic subtitle trigger', () => {
  test('manual subtitle generation returns 202 and only enqueues durable work', async () => {
    let queuedLessonId = null;
    let synchronousCalls = 0;
    subtitlesService.queueAutoGeneration = async lessonId => {
      queuedLessonId = Number(lessonId);
      return true;
    };
    subtitlesService.generateSubtitlesWithGemini = async () => {
      synchronousCalls += 1;
      throw new Error('Manual endpoint must not wait for Gemini');
    };

    let statusCode = null;
    let payload = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { payload = body; return body; }
    };
    await subtitlesController.generateSubtitles(
      { params: { lessonId: '72' } },
      res,
      error => { throw error; }
    );

    assert.equal(statusCode, 202);
    assert.equal(payload.data.status, 'pending');
    assert.equal(queuedLessonId, 72);
    assert.equal(synchronousCalls, 0);
  });

  test('student subtitle GET never starts the AI pipeline', async () => {
    let generationCalls = 0;
    subtitlesService.getSubtitlesByLessonId = async () => null;
    subtitlesService.generateSubtitlesWithGemini = async () => { generationCalls += 1; };

    let payload;
    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(body) {
        payload = body;
        return body;
      }
    };

    await subtitlesController.getSubtitles(
      { params: { lessonId: '42' } },
      res,
      error => { throw error; }
    );

    assert.equal(generationCalls, 0);
    assert.equal(payload.success, true);
    assert.equal(payload.data, null);
  });

  test('queue writes pending state before scheduling background generation', async () => {
    const queries = [];
    let scheduled;
    db.query = async (sql, params) => {
      queries.push({ sql: String(sql), params });
      if (String(sql).includes('FROM lessons')) {
        return { rows: [{ lesson_id: 42, content_type: 'video', content_url: 'courses/2/new-video.mp4' }] };
      }
      return { rows: [] };
    };
    subtitlesService.scheduleAutoGeneration = (lessonId, source) => {
      scheduled = { lessonId, source };
    };

    const queued = await subtitlesService.queueAutoGeneration(42);

    assert.equal(queued, true);
    assert.deepEqual(scheduled, { lessonId: 42, source: 'courses/2/new-video.mp4' });
    const pendingWrite = queries.find(query => query.sql.includes("subtitle_status = 'pending'"));
    assert.ok(pendingWrite);
    assert.deepEqual(pendingWrite.params, [42, 'courses/2/new-video.mp4']);
  });

  test('queue uses the canonical storage key and accepts YouTube lessons', async () => {
    const scheduled = [];
    db.query = async (sql) => {
      if (String(sql).includes('FROM lessons')) {
        return {
          rows: [{
            lesson_id: 43,
            content_type: 'youtube',
            content_url: 'https://www.youtube.com/watch?v=abcdefghijk',
            storage_key: null
          }]
        };
      }
      return { rows: [] };
    };
    subtitlesService.scheduleAutoGeneration = (lessonId, source) => scheduled.push({ lessonId, source });

    assert.equal(await subtitlesService.queueAutoGeneration(43), true);
    assert.deepEqual(scheduled, [{
      lessonId: 43,
      source: 'https://www.youtube.com/watch?v=abcdefghijk'
    }]);

    db.query = async (sql) => {
      if (String(sql).includes('FROM lessons')) {
        return {
          rows: [{
            lesson_id: 44,
            content_type: 'video',
            content_url: 'courses/44/manifest.mpd',
            storage_key: 'courses/44/source.mp4'
          }]
        };
      }
      return { rows: [] };
    };

    assert.equal(await subtitlesService.queueAutoGeneration(44), true);
    assert.deepEqual(scheduled[1], { lessonId: 44, source: 'courses/44/source.mp4' });
  });

  test('stale queued source is repaired instead of looping forever', async () => {
    const writes = [];
    db.query = async (sql, params) => {
      if (String(sql).includes('FROM lessons WHERE lesson_id')) {
        return {
          rows: [{
            lesson_id: 45,
            content_type: 'video',
            content_url: 'courses/45/current/manifest.mpd',
            storage_key: 'courses/45/current/manifest.mpd',
            storage_bucket: 'videos',
            storage_provider: 'r2'
          }]
        };
      }
      writes.push({ sql: String(sql), params });
      return { rows: [{ lesson_id: 45 }] };
    };

    const result = await subtitlesService._generateSubtitlesWithGemini(45, {
      expectedSourceUrl: 'courses/45/old/manifest.mpd'
    });

    assert.equal(result, null);
    assert.equal(writes.length, 1);
    assert.match(writes[0].sql, /source_content_url = \$3/);
    assert.match(writes[0].sql, /subtitle_status = 'pending'/);
    assert.deepEqual(writes[0].params, [
      45,
      'courses/45/old/manifest.mpd',
      'courses/45/current/manifest.mpd'
    ]);
  });

  test('watchdog requeues a lost stale pending job with the current source', async () => {
    const writes = [];
    const scheduled = [];
    db.query = async (sql, params) => {
      if (String(sql).includes('ls.updated_at < CURRENT_TIMESTAMP')) {
        assert.deepEqual(params, [900000]);
        return {
          rows: [{
            lesson_id: 46,
            source_content_url: 'courses/46/old/manifest.mpd',
            current_source_url: 'courses/46/current/manifest.mpd'
          }]
        };
      }
      writes.push({ sql: String(sql), params });
      return { rows: [] };
    };
    subtitlesService.scheduleAutoGeneration = (lessonId, source) => scheduled.push({ lessonId, source });

    const count = await subtitlesService.recoverStalledAutoGeneration(900000);

    assert.equal(count, 1);
    assert.deepEqual(writes[0].params, [46, 'courses/46/current/manifest.mpd']);
    assert.deepEqual(scheduled, [{ lessonId: 46, source: 'courses/46/current/manifest.mpd' }]);
  });

  test('startup recovery republishes an abandoned processing lesson to the durable queue', async () => {
    const scheduled = [];
    const writes = [];
    db.query = async (sql, params) => {
      const text = String(sql);
      if (text.includes("ls.subtitle_status IN ('pending', 'processing')") && text.includes('LEFT JOIN background_jobs')) {
        return {
          rows: [{
            lesson_id: 131,
            subtitle_status: 'processing',
            source_content_url: 'courses/43/videos/131/source.mp4',
            job_status: 'processing',
            lease_expires_at: new Date(Date.now() - 60_000).toISOString(),
            job_payload: { lessonId: 131, sourceContentUrl: 'courses/43/videos/131/source.mp4' }
          }]
        };
      }
      writes.push({ sql: text, params });
      return { rows: [] };
    };
    subtitlesService.scheduleAutoGeneration = async (lessonId, source, options) => {
      scheduled.push({ lessonId, source, options });
    };

    const recovered = await subtitlesService.resumePendingAutoGeneration();

    assert.equal(recovered, 1);
    assert.match(writes[0].sql, /subtitle_status = 'pending'/);
    assert.deepEqual(scheduled, [{
      lessonId: 131,
      source: 'courses/43/videos/131/source.mp4',
      options: { replaceActive: false }
    }]);
  });

  test('startup recovery does not steal a valid lease owned by another server instance', async () => {
    const writes = [];
    const scheduled = [];
    db.query = async (sql, params) => {
      const text = String(sql);
      if (text.includes("ls.subtitle_status IN ('pending', 'processing')") && text.includes('LEFT JOIN background_jobs')) {
        return {
          rows: [{
            lesson_id: 132,
            subtitle_status: 'processing',
            source_content_url: 'courses/43/videos/132/source.mp4',
            job_status: 'processing',
            lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
            job_payload: { lessonId: 132, sourceContentUrl: 'courses/43/videos/132/source.mp4' }
          }]
        };
      }
      writes.push({ sql: text, params });
      return { rows: [] };
    };
    subtitlesService.scheduleAutoGeneration = async (lessonId, source, options) => {
      scheduled.push({ lessonId, source, options });
    };

    assert.equal(await subtitlesService.resumePendingAutoGeneration(), 1);
    assert.equal(writes.length, 0, 'không được reset trạng thái của job còn lease hợp lệ');
    assert.deepEqual(scheduled[0], {
      lessonId: 132,
      source: 'courses/43/videos/132/source.mp4',
      options: { replaceActive: false }
    });
  });

  test('admin recovery schedules an immediate quota-bounded pending batch', async () => {
    const scheduled = [];
    const writes = [];
    db.query = async (sql, params) => {
      if (String(sql).includes('FROM lesson_subtitles ls') && String(sql).includes('LIMIT 200')) {
        assert.deepEqual(params, [43]);
        return {
          rows: [131, 132, 133].map(lessonId => ({
            course_id: 43,
            course_name: 'Basic English - P3',
            lesson_id: lessonId,
            lesson_title: `Lesson ${lessonId}`,
            previous_status: 'pending',
            source_content_url: `courses/43/old-${lessonId}.mp4`,
            current_source_url: `courses/43/current-${lessonId}.mp4`
          }))
        };
      }
      writes.push({ sql: String(sql), params });
      return { rows: [{ lesson_id: params[0] }] };
    };
    subtitlesService.scheduleAutoGeneration = (lessonId, source) => scheduled.push({ lessonId, source });

    const result = await subtitlesService.recoverPendingNow({ courseId: 43, limit: 2 });

    assert.equal(result.scheduled, 2);
    assert.equal(result.batchLimit, 2);
    assert.deepEqual(scheduled, [
      { lessonId: 131, source: 'courses/43/current-131.mp4' },
      { lessonId: 132, source: 'courses/43/current-132.mp4' }
    ]);
    assert.equal(writes.length, 2);
    assert.equal(result.scheduledLessons.every(lesson => lesson.sourceRepaired), true);
  });

  test('admin can explicitly retry failed transcripts and resets them to pending', async () => {
    const scheduled = [];
    const writes = [];
    db.query = async (sql, params) => {
      if (String(sql).includes('FROM lesson_subtitles ls') && String(sql).includes('LIMIT 200')) {
        assert.match(String(sql), /subtitle_status IN \('pending', 'failed'\)/);
        return {
          rows: [{
            course_id: 43,
            course_name: 'Basic English - P3',
            lesson_id: 131,
            lesson_title: 'Architecture',
            previous_status: 'failed',
            source_content_url: 'courses/43/manifest.mpd',
            current_source_url: 'courses/43/manifest.mpd'
          }]
        };
      }
      writes.push({ sql: String(sql), params });
      return { rows: [{ lesson_id: params[0] }] };
    };
    subtitlesService.scheduleAutoGeneration = (lessonId, source) => scheduled.push({ lessonId, source });

    const result = await subtitlesService.recoverPendingNow({
      courseId: 43,
      limit: 5,
      includeFailed: true
    });

    assert.equal(result.scheduled, 1);
    assert.equal(result.scheduledLessons[0].previousStatus, 'failed');
    assert.match(writes[0].sql, /subtitle_status = 'pending'/);
    assert.deepEqual(writes[0].params, [
      131,
      'courses/43/manifest.mpd',
      ['pending', 'failed']
    ]);
    assert.deepEqual(scheduled, [{ lessonId: 131, source: 'courses/43/manifest.mpd' }]);
  });

  test('DASH transcript source falls back to audio when source MP4 is missing', async () => {
    const checked = [];
    supabaseStorage.checkObjectExists = async key => {
      checked.push(key);
      return key.endsWith('/audio.mp4');
    };

    const resolved = await subtitlesService.resolveStorageMediaForTranscription({
      storage_key: 'courses/43/videos/asset/manifest.mpd',
      storage_bucket: 'elearning-media',
      storage_provider: 'r2'
    });

    assert.deepEqual(checked, [
      'courses/43/videos/asset/source.mp4',
      'courses/43/videos/asset/audio.mp4'
    ]);
    assert.deepEqual(resolved, {
      storageKey: 'courses/43/videos/asset/audio.mp4',
      encrypted: false,
      audioOnly: true,
      storageBucket: 'elearning-media',
      storageProvider: 'r2'
    });
  });

  test('DASH transcript source falls back to encrypted audio for legacy encrypted manifests', async () => {
    supabaseStorage.checkObjectExists = async key => key.endsWith('/audio.mp4');
    const originalIsEncrypted = subtitlesService.isEncryptedDashObject;
    subtitlesService.isEncryptedDashObject = async () => true;

    try {
      const resolved = await subtitlesService.resolveStorageMediaForTranscription({
        storage_key: 'courses/43/videos/asset/manifest.mpd',
        storage_bucket: 'elearning-media',
        storage_provider: 'r2'
      });

      assert.deepEqual(resolved, {
        storageKey: 'courses/43/videos/asset/audio.mp4',
        encrypted: true,
        audioOnly: true,
        storageBucket: 'elearning-media',
        storageProvider: 'r2'
      });
    } finally {
      subtitlesService.isEncryptedDashObject = originalIsEncrypted;
    }
  });

  test('DASH transcript source discovers an older source filename in the same asset folder', async () => {
    supabaseStorage.checkObjectExists = async () => false;
    subtitlesService.listR2Objects = async prefix => {
      assert.equal(prefix, 'courses/43/videos/asset');
      return [
        { Key: `${prefix}/manifest.mpd` },
        { Key: `${prefix}/lesson-original-source.mp4` }
      ];
    };

    const resolved = await subtitlesService.resolveStorageMediaForTranscription({
      storage_key: 'courses/43/videos/asset/manifest.mpd',
      storage_bucket: 'elearning-media',
      storage_provider: 'r2'
    });

    assert.deepEqual(resolved, {
      storageKey: 'courses/43/videos/asset/lesson-original-source.mp4',
      encrypted: false,
      audioOnly: false,
      storageBucket: 'elearning-media',
      storageProvider: 'r2'
    });
  });

  test('DASH transcript source discovers a moved asset by its stable UUID', async () => {
    const assetId = '2bc8247d-6b5a-4f88-a149-4af939173844';
    supabaseStorage.checkObjectExists = async () => false;
    subtitlesService.listR2Objects = async () => [];
    subtitlesService.findR2ObjectsByAssetId = async value => {
      assert.equal(value, assetId);
      return [{ Key: `courses/legacy/videos/${assetId}/audio.mp4` }];
    };

    const resolved = await subtitlesService.resolveStorageMediaForTranscription({
      storage_key: `courses/current/videos/${assetId}/manifest.mpd`,
      storage_bucket: 'elearning-media',
      storage_provider: 'r2'
    });

    assert.deepEqual(resolved, {
      storageKey: `courses/legacy/videos/${assetId}/audio.mp4`,
      encrypted: false,
      audioOnly: true,
      storageBucket: 'elearning-media',
      storageProvider: 'r2'
    });
  });

  test('missing media status update is source-safe and cannot overwrite a replacement video', async () => {
    let write;
    db.query = async (sql, params) => {
      write = { sql: String(sql), params };
      return { rows: [{ lesson_id: 131 }] };
    };

    assert.equal(await subtitlesService.markLessonMediaMissing(131, 'courses/old/manifest.mpd'), true);
    assert.match(write.sql, /media_status = 'MISSING_SOURCE'/);
    assert.match(write.sql, /COALESCE\(storage_key, content_url, ''\) = \$2/);
    assert.deepEqual(write.params, [131, 'courses/old/manifest.mpd']);
  });

  test('new course video lesson is collected for post-commit generation', async () => {
    const queuedLessonIds = [];
    const client = {
      query: async sql => {
        assert.match(String(sql), /INSERT INTO lessons/);
        return { rows: [{ lesson_id: 77 }] };
      }
    };
    coursesService._syncLessonQuiz = async () => {};

    await coursesService._insertLesson(
      client,
      10,
      20,
      { title: 'Uploaded video', contentType: 'video', contentUrl: 'https://cdn.example.com/video.mp4' },
      1,
      [],
      [],
      2,
      2,
      queuedLessonIds
    );

    assert.deepEqual(queuedLessonIds, [77]);
  });

  test('post-commit queue de-duplicates lesson IDs', async () => {
    const queued = [];
    subtitlesService.queueAutoGeneration = async lessonId => { queued.push(lessonId); };

    await coursesService._queueAutoSubtitles([7, 7, 8]);

    assert.deepEqual(queued.sort((a, b) => a - b), [7, 8]);
  });

  test('all subtitle entry points share one sequential generation queue', async () => {
    let activeJobs = 0;
    let maximumActiveJobs = 0;
    const executionOrder = [];

    subtitlesService._generateSubtitlesWithGemini = async lessonId => {
      activeJobs += 1;
      maximumActiveJobs = Math.max(maximumActiveJobs, activeJobs);
      executionOrder.push(`start-${lessonId}`);
      await new Promise(resolve => setTimeout(resolve, 10));
      executionOrder.push(`end-${lessonId}`);
      activeJobs -= 1;
      return { lesson_id: lessonId };
    };

    const first = subtitlesService.generateSubtitlesWithGemini(501);
    const second = subtitlesService.generateSubtitlesWithGemini(502);
    await Promise.all([first, second]);

    assert.equal(maximumActiveJobs, 1);
    assert.deepEqual(executionOrder, [
      'start-501',
      'end-501',
      'start-502',
      'end-502'
    ]);
  });

  test('duplicate requests for one lesson reuse the active job', async () => {
    let executions = 0;
    subtitlesService._generateSubtitlesWithGemini = async lessonId => {
      executions += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      return { lesson_id: lessonId };
    };

    const first = subtitlesService.generateSubtitlesWithGemini(601);
    const duplicate = subtitlesService.generateSubtitlesWithGemini(601);

    assert.strictEqual(first, duplicate);
    await Promise.all([first, duplicate]);
    assert.equal(executions, 1);
  });
});
