/**
 * Comprehensive Test Suite: SafePath, Pending Claim, Durable Media Pipeline & DASH DRM (R2.1)
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { resolveSafePath, UPLOADS_ROOT } = require('../src/utils/safePath.util');
const orphanCleanupService = require('../src/utils/orphanCleanup.service');
const coursesService = require('../src/modules/courses/services/courses.service');
const db = require('../src/config/database');

describe('🛡️ 1. SafePath Utility Security & Boundary Checks', () => {
  test('Phân giải đường dẫn hợp lệ bên trong uploads', () => {
    const safe = resolveSafePath(UPLOADS_ROOT, 'courses/videos/sample.mp4');
    assert.ok(safe);
    assert.ok(safe.startsWith(UPLOADS_ROOT));
  });

  test('Chặn hoàn toàn Path Traversal (../ và /uploads/../../.env)', () => {
    const attack1 = resolveSafePath(UPLOADS_ROOT, '../../.env');
    assert.strictEqual(attack1, null, 'Phải chặn ../..');

    const attack2 = resolveSafePath(UPLOADS_ROOT, '/uploads/../../backend/src/config/database.js');
    assert.strictEqual(attack2, null, 'Phải chặn /uploads/../../ traversal');

    const attack3 = resolveSafePath(UPLOADS_ROOT, '../uploads_evil/secret.txt');
    assert.strictEqual(attack3, null, 'Phải chặn prefix sibling directory bypass');
  });

  test('Chặn Null Byte Injection', () => {
    const attack = resolveSafePath(UPLOADS_ROOT, 'courses/videos/sample.mp4\0.pdf');
    assert.strictEqual(attack, null, 'Phải chặn null byte injection');
  });
});

describe('📦 2. Pending Uploads & Fail-Closed Reference Checks', () => {
  test('Quy tắc Fail-Closed: isKeyReferenced trả về true nếu query gặp lỗi', async () => {
    const originalQuery = db.query;
    try {
      db.query = async () => {
        throw new Error('Database connection timeout');
      };

      const isRef = await orphanCleanupService.isKeyReferenced('courses/some-asset.mp4');
      assert.strictEqual(isRef, true, 'isKeyReferenced BẮT BUỘC trả về true khi DB lỗi (Fail-Closed)');
    } finally {
      db.query = originalQuery;
    }
  });

  test('So khớp chặt chẽ metadata khi claimPendingUpload', async () => {
    const mockClient = {
      query: async (sql, params) => {
        if (typeof sql === 'string' && sql.toLowerCase().includes('pending_media_uploads')) {
          return {
            rows: [{
              upload_id: 'test-upload-uuid',
              instructor_id: 10,
              storage_key: 'courses/10/asset/video.mp4',
              storage_bucket: 'videos',
              mime_type: 'video/mp4',
              size_bytes: 1024,
              checksum_sha256: 'abc123sha256',
              status: 'PENDING',
              expires_at: new Date(Date.now() + 3600000)
            }]
          };
        }
        return { rows: [] };
      }
    };

    // 1. Thất bại nếu sai instructorId
    await assert.rejects(async () => {
      await orphanCleanupService.claimPendingUpload({
        uploadId: 'test-upload-uuid',
        instructorId: 999, // Sai instructor
        userRole: 2,
        storageKey: 'courses/10/asset/video.mp4',
        client: mockClient
      });
    }, /quyền liên kết tài nguyên/);

    // 2. Thất bại nếu sai checksum SHA-256
    await assert.rejects(async () => {
      await orphanCleanupService.claimPendingUpload({
        uploadId: 'test-upload-uuid',
        instructorId: 10,
        userRole: 2,
        storageKey: 'courses/10/asset/video.mp4',
        checksumSha256: 'wrong_checksum',
        client: mockClient
      });
    }, /Mã băm SHA-256 không khớp/);
  });
});

describe('🎓 3. Courses Service Metadata & Publish Validation', () => {
  test('Phân giải Media Metadata trả về đầy đủ các trường và xử lý non-media chuẩn', () => {
    // Non-media (Quiz)
    const quizMeta = coursesService._resolveMediaMetadata({ type: 'quiz', title: 'Quiz 1' });
    assert.strictEqual(quizMeta.isNonMedia, true);
    assert.strictEqual(quizMeta.storageKey, null);
    assert.strictEqual(quizMeta.mediaStatus, null);
    assert.strictEqual(quizMeta.sizeBytes, 0);

    // Video Supabase
    const videoMeta = coursesService._resolveMediaMetadata({
      type: 'video',
      storageKey: 'courses/10/vid.mp4',
      storageBucket: 'videos',
      mimeType: 'video/mp4',
      sizeBytes: 5000,
      checksumSha256: 'hash123',
      mediaStatus: 'READY'
    });
    assert.strictEqual(videoMeta.isNonMedia, false);
    assert.strictEqual(videoMeta.storageProvider, 'supabase');
    assert.strictEqual(videoMeta.storageKey, 'courses/10/vid.mp4');
    assert.strictEqual(videoMeta.mediaStatus, 'READY');
  });

  test('Publish Validation: Chặn xuất bản nếu bài học media có status MISSING_SOURCE hoặc PENDING_AUDIT', () => {
    const invalidSections = [
      {
        title: 'Chương 1',
        lessons: [
          {
            title: 'Bài học 1',
            type: 'video',
            storageKey: 'courses/10/missing.mp4',
            mediaStatus: 'MISSING_SOURCE'
          }
        ]
      }
    ];

    assert.throws(() => {
      coursesService._validateCourseForPublish(invalidSections);
    }, (err) => {
      assert.strictEqual(err.code, 'UNVERIFIED_MEDIA_ASSETS');
      return true;
    });
  });
});
