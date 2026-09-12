'use strict';

const { pool } = require('../../../config/database');
const subtitlesService = require('../../lessons/services/subtitles.service');

const TRANSCRIPT_SOURCE = 'PostgreSQL · lessons + lesson_subtitles';
const STALE_PENDING_SECONDS = 15 * 60;

const normalizeTranscriptStatus = (row) => {
  if (row.subtitle_status === 'ready' && Number(row.cue_count) > 0) return 'ready';
  if (['pending', 'processing', 'failed'].includes(row.subtitle_status)) return row.subtitle_status;
  return 'missing';
};

const emptyCounts = () => ({
  total: 0,
  ready: 0,
  pending: 0,
  processing: 0,
  failed: 0,
  missing: 0,
  mediaMissing: 0,
  retryable: 0,
  retryablePending: 0,
  stalePending: 0,
  sourceMismatch: 0
});

const incrementCounts = (counts, lesson) => {
  counts.total += 1;
  counts[lesson.transcriptStatus] += 1;
  if (lesson.mediaMissingSource) counts.mediaMissing += 1;
  if (lesson.retryable) counts.retryable += 1;
  if (lesson.retryable && lesson.transcriptStatus === 'pending') counts.retryablePending += 1;
  if (lesson.stalePending) counts.stalePending += 1;
  if (lesson.sourceMismatch) counts.sourceMismatch += 1;
};

const getCourseTranscriptHealth = async () => {
  const { rows } = await pool.query(`
    SELECT c.course_id, c.course_name, c.status AS course_status,
           l.lesson_id, l.title AS lesson_title, l.content_type,
           l.media_status,
           ls.subtitle_status, ls.error_code, ls.error_message, ls.updated_at,
           CASE
             WHEN jsonb_typeof(COALESCE(ls.cues, '[]'::jsonb)) = 'array'
             THEN jsonb_array_length(COALESCE(ls.cues, '[]'::jsonb))
             ELSE 0
           END AS cue_count,
           GREATEST(
             0,
             EXTRACT(EPOCH FROM (LOCALTIMESTAMP - COALESCE(ls.updated_at, LOCALTIMESTAMP)))
           )::bigint AS status_age_seconds,
           COALESCE(NULLIF(l.storage_key, ''), l.content_url) AS current_source_url,
           ls.source_content_url IS NOT DISTINCT FROM
             COALESCE(NULLIF(l.storage_key, ''), l.content_url) AS source_matches
    FROM courses c
    JOIN sections s ON s.course_id = c.course_id
    JOIN lessons l ON l.section_id = s.section_id
    LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
    WHERE l.content_type IN ('video', 'youtube')
    ORDER BY c.course_id, s.order_index, l.order_index, l.lesson_id
  `);

  const summary = emptyCounts();
  const courses = new Map();

  for (const row of rows) {
    const transcriptStatus = normalizeTranscriptStatus(row);
    const statusAgeSeconds = Number(row.status_age_seconds) || 0;
    const sourceMismatch = Boolean(row.current_source_url)
      && row.source_matches === false
      && ['pending', 'processing'].includes(transcriptStatus);
    const lesson = {
      lessonId: Number(row.lesson_id),
      lessonTitle: row.lesson_title || `Bài học #${row.lesson_id}`,
      contentType: row.content_type,
      mediaStatus: row.media_status || null,
      mediaMissingSource: row.media_status === 'MISSING_SOURCE',
      transcriptStatus,
      cueCount: Number(row.cue_count) || 0,
      statusAgeSeconds,
      stalePending: transcriptStatus === 'pending' && statusAgeSeconds >= STALE_PENDING_SECONDS,
      sourceMismatch,
      retryable: ['pending', 'failed'].includes(transcriptStatus)
        && row.media_status !== 'MISSING_SOURCE',
      errorCode: transcriptStatus === 'failed' ? (row.error_code || null) : null,
      errorMessage: transcriptStatus === 'failed' ? (row.error_message || null) : null,
      updatedAt: row.updated_at || null
    };

    if (!courses.has(row.course_id)) {
      courses.set(row.course_id, {
        courseId: Number(row.course_id),
        courseName: row.course_name || `Khóa học #${row.course_id}`,
        courseStatus: row.course_status,
        counts: emptyCounts(),
        affectedLessons: []
      });
    }

    const course = courses.get(row.course_id);
    incrementCounts(summary, lesson);
    incrementCounts(course.counts, lesson);
    if (transcriptStatus !== 'ready' || sourceMismatch) course.affectedLessons.push(lesson);
  }

  const courseList = [...courses.values()];
  return {
    generatedAt: new Date().toISOString(),
    source: TRANSCRIPT_SOURCE,
    stalePendingAfterSeconds: STALE_PENDING_SECONDS,
    summary: {
      ...summary,
      courses: courseList.length,
      affectedCourses: courseList.filter(course => course.affectedLessons.length > 0).length,
      recoverablePending: summary.retryablePending,
      recoverable: summary.retryable
    },
    courses: courseList
  };
};

const recoverPendingTranscripts = async ({
  courseId = null,
  lessonIds = [],
  limit = 10,
  includeFailed = false
} = {}) => (
  subtitlesService.recoverPendingNow({ courseId, lessonIds, limit, includeFailed })
);

module.exports = {
  TRANSCRIPT_SOURCE,
  STALE_PENDING_SECONDS,
  getCourseTranscriptHealth,
  recoverPendingTranscripts
};
