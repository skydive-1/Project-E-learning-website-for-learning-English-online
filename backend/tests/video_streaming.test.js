/**
 * Video Streaming & Ticket Contract Test Suite (TASK-VIDEO-TICKET-CONTRACT-HOTFIX-01)
 * Run with: node --test tests/video_streaming.test.js
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../src/config/database');
const { authenticate, authenticateVideoToken } = require('../src/middleware/auth.middleware');
const supabaseStorage = require('../src/utils/supabaseStorage');
const { isValidMp4 } = supabaseStorage;
const coursesService = require('../src/modules/courses/services/courses.service');
const lessonsController = require('../src/modules/lessons/controllers/lessons.controller');

describe('🎬 Video Streaming & Ticket Contract Full Integration Test Suite', () => {
  const sampleMp4Path = path.join(__dirname, '../uploads/videos/valid_test_video.mp4');
  let server;
  let baseUrl;
  let originalQuery;
  let originalGetLessonById;
  let originalCanAccess;
  let originalGenerateSignedUrl;
  const originalJwtSecret = process.env.JWT_SECRET;
  const testSecret = 'test-video-ticket-secret-key-123456';

  const mockUsers = [
    { user_id: 1, email: 'student@example.com', username: 'student', full_name: 'Student One', role_id: 3 },
    { user_id: 2, email: 'hacker@example.com', username: 'hacker', full_name: 'Hacker User', role_id: 3 }
  ];

  before(async () => {
    process.env.JWT_SECRET = testSecret;
    originalQuery = db.query;
    originalGetLessonById = coursesService.getLessonById;
    originalCanAccess = coursesService.canUserAccessLesson;
    originalGenerateSignedUrl = supabaseStorage.generateSignedUrl;

    // Mock DB for auth middleware user lookup
    db.query = async (sqlText, params = []) => {
      const cleanSql = sqlText.trim();
      if (cleanSql.includes('FROM users WHERE user_id = $1 OR email = $2')) {
        const [userId, email] = params;
        const user = mockUsers.find((u) => u.user_id === Number(userId) || u.email === email);
        return { rows: user ? [user] : [] };
      }
      return { rows: [] };
    };

    // Mock courses service
    coursesService.canUserAccessLesson = async (userId, lessonId, roleId) => {
      if (Number(userId) === 2 || Number(lessonId) === 999) {
        return false; // User 2 has no access, lesson 999 is inaccessible
      }
      return true;
    };

    coursesService.getLessonById = async (id) => {
      const numId = Number(id);
      if (numId === 123) {
        return {
          lesson_id: 123,
          title: 'Local MP4 Lesson',
          content_type: 'video',
          content_url: '/uploads/videos/valid_test_video.mp4'
        };
      }
      if (numId === 44) {
        return {
          lesson_id: 44,
          title: 'Supabase Cloud Lesson 44',
          content_type: 'video',
          content_url: 'courses/5/eb5f9f73-a9c4-4fb3-9a71-57e2f8c1c752/lesson44.mp4'
        };
      }
      if (numId === 456) {
        return {
          lesson_id: 456,
          title: 'Another Lesson',
          content_type: 'video',
          content_url: '/uploads/videos/valid_test_video.mp4'
        };
      }
      if (numId === 789) {
        return {
          lesson_id: 789,
          title: 'PDF Lesson',
          content_type: 'pdf',
          content_url: '/uploads/lesson.pdf'
        };
      }
      return null;
    };

    // Mock generateSignedUrl for storage keys
    supabaseStorage.generateSignedUrl = async (filePath, bucket, expires) => {
      if (filePath && !filePath.startsWith('/uploads/') && !filePath.startsWith('uploads/')) {
        return `https://mock-supabase.supabase.co/storage/v1/object/sign/videos/${filePath}?token=mock_signed_token`;
      }
      return null;
    };

    // Express app using authentic production middlewares
    const app = express();
    app.use(express.json());

    // Mount real production routes
    app.get('/api/lessons/video/ticket/:lessonId', authenticate, lessonsController.getVideoTicket);
    app.get('/api/lessons/video/stream/:lessonId', authenticateVideoToken, lessonsController.streamLessonVideo);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    db.query = originalQuery;
    coursesService.getLessonById = originalGetLessonById;
    coursesService.canUserAccessLesson = originalCanAccess;
    supabaseStorage.generateSignedUrl = originalGenerateSignedUrl;
    process.env.JWT_SECRET = originalJwtSecret;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Validation MP4 Magic Bytes & MIME Type', () => {
    assert.strictEqual(fs.existsSync(sampleMp4Path), true, 'Sample MP4 file must exist');
    const valid = isValidMp4(sampleMp4Path);
    assert.strictEqual(valid, true, 'valid_test_video.mp4 must have valid ftyp header');

    const fakeBuffer = Buffer.from('NOT_AN_MP4_FILE_CONTENT_AT_ALL');
    const fakeValid = isValidMp4(fakeBuffer);
    assert.strictEqual(fakeValid, false, 'Fake buffer must fail isValidMp4 check');
  });

  test('2. Feature Flag ENABLE_DRM_PACKAGING defaults to false', () => {
    const enableDrm = process.env.ENABLE_DRM_PACKAGING === 'true';
    assert.strictEqual(enableDrm, false, 'DRM Packaging should be disabled by default');
  });

  test('3. Case 1: Valid Session JWT requests ticket -> 200 OK with short-lived ticket and streamUrl', async () => {
    const sessionToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      testSecret,
      { expiresIn: '7d' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/video/ticket/123`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(typeof data.ticket, 'string');
    assert.strictEqual(data.expiresIn, 60);
    assert.strictEqual(data.streamUrl, `/api/lessons/video/stream/123?ticket=${data.ticket}`);

    // Verify ticket payload contains proper fields
    const decodedTicket = jwt.verify(data.ticket, testSecret);
    assert.strictEqual(decodedTicket.type, 'video_stream_ticket');
    assert.strictEqual(Number(decodedTicket.lessonId), 123);
    assert.strictEqual(Number(decodedTicket.id), 1);
  });

  test('4. Case 2: User without lesson access receives 403 FORBIDDEN when requesting ticket', async () => {
    const unauthorizedSessionToken = jwt.sign(
      { id: 2, email: 'hacker@example.com', roleId: 3 },
      testSecret,
      { expiresIn: '7d' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/video/ticket/123`, {
      headers: { Authorization: `Bearer ${unauthorizedSessionToken}` }
    });
    const data = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'FORBIDDEN');
    assert.match(data.message, /không có quyền/);
  });

  test('5. Case 3: Session JWT passed directly to video stream is rejected with 403 TOKEN_INVALID', async () => {
    const sessionToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      testSecret,
      { expiresIn: '7d' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=${sessionToken}`);
    const data = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
    assert.match(data.message, /không đúng loại vé xem video/);
  });

  test('6. Case 4: Ticket with matching lessonId is accepted for stream', async () => {
    const validTicket = jwt.sign(
      { id: 1, userId: 1, roleId: 3, lessonId: 123, type: 'video_stream_ticket' },
      testSecret,
      { expiresIn: '60s' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=${validTicket}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'video/mp4');
    assert.strictEqual(res.headers.get('accept-ranges'), 'bytes');
  });

  test('7. Case 5: Ticket with mismatched lessonId is rejected with 403 TOKEN_INVALID', async () => {
    const mismatchedTicket = jwt.sign(
      { id: 1, userId: 1, roleId: 3, lessonId: 456, type: 'video_stream_ticket' },
      testSecret,
      { expiresIn: '60s' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=${mismatchedTicket}`);
    const data = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'TOKEN_INVALID');
    assert.match(data.message, /không khớp với bài học yêu cầu/);
  });

  test('8. Case 6: Expired ticket is rejected with 401 TOKEN_EXPIRED', async () => {
    const expiredTicket = jwt.sign(
      { id: 1, userId: 1, roleId: 3, lessonId: 123, type: 'video_stream_ticket' },
      testSecret,
      { expiresIn: -10 }
    );

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=${expiredTicket}`);
    const data = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_EXPIRED');
  });

  test('9. Case 7: Supabase storage key (Lesson 44) returns valid signed 302 redirect', async () => {
    const sessionToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      testSecret,
      { expiresIn: '7d' }
    );

    // 1. Get ticket for lesson 44
    const ticketRes = await fetch(`${baseUrl}/api/lessons/video/ticket/44`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    const ticketData = await ticketRes.json();
    assert.strictEqual(ticketRes.status, 200);
    assert.strictEqual(ticketData.success, true);

    // 2. Stream request for lesson 44 with redirect manual
    const streamRes = await fetch(`${baseUrl}${ticketData.streamUrl}`, {
      redirect: 'manual'
    });

    // Supabase key triggers 302 redirect to signed URL
    assert.strictEqual(streamRes.status, 302);
    const location = streamRes.headers.get('location');
    assert.ok(location, 'Must return a redirect Location header');
    assert.match(location, /^https?:\/\//);
  });

  test('10. Case 8: Local MP4 stream supports 206 Partial Content and 416 Out of Range', async () => {
    const validTicket = jwt.sign(
      { id: 1, userId: 1, roleId: 3, lessonId: 123, type: 'video_stream_ticket' },
      testSecret,
      { expiresIn: '60s' }
    );

    const fileSize = fs.statSync(sampleMp4Path).size;

    // Range Request 0-1023 -> 206
    const rangeRes = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=${validTicket}`, {
      headers: { Range: 'bytes=0-1023' }
    });
    assert.strictEqual(rangeRes.status, 206);
    assert.strictEqual(rangeRes.headers.get('content-range'), `bytes 0-1023/${fileSize}`);
    assert.strictEqual(rangeRes.headers.get('content-type'), 'video/mp4');

    // Out of range -> 416
    const oofRes = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=${validTicket}`, {
      headers: { Range: `bytes=${fileSize + 500}-${fileSize + 1000}` }
    });
    assert.strictEqual(oofRes.status, 416);
  });

  test('11. Case 9: Error responses are clean JSON, video responses are media/redirect', async () => {
    // Error response check
    const errRes = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=invalid-garbage`);
    assert.strictEqual(errRes.headers.get('content-type')?.includes('application/json'), true);
    const errData = await errRes.json();
    assert.strictEqual(errData.success, false);

    // Non-video lesson ticket request check
    const sessionToken = jwt.sign(
      { id: 1, email: 'student@example.com', roleId: 3 },
      testSecret,
      { expiresIn: '7d' }
    );
    const pdfRes = await fetch(`${baseUrl}/api/lessons/video/ticket/789`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    const pdfData = await pdfRes.json();
    assert.strictEqual(pdfRes.status, 400);
    assert.strictEqual(pdfData.code, 'INVALID_RESOURCE_TYPE');
  });
});
