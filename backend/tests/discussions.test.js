const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const http = require('http');

const discussionsRoutes = require('../src/modules/discussions/discussions.routes');
const discussionsController = require('../src/modules/discussions/controllers/discussions.controller');
const discussionsService = require('../src/modules/discussions/services/discussions.service');
const coursesService = require('../src/modules/courses/services/courses.service');
const db = require('../src/config/database');

describe('Discussions API authentication boundary', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/discussions', discussionsRoutes);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  it('rejects anonymous student and instructor reads', async () => {
    const [studentResponse, instructorResponse, sendResponse] = await Promise.all([
      fetch(`${baseUrl}/api/discussions/lesson/10`),
      fetch(`${baseUrl}/api/discussions/instructor/threads`),
      fetch(`${baseUrl}/api/discussions/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonId: 10, content: 'Test' })
      })
    ]);

    assert.strictEqual(studentResponse.status, 401);
    assert.strictEqual(instructorResponse.status, 401);
    assert.strictEqual(sendResponse.status, 401);
  });
});

describe('Discussions controller identity boundary', () => {
  it('uses authenticated identity and ignores identity fields in the body', async () => {
    const originalCreate = discussionsService.createDiscussion;
    let receivedUser;
    let receivedPayload;
    discussionsService.createDiscussion = async (user, payload) => {
      receivedUser = user;
      receivedPayload = payload;
      return { id: 12 };
    };

    const response = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };

    try {
      await discussionsController.createDiscussion({
        user: { id: 42, roleId: 3 },
        body: { lessonId: 7, title: 'Question', content: 'Content', studentId: 999 }
      }, response, error => { throw error; });

      assert.strictEqual(receivedUser.id, 42);
      assert.strictEqual(receivedPayload.studentId, 999);
      assert.strictEqual(response.statusCode, 201);
      assert.strictEqual(response.body.data.discussion.id, 12);
    } finally {
      discussionsService.createDiscussion = originalCreate;
    }
  });
});

describe('Discussions service authorization and state transitions', () => {
  it('denies a student access to another student thread', async () => {
    const originalQuery = db.query;
    db.query = async sql => {
      if (sql.includes('FROM course_discussions d')) {
        return { rows: [{ discussion_id: 5, student_id: 77, instructor_id: 9 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    };

    try {
      await assert.rejects(
        () => discussionsService.getThreadAccess(5, { id: 42, roleId: 3 }),
        error => error.status === 403 && error.code === 'DISCUSSION_ACCESS_DENIED'
      );
    } finally {
      db.query = originalQuery;
    }
  });

  it('denies an instructor access to a course owned by another instructor', async () => {
    const originalQuery = db.query;
    db.query = async () => ({
      rows: [{ discussion_id: 5, student_id: 77, instructor_id: 99 }]
    });

    try {
      await assert.rejects(
        () => discussionsService.getThreadAccess(5, { id: 9, roleId: 2 }),
        error => error.status === 403 && error.code === 'DISCUSSION_ACCESS_DENIED'
      );
    } finally {
      db.query = originalQuery;
    }
  });

  it('derives course and student identity on discussion creation', async () => {
    const originalGetContext = discussionsService.getLessonContext;
    const originalCanAccess = coursesService.canUserAccessLesson;
    const originalGetDiscussion = discussionsService.getDiscussion;
    const originalQuery = db.query;
    let insertValues;

    discussionsService.getLessonContext = async () => ({ course_id: 88 });
    coursesService.canUserAccessLesson = async () => true;
    discussionsService.getDiscussion = async (id, user) => ({ id, studentId: user.id });
    db.query = async (sql, values) => {
      if (sql.includes('INSERT INTO course_discussions')) {
        insertValues = values;
        return { rows: [{ discussion_id: 321 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    };

    try {
      const created = await discussionsService.createDiscussion(
        { id: 42, roleId: 3 },
        {
          lessonId: 7,
          courseId: 999,
          studentId: 999,
          title: 'Câu hỏi về mệnh đề quan hệ',
          content: 'Vì sao câu này dùng waiting?',
          timestampSeconds: 12
        }
      );

      assert.deepStrictEqual(insertValues.slice(0, 3), [88, 7, 42]);
      assert.strictEqual(created.id, 321);
      assert.strictEqual(created.studentId, 42);
    } finally {
      discussionsService.getLessonContext = originalGetContext;
      coursesService.canUserAccessLesson = originalCanAccess;
      discussionsService.getDiscussion = originalGetDiscussion;
      db.query = originalQuery;
    }
  });

  it('updates a thread atomically when an instructor replies', async () => {
    const originalAccess = discussionsService.getThreadAccess;
    const originalGetDiscussion = discussionsService.getDiscussion;
    const originalGetClient = db.getClient;
    const calls = [];

    discussionsService.getThreadAccess = async () => ({ discussion_id: 5, instructor_id: 9 });
    discussionsService.getDiscussion = async () => ({ id: 5, status: 'answered' });
    db.getClient = async () => ({
      query: async (sql, values) => {
        calls.push({ sql, values });
        return { rows: [] };
      },
      release: () => calls.push({ sql: 'RELEASE' })
    });

    try {
      const result = await discussionsService.addReply(
        { id: 9, roleId: 2 },
        5,
        'Em dùng waiting vì candidate là chủ thể thực hiện hành động.'
      );

      const update = calls.find(call => call.sql.includes('UPDATE course_discussions'));
      assert.deepStrictEqual(update.values, [5, 'answered', true, false]);
      assert.ok(calls.some(call => call.sql === 'COMMIT'));
      assert.ok(calls.some(call => call.sql === 'RELEASE'));
      assert.strictEqual(result.status, 'answered');
    } finally {
      discussionsService.getThreadAccess = originalAccess;
      discussionsService.getDiscussion = originalGetDiscussion;
      db.getClient = originalGetClient;
    }
  });

  it('reuses the authenticated student active lesson thread and stores message metadata', async () => {
    const originalAccess = discussionsService.assertStudentLessonAccess;
    const originalGetDiscussion = discussionsService.getDiscussion;
    const originalGetClient = db.getClient;
    const calls = [];

    discussionsService.assertStudentLessonAccess = async () => ({ course_id: 88 });
    discussionsService.getDiscussion = async (id, user) => ({ id, studentId: user.id });
    db.getClient = async () => ({
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('SELECT discussion_id')) {
          return { rows: [{ discussion_id: 55 }] };
        }
        return { rows: [] };
      },
      release: () => calls.push({ sql: 'RELEASE' })
    });

    try {
      const result = await discussionsService.sendStudentMessage(
        { id: 42, roleId: 3 },
        {
          lessonId: 7,
          courseId: 999,
          studentId: 999,
          content: 'Em chưa hiểu đoạn này.',
          aiResponse: 'Ngữ cảnh AI đã kiểm tra',
          timestampSeconds: 95
        }
      );

      const activeThreadQuery = calls.find(call => call.sql.includes('SELECT discussion_id'));
      const replyInsert = calls.find(call => call.sql.includes('INSERT INTO course_discussion_replies'));
      assert.deepStrictEqual(activeThreadQuery.values, [88, 7, 42]);
      assert.deepStrictEqual(replyInsert.values, [55, 42, 'Em chưa hiểu đoạn này.', 'Ngữ cảnh AI đã kiểm tra', 95]);
      assert.ok(calls.some(call => call.sql === 'COMMIT'));
      assert.strictEqual(result.id, 55);
      assert.strictEqual(result.studentId, 42);
    } finally {
      discussionsService.assertStudentLessonAccess = originalAccess;
      discussionsService.getDiscussion = originalGetDiscussion;
      db.getClient = originalGetClient;
    }
  });

  it('creates the first lesson conversation when no active thread exists', async () => {
    const originalAccess = discussionsService.assertStudentLessonAccess;
    const originalGetDiscussion = discussionsService.getDiscussion;
    const originalGetClient = db.getClient;
    const calls = [];

    discussionsService.assertStudentLessonAccess = async () => ({ course_id: 88 });
    discussionsService.getDiscussion = async id => ({ id });
    db.getClient = async () => ({
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('SELECT discussion_id')) return { rows: [] };
        if (sql.includes('INSERT INTO course_discussions')) {
          return { rows: [{ discussion_id: 77 }] };
        }
        return { rows: [] };
      },
      release: () => calls.push({ sql: 'RELEASE' })
    });

    try {
      const result = await discussionsService.sendStudentMessage(
        { id: 42, roleId: 3 },
        { lessonId: 7, content: 'Em cần giảng viên giải thích thêm.' }
      );

      const insert = calls.find(call => call.sql.includes('INSERT INTO course_discussions'));
      assert.deepStrictEqual(insert.values.slice(0, 3), [88, 7, 42]);
      assert.strictEqual(insert.values[4], 'Em cần giảng viên giải thích thêm.');
      assert.strictEqual(result.id, 77);
      assert.ok(calls.some(call => call.sql === 'COMMIT'));
    } finally {
      discussionsService.assertStudentLessonAccess = originalAccess;
      discussionsService.getDiscussion = originalGetDiscussion;
      db.getClient = originalGetClient;
    }
  });

  it('validates status values before writing', async () => {
    await assert.rejects(
      () => discussionsService.updateStatus({ id: 42, roleId: 3 }, 5, 'deleted'),
      error => error.status === 400 && error.code === 'VALIDATION_ERROR'
    );
  });
});
