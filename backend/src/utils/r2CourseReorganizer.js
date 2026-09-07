'use strict';

/**
 * Logic dùng chung để đưa các object media (video/pdf/audio/ảnh) trên Cloudflare R2
 * về đúng cấu trúc thư mục "courses/<ten-khoa-hoc>-<courseId>/sections/.../lessons/...".
 *
 * Module này được dùng ở 2 nơi:
 *   1. scripts/reorganize_r2_by_course.js — công cụ CLI chạy tay để dọn toàn bộ DB
 *      (dry-run mặc định, cần --execute để ghi thật).
 *   2. courses.service.js — gọi reorganizeCourseMedia(courseId) NGAY SAU KHI một
 *      khóa học mới được tạo, để tự động dời media từ thư mục tạm
 *      "courses/<ten>-draft-<instructorId>/..." (do lúc upload chưa có course_id thật)
 *      sang thư mục chính thức "courses/<ten>-<courseId>/...".
 *
 * Mọi thao tác đều: copy trước → HEAD verify khớp (size + checksum nếu có) → cập nhật
 * DB (transaction) → chỉ xóa object nguồn khi không còn tham chiếu sống nào trỏ tới nó.
 * Không có bước nào xóa trước khi copy đã được xác minh thành công.
 */

const path = require('path');
const {
  CopyObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3');
const db = require('../config/database');
const r2 = require('./r2Storage');
const lessonStreamCache = require('./lessonStreamCache');
const { buildCourseAssetPrefix } = require('./mediaObjectKey.util');

function mediaKindFor(row) {
  const mime = String(row.mime_type || '').toLowerCase();
  const sourceKey = String(row.source_key || '').toLowerCase();
  if (mime.startsWith('video/') || sourceKey.endsWith('.mpd')) return 'video';
  if (mime === 'application/pdf' || sourceKey.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return 'other';
}

function assetIdFor(row) {
  return row.media_asset_id || `${row.ref_type}-${row.ref_id}`;
}

function targetPrefixFor(row) {
  return buildCourseAssetPrefix({
    courseName: row.course_name,
    courseId: row.course_id,
    sectionName: row.section_name,
    sectionOrder: row.section_order,
    lessonName: row.lesson_name,
    lessonOrder: row.lesson_order,
    mediaKind: mediaKindFor(row),
    assetId: assetIdFor(row)
  });
}

function canonicalCourseMediaPrefix(row) {
  const generated = buildCourseAssetPrefix({
    courseName: row.course_name,
    courseId: row.course_id,
    sectionName: row.section_name,
    sectionOrder: row.section_order,
    lessonName: row.lesson_name,
    lessonOrder: row.lesson_order,
    mediaKind: mediaKindFor(row),
    assetId: 'asset'
  });
  return `${path.posix.dirname(generated)}/`;
}

function isAlreadyCourseScoped(row) {
  return String(row.source_key || '').startsWith(canonicalCourseMediaPrefix(row));
}

function targetKeyFor(row, sourceObjectKey = row.source_key) {
  return path.posix.join(targetPrefixFor(row), path.posix.basename(sourceObjectKey));
}

function isDashManifest(row) {
  return String(row.source_key || '').toLowerCase().endsWith('.mpd');
}

async function listAllObjects(prefix) {
  const bucket = r2.resolveBucket();
  const client = r2.getClient();
  const objects = [];
  let continuationToken;
  do {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    objects.push(...(result.Contents || []).filter(item => item.Key));
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function sourceObjectsFor(row) {
  if (!isDashManifest(row)) return [{ Key: row.source_key }];
  const sourcePrefix = `${path.posix.dirname(row.source_key)}/`;
  const objects = await listAllObjects(sourcePrefix);
  if (!objects.some(item => item.Key === row.source_key)) {
    throw new Error(`Không tìm thấy manifest nguồn ${row.source_key}`);
  }
  return objects;
}

function encodedCopySource(bucket, key) {
  return `${encodeURIComponent(bucket)}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}

async function headObject(key) {
  try {
    return await r2.getClient().send(new HeadObjectCommand({
      Bucket: r2.resolveBucket(),
      Key: key
    }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return null;
    throw error;
  }
}

function sameObject(source, destination) {
  if (!source || !destination) return false;
  const sourceSha = source.Metadata?.sha256;
  const destinationSha = destination.Metadata?.sha256;
  return Number(source.ContentLength) === Number(destination.ContentLength)
    && (!sourceSha || !destinationSha || sourceSha === destinationSha);
}

async function copyAndVerify(sourceKey, destinationKey) {
  const bucket = r2.resolveBucket();
  const sourceHead = await headObject(sourceKey);
  if (!sourceHead) throw new Error(`Object nguồn không tồn tại: ${sourceKey}`);

  const existingDestination = await headObject(destinationKey);
  if (!sameObject(sourceHead, existingDestination)) {
    await r2.getClient().send(new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationKey,
      CopySource: encodedCopySource(bucket, sourceKey),
      MetadataDirective: 'COPY'
    }));
  }

  const destinationHead = await headObject(destinationKey);
  if (!sameObject(sourceHead, destinationHead)) {
    throw new Error(`Xác minh bản sao R2 thất bại: ${destinationKey}`);
  }
}

async function persistReference(row, destinationKey) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (row.ref_type === 'lesson') {
      await client.query(
        `UPDATE lessons
         SET storage_key = $1, content_url = $1, updated_at = CURRENT_TIMESTAMP
         WHERE lesson_id = $2 AND storage_provider = 'r2'
           AND COALESCE(storage_key, content_url) = $3`,
        [destinationKey, row.ref_id, row.source_key]
      );
    } else {
      await client.query(
        `UPDATE lesson_materials
         SET storage_key = $1, file_url = $1, updated_at = CURRENT_TIMESTAMP
         WHERE material_id = $2 AND storage_provider = 'r2'
           AND COALESCE(storage_key, file_url) = $3`,
        [destinationKey, row.ref_id, row.source_key]
      );
    }
    await client.query(
      `UPDATE pending_media_uploads
       SET storage_key = $1
       WHERE storage_provider = 'r2' AND storage_key = $2 AND status = 'COMMITTED'`,
      [destinationKey, row.source_key]
    );
    await client.query('COMMIT');
    if (row.ref_type === 'lesson') {
      lessonStreamCache.invalidateLessonStreamCache(row.ref_id);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function countLiveReferences(storageKey) {
  const result = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM lessons
        WHERE storage_provider = 'r2' AND COALESCE(storage_key, content_url) = $1)
       +
       (SELECT COUNT(*) FROM lesson_materials
        WHERE storage_provider = 'r2' AND COALESCE(storage_key, file_url) = $1)
       +
       (SELECT COUNT(*) FROM pending_media_uploads
        WHERE storage_provider = 'r2' AND storage_key = $1
          AND status IN ('PENDING', 'CLAIMING', 'CLEANING')) AS total`,
    [storageKey]
  );
  return Number(result.rows[0]?.total || 0);
}

async function deleteObjects(keys) {
  const uniqueKeys = [...new Set(keys)].filter(Boolean);
  for (let offset = 0; offset < uniqueKeys.length; offset += 1000) {
    const batch = uniqueKeys.slice(offset, offset + 1000);
    const response = await r2.getClient().send(new DeleteObjectsCommand({
      Bucket: r2.resolveBucket(),
      Delete: { Objects: batch.map(Key => ({ Key })), Quiet: true }
    }));
    if (response.Errors?.length) {
      throw new Error(response.Errors.map(item => `${item.Key}: ${item.Message}`).join('; '));
    }
    for (const key of batch) r2.invalidateSignedUrlCache(key);
  }
}

async function markOldAssetsDeleted(keys) {
  await db.query(
    `UPDATE media_assets
     SET status = 'DELETED', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE storage_provider = 'r2' AND storage_bucket = $1
       AND object_key = ANY($2::text[]) AND deleted_at IS NULL`,
    [r2.resolveBucket(), keys]
  );
}

/**
 * Nạp danh sách media đang được lesson / lesson_materials tham chiếu trên R2.
 * Truyền courseId để chỉ nạp media của MỘT khóa học (dùng cho hook tự động sau khi
 * tạo khóa học); không truyền gì để nạp toàn bộ DB (dùng cho script CLI).
 */
async function loadReferencedMedia({ courseId } = {}) {
  const params = [];
  let courseFilter = '';
  if (courseId) {
    params.push(courseId);
    courseFilter = `AND c.course_id = $${params.length}`;
  }

  const result = await db.query(`
    SELECT 'lesson' AS ref_type, l.lesson_id AS ref_id, l.media_asset_id,
           c.course_id, c.course_name,
           s.title AS section_name, s.order_index AS section_order,
           l.title AS lesson_name, l.order_index AS lesson_order,
           l.title AS original_filename,
           l.mime_type, COALESCE(l.storage_key, l.content_url) AS source_key
    FROM lessons l
    JOIN sections s ON s.section_id = l.section_id
    JOIN courses c ON c.course_id = s.course_id
    WHERE l.storage_provider = 'r2'
      AND COALESCE(l.storage_key, l.content_url) IS NOT NULL
      ${courseFilter}
    UNION ALL
    SELECT 'material', m.material_id, m.media_asset_id,
           c.course_id, c.course_name,
           s.title AS section_name, s.order_index AS section_order,
           l.title AS lesson_name, l.order_index AS lesson_order,
           m.file_name,
           COALESCE(m.mime_type, m.file_type), COALESCE(m.storage_key, m.file_url)
    FROM lesson_materials m
    JOIN lessons l ON l.lesson_id = m.lesson_id
    JOIN sections s ON s.section_id = l.section_id
    JOIN courses c ON c.course_id = s.course_id
    WHERE m.storage_provider = 'r2'
      AND COALESCE(m.storage_key, m.file_url) IS NOT NULL
      ${courseFilter}
    ORDER BY course_id, ref_type, ref_id
  `, params);
  return result.rows;
}

/**
 * Tự động dời media của MỘT khóa học về đúng thư mục chính thức (dùng course_id thật).
 * Gọi hàm này ngay sau khi transaction tạo khóa học COMMIT thành công.
 *
 * Không throw ra ngoài với lỗi từng item — trả về báo cáo để caller tự quyết định
 * log/cảnh báo, vì việc tổ chức lại thư mục là "best effort", không được phép làm
 * hỏng luồng tạo khóa học chính.
 */
async function reorganizeCourseMedia(courseId, { deleteSource = true } = {}) {
  if (!courseId) return { total: 0, moved: 0, failed: 0, failures: [] };

  const rows = await loadReferencedMedia({ courseId });
  const plans = rows
    .map(row => ({ ...row, target_key: targetKeyFor(row) }))
    .filter(row => !isAlreadyCourseScoped(row));

  let moved = 0;
  const failures = [];

  for (const row of plans) {
    try {
      const sourceObjects = await sourceObjectsFor(row);
      for (const sourceObject of sourceObjects) {
        await copyAndVerify(sourceObject.Key, targetKeyFor(row, sourceObject.Key));
      }

      await persistReference(row, row.target_key);

      if (deleteSource && await countLiveReferences(row.source_key) === 0) {
        await deleteObjects(sourceObjects.map(item => item.Key));
        await markOldAssetsDeleted(sourceObjects.map(item => item.Key));
      }
      moved += 1;
    } catch (error) {
      failures.push({ ref: `${row.ref_type}#${row.ref_id}`, sourceKey: row.source_key, message: error.message });
    }
  }

  return { total: rows.length, moved, failed: failures.length, failures };
}

/**
 * Nạp danh sách media trên Supabase (storage_provider = 'supabase') của một khóa học.
 * Đây là dữ liệu legacy — upload trước khi hệ thống chuyển hoàn toàn sang R2.
 */
async function loadSupabaseMedia({ courseId } = {}) {
  const params = [];
  let courseFilter = '';
  if (courseId) {
    params.push(courseId);
    courseFilter = `AND c.course_id = $${params.length}`;
  }

  const result = await db.query(`
    SELECT 'lesson' AS ref_type, l.lesson_id AS ref_id, l.media_asset_id,
           c.course_id, c.course_name,
           s.title AS section_name, s.order_index AS section_order,
           l.title AS lesson_name, l.order_index AS lesson_order,
           l.mime_type, COALESCE(l.storage_key, l.content_url) AS source_key,
           l.storage_bucket AS source_bucket,
           l.storage_provider AS source_provider
    FROM lessons l
    JOIN sections s ON s.section_id = l.section_id
    JOIN courses c ON c.course_id = s.course_id
    WHERE l.storage_provider = 'supabase'
      AND COALESCE(l.storage_key, l.content_url) IS NOT NULL
      ${courseFilter}
    UNION ALL
    SELECT 'material', m.material_id, m.media_asset_id,
           c.course_id, c.course_name,
           s.title AS section_name, s.order_index AS section_order,
           l.title AS lesson_name, l.order_index AS lesson_order,
           COALESCE(m.mime_type, m.file_type), COALESCE(m.storage_key, m.file_url),
           m.storage_bucket,
           m.storage_provider
    FROM lesson_materials m
    JOIN lessons l ON l.lesson_id = m.lesson_id
    JOIN sections s ON s.section_id = l.section_id
    JOIN courses c ON c.course_id = s.course_id
    WHERE m.storage_provider = 'supabase'
      AND COALESCE(m.storage_key, m.file_url) IS NOT NULL
      ${courseFilter}
    ORDER BY course_id, ref_type, ref_id
  `, params);
  return result.rows;
}

/**
 * Download một object từ Supabase về buffer trong bộ nhớ.
 * Sử dụng signed URL để truy cập private bucket.
 */
async function downloadFromSupabase(storageKey, storageBucket) {
  const { supabaseAdmin } = require('../config/supabase');
  const client = supabaseAdmin;

  // Thử download trực tiếp qua storage API
  const { data, error } = await client.storage.from(storageBucket).download(storageKey);
  if (error) {
    throw new Error(`Không thể download từ Supabase (${storageBucket}/${storageKey}): ${error.message}`);
  }
  // data là Blob
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Cập nhật DB sau khi migrate từ Supabase → R2.
 * Cập nhật storage_provider, storage_bucket, storage_key, content_url.
 */
async function persistSupabaseMigration(row, newKey, newBucket) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (row.ref_type === 'lesson') {
      await client.query(
        `UPDATE lessons
         SET storage_provider = 'r2',
             storage_bucket   = $1,
             storage_key      = $2,
             content_url      = $2,
             updated_at       = CURRENT_TIMESTAMP
         WHERE lesson_id = $3
           AND storage_provider = 'supabase'
           AND COALESCE(storage_key, content_url) = $4`,
        [newBucket, newKey, row.ref_id, row.source_key]
      );
    } else {
      await client.query(
        `UPDATE lesson_materials
         SET storage_provider = 'r2',
             storage_bucket   = $1,
             storage_key      = $2,
             file_url         = $2,
             updated_at       = CURRENT_TIMESTAMP
         WHERE material_id = $3
           AND storage_provider = 'supabase'
           AND COALESCE(storage_key, file_url) = $4`,
        [newBucket, newKey, row.ref_id, row.source_key]
      );
    }
    // Cập nhật pending_media_uploads nếu còn tham chiếu cũ
    await client.query(
      `UPDATE pending_media_uploads
       SET storage_provider = 'r2', storage_bucket = $1, storage_key = $2
       WHERE storage_provider = 'supabase' AND storage_key = $3 AND status = 'COMMITTED'`,
      [newBucket, newKey, row.source_key]
    );
    await client.query('COMMIT');
    if (row.ref_type === 'lesson') {
      lessonStreamCache.invalidateLessonStreamCache(row.ref_id);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Xóa object cũ trên Supabase (best-effort).
 */
async function deleteFromSupabase(storageKey, storageBucket) {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { error } = await supabaseAdmin.storage.from(storageBucket).remove([storageKey]);
    if (error) {
      console.warn(`[R2-Migrate] Không xóa được Supabase object ${storageBucket}/${storageKey}: ${error.message}`);
    }
  } catch (err) {
    console.warn(`[R2-Migrate] Lỗi xóa Supabase object ${storageBucket}/${storageKey}: ${err.message}`);
  }
}

/**
 * Migrate toàn bộ media Supabase của MỘT khóa học sang Cloudflare R2.
 *
 * Luồng xử lý từng file:
 *   1. Download buffer từ Supabase
 *   2. Upload lên R2 vào đúng thư mục chuẩn (courses/<slug>-<id>/sections/.../lessons/...)
 *   3. Cập nhật DB (storage_provider, storage_key, storage_bucket)
 *   4. Xóa file cũ trên Supabase (best-effort)
 *
 * Không throw ra ngoài với lỗi từng item — trả về báo cáo để caller tự quyết định.
 */
async function migrateSupabaseMediaToR2(courseId, { deleteSource = true } = {}) {
  if (!courseId) return { total: 0, migrated: 0, failed: 0, failures: [] };

  const rows = await loadSupabaseMedia({ courseId });
  if (rows.length === 0) return { total: 0, migrated: 0, failed: 0, failures: [] };

  const bucket = r2.resolveBucket();
  let migrated = 0;
  const failures = [];

  for (const row of rows) {
    try {
      // Xây dựng R2 key chuẩn
      const ext = path.posix.extname(row.source_key) || '';
      const safeBaseName = path.posix.basename(row.source_key, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const assetId = row.media_asset_id || `${row.ref_type}-${row.ref_id}`;
      const targetPrefix = buildCourseAssetPrefix({
        courseName: row.course_name,
        courseId: row.course_id,
        sectionName: row.section_name,
        sectionOrder: row.section_order,
        lessonName: row.lesson_name,
        lessonOrder: row.lesson_order,
        mediaKind: mediaKindFor(row),
        assetId: String(assetId).replace(/[^a-zA-Z0-9_-]/g, '')
      });
      const newKey = `${targetPrefix}/${safeBaseName}${ext}`;

      // Kiểm tra xem đã có ở R2 chưa (idempotent)
      const existing = await headObject(newKey);
      let fileBuffer;

      if (!existing) {
        // Download từ Supabase
        fileBuffer = await downloadFromSupabase(row.source_key, row.source_bucket);

        // Upload lên R2
        const { Upload } = require('@aws-sdk/lib-storage');
        const crypto = require('crypto');
        const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const uploader = new Upload({
          client: r2.getClient(),
          params: {
            Bucket: bucket,
            Key: newKey,
            Body: fileBuffer,
            ContentLength: fileBuffer.length,
            ContentType: row.mime_type || 'application/octet-stream',
            CacheControl: 'private, no-store',
            Metadata: { sha256, migrated_from: 'supabase' }
          },
          queueSize: 1,
          partSize: 64 * 1024 * 1024,
          leavePartsOnError: false
        });
        await uploader.done();
      }

      // Cập nhật DB
      await persistSupabaseMigration(row, newKey, bucket);

      // Xóa Supabase (best-effort)
      if (deleteSource) {
        await deleteFromSupabase(row.source_key, row.source_bucket);
      }

      migrated += 1;
      console.log(`[R2-Migrate] ✅ ${row.ref_type}#${row.ref_id}: ${row.source_key} → ${newKey}`);
    } catch (err) {
      failures.push({
        ref: `${row.ref_type}#${row.ref_id}`,
        sourceKey: row.source_key,
        message: err.message
      });
      console.warn(`[R2-Migrate] ❌ ${row.ref_type}#${row.ref_id} (${row.source_key}): ${err.message}`);
    }
  }

  return { total: rows.length, migrated, failed: failures.length, failures };
}

/**
 * Orchestrator: Chạy toàn bộ quá trình chuẩn hóa media của một khóa học:
 *   1. migrateSupabaseMediaToR2 — migrate file legacy Supabase → R2
 *   2. reorganizeCourseMedia    — dời file đã trên R2 về đúng thư mục
 *
 * Gọi hàm này ngay sau khi khóa học được PUBLISH (sau COMMIT).
 * Trả về báo cáo tổng hợp.
 */
async function migrateCourseAllMedia(courseId, options = {}) {
  if (!courseId) return null;

  const supabaseReport = await migrateSupabaseMediaToR2(courseId, options);
  const r2Report = await reorganizeCourseMedia(courseId, options);

  const report = {
    courseId,
    supabase: supabaseReport,
    r2Reorganize: r2Report,
    totalMigrated: supabaseReport.migrated + r2Report.moved,
    totalFailed: supabaseReport.failed + r2Report.failed,
    failures: [
      ...supabaseReport.failures.map(f => ({ ...f, phase: 'supabase→r2' })),
      ...r2Report.failures.map(f => ({ ...f, phase: 'r2-reorganize' }))
    ]
  };

  if (report.totalFailed > 0) {
    console.warn(
      `[Course Media Standardize] Khóa học #${courseId}: ` +
      `${report.totalMigrated} thành công, ${report.totalFailed} lỗi:\n` +
      report.failures.map(f => `  [${f.phase}] ${f.ref} (${f.sourceKey}): ${f.message}`).join('\n')
    );
  } else if (report.totalMigrated > 0) {
    console.log(
      `[Course Media Standardize] Khóa học #${courseId}: ` +
      `Đã chuẩn hóa ${report.totalMigrated} media về Cloudflare R2 thành công.`
    );
  }

  return report;
}

module.exports = {
  mediaKindFor,
  assetIdFor,
  targetPrefixFor,
  canonicalCourseMediaPrefix,
  isAlreadyCourseScoped,
  targetKeyFor,
  isDashManifest,
  listAllObjects,
  sourceObjectsFor,
  headObject,
  sameObject,
  copyAndVerify,
  persistReference,
  countLiveReferences,
  deleteObjects,
  markOldAssetsDeleted,
  loadReferencedMedia,
  loadSupabaseMedia,
  reorganizeCourseMedia,
  migrateSupabaseMediaToR2,
  migrateCourseAllMedia
};
