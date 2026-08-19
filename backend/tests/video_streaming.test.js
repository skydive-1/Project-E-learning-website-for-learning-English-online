/**
 * Video Streaming & Upload Test Suite
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

const { isValidMp4, uploadVideoToSupabase, generateSignedUrl } = require('../src/utils/supabaseStorage');
const coursesService = require('../src/modules/courses/services/courses.service');
const lessonsController = require('../src/modules/lessons/controllers/lessons.controller');

describe('🎬 Video Streaming & Security Test Suite', () => {
  const sampleMp4Path = path.join(__dirname, '../uploads/videos/valid_test_video.mp4');

  test('1. Validation MP4 Magic Bytes & MIME Type', () => {
    // A. File MP4 hợp lệ
    assert.strictEqual(fs.existsSync(sampleMp4Path), true, 'Sample MP4 file must exist');
    const valid = isValidMp4(sampleMp4Path);
    assert.strictEqual(valid, true, 'valid_test_video.mp4 must have valid ftyp header');

    // B. File giả mạo / non-MP4
    const fakeBuffer = Buffer.from('NOT_AN_MP4_FILE_CONTENT_AT_ALL');
    const fakeValid = isValidMp4(fakeBuffer);
    assert.strictEqual(fakeValid, false, 'Fake buffer must fail isValidMp4 check');
  });

  test('2. Feature Flag ENABLE_DRM_PACKAGING defaults to false', () => {
    const enableDrm = process.env.ENABLE_DRM_PACKAGING === 'true';
    // Mặc định hoặc khi gán false thì enableDrm phải là false
    assert.strictEqual(enableDrm, false, 'DRM Packaging should be disabled by default');
  });

  test('3. canUserAccessLesson Access Control Check', async () => {
    // Admin (Role 1) luôn có quyền
    const adminAccess = await coursesService.canUserAccessLesson(1, 13, 1);
    assert.strictEqual(adminAccess, true, 'Admin should have full access to lesson');

    // Lesson không tồn tại -> false
    const nonExistentAccess = await coursesService.canUserAccessLesson(999, 999999, 3);
    assert.strictEqual(nonExistentAccess, false, 'Non-existent lesson should return false');
  });

  test('4. HTTP Range Requests & Streaming Server (206, 416, 200)', async () => {
    // Khởi tạo app express mini để test endpoint stream độc lập
    const app = express();
    const mockLessonId = 9999;
    const testSecret = process.env.JWT_SECRET || 'elearning_video_secure_jwt_secret';

    // Mock service getLessonById
    const originalGetLessonById = coursesService.getLessonById;
    coursesService.getLessonById = async (id) => {
      if (Number(id) === mockLessonId) {
        return {
          lesson_id: mockLessonId,
          title: 'Test Stream Lesson',
          content_type: 'video',
          content_url: '/uploads/videos/valid_test_video.mp4'
        };
      }
      return null;
    };

    const originalCanAccess = coursesService.canUserAccessLesson;
    coursesService.canUserAccessLesson = async () => true;

    app.get('/api/lessons/video/stream/:lessonId', (req, res, next) => {
      req.user = { id: 1, roleId: 1 };
      return lessonsController.streamLessonVideo(req, res, next);
    });

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/lessons/video/stream/${mockLessonId}`;

    const fileSize = fs.statSync(sampleMp4Path).size;

    // A. Test Range Request hợp lệ (0-1023) -> HTTP 206 Partial Content
    const rangeRes = await fetch(baseUrl, {
      headers: { Range: 'bytes=0-1023' }
    });
    assert.strictEqual(rangeRes.status, 206, 'Valid range request must return HTTP 206');
    assert.strictEqual(rangeRes.headers.get('content-range'), `bytes 0-1023/${fileSize}`);
    assert.strictEqual(rangeRes.headers.get('content-type'), 'video/mp4');
    assert.strictEqual(rangeRes.headers.get('accept-ranges'), 'bytes');
    const rangeBody = await rangeRes.arrayBuffer();
    assert.strictEqual(rangeBody.byteLength, 1024);

    // B. Test Range ngoài phạm vi (start >= fileSize) -> HTTP 416
    const invalidRangeRes = await fetch(baseUrl, {
      headers: { Range: `bytes=${fileSize + 1000}-${fileSize + 2000}` }
    });
    assert.strictEqual(invalidRangeRes.status, 416, 'Out-of-range request must return HTTP 416');
    assert.strictEqual(invalidRangeRes.headers.get('content-range'), `bytes */${fileSize}`);

    // C. Test Full Stream Request không có Range -> HTTP 200
    const fullRes = await fetch(baseUrl);
    assert.strictEqual(fullRes.status, 200, 'Request without range must return HTTP 200');
    assert.strictEqual(fullRes.headers.get('content-type'), 'video/mp4');
    const fullBody = await fullRes.arrayBuffer();
    assert.strictEqual(fullBody.byteLength, fileSize);

    // D. Test Lesson không tồn tại -> HTTP 404
    const notFoundRes = await fetch(`http://localhost:${port}/api/lessons/video/stream/888888`);
    assert.strictEqual(notFoundRes.status, 404, 'Non-existent lesson must return HTTP 404');

    // Cleanup server
    await new Promise(resolve => server.close(resolve));
    coursesService.getLessonById = originalGetLessonById;
    coursesService.canUserAccessLesson = originalCanAccess;
  });

  test('5. Supabase Signed URL Generator for Local Paths returns null', async () => {
    // Không bao giờ gọi Supabase cho đường dẫn local
    const localRes = await generateSignedUrl('/uploads/courses/videos/sample.mp4', 'videos');
    assert.strictEqual(localRes, null, 'Local /uploads/ path must return null from generateSignedUrl');
  });

  after(async () => {
    try {
      const db = require('../src/config/database');
      if (db.pool) await db.pool.end();
    } catch (e) {}
  });
});
