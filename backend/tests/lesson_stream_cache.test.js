const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('events');
const { Writable } = require('stream');

const coursesService = require('../src/modules/courses/services/courses.service');
const supabaseStorage = require('../src/utils/supabaseStorage');
const lessonStreamCache = require('../src/utils/lessonStreamCache');
const lessonsController = require('../src/modules/lessons/controllers/lessons.controller');

const TEST_LESSON_IDS = ['cache-hit', 'cache-expired', 'cache-invalidated', 'dash-stream', 'dash-timing'];

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function createStreamingLesson(lessonId) {
  return {
    lesson_id: lessonId,
    title: 'Dữ liệu không cần cache',
    content_type: 'video',
    content_url: 'courses/5/lesson/video/manifest.mpd',
    storage_key: 'courses/5/lesson/video/manifest.mpd',
    storage_bucket: 'videos',
    storage_provider: 'r2',
    media_status: 'READY',
    hasAccess: true,
    enrollment: { userId: 99 }
  };
}

class MockDashResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.payload = null;
  }

  _write(_chunk, _encoding, callback) {
    callback();
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  }

  json(payload) {
    this.payload = payload;
    this.end();
    return this;
  }
}

async function requestDashSegment(lessonId, segmentFile) {
  const req = {
    params: { lessonId, segmentFile },
    headers: { range: 'bytes=0-3' }
  };
  const res = new MockDashResponse();
  const finished = once(res, 'finish');
  let nextError = null;

  await lessonsController.streamDashSegment(req, res, (error) => {
    nextError = error;
  });
  if (nextError) throw nextError;
  if (!res.writableFinished) await finished;
  return res;
}

