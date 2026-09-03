#!/usr/bin/env node
'use strict';

require('dotenv').config();

const path = require('path');
const {
  CopyObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3');
const db = require('../src/config/database');
const r2 = require('../src/utils/r2Storage');
const { buildCourseAssetPrefix } = require('../src/utils/mediaObjectKey.util');

const execute = process.argv.includes('--execute');
const deleteSource = process.argv.includes('--delete-source');
const cleanLegacy = process.argv.includes('--clean-redundant-legacy')
  || process.argv.includes('--clean-redundant-archives');
const verify = process.argv.includes('--verify');

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

async function loadReferencedMedia() {
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
    ORDER BY course_id, ref_type, ref_id
  `);
  return result.rows;
}

async function matchingLegacyObjectKeys(item) {
  if (!String(item.object_key).toLowerCase().endsWith('.mpd')) {
    const legacyHead = await headObject(item.object_key);
    const canonicalHead = await headObject(item.canonical_key);
    if (!sameObject(legacyHead, canonicalHead)) {
      throw new Error(`Bản cũ không khớp canonical object: ${item.object_key}`);
    }
    return [item.object_key];
  }

  const legacyPrefix = `${path.posix.dirname(item.object_key)}/`;
  const canonicalPrefix = `${path.posix.dirname(item.canonical_key)}/`;
  const legacyObjects = await listAllObjects(legacyPrefix);
  const canonicalObjects = await listAllObjects(canonicalPrefix);
  const canonicalByName = new Map(
    canonicalObjects.map(object => [path.posix.basename(object.Key), object.Key])
  );
  if (legacyObjects.length === 0) throw new Error(`DASH bundle cũ rỗng: ${legacyPrefix}`);

  for (const legacyObject of legacyObjects) {
    const canonicalKey = canonicalByName.get(path.posix.basename(legacyObject.Key));
    if (!canonicalKey) throw new Error(`Canonical DASH thiếu ${path.posix.basename(legacyObject.Key)}`);
    const [legacyHead, canonicalHead] = await Promise.all([
      headObject(legacyObject.Key),
      headObject(canonicalKey)
    ]);
    if (!sameObject(legacyHead, canonicalHead)) {
      throw new Error(`DASH object không khớp: ${legacyObject.Key}`);
    }
  }
  return legacyObjects.map(object => object.Key);
}

async function cleanRedundantLegacyObjects() {
  const result = await db.query(`
    SELECT archived.media_id, archived.object_key, archived.checksum_sha256,
           archived.size_bytes, canonical.object_key AS canonical_key
    FROM media_assets archived
    LEFT JOIN LATERAL (
      SELECT candidate.object_key
      FROM media_assets candidate
      WHERE candidate.storage_provider = 'r2'
        AND candidate.storage_bucket = archived.storage_bucket
        AND candidate.checksum_sha256 = archived.checksum_sha256
        AND candidate.object_key LIKE 'courses/%'
        AND candidate.deleted_at IS NULL
      ORDER BY candidate.updated_at DESC
      LIMIT 1
    ) canonical ON TRUE
    WHERE archived.storage_provider = 'r2'
      AND (archived.object_key LIKE 'archive/%' OR archived.object_key LIKE 'migrated/%')
      AND archived.deleted_at IS NULL
    ORDER BY archived.object_key
  `);

  let removed = 0;
  let unresolved = 0;
  for (const item of result.rows) {
    if (!item.canonical_key) {
      unresolved += 1;
      console.log(`[ARCHIVE UNRESOLVED] ${item.object_key}`);
      continue;
    }
    const legacyKeys = await matchingLegacyObjectKeys(item);
    if (execute && deleteSource) {
      await deleteObjects(legacyKeys);
      await markOldAssetsDeleted(legacyKeys);
    }
    removed += 1;
    console.log(`[LEGACY REDUNDANT] objects=${legacyKeys.length} ${item.object_key} -> ${item.canonical_key}`);
  }
  return { total: result.rows.length, removed, unresolved };
}

async function verifyReferencedMedia(rows) {
  let verified = 0;
  for (const row of rows) {
    if (!isAlreadyCourseScoped(row)) {
      throw new Error(`Key chưa nằm trong thư mục khóa học: ${row.source_key}`);
    }
    const objects = await sourceObjectsFor(row);
    if (objects.length === 0) throw new Error(`Không tìm thấy object cho ${row.source_key}`);
    for (const object of objects) {
      if (!await headObject(object.Key)) throw new Error(`Object không tồn tại: ${object.Key}`);
    }
    verified += 1;
    console.log(`[VERIFIED] ${row.ref_type}#${row.ref_id} [${row.course_name}] objects=${objects.length}`);
  }
  return verified;
}

