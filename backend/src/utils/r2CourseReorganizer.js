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
  reorganizeCourseMedia
};
