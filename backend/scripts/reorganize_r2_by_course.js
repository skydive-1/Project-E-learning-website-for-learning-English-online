#!/usr/bin/env node
'use strict';

require('dotenv').config();

const path = require('path');
const db = require('../src/config/database');
const r2 = require('../src/utils/r2Storage');
const {
  isAlreadyCourseScoped,
  targetKeyFor,
  listAllObjects,
  sourceObjectsFor,
  headObject,
  sameObject,
  copyAndVerify,
  persistReference,
  countLiveReferences,
  deleteObjects,
  markOldAssetsDeleted,
  loadReferencedMedia
} = require('../src/utils/r2CourseReorganizer');

const execute = process.argv.includes('--execute');
const deleteSource = process.argv.includes('--delete-source');
const cleanLegacy = process.argv.includes('--clean-redundant-legacy')
  || process.argv.includes('--clean-redundant-archives');
const verify = process.argv.includes('--verify');

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
