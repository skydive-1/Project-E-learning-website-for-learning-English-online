const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');

const db = require('../src/config/database');
const r2 = require('../src/utils/r2Storage');
const supabaseConfig = require('../src/config/supabase');
const {
  reorganizeCourseMedia,
  migrateSupabaseMediaToR2
} = require('../src/utils/r2CourseReorganizer');

describe('📁 R2 auto-organize sau khi tạo khóa học mới', () => {
  const originalDbQuery = db.query;
  const originalPoolConnect = db.pool.connect;
  const originalGetClient = r2.getClient;
  const originalResolveBucket = r2.resolveBucket;
  const originalInvalidate = r2.invalidateSignedUrlCache;
  const originalUploadObject = r2.uploadObject;
  const originalSupabaseAdmin = supabaseConfig.supabaseAdmin;

  afterEach(() => {
    db.query = originalDbQuery;
    db.pool.connect = originalPoolConnect;
    r2.getClient = originalGetClient;
    r2.resolveBucket = originalResolveBucket;
    r2.invalidateSignedUrlCache = originalInvalidate;
    r2.uploadObject = originalUploadObject;
    supabaseConfig.supabaseAdmin = originalSupabaseAdmin;
  });

  test('dời video khỏi thư mục draft-<instructorId> về courses/<ten>-<courseId>/... và xóa object cũ', async () => {
    const draftKey = 'courses/ielts-speaking-nang-cao-draft-17/videos/asset-lesson-501/bai-1.mp4';
    const expectedTargetKey =
      'courses/ielts-speaking-nang-cao-99/sections/01-chuong-1/lessons/01-bai-1/videos/asset-lesson-501/bai-1.mp4';

    const calls = { copy: [], deletes: [], updatedLessonQueries: [] };

    // --- Mock db.query: chỉ cần trả đúng cho 3 câu SELECT/UPDATE mà reorganizeCourseMedia gọi
    db.query = async (text) => {
      if (text.includes('FROM lessons l') && text.includes('UNION ALL')) {
        // loadReferencedMedia({ courseId: 99 })
        return {
          rows: [{
            ref_type: 'lesson',
            ref_id: 501,
            media_asset_id: 'asset-lesson-501',
            course_id: 99,
            course_name: 'IELTS Speaking Nâng Cao',
            section_name: 'Chương 1',
            section_order: 1,
            lesson_name: 'Bài 1',
            lesson_order: 1,
            original_filename: 'Bài 1',
            mime_type: 'video/mp4',
            source_key: draftKey
          }]
        };
      }
      if (text.includes('FROM lessons') && text.includes('SELECT COUNT')) {
        // countLiveReferences sau khi đã persist reference mới -> object cũ không còn ai tham chiếu
        return { rows: [{ total: 0 }] };
      }
      if (text.includes('UPDATE media_assets')) {
        return { rows: [] };
      }
      throw new Error(`db.query không mong đợi: ${text.slice(0, 80)}`);
    };

    // --- Mock transaction client cho persistReference
    const fakeTxClient = {
      query: async (text, params) => {
        calls.updatedLessonQueries.push({ text, params });
        return { rows: [] };
      },
      release: () => {}
    };
    db.pool.connect = async () => fakeTxClient;

    // --- Mock R2 S3 client: HeadObject nguồn tồn tại, đích chưa tồn tại -> copy -> sau copy đích "tồn tại" khớp nguồn
    let destinationCopied = false;
    const fakeS3Client = {
      send: async (command) => {
        const name = command.constructor.name;
        if (name === 'HeadObjectCommand') {
          if (command.input.Key === draftKey) {
            return { ContentLength: 12345, Metadata: { sha256: 'abc123' } };
          }
          if (command.input.Key === expectedTargetKey) {
            if (!destinationCopied) {
              const err = new Error('Not Found');
              err.name = 'NotFound';
              err.$metadata = { httpStatusCode: 404 };
              throw err;
            }
            return { ContentLength: 12345, Metadata: { sha256: 'abc123' } };
          }
          const err = new Error('Not Found');
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }
        if (name === 'CopyObjectCommand') {
          calls.copy.push({ from: command.input.CopySource, to: command.input.Key });
          destinationCopied = true;
          return {};
        }
        if (name === 'DeleteObjectsCommand') {
          calls.deletes.push(command.input.Delete.Objects.map(o => o.Key));
          return {};
        }
        throw new Error(`Lệnh S3 không mong đợi trong test: ${name}`);
      }
    };
    r2.getClient = () => fakeS3Client;
    r2.resolveBucket = () => 'elearning-media';
    r2.invalidateSignedUrlCache = () => {};

    const report = await reorganizeCourseMedia(99);

    assert.strictEqual(report.total, 1);
    assert.strictEqual(report.failed, 0, `Không mong đợi lỗi: ${JSON.stringify(report.failures)}`);
    assert.strictEqual(report.moved, 1);

    // 1. Đã copy đúng sang path chính thức dùng course_id thật, không còn "draft-17"
    assert.strictEqual(calls.copy.length, 1);
    assert.strictEqual(calls.copy[0].to, expectedTargetKey);
    assert.ok(!calls.copy[0].to.includes('draft'), 'Path đích không được chứa "draft"');

    // 2. Đã cập nhật lessons.storage_key/content_url sang key mới trong transaction
    const lessonUpdate = calls.updatedLessonQueries.find(q => q.text.includes('UPDATE lessons'));
    assert.ok(lessonUpdate, 'Phải có UPDATE lessons trong transaction persistReference');
    assert.strictEqual(lessonUpdate.params[0], expectedTargetKey);
    assert.strictEqual(lessonUpdate.params[1], 501);

    // 3. Vì không còn tham chiếu sống nào tới key cũ -> object cũ bị xóa khỏi R2
    assert.strictEqual(calls.deletes.length, 1);
    assert.deepStrictEqual(calls.deletes[0], [draftKey]);
  });

  test('bỏ qua object đã nằm đúng thư mục khóa học (idempotent)', async () => {
    const alreadyCanonicalKey =
      'courses/ielts-speaking-nang-cao-99/sections/01-chuong-1/lessons/01-bai-1/videos/asset-lesson-501/bai-1.mp4';

    db.query = async (text) => {
      if (text.includes('FROM lessons l') && text.includes('UNION ALL')) {
        return {
          rows: [{
            ref_type: 'lesson',
            ref_id: 501,
            media_asset_id: 'asset-lesson-501',
            course_id: 99,
            course_name: 'IELTS Speaking Nâng Cao',
            section_name: 'Chương 1',
            section_order: 1,
            lesson_name: 'Bài 1',
            lesson_order: 1,
            original_filename: 'Bài 1',
            mime_type: 'video/mp4',
            source_key: alreadyCanonicalKey
          }]
        };
      }
      throw new Error(`db.query không mong đợi (test idempotent): ${text.slice(0, 80)}`);
    };

    let copyCalled = false;
    r2.getClient = () => ({ send: async () => { copyCalled = true; return {}; } });
    r2.resolveBucket = () => 'elearning-media';

    const report = await reorganizeCourseMedia(99);

    assert.strictEqual(report.total, 1);
    assert.strictEqual(report.moved, 0, 'Không được dời object đã ở đúng thư mục');
    assert.strictEqual(copyCalled, false, 'Không được gọi R2 khi object đã canonical');
  });

  test('courseId rỗng -> không làm gì, không throw', async () => {
    const report = await reorganizeCourseMedia(null);
    assert.deepStrictEqual(report, { total: 0, moved: 0, failed: 0, failures: [] });
  });

  test('Supabase → R2 chép nguyên bundle DASH và mặc định giữ nguồn legacy', async () => {
    const sourcePrefix = 'legacy/course-99/asset-abc';
    const sourceFiles = ['manifest.mpd', 'source.mp4', 'video.mp4', 'audio.mp4'];
    const sourceBuffers = new Map(sourceFiles.map(name => [
      `${sourcePrefix}/${name}`,
      Buffer.from(`content:${name}`)
    ]));
    const uploaded = new Map();
    const removed = [];
    const txQueries = [];

    db.query = async text => {
      assert.match(String(text), /storage_provider = 'supabase'/);
      return { rows: [{
        ref_type: 'lesson',
        ref_id: 501,
        media_asset_id: '25ace9af-7d29-4ab3-8e8c-fca148f568fe',
        course_id: 99,
        course_name: 'Khóa học kiểm thử',
        section_name: 'Chương 1',
        section_order: 1,
        lesson_name: 'Bài 1',
        lesson_order: 1,
        mime_type: 'application/dash+xml',
        source_key: `${sourcePrefix}/manifest.mpd`,
        source_bucket: 'videos',
        source_provider: 'supabase'
      }] };
    };
    db.pool.connect = async () => ({
      query: async (text, params) => {
        txQueries.push({ text: String(text), params });
        return { rows: [] };
      },
      release() {}
    });

    supabaseConfig.supabaseAdmin = {
      storage: {
        from(bucket) {
          assert.equal(bucket, 'videos');
          return {
            async list(prefix) {
              assert.equal(prefix, sourcePrefix);
              return { data: sourceFiles.map((name, index) => ({ name, id: `id-${index}` })), error: null };
            },
            async download(key) {
              const buffer = sourceBuffers.get(key);
              assert.ok(buffer, `Unexpected Supabase download: ${key}`);
              return { data: new Blob([buffer]), error: null };
            },
            async remove(keys) {
              removed.push(...keys);
              return { error: null };
            }
          };
        }
      }
    };

    r2.resolveBucket = () => 'elearning-media';
    r2.getClient = () => ({
      async send(command) {
        if (command.constructor.name !== 'HeadObjectCommand') {
          throw new Error(`Unexpected S3 command: ${command.constructor.name}`);
        }
        const object = uploaded.get(command.input.Key);
        if (!object) {
          const error = new Error('Not Found');
          error.$metadata = { httpStatusCode: 404 };
          throw error;
        }
        return { ContentLength: object.length, Metadata: {} };
      }
    });
    r2.uploadObject = async (buffer, key) => {
      uploaded.set(key, Buffer.from(buffer));
      return { success: true, storageKey: key, sizeBytes: buffer.length };
    };

    const report = await migrateSupabaseMediaToR2(99);

    assert.equal(report.total, 1);
    assert.equal(report.migrated, 1);
    assert.equal(report.failed, 0);
    assert.deepEqual(
      [...uploaded.keys()].map(key => key.split('/').at(-1)).sort(),
      [...sourceFiles].sort()
    );
    assert.deepEqual(removed, [], 'legacy source must not be deleted without explicit opt-in');
    const lessonUpdate = txQueries.find(query => query.text.includes('UPDATE lessons'));
    assert.ok(lessonUpdate);
    assert.match(lessonUpdate.params[1], /\/manifest\.mpd$/);
    assert.ok(txQueries.some(query => query.text.includes('legacyStorageKey')));
  });
});
