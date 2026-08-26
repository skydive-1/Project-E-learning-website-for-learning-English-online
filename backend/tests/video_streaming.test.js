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
const drmController = require('../src/modules/drm/drm.controller');
const { resolveBoundedRange, sanitizeLessonMediaForClient } = require('../src/utils/videoSecurity.util');

describe('🎬 Video Streaming & Ticket Contract Full Integration Test Suite', () => {
  const sampleMp4Path = path.join(__dirname, '../uploads/videos/valid_test_video.mp4');
  let server;
  let baseUrl;
  let originalQuery;
  let originalGetLessonById;
  let originalCanAccess;
  let originalGenerateSignedUrl;
  let originalFetchPrivateObject;
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
    originalFetchPrivateObject = supabaseStorage.fetchPrivateObject;

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
          content_url: 'courses/5/eb5f9f73-a9c4-4fb3-9a71-57e2f8c1c752/lesson44.mp4',
          storage_key: 'courses/5/eb5f9f73-a9c4-4fb3-9a71-57e2f8c1c752/lesson44.mp4',
          storage_provider: 'supabase',
          storage_bucket: 'videos',
          size_bytes: 4096,
          media_status: 'READY'
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
    supabaseStorage.fetchPrivateObject = async (filePath, bucket, rangeHeader) => {
      const match = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader || '');
      const start = match ? Number(match[1]) : 0;
      const end = match ? Math.min(Number(match[2]), 4095) : 4095;
      const body = Buffer.alloc(Math.max(0, end - start + 1), 7);
      return new Response(body, {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(body.length),
          'Content-Range': `bytes ${start}-${end}/4096`,
          'Accept-Ranges': 'bytes'
        }
      });
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
    supabaseStorage.fetchPrivateObject = originalFetchPrivateObject;
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
    assert.strictEqual(data.streamUrl, '/api/lessons/video/stream/123');
    assert.match(res.headers.get('set-cookie') || '', /video_playback_ticket=.*HttpOnly/i);
    assert.strictEqual(data.streamUrl.includes('ticket='), false);

    // Verify ticket payload contains proper fields
    const decodedTicket = jwt.verify(data.ticket, testSecret);
    assert.strictEqual(decodedTicket.type, 'video_stream_ticket');
    assert.strictEqual(Number(decodedTicket.lessonId), 123);
    assert.strictEqual(Number(decodedTicket.id), 1);
    assert.strictEqual(typeof decodedTicket.jti, 'string');
    assert.strictEqual(typeof decodedTicket.clientHash, 'string');
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

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123`, {
      headers: { 'X-Video-Ticket': sessionToken }
    });
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

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123`, {
      headers: { 'X-Video-Ticket': validTicket }
    });
    assert.strictEqual(res.status, 206);
    assert.strictEqual(res.headers.get('content-type'), 'video/mp4');
    assert.strictEqual(res.headers.get('accept-ranges'), 'bytes');
  });

  test('7. Case 5: Ticket with mismatched lessonId is rejected with 403 TOKEN_INVALID', async () => {
    const mismatchedTicket = jwt.sign(
      { id: 1, userId: 1, roleId: 3, lessonId: 456, type: 'video_stream_ticket' },
      testSecret,
      { expiresIn: '60s' }
    );

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123`, {
      headers: { 'X-Video-Ticket': mismatchedTicket }
    });
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

    const res = await fetch(`${baseUrl}/api/lessons/video/stream/123`, {
      headers: { 'X-Video-Ticket': expiredTicket }
    });
    const data = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.code, 'TOKEN_EXPIRED');
  });

  test('9. Case 7: Supabase storage key is proxied and never leaks a signed redirect', async () => {
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

    // 2. Stream request stays on the backend and returns only a bounded range.
    const streamRes = await fetch(`${baseUrl}${ticketData.streamUrl}`, {
      redirect: 'manual',
      headers: {
        'X-Video-Ticket': ticketData.ticket,
        Range: 'bytes=0-1023'
      }
    });

    assert.strictEqual(streamRes.status, 206);
    assert.strictEqual(streamRes.headers.get('location'), null);
    assert.strictEqual(streamRes.headers.get('content-range'), 'bytes 0-1023/4096');
    assert.strictEqual((await streamRes.arrayBuffer()).byteLength, 1024);
  });

  test('10. Case 8: Local MP4 stream supports 206 Partial Content and 416 Out of Range', async () => {
    const validTicket = jwt.sign(
      { id: 1, userId: 1, roleId: 3, lessonId: 123, type: 'video_stream_ticket' },
      testSecret,
      { expiresIn: '60s' }
    );

    const fileSize = fs.statSync(sampleMp4Path).size;

    // Range Request 0-1023 -> 206
    const rangeRes = await fetch(`${baseUrl}/api/lessons/video/stream/123`, {
      headers: { Range: 'bytes=0-1023', 'X-Video-Ticket': validTicket }
    });
    assert.strictEqual(rangeRes.status, 206);
    assert.strictEqual(rangeRes.headers.get('content-range'), `bytes 0-1023/${fileSize}`);
    assert.strictEqual(rangeRes.headers.get('content-type'), 'video/mp4');

    // Out of range -> 416
    const oofRes = await fetch(`${baseUrl}/api/lessons/video/stream/123`, {
      headers: { Range: `bytes=${fileSize + 500}-${fileSize + 1000}`, 'X-Video-Ticket': validTicket }
    });
    assert.strictEqual(oofRes.status, 416);
  });

  test('11. Case 9: Error responses are clean JSON, video responses are media/redirect', async () => {
    // Error response check
    const errRes = await fetch(`${baseUrl}/api/lessons/video/stream/123`, {
      headers: { 'X-Video-Ticket': 'invalid-garbage' }
    });
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

  test('12. Query-string tickets are rejected by default and ranges are capped', async () => {
    const validTicket = jwt.sign(
      { id: 1, userId: 1, roleId: 3, lessonId: 123, type: 'video_stream_ticket' },
      testSecret,
      { expiresIn: '60s' }
    );

    const queryRes = await fetch(`${baseUrl}/api/lessons/video/stream/123?ticket=${validTicket}`);
    const queryData = await queryRes.json();
    assert.strictEqual(queryRes.status, 401);
    assert.strictEqual(queryData.code, 'QUERY_TICKET_DISABLED');

    const bounded = resolveBoundedRange('bytes=0-99999999', 100000000);
    assert.strictEqual(bounded.valid, true);
    assert.strictEqual(bounded.length, 8 * 1024 * 1024);
  });

  test('13. Client metadata redacts external source URLs', () => {
    const safeLesson = sanitizeLessonMediaForClient({
      lesson_id: 46,
      content_type: 'video',
      content_url: 'https://cdn.example.com/private-course.mp4',
      storage_key: 'https://cdn.example.com/private-course.mp4'
    });
    assert.strictEqual(safeLesson.content_url, 'protected-video-source');
    assert.strictEqual(safeLesson.storage_key, null);
    assert.strictEqual(JSON.stringify(safeLesson).includes('cdn.example.com'), false);
  });

  test('14. DRM info never returns a decryption key and mismatched KID is rejected', async () => {
    const createRes = () => ({
      statusCode: 200,
      headers: {},
      payload: null,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
      end() { return this; }
    });

    const previousGetLessonById = coursesService.getLessonById;
    coursesService.getLessonById = async (lessonId) => ({
      lesson_id: Number(lessonId),
      content_type: 'video',
      content_url: '/uploads/videos/test_drm.mpd'
    });

    try {
      const infoRes = createRes();
      await drmController.getLessonDrmInfo({
        params: { lessonId: '123' },
        user: { id: 1, roleId: 3 }
      }, infoRes);
      assert.strictEqual(infoRes.statusCode, 200);
      assert.strictEqual(JSON.stringify(infoRes.payload).includes('secretKey'), false);
      assert.strictEqual(JSON.stringify(infoRes.payload).includes('keyIdHex'), false);

      const licenseRes = createRes();
      await drmController.getClearKeyLicense({
        method: 'POST',
        params: { lessonId: '123' },
        query: {},
        body: { kids: ['not-the-key-for-this-lesson'] },
        user: { id: 1, roleId: 3, email: 'student@example.com' }
      }, licenseRes);
      assert.strictEqual(licenseRes.statusCode, 403);
      assert.strictEqual(licenseRes.payload.code, 'DRM_KEY_ID_MISMATCH');
    } finally {
      coursesService.getLessonById = previousGetLessonById;
    }
  });
});
