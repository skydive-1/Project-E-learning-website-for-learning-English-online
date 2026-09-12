'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/database');
const service = require('../src/modules/admin/services/courseTranscriptHealth.service');

test('course transcript health groups observed PostgreSQL states without fabricated metrics', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({
    rows: [
      {
        course_id: 42,
        course_name: 'Basic English - P2',
        course_status: 1,
        lesson_id: 124,
        lesson_title: 'Mở đầu',
        content_type: 'video',
        subtitle_status: 'pending',
        cue_count: 0,
        status_age_seconds: 5400,
        current_source_url: 'courses/42/current.mpd',
        source_matches: false,
        updated_at: '2026-09-12T02:36:29.019Z'
      },
      {
        course_id: 42,
        course_name: 'Basic English - P2',
        course_status: 1,
        lesson_id: 125,
        lesson_title: 'Nature',
        content_type: 'video',
        subtitle_status: 'ready',
        cue_count: 28,
        status_age_seconds: 100,
        current_source_url: 'courses/42/nature.mpd',
        source_matches: true,
        updated_at: '2026-09-12T03:00:00.000Z'
      },
      {
        course_id: 43,
        course_name: 'Basic English - P3',
        course_status: 0,
        lesson_id: 131,
        lesson_title: 'Architecture',
        content_type: 'video',
        subtitle_status: 'failed',
        error_code: 'SUBTITLE_PIPELINE_FAILED',
        error_message: 'Audio unavailable',
        cue_count: 0,
        status_age_seconds: 120,
        current_source_url: 'courses/43/architecture.mpd',
        source_matches: true,
        updated_at: '2026-09-12T03:10:00.000Z'
      }
    ]
  });

  try {
    const snapshot = await service.getCourseTranscriptHealth();
    assert.equal(snapshot.source, 'PostgreSQL · lessons + lesson_subtitles');
    assert.deepEqual(snapshot.summary, {
      total: 3,
      ready: 1,
      pending: 1,
      processing: 0,
      failed: 1,
      missing: 0,
      stalePending: 1,
      sourceMismatch: 1,
      courses: 2,
      affectedCourses: 2,
      recoverablePending: 1,
      recoverable: 2
    });
    assert.deepEqual(snapshot.courses[0].affectedLessons.map(lesson => lesson.lessonId), [124]);
    assert.equal(snapshot.courses[0].affectedLessons[0].sourceMismatch, true);
    assert.equal(snapshot.courses[1].affectedLessons[0].errorMessage, 'Audio unavailable');
  } finally {
    pool.query = originalQuery;
  }
});

test('ready rows without cues are reported as missing rather than healthy', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({
    rows: [{
      course_id: 50,
      course_name: 'Course',
      course_status: 1,
      lesson_id: 201,
      lesson_title: 'Empty ready row',
      content_type: 'video',
      subtitle_status: 'ready',
      cue_count: 0,
      status_age_seconds: 0,
      current_source_url: 'courses/50/video.mpd',
      source_matches: true
    }]
  });

  try {
    const snapshot = await service.getCourseTranscriptHealth();
    assert.equal(snapshot.summary.ready, 0);
    assert.equal(snapshot.summary.missing, 1);
  } finally {
    pool.query = originalQuery;
  }
});