describe('Lesson metadata cache dành riêng cho DASH streaming', () => {
  let originalGetLessonById;
  let originalFetchPrivateObject;
  let originalConsoleInfo;
  let originalDateNow;
  let originalTtl;
  let originalDebugTiming;

  beforeEach(() => {
    originalGetLessonById = coursesService.getLessonById;
    originalFetchPrivateObject = supabaseStorage.fetchPrivateObject;
    originalConsoleInfo = console.info;
    originalDateNow = Date.now;
    originalTtl = process.env.LESSON_STREAM_CACHE_TTL_MS;
    originalDebugTiming = process.env.DEBUG_DASH_TIMING;
    process.env.LESSON_STREAM_CACHE_TTL_MS = '30000';
    process.env.DEBUG_DASH_TIMING = 'false';
    for (const lessonId of TEST_LESSON_IDS) {
      lessonStreamCache.invalidateLessonStreamCache(lessonId);
    }
  });

  afterEach(() => {
    coursesService.getLessonById = originalGetLessonById;
    supabaseStorage.fetchPrivateObject = originalFetchPrivateObject;
    console.info = originalConsoleInfo;
    Date.now = originalDateNow;
    restoreEnv('LESSON_STREAM_CACHE_TTL_MS', originalTtl);
    restoreEnv('DEBUG_DASH_TIMING', originalDebugTiming);
    for (const lessonId of TEST_LESSON_IDS) {
      lessonStreamCache.invalidateLessonStreamCache(lessonId);
    }
  });

  test('hai lần đọc trong TTL chỉ query getLessonById đúng một lần', async () => {
    let dbCalls = 0;
    const cacheStatuses = [];
    coursesService.getLessonById = async (lessonId) => {
      dbCalls += 1;
      return createStreamingLesson(lessonId);
    };

    const first = await lessonStreamCache.getCachedLessonForStreaming('cache-hit', {
      onCacheStatus: status => cacheStatuses.push(status)
    });
    const second = await lessonStreamCache.getCachedLessonForStreaming('cache-hit', {
      onCacheStatus: status => cacheStatuses.push(status)
    });

    assert.equal(dbCalls, 1);
    assert.strictEqual(second, first);
    assert.deepEqual(cacheStatuses, ['miss', 'hit']);
    assert.deepEqual(Object.keys(first).sort(), [
      'content_type',
      'content_url',
      'lesson_id',
      'media_status',
      'storage_bucket',
      'storage_key',
      'storage_provider'
    ]);
    assert.equal(first.hasAccess, undefined);
    assert.equal(first.enrollment, undefined);
  });

  test('entry hết TTL sẽ tự query và làm mới cache', async () => {
    let now = 10_000;
    let dbCalls = 0;
    Date.now = () => now;
    process.env.LESSON_STREAM_CACHE_TTL_MS = '10';
    coursesService.getLessonById = async (lessonId) => {
      dbCalls += 1;
      return { ...createStreamingLesson(lessonId), media_status: `READY-${dbCalls}` };
    };

    const first = await lessonStreamCache.getCachedLessonForStreaming('cache-expired');
    now += 11;
    const refreshed = await lessonStreamCache.getCachedLessonForStreaming('cache-expired');

    assert.equal(dbCalls, 2);
    assert.equal(first.media_status, 'READY-1');
    assert.equal(refreshed.media_status, 'READY-2');
  });

  test('invalidate xóa entry ngay, lần đọc kế tiếp phải query lại', async () => {
    let dbCalls = 0;
    coursesService.getLessonById = async (lessonId) => {
      dbCalls += 1;
      return createStreamingLesson(lessonId);
    };

    await lessonStreamCache.getCachedLessonForStreaming('cache-invalidated');
    assert.equal(lessonStreamCache.invalidateLessonStreamCache('cache-invalidated'), true);
    await lessonStreamCache.getCachedLessonForStreaming('cache-invalidated');

    assert.equal(dbCalls, 2);
  });

  test('hai DASH segment liên tiếp resolve DB một lần nhưng fetch R2 hai lần', async () => {
    let dbCalls = 0;
    let r2Calls = 0;
    let timingLogs = 0;
    coursesService.getLessonById = async (lessonId) => {
      dbCalls += 1;
      return createStreamingLesson(lessonId);
    };
    supabaseStorage.fetchPrivateObject = async () => {
      r2Calls += 1;
      return new Response(Buffer.alloc(4), {
        status: 206,
        headers: {
          'content-type': 'video/iso.segment',
          'content-length': '4',
          'content-range': 'bytes 0-3/4'
        }
      });
    };
    console.info = () => { timingLogs += 1; };

    const first = await requestDashSegment('dash-stream', 'video-1.m4s');
    const second = await requestDashSegment('dash-stream', 'audio-1.m4s');

    assert.equal(first.statusCode, 206);
    assert.equal(second.statusCode, 206);
    assert.equal(dbCalls, 1);
    assert.equal(r2Calls, 2);
    assert.equal(timingLogs, 0, 'DEBUG_DASH_TIMING=false không được ghi timing log');
  });

  test('DEBUG_DASH_TIMING=true ghi hit/miss và đủ ba khoảng thời gian', async () => {
    const logs = [];
    process.env.DEBUG_DASH_TIMING = 'true';
    coursesService.getLessonById = async lessonId => createStreamingLesson(lessonId);
    supabaseStorage.fetchPrivateObject = async () => new Response(Buffer.alloc(4), {
      status: 206,
      headers: {
        'content-type': 'video/iso.segment',
        'content-length': '4',
        'content-range': 'bytes 0-3/4'
      }
    });
    console.info = (...args) => logs.push(args);

    await requestDashSegment('dash-timing', 'video-1.m4s');
    await requestDashSegment('dash-timing', 'video-2.m4s');

    assert.equal(logs.length, 2);
    assert.equal(logs[0][0], '[DASH Timing]');
    assert.equal(logs[0][1].cache, 'miss');
    assert.equal(logs[1][1].cache, 'hit');
    for (const [, details] of logs) {
      assert.equal(typeof details.resolveLessonMs, 'number');
      assert.equal(typeof details.r2FetchMs, 'number');
      assert.equal(typeof details.totalRequestMs, 'number');
    }
  });
});
