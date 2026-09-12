const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const subtitlesController = require('../src/modules/lessons/controllers/subtitles.controller');
const subtitlesService = require('../src/modules/lessons/services/subtitles.service');
const coursesService = require('../src/modules/courses/services/courses.service');

const originalDbQuery = db.query;
const originalGetSubtitles = subtitlesService.getSubtitlesByLessonId;
const originalGenerateSubtitles = subtitlesService.generateSubtitlesWithGemini;
const originalInternalGenerateSubtitles = subtitlesService._generateSubtitlesWithGemini;
const originalSchedule = subtitlesService.scheduleAutoGeneration;
const originalQueue = subtitlesService.queueAutoGeneration;
const originalSyncLessonQuiz = coursesService._syncLessonQuiz;

afterEach(() => {
  db.query = originalDbQuery;
  subtitlesService.getSubtitlesByLessonId = originalGetSubtitles;
  subtitlesService.generateSubtitlesWithGemini = originalGenerateSubtitles;
  subtitlesService._generateSubtitlesWithGemini = originalInternalGenerateSubtitles;
  subtitlesService.scheduleAutoGeneration = originalSchedule;
  subtitlesService.queueAutoGeneration = originalQueue;
  coursesService._syncLessonQuiz = originalSyncLessonQuiz;
});

describe('Automatic subtitle trigger', () => {
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
            source_content_url: `courses/43/old-${lessonId}.mp4`,
            current_source_url: `courses/43/current-${lessonId}.mp4`
          }))
        };
      }
      writes.push({ sql: String(sql), params });
      return { rows: [] };
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