async function auditLegacyPrefixes() {
  const summaries = [];
  for (const prefix of ['migrated/', 'archive/']) {
    const objects = await listAllObjects(prefix);
    summaries.push({
      prefix,
      objects: objects.length,
      bytes: objects.reduce((sum, item) => sum + Number(item.Size || 0), 0)
    });
  }
  return summaries;
}

async function auditLegacyAssets() {
  const result = await db.query(`
    SELECT legacy.object_key, legacy.original_filename, legacy.checksum_sha256,
           legacy.metadata, canonical.object_key AS canonical_key
    FROM media_assets legacy
    LEFT JOIN LATERAL (
      SELECT candidate.object_key
      FROM media_assets candidate
      WHERE candidate.storage_provider = 'r2'
        AND candidate.storage_bucket = legacy.storage_bucket
        AND candidate.checksum_sha256 = legacy.checksum_sha256
        AND candidate.object_key LIKE 'courses/%'
        AND candidate.deleted_at IS NULL
      ORDER BY candidate.updated_at DESC
      LIMIT 1
    ) canonical ON TRUE
    WHERE legacy.storage_provider = 'r2'
      AND (legacy.object_key LIKE 'migrated/%' OR legacy.object_key LIKE 'archive/%')
      AND legacy.deleted_at IS NULL
    ORDER BY legacy.object_key
  `);
  return result.rows;
}

async function main() {
  await r2.ensureBucketExists();
  const rows = await loadReferencedMedia();
  const plans = rows.map(row => ({
    ...row,
    target_key: targetKeyFor(row)
  })).filter(row => !isAlreadyCourseScoped(row));

  console.log(`[R2 course folders] references=${rows.length}; moves=${plans.length}; mode=${execute ? 'EXECUTE' : 'DRY_RUN'}; deleteSource=${deleteSource}`);
  if (verify) {
    const verified = await verifyReferencedMedia(rows);
    console.log(`[R2 course folders] verified=${verified}/${rows.length}`);
    const legacyPrefixes = await auditLegacyPrefixes();
    for (const summary of legacyPrefixes) {
      console.log(`[R2 legacy audit] prefix=${summary.prefix} objects=${summary.objects} bytes=${summary.bytes}`);
    }
    const legacyAssets = await auditLegacyAssets();
    for (const item of legacyAssets) {
      const legacyPaths = Array.isArray(item.metadata?.legacyPaths)
        ? item.metadata.legacyPaths.join(',')
        : '';
      console.log(
        `[R2 legacy asset] ${item.canonical_key ? 'REDUNDANT' : 'UNASSIGNED'} `
        + `${item.object_key} canonical=${item.canonical_key || '-'} legacyPaths=${legacyPaths || '-'}`
      );
    }
  }
  if (!execute) {
    for (const row of plans) {
      console.log(`- ${row.ref_type}#${row.ref_id} [${row.course_name}] ${row.source_key} -> ${row.target_key}`);
    }
    if (cleanLegacy) await cleanRedundantLegacyObjects();
    console.log('Review xong hãy chạy --execute --delete-source. Script chỉ xóa nguồn sau khi copy, HEAD verify và cập nhật DB thành công.');
    return;
  }

  let completed = 0;
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
      completed += 1;
      console.log(`[OK] ${row.ref_type}#${row.ref_id} [${row.course_name}] -> ${row.target_key}`);
    } catch (error) {
      process.exitCode = 1;
      console.error(`[FAIL] ${row.ref_type}#${row.ref_id}: ${error.message}`);
    }
  }

  let archiveSummary = null;
  if (cleanLegacy) archiveSummary = await cleanRedundantLegacyObjects();
  console.log(`[R2 course folders] completed=${completed}/${plans.length}; archive=${JSON.stringify(archiveSummary)}`);
}

main()
  .catch(error => {
    process.exitCode = 1;
    console.error(error);
  })
  .finally(() => db.pool.end());
