const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const db = require('../src/config/database');
const supabaseStorage = require('../src/utils/supabaseStorage');
const orphanCleanupService = require('../src/utils/orphanCleanup.service');
const coursesService = require('../src/modules/courses/services/courses.service');
const lessonsService = require('../src/modules/lessons/services/lessons.service');
const ragIngestionService = require('../src/modules/lessons/services/ragIngestion.service');
const {
  classifyMediaSource,
  parseSupabaseStorageUrl,
  resolveLocalUploadPath,
  UPLOADS_ROOT
} = require('../scripts/audit_and_migrate_media');

describe('🧹 TASK-DURABLE-VIDEO-MEDIA-MERGE-BLOCKERS-R2: Orphan Asset Cleanup & Classifier Test Suite', () => {
  let origDeleteStorageObject;
  let origQuery;
  let origPool;
  let origDeleteLessonVectors;
  let deletedFromStorage = [];

  before(() => {
    origDeleteStorageObject = supabaseStorage.deleteStorageObject;
    origQuery = db.query;
    origPool = db.pool;
    origDeleteLessonVectors = ragIngestionService.deleteLessonVectors;
  });

  after(() => {
    supabaseStorage.deleteStorageObject = origDeleteStorageObject;
    db.query = origQuery;
    db.pool = origPool;
    ragIngestionService.deleteLessonVectors = origDeleteLessonVectors;
  });

  beforeEach(() => {
    deletedFromStorage = [];
    supabaseStorage.deleteStorageObject = async (key, bucket) => {
      deletedFromStorage.push({ key, bucket });
      return true;
    };
    ragIngestionService.deleteLessonVectors = async () => ({ deletedCount: 0 });
  });

  describe('1. Pure Classifier & Path Traversal Security', () => {
    it('1.1. classifyMediaSource handles non-media lessons (quiz, speaking, text) as NON_MEDIA', () => {
      const resQuiz = classifyMediaSource({ contentType: 'quiz', contentUrl: '' });
      assert.strictEqual(resQuiz.category, 'NON_MEDIA');
      assert.strictEqual(resQuiz.bucket, null);
      assert.strictEqual(resQuiz.mimeType, null);

      const resSpeaking = classifyMediaSource({ contentType: 'speaking', contentUrl: '' });
      assert.strictEqual(resSpeaking.category, 'NON_MEDIA');

      const resText = classifyMediaSource({ contentType: 'text', contentUrl: '' });
      assert.strictEqual(resText.category, 'NON_MEDIA');
    });

    it('1.2. parseSupabaseStorageUrl parses full Supabase signed/public/authenticated URLs correctly', () => {
      const fullUrl = 'https://abcdefgh.supabase.co/storage/v1/object/public/videos/courses/1/uuid123/lesson.mp4';
      const parsed = parseSupabaseStorageUrl(fullUrl);
      assert.ok(parsed);
      assert.strictEqual(parsed.bucket, 'videos');
      assert.strictEqual(parsed.key, 'courses/1/uuid123/lesson.mp4');

      const fullDocUrl = 'https://abcdefgh.supabase.co/storage/v1/object/sign/documents/courses/2/doc.pdf?token=xyz';
      const parsedDoc = parseSupabaseStorageUrl(fullDocUrl);
      assert.ok(parsedDoc);
      assert.strictEqual(parsedDoc.bucket, 'documents');
      assert.strictEqual(parsedDoc.key, 'courses/2/doc.pdf');
    });

    it('1.3. classifyMediaSource identifies external CDN URLs vs Supabase storage keys', () => {
      const ext = classifyMediaSource({ contentType: 'video', contentUrl: 'https://cdn.example.com/video.mp4' });
      assert.strictEqual(ext.category, 'EXTERNAL_URL');

      const sup = classifyMediaSource({ contentType: 'video', contentUrl: 'courses/1/asset/video.mp4' });
      assert.strictEqual(sup.category, 'SUPABASE_KEY');
      assert.strictEqual(sup.bucket, 'videos');
      assert.strictEqual(sup.mimeType, 'video/mp4');

      const pdf = classifyMediaSource({ contentType: 'pdf', contentUrl: 'courses/1/asset/document.pdf' });
      assert.strictEqual(pdf.category, 'SUPABASE_KEY');
      assert.strictEqual(pdf.bucket, 'documents');
      assert.strictEqual(pdf.mimeType, 'application/pdf');
    });

    it('1.4. resolveLocalUploadPath prevents path traversal attacks', () => {
      const valid = resolveLocalUploadPath('/uploads/courses/videos/lesson.mp4');
      assert.ok(valid);
      assert.ok(valid.startsWith(UPLOADS_ROOT));

      const traversal1 = resolveLocalUploadPath('/uploads/../../etc/passwd');
      assert.strictEqual(traversal1, null);

      const traversal2 = resolveLocalUploadPath('/uploads/../sensitive.env');
      assert.strictEqual(traversal2, null);
    });
  });

  describe('2. Orphan Cleanup Logic & Shared Reference Guard', () => {
    it('2.1. isKeyReferenced returns true when storage_key exists in lessons or lesson_materials', async () => {
      db.query = async (sql, params) => {
        if (sql.includes('SELECT COUNT(*) FROM lessons')) {
          if (params[0] === 'courses/shared/asset.mp4') {
            return { rows: [{ total_ref: '2' }] };
          }
          return { rows: [{ total_ref: '0' }] };
        }
        return { rows: [] };
      };

      const isShared = await orphanCleanupService.isKeyReferenced('courses/shared/asset.mp4');
      assert.strictEqual(isShared, true);

      const isOrphan = await orphanCleanupService.isKeyReferenced('courses/orphan/old.mp4');
      assert.strictEqual(isOrphan, false);
    });

    it('2.2. cleanupUnreferencedAssets deletes orphan assets but skips shared referenced assets', async () => {
      db.query = async (sql, params) => {
        if (sql.includes('SELECT COUNT(*) FROM lessons')) {
          if (params[0] === 'courses/shared/keep.mp4') {
            return { rows: [{ total_ref: '1' }] };
          }
          return { rows: [{ total_ref: '0' }] };
        }
        return { rows: [] };
      };

      const result = await orphanCleanupService.cleanupUnreferencedAssets([
        { key: 'courses/shared/keep.mp4', bucket: 'videos' },
        { key: 'courses/orphan/delete_me.mp4', bucket: 'videos' },
        { key: 'courses/orphan/delete_doc.pdf', bucket: 'documents' },
        { key: 'https://cdn.example.com/external.mp4', bucket: 'videos' } // should be skipped
      ]);

      assert.strictEqual(result.cleanedCount, 2);
      assert.strictEqual(deletedFromStorage.length, 2);
      assert.strictEqual(deletedFromStorage[0].key, 'courses/orphan/delete_me.mp4');
      assert.strictEqual(deletedFromStorage[0].bucket, 'videos');
      assert.strictEqual(deletedFromStorage[1].key, 'courses/orphan/delete_doc.pdf');
      assert.strictEqual(deletedFromStorage[1].bucket, 'documents');
    });

    it('2.3. rollbackNewUploads deletes all newly uploaded files on DB transaction rollback', async () => {
      await orphanCleanupService.rollbackNewUploads([
        { key: 'courses/temp/upload1.mp4', bucket: 'videos' },
        { key: 'courses/temp/upload2.pdf', bucket: 'documents' }
      ]);

      assert.strictEqual(deletedFromStorage.length, 2);
      assert.strictEqual(deletedFromStorage[0].key, 'courses/temp/upload1.mp4');
      assert.strictEqual(deletedFromStorage[1].key, 'courses/temp/upload2.pdf');
    });

    it('2.4. rollbackUploadedAssetBundle deduplicates objects and durably records delete failures', async () => {
      const failedDeletionKeys = [];
      db.query = async (sql, params) => {
        if (String(sql).includes('SELECT COUNT(*) FROM lessons')) {
          return { rows: [{ total_ref: '0' }] };
        }
        if (String(sql).includes('INSERT INTO failed_storage_deletions')) {
          failedDeletionKeys.push(params[1]);
        }
        return { rows: [] };
      };
      supabaseStorage.deleteStorageObject = async (key, bucket, provider) => {
        deletedFromStorage.push({ key, bucket, provider });
        return !key.endsWith('/audio.mp4');
      };

      const result = await orphanCleanupService.rollbackUploadedAssetBundle([
        { storageKey: 'courses/43/asset/source.mp4', storageBucket: 'videos', storageProvider: 'r2' },
        { storageKey: 'courses/43/asset/source.mp4', storageBucket: 'videos', storageProvider: 'r2' },
        { storageKey: 'courses/43/asset/audio.mp4', storageBucket: 'videos', storageProvider: 'r2' }
      ]);

      assert.equal(deletedFromStorage.length, 2, 'mỗi object trong bundle chỉ được xóa một lần');
      assert.equal(result.deletedCount, 1);
      assert.equal(result.deferredCount, 1);
      assert.deepEqual(failedDeletionKeys, ['courses/43/asset/audio.mp4']);
    });

    it('2.5. expired DRM pending upload cleans manifest and every sibling object', async () => {
      const statusUpdates = [];
      db.query = async (sql, params) => {
        const text = String(sql);
        if (text.includes('SELECT COUNT(*) FROM lessons')) {
          return { rows: [{ total_ref: '0' }] };
        }
        if (text.includes("SET status = 'EXPIRED'")) statusUpdates.push(params[0]);
        return { rows: [] };
      };

      const result = await orphanCleanupService.cleanupPendingUploadRows([{
        upload_id: '00000000-0000-4000-8000-000000000043',
        storage_key: 'courses/43/videos/asset/manifest.mpd',
        storage_bucket: 'videos',
        storage_provider: 'r2'
      }]);

      assert.equal(result.cleanedCount, 1);
      assert.deepEqual(
        deletedFromStorage.map(item => item.key).sort(),
        [
          'courses/43/videos/asset/audio.mp4',
          'courses/43/videos/asset/manifest.mpd',
          'courses/43/videos/asset/source.mp4',
          'courses/43/videos/asset/video.mp4'
        ].sort()
      );
      assert.deepEqual(statusUpdates, ['00000000-0000-4000-8000-000000000043']);
    });
  });

  describe('3. Course Service Integration: Replace Asset & Delete Course', () => {
    it('3.1. deleteCourse collects course assets before deletion and triggers orphan cleanup', async () => {
      db.query = async (sql, params) => {
        if (sql.includes('SELECT course_id, instructor_id FROM courses')) {
          return { rows: [{ course_id: 10, instructor_id: 2 }] };
        }
        if (sql.includes('FROM lessons l') && sql.includes('course_id = $1')) {
          return {
            rows: [
              { storage_key: 'courses/10/uuid1/video.mp4', storage_bucket: 'videos', storage_provider: 'supabase' },
              { storage_key: 'courses/10/uuid2/doc.pdf', storage_bucket: 'documents', storage_provider: 'supabase' }
            ]
          };
        }
        if (sql.includes('DELETE FROM courses')) {
          return { rows: [{ course_id: params[0] }] };
        }
        if (sql.includes('SELECT COUNT(*) FROM lessons')) {
          return { rows: [{ total_ref: '0' }] };
        }
        return { rows: [] };
      };

      db.pool = {
        connect: async () => ({
          query: db.query,
          release: () => {}
        })
      };

      const deleted = await coursesService.deleteCourse(10);
      assert.strictEqual(deleted, true);

      // Cho phép async unreferenced cleanup hoàn tất
      await new Promise(r => setTimeout(r, 50));
      assert.strictEqual(deletedFromStorage.length, 2);
      assert.strictEqual(deletedFromStorage[0].key, 'courses/10/uuid1/video.mp4');
      assert.strictEqual(deletedFromStorage[1].key, 'courses/10/uuid2/doc.pdf');
    });

    it('3.2. deleteLesson in lessonsService triggers orphan cleanup for unreferenced asset', async () => {
      db.query = async (sql, params) => {
        if (sql.includes('FROM lessons l') && sql.includes('l.lesson_id = $1')) {
          return {
            rows: [
              { storage_key: 'courses/5/eb5f9f73/video44.mp4', storage_bucket: 'videos', storage_provider: 'supabase' }
            ]
          };
        }
        if (sql.includes('DELETE FROM lessons')) {
          return { rows: [{ lesson_id: params[0] }] };
        }
        if (sql.includes('SELECT COUNT(*) FROM lessons')) {
          return { rows: [{ total_ref: '0' }] };
        }
        return { rows: [] };
      };

      const deleted = await lessonsService.deleteLesson(44);
      assert.strictEqual(deleted, true);

      await new Promise(r => setTimeout(r, 50));
      assert.strictEqual(deletedFromStorage.length, 1);
      assert.strictEqual(deletedFromStorage[0].key, 'courses/5/eb5f9f73/video44.mp4');
    });

    it('3.3. deleteCourse chuyển pending uploads sang CLEANING trước cascade và dọn object sau commit', async () => {
      const stagedUploadIds = [];

      db.query = async (sql, params) => {
        if (sql.includes('SELECT course_id, instructor_id FROM courses')) {
          return { rows: [{ course_id: 20, instructor_id: 2 }] };
        }
        if (sql.includes('UPDATE pending_media_uploads p') && sql.includes("SET status = 'CLEANING'")) {
          stagedUploadIds.push('mocked-upload-eb1bc770');
          return {
            rows: [{
              upload_id: 'mocked-upload-eb1bc770',
              storage_key: 'courses/deleted-course-20/orphan.mp4',
              storage_bucket: 'videos',
              storage_provider: 'r2'
            }],
            rowCount: 1
          };
        }
        if (sql.includes('FROM lessons l') && sql.includes('course_id = $1') && !sql.includes('DELETE')) {
          return { rows: [] }; // Không còn media đã gắn vào lesson (giả lập khóa học chỉ có upload treo)
        }
        if (sql.includes('DELETE FROM courses')) {
          return { rows: [{ course_id: params[0] }] };
        }
        if (sql.includes('SELECT COUNT(*) FROM lessons')) {
          return { rows: [{ total_ref: '0' }] };
        }
        return { rows: [] };
      };

      db.pool = {
        connect: async () => ({
          query: db.query,
          release: () => {}
        })
      };

      const deleted = await coursesService.deleteCourse(20);
      assert.strictEqual(deleted, true);
      assert.strictEqual(stagedUploadIds.length, 1, 'pending upload phải được khóa logic đúng 1 lần trước DELETE FROM courses');
      await new Promise(r => setTimeout(r, 50));
      assert.ok(deletedFromStorage.some((item) => item.key === 'courses/deleted-course-20/orphan.mp4'));
    });

    it('3.4. deleteCourse rollback và không xóa course khi không staging được pending uploads', async () => {
      let rolledBack = false;
      let deletedCourse = false;
      const client = {
        query: async (sql) => {
          const text = String(sql);
          if (text.includes('SELECT course_id, instructor_id FROM courses')) {
            return { rows: [{ course_id: 21, instructor_id: 2 }] };
          }
          if (text.includes('UPDATE pending_media_uploads p')) {
            throw new Error('pending upload table unavailable');
          }
          if (text.includes('FROM lessons l') && text.includes('course_id = $1')) {
            return { rows: [] };
          }
          if (text.includes('DELETE FROM courses')) deletedCourse = true;
          if (text === 'ROLLBACK') rolledBack = true;
          return { rows: [] };
        },
        release: () => {}
      };
      db.pool = { connect: async () => client };

      await assert.rejects(
        () => coursesService.deleteCourse(21, 2),
        /pending upload table unavailable/
      );
      assert.strictEqual(rolledBack, true);
      assert.strictEqual(deletedCourse, false);
    });
  });
});
