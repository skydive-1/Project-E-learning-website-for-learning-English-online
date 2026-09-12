'use strict';

const { pool, testConnection } = require('../src/config/database');
const subtitlesService = require('../src/modules/lessons/services/subtitles.service');
const {
  getCourseTranscriptHealth
} = require('../src/modules/admin/services/courseTranscriptHealth.service');

const readOption = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};

const hasFlag = name => process.argv.slice(2).includes(`--${name}`);

const parsePositiveInt = (value, label, fallback = null) => {
  if (value === null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} phải là số nguyên dương.`);
  }
  return parsed;
};

const main = async () => {
  if (!await testConnection()) {
    throw new Error('Không thể kết nối PostgreSQL hoặc áp dụng migration trước khi phục hồi transcript.');
  }
  const courseId = parsePositiveInt(readOption('course-id'), 'course-id');
  const limit = Math.min(20, parsePositiveInt(readOption('limit'), 'limit', 10));
  const timeoutMinutes = parsePositiveInt(readOption('timeout-minutes'), 'timeout-minutes', 120);
  const includeFailed = hasFlag('include-failed');
  const lessonIds = String(readOption('lesson-ids') || '')
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isInteger(value) && value > 0);

  if (hasFlag('dry-run')) {
    const snapshot = await getCourseTranscriptHealth();
    const courses = snapshot.courses
      .filter(course => course.counts.retryable > 0 || course.counts.mediaMissing > 0)
      .filter(course => !courseId || course.courseId === courseId)
      .map(course => ({
        courseId: course.courseId,
        courseName: course.courseName,
        pending: course.counts.pending,
        failed: course.counts.failed,
        retryable: course.counts.retryable,
        mediaMissing: course.counts.mediaMissing,
        stalePending: course.counts.stalePending,
        sourceMismatch: course.counts.sourceMismatch,
        lessonIds: course.affectedLessons
          .filter(lesson => lesson.retryable)
          .map(lesson => lesson.lessonId),
        reuploadLessonIds: course.affectedLessons
          .filter(lesson => lesson.mediaMissingSource)
          .map(lesson => lesson.lessonId)
      }));
    console.log(JSON.stringify({ dryRun: true, source: snapshot.source, courses }, null, 2));
    return;
  }

  subtitlesService.startAutoGenerationRecoveryWorker();
  const result = await subtitlesService.recoverPendingNow({ courseId, lessonIds, limit, includeFailed });
  console.log(JSON.stringify({ phase: 'scheduled', ...result }, null, 2));
  if (result.scheduled === 0 && result.alreadyActive === 0) return;

  const completed = await subtitlesService.waitForAutoGenerationIdle(timeoutMinutes * 60 * 1000);
  if (!completed) {
    throw new Error(
      `Worker chưa hoàn tất trong ${timeoutMinutes} phút. Job đang processing sẽ được backend khôi phục khi khởi động lại.`
    );
  }

  const snapshot = await getCourseTranscriptHealth();
  const remaining = snapshot.courses
    .filter(course => !courseId || course.courseId === courseId)
    .reduce((total, course) => (
      total + (includeFailed ? course.counts.retryable : course.counts.retryablePending)
    ), 0);
  console.log(JSON.stringify({ phase: 'completed', remaining }, null, 2));
};

main()
  .catch(error => {
    console.error(`[Subtitle Recovery] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await subtitlesService.stopAutoGenerationRecoveryWorker();
    await pool.end().catch(() => {});
  });
