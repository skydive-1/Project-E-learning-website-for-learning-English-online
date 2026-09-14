'use strict';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');
const db = require('../src/config/database');
const coursesService = require('../src/modules/courses/services/courses.service');

describe('Course save resilience', () => {
  const originalConnect = db.pool.connect;
  const originalQueueAutoSubtitles = coursesService._queueAutoSubtitles;
  const originalGetCourseById = coursesService.getCourseById;
  const originalReorganize = coursesService._reorganizeCourseMediaFolders;

  afterEach(() => {
    db.pool.connect = originalConnect;
    coursesService._queueAutoSubtitles = originalQueueAutoSubtitles;
    coursesService.getCourseById = originalGetCourseById;
    coursesService._reorganizeCourseMediaFolders = originalReorganize;
    mock.restoreAll();
  });

  it('returns the committed course even when post-commit jobs and response hydration fail', async () => {
    const queries = [];
    const client = {
      async query(sql) {
        const normalizedSql = String(sql).trim();
        queries.push(normalizedSql);
        if (/^INSERT INTO courses/i.test(normalizedSql)) {
          return {
            rows: [{
              course_id: 91,
              course_name: 'Khóa học an toàn',
              subject_id: 1,
              academy_roadmap: 'ielts',
              status: 'draft'
            }]
          };
        }
        return { rows: [] };
      },
      release: mock.fn()
    };

    db.pool.connect = async () => client;
    coursesService._reorganizeCourseMediaFolders = mock.fn(async () => {});
    coursesService._queueAutoSubtitles = mock.fn(async () => {
      throw new Error('subtitle worker unavailable');
    });
    coursesService.getCourseById = mock.fn(async () => {
      throw new Error('response hydration unavailable');
    });
    mock.method(console, 'warn', () => {});

    const result = await coursesService.createCourse({
      courseName: 'Khóa học an toàn',
      subjectId: 1,
      academyRoadmap: 'ielts',
      status: 0,
      sections: []
    }, 7, 2);

    assert.equal(result.course_id, 91);
    assert.equal(result.status, 0);
    assert.ok(queries.includes('COMMIT'));
    assert.ok(!queries.includes('ROLLBACK'), 'không rollback hoặc báo thất bại sau khi dữ liệu đã commit');
    assert.equal(client.release.mock.callCount(), 1);
  });
});
