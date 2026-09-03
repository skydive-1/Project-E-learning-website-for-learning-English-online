#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const db = require('../src/config/database');
const supabase = require('../src/config/supabase');
const r2 = require('../src/utils/r2Storage');
const { resolveSafePath, UPLOADS_ROOT } = require('../src/utils/safePath.util');

const execute = process.argv.includes('--execute');
const deleteSource = process.argv.includes('--delete-source');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = Math.max(1, Number(limitArg?.split('=')[1] || 10000));

function kindFor(row) {
  const mime = row.mime_type || '';
  if (mime.startsWith('video/') || /\.(mp4|mpd|m4s)$/i.test(row.source_key)) return 'video';
  if (mime === 'application/pdf' || /\.pdf$/i.test(row.source_key)) return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return 'other';
}

function targetKeyFor(row, sourceKey = row.source_key) {
  const clean = String(sourceKey).replace(/^\/?uploads\//, '').replace(/^\/+/, '');
  const source = row.storage_provider === 'supabase' ? `supabase/${row.storage_bucket || 'unknown'}` : 'local';
  return `migrated/${source}/${clean}`;
}

async function downloadSupabaseObject(bucket, key) {
  const { data, error } = await supabase.supabaseAdmin.storage.from(bucket).createSignedUrl(key, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Không tạo được signed URL Supabase');
  const response = await fetch(data.signedUrl);
  if (!response.ok || !response.body) throw new Error(`Supabase trả HTTP ${response.status}`);
  const tempPath = path.join(os.tmpdir(), `elearn-r2-${crypto.randomUUID()}`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempPath, { flags: 'wx' }));
  return tempPath;
}

async function acquireSource(row, sourceKey = row.source_key) {
  if (row.storage_provider === 'supabase') {
    return { path: await downloadSupabaseObject(row.storage_bucket, sourceKey), temporary: true };
  }
  const localPath = resolveSafePath(UPLOADS_ROOT, sourceKey, { checkExists: true });
  if (!localPath) throw new Error(`Không tìm thấy file local: ${sourceKey}`);
  return { path: localPath, temporary: false };
}

async function uploadOne(row, sourceKey = row.source_key, mimeType = row.mime_type) {
  const acquired = await acquireSource(row, sourceKey);
  try {
    const result = await r2.uploadObject(acquired.path, targetKeyFor(row, sourceKey), mimeType || 'application/octet-stream');
    if (!result.success) throw new Error(result.error || result.code);
    return result;
  } finally {
    if (acquired.temporary) await fs.promises.unlink(acquired.path).catch(() => {});
  }
}

async function migrateDashSiblings(row, manifestPath) {
  if (!/\.mpd$/i.test(row.source_key)) return [];
  const manifest = await fs.promises.readFile(manifestPath, 'utf8');
  const refs = new Set([
    ...[...manifest.matchAll(/(?:media|initialization|sourceURL)=["']([^"']+)["']/gi)].map(match => match[1]),
    ...[...manifest.matchAll(/<BaseURL>\s*([^<]+?)\s*<\/BaseURL>/gi)].map(match => match[1])
  ]);
  const sourceDir = path.posix.dirname(row.source_key);
  refs.add('source.mp4');
  const migratedSourceKeys = [];
  for (const ref of refs) {
    if (!/^[A-Za-z0-9_.-]+$/.test(ref)) throw new Error(`DASH reference không an toàn: ${ref}`);
    const siblingKey = path.posix.join(sourceDir, ref);
    const mime = ref.endsWith('.mpd') ? 'application/dash+xml' : (ref.includes('audio') ? 'audio/mp4' : 'video/mp4');
    await uploadOne(row, siblingKey, mime);
    migratedSourceKeys.push(siblingKey);
  }
  return migratedSourceKeys;
}

async function persistMigration(row, uploaded) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let asset = await client.query(
      `SELECT media_id FROM media_assets
       WHERE storage_provider = 'r2' AND storage_bucket = $1 AND object_key = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [uploaded.storageBucket, uploaded.storageKey]
    );
    let mediaId = asset.rows[0]?.media_id;
    if (!mediaId) {
      asset = await client.query(
        `INSERT INTO media_assets (
           media_kind, storage_provider, storage_bucket, object_key, original_filename,
           mime_type, size_bytes, checksum_sha256, status, created_by, metadata
         ) VALUES ($1, 'r2', $2, $3, $4, $5, $6, $7, 'READY', $8, $9::jsonb)
         RETURNING media_id`,
        [
          kindFor(row), uploaded.storageBucket, uploaded.storageKey, row.original_filename,
          uploaded.mimeType, uploaded.sizeBytes, uploaded.checksumSha256, row.created_by,
          JSON.stringify({ migratedFrom: row.storage_provider, migratedAt: new Date().toISOString() })
        ]
      );
      mediaId = asset.rows[0].media_id;
    }

    if (row.ref_type === 'lesson') {
      await client.query(
        `UPDATE lessons SET media_asset_id = $1, storage_provider = 'r2', storage_bucket = $2,
           storage_key = $3, content_url = $3, mime_type = $4, size_bytes = $5,
           checksum_sha256 = $6, media_status = 'READY', updated_at = CURRENT_TIMESTAMP
         WHERE lesson_id = $7`,
        [mediaId, uploaded.storageBucket, uploaded.storageKey, uploaded.mimeType, uploaded.sizeBytes, uploaded.checksumSha256, row.ref_id]
      );
    } else {
      await client.query(
        `UPDATE lesson_materials SET media_asset_id = $1, storage_provider = 'r2', storage_bucket = $2,
           storage_key = $3, file_url = $3, mime_type = $4, size_bytes = $5,
           checksum_sha256 = $6, media_status = 'READY', updated_at = CURRENT_TIMESTAMP
         WHERE material_id = $7`,
        [mediaId, uploaded.storageBucket, uploaded.storageKey, uploaded.mimeType, uploaded.sizeBytes, uploaded.checksumSha256, row.ref_id]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function removeLegacySource(row, sourceKeys = [row.source_key]) {
  if (!deleteSource || row.storage_provider !== 'supabase') return;
  const { error } = await supabase.supabaseAdmin.storage.from(row.storage_bucket).remove(sourceKeys);
  if (error) console.warn(`[WARN] Không xóa được nguồn cũ trong ${row.storage_bucket}: ${error.message}`);
}

async function main() {
  r2.getConfig();
  const result = await db.query(`
    SELECT 'lesson' AS ref_type, l.lesson_id AS ref_id, l.storage_provider,
           l.storage_bucket, COALESCE(l.storage_key, l.content_url) AS source_key,
           l.title AS original_filename, COALESCE(l.mime_type,
             CASE WHEN l.content_type = 'pdf' THEN 'application/pdf' ELSE 'video/mp4' END) AS mime_type,
           c.instructor_id AS created_by
    FROM lessons l
    JOIN sections s ON s.section_id = l.section_id
    JOIN courses c ON c.course_id = s.course_id
    WHERE (l.storage_provider IN ('supabase', 'local', 'legacy_local') OR l.content_url LIKE '/uploads/%')
      AND COALESCE(l.storage_key, l.content_url) IS NOT NULL
    UNION ALL
    SELECT 'material', m.material_id, m.storage_provider, m.storage_bucket,
           COALESCE(m.storage_key, m.file_url), m.file_name,
           COALESCE(m.mime_type, m.file_type, 'application/pdf'), m.uploaded_by
    FROM lesson_materials m
    WHERE (m.storage_provider IN ('supabase', 'local', 'legacy_local') OR m.file_url LIKE '/uploads/%')
      AND COALESCE(m.storage_key, m.file_url) IS NOT NULL
    ORDER BY ref_type, ref_id
    LIMIT $1
  `, [limit]);

  console.log(`[R2 migration] ${result.rows.length} media object(s); mode=${execute ? 'EXECUTE' : 'DRY_RUN'}`);
  if (!execute) {
    for (const row of result.rows) console.log(`- ${row.ref_type}#${row.ref_id}: ${row.storage_provider}:${row.source_key} -> ${targetKeyFor(row)}`);
    console.log('Chạy lại với --execute sau khi đã review. Chỉ thêm --delete-source sau khi kiểm tra playback/preview thành công.');
    return;
  }

  let migrated = 0;
  for (const row of result.rows) {
    let source;
    try {
      source = await acquireSource(row);
      const uploaded = await r2.uploadObject(source.path, targetKeyFor(row), row.mime_type || 'application/octet-stream');
      if (!uploaded.success) throw new Error(uploaded.error || uploaded.code);
      const dashSourceKeys = await migrateDashSiblings(row, source.path);
      await persistMigration(row, uploaded);
      await removeLegacySource(row, [row.source_key, ...dashSourceKeys]);
      migrated += 1;
      console.log(`[OK] ${row.ref_type}#${row.ref_id} -> r2://${uploaded.storageBucket}/${uploaded.storageKey}`);
    } catch (error) {
      console.error(`[FAIL] ${row.ref_type}#${row.ref_id}: ${error.message}`);
      process.exitCode = 1;
    } finally {
      if (source?.temporary) await fs.promises.unlink(source.path).catch(() => {});
    }
  }
  console.log(`[R2 migration] Hoàn tất ${migrated}/${result.rows.length}.`);
}

main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => db.pool.end());
