const DEFAULT_TTL_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

// Cache này chỉ sống trong từng Node.js process. Nếu backend chạy nhiều instance,
// mỗi instance có cache riêng; đây là chủ đích cho metadata streaming ngắn hạn.
const lessonStreamCache = new Map();

function getCacheTtlMs() {
  const configuredTtl = Number(process.env.LESSON_STREAM_CACHE_TTL_MS);
  return Number.isFinite(configuredTtl) && configuredTtl > 0
    ? configuredTtl
    : DEFAULT_TTL_MS;
}

function normalizeLessonId(lessonId) {
  return String(lessonId);
}

function selectStreamingMetadata(lesson) {
  if (!lesson) return null;

  return Object.freeze({
    lesson_id: lesson.lesson_id,
    content_type: lesson.content_type,
    content_url: lesson.content_url,
    storage_key: lesson.storage_key,
    storage_bucket: lesson.storage_bucket,
    storage_provider: lesson.storage_provider,
    media_status: lesson.media_status
  });
}

function reportCacheStatus(options, status) {
  if (typeof options?.onCacheStatus === 'function') {
    options.onCacheStatus(status);
  }
}

async function getCachedLessonForStreaming(lessonId, options = {}) {
  const cacheKey = normalizeLessonId(lessonId);
  const now = Date.now();
  const cached = lessonStreamCache.get(cacheKey);

  if (cached?.pending) {
    reportCacheStatus(options, 'hit');
    return cached.pending;
  }

  if (cached && now - cached.cachedAt < getCacheTtlMs()) {
    reportCacheStatus(options, 'hit');
    return cached.lesson;
  }

  reportCacheStatus(options, 'miss');

  // Lưu promise đang chạy để các request audio/video đến đồng thời không cùng
  // tạo thêm query DB trong lúc cache miss đầu tiên chưa hoàn tất.
  const pendingEntry = { pending: null, cachedAt: now };
  const pending = Promise.resolve()
    // Lazy require tránh vòng phụ thuộc: CoursesService cũng cần gọi invalidate
    // sau khi transaction cập nhật khóa học commit.
    .then(() => require('../modules/courses/services/courses.service').getLessonById(lessonId))
    .then((lesson) => {
      const streamingLesson = selectStreamingMetadata(lesson);
      // Nếu entry đã bị invalidate trong lúc query đang chạy, không đưa kết quả
      // có khả năng cũ quay trở lại cache.
      if (lessonStreamCache.get(cacheKey) === pendingEntry) {
        lessonStreamCache.set(cacheKey, {
          lesson: streamingLesson,
          cachedAt: Date.now()
        });
      }
      return streamingLesson;
    })
    .catch((error) => {
      if (lessonStreamCache.get(cacheKey) === pendingEntry) {
        lessonStreamCache.delete(cacheKey);
      }
      throw error;
    });

  pendingEntry.pending = pending;
  lessonStreamCache.set(cacheKey, pendingEntry);
  return pending;
}

function invalidateLessonStreamCache(lessonId) {
  if (lessonId === undefined || lessonId === null) return false;
  return lessonStreamCache.delete(normalizeLessonId(lessonId));
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  const ttlMs = getCacheTtlMs();

  for (const [cacheKey, entry] of lessonStreamCache.entries()) {
    if (!entry.pending && now - entry.cachedAt >= ttlMs) {
      lessonStreamCache.delete(cacheKey);
    }
  }
}, CLEANUP_INTERVAL_MS);

cleanupTimer.unref?.();

module.exports = {
  getCachedLessonForStreaming,
  invalidateLessonStreamCache
};
