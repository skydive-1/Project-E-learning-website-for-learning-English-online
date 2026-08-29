const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/database');
const subtitlesController = require('../src/modules/lessons/controllers/subtitles.controller');
const subtitlesService = require('../src/modules/lessons/services/subtitles.service');
const coursesService = require('../src/modules/courses/services/courses.service');

const originalDbQuery = db.query;
const originalGetSubtitles = subtitlesService.getSubtitlesByLessonId;
const originalGenerateSubtitles = subtitlesService.generateSubtitlesWithGemini;
const originalSchedule = subtitlesService.scheduleAutoGeneration;
const originalQueue = subtitlesService.queueAutoGeneration;
const originalSyncLessonQuiz = coursesService._syncLessonQuiz;

afterEach(() => {
  db.query = originalDbQuery;
  subtitlesService.getSubtitlesByLessonId = originalGetSubtitles;
  subtitlesService.generateSubtitlesWithGemini = originalGenerateSubtitles;
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
});
