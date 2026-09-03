#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HeadObjectCommand } = require('@aws-sdk/client-s3');
const db = require('../src/config/database');
const r2 = require('../src/utils/r2Storage');
const { UPLOADS_ROOT } = require('../src/utils/safePath.util');

const execute = process.argv.includes('--execute');
const sourceRoot = path.resolve(UPLOADS_ROOT, 'courses');

const MEDIA_TYPES = new Map([
  ['.mp4', { kind: 'video', mime: 'video/mp4' }],
  ['.mpd', { kind: 'video', mime: 'application/dash+xml' }],
  ['.m4s', { kind: 'video', mime: 'video/iso.segment' }],
  ['.pdf', { kind: 'pdf', mime: 'application/pdf' }],
  ['.mp3', { kind: 'audio', mime: 'audio/mpeg' }],
  ['.wav', { kind: 'audio', mime: 'audio/wav' }],
  ['.ogg', { kind: 'audio', mime: 'audio/ogg' }],
  ['.m4a', { kind: 'audio', mime: 'audio/mp4' }],
  ['.aac', { kind: 'audio', mime: 'audio/aac' }],
  ['.jpg', { kind: 'image', mime: 'image/jpeg' }],
  ['.jpeg', { kind: 'image', mime: 'image/jpeg' }],
  ['.png', { kind: 'image', mime: 'image/png' }],
  ['.gif', { kind: 'image', mime: 'image/gif' }],
  ['.webp', { kind: 'image', mime: 'image/webp' }],
  ['.avif', { kind: 'image', mime: 'image/avif' }],
  ['.vtt', { kind: 'subtitle', mime: 'text/vtt' }],
  ['.srt', { kind: 'subtitle', mime: 'application/x-subrip' }],
  ['.json', { kind: 'subtitle', mime: 'application/json' }]
]);

function listMediaFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('temp_')) files.push(...listMediaFiles(absolutePath));
      continue;
    }
    const type = MEDIA_TYPES.get(path.extname(entry.name).toLowerCase());
    if (!type) continue;
    const stat = fs.statSync(absolutePath);
    files.push({
      absolutePath,
      legacyPath: path.relative(UPLOADS_ROOT, absolutePath).replace(/\\/g, '/'),
      originalFilename: entry.name,
      sizeBytes: stat.size,
      ...type
    });
  }
  return files;
}

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function buildArchivePlan() {
  const files = listMediaFiles(sourceRoot);
  const objects = new Map();
  for (const file of files) {
    const checksum = await sha256(file.absolutePath);
    const extension = path.extname(file.originalFilename).toLowerCase();
    const objectKey = `archive/legacy-local/${file.kind}/${checksum}${extension}`;
    const existing = objects.get(objectKey);
    if (existing) {
      existing.legacyPaths.push(file.legacyPath);
      continue;
    }
    objects.set(objectKey, { ...file, checksum, objectKey, legacyPaths: [file.legacyPath] });
  }
  return { files, objects: [...objects.values()] };
}

async function persistAsset(item, bucket) {
  await db.query(
    `INSERT INTO media_assets (
       media_kind, storage_provider, storage_bucket, object_key, original_filename,
       mime_type, size_bytes, checksum_sha256, status, visibility, metadata
     ) VALUES ($1, 'r2', $2, $3, $4, $5, $6, $7, 'READY', 'private', $8::jsonb)
     ON CONFLICT (storage_provider, storage_bucket, object_key)
       WHERE deleted_at IS NULL AND object_key IS NOT NULL
     DO UPDATE SET
       status = 'READY',
       size_bytes = EXCLUDED.size_bytes,
       checksum_sha256 = EXCLUDED.checksum_sha256,
       metadata = media_assets.metadata || EXCLUDED.metadata,
       updated_at = CURRENT_TIMESTAMP`,
    [
      item.kind,
      bucket,
      item.objectKey,
      item.originalFilename,
      item.mime,
      item.sizeBytes,
      item.checksum,
      JSON.stringify({
        archivedUnreferencedLocalMedia: true,
        legacyPaths: item.legacyPaths,
        archivedAt: new Date().toISOString()
      })
    ]
  );
}

async function uploadAndVerify(item) {
  const bucket = r2.resolveBucket();
  let head;
  try {
    head = await r2.getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: item.objectKey }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
  }

  if (!head) {
    const uploaded = await r2.uploadObject(item.absolutePath, item.objectKey, item.mime, {
      custom: { source: 'legacy-local-archive' }
    });
    if (!uploaded.success) throw new Error(uploaded.error || uploaded.code || 'R2 upload failed');
  }

  const verified = await r2.getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: item.objectKey }));
  const remoteChecksum = verified.Metadata?.sha256;
  if (Number(verified.ContentLength) !== item.sizeBytes || (remoteChecksum && remoteChecksum !== item.checksum)) {
    throw new Error('R2 verification failed after upload');
  }
  await persistAsset(item, bucket);
}

async function main() {
  r2.getConfig();
  const plan = await buildArchivePlan();
  const totalBytes = plan.files.reduce((sum, item) => sum + item.sizeBytes, 0);
  const uniqueBytes = plan.objects.reduce((sum, item) => sum + item.sizeBytes, 0);
  console.log(`[Local media archive] files=${plan.files.length}; unique=${plan.objects.length}; duplicates=${plan.files.length - plan.objects.length}; mode=${execute ? 'EXECUTE' : 'DRY_RUN'}`);
  console.log(`[Local media archive] totalBytes=${totalBytes}; uniqueBytes=${uniqueBytes}`);

  if (!execute) {
    console.log('Chạy lại với --execute để upload các object duy nhất lên R2. File local chưa bị xóa.');
    return;
  }

  let completed = 0;
  for (const item of plan.objects) {
    try {
      await uploadAndVerify(item);
      completed += 1;
      console.log(`[OK] ${item.kind} ${completed}/${plan.objects.length}; aliases=${item.legacyPaths.length}`);
    } catch (error) {
      console.error(`[FAIL] ${item.kind}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`[Local media archive] Hoàn tất ${completed}/${plan.objects.length}. File local chưa bị xóa.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
