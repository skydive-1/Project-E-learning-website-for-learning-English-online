/**
 * Repackage legacy encrypted DASH lessons as clear DASH without overwriting the
 * old objects. Dry-run is the default.
 *
 * Usage:
 *   node scripts/migrate_clear_dash.js
 *   node scripts/migrate_clear_dash.js --lesson=123
 *   node scripts/migrate_clear_dash.js --apply --lesson=123
 */

require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const db = require('../src/config/database');
const storage = require('../src/utils/supabaseStorage');
const {
  isEncryptedDashManifest,
  packageVideoToDash
} = require('../src/utils/dashPackager.util');

const applyChanges = process.argv.includes('--apply');
const lessonArgument = process.argv.find(argument => argument.startsWith('--lesson='));
const lessonId = lessonArgument ? Number(lessonArgument.slice('--lesson='.length)) : null;

function assertSafeTempDirectory(directory) {
  const resolved = path.resolve(directory);
  const tempRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolved.startsWith(tempRoot) || !path.basename(resolved).startsWith('elearn-clear-dash-')) {
    throw new Error(`Từ chối dọn dẹp thư mục tạm không hợp lệ: ${resolved}`);
  }
  return resolved;
}

async function uploadClearDashBundle(lesson, sourcePath) {
  const packageResult = await packageVideoToDash(sourcePath, lesson.lesson_id);
  if (!packageResult.success) throw new Error(packageResult.error);

  const assetPrefix = path.posix.dirname(lesson.storage_key);
  const videoKey = path.posix.join(assetPrefix, 'video-clear.mp4');
  const audioKey = path.posix.join(assetPrefix, 'audio-clear.mp4');
  const manifestKey = path.posix.join(assetPrefix, 'manifest-clear.mpd');
  const rawManifest = await fs.promises.readFile(packageResult.mpdPath, 'utf8');
  const manifest = rawManifest
    .replaceAll(path.basename(packageResult.videoPath), path.posix.basename(videoKey))
    .replaceAll(path.basename(packageResult.audioPath), path.posix.basename(audioKey));

  const videoUpload = await storage.uploadPrivateObject(
    packageResult.videoPath,
    videoKey,
    'videos',
    'video/mp4'
  );
  if (!videoUpload.success) throw new Error(videoUpload.error || 'Không thể upload video DASH mới.');

  const audioUpload = await storage.uploadPrivateObject(
    packageResult.audioPath,
    audioKey,
    'videos',
    'audio/mp4'
  );
  if (!audioUpload.success) throw new Error(audioUpload.error || 'Không thể upload audio DASH mới.');

  // Upload manifest last. Until this succeeds, no database row points at the
  // newly uploaded bundle, so playback continues using the old asset.
  const manifestUpload = await storage.uploadPrivateObject(
    Buffer.from(manifest, 'utf8'),
    manifestKey,
    'videos',
    'application/dash+xml'
  );
  if (!manifestUpload.success) throw new Error(manifestUpload.error || 'Không thể upload manifest DASH mới.');

  const updated = await db.query(
    `UPDATE lessons
     SET content_url = $1,
         storage_key = $1,
         mime_type = 'application/dash+xml',
         size_bytes = $2,
         checksum_sha256 = $3,
         media_status = 'READY',
         updated_at = CURRENT_TIMESTAMP
     WHERE lesson_id = $4
       AND storage_key = $5
     RETURNING lesson_id`,
    [
      manifestKey,
      manifestUpload.sizeBytes || Buffer.byteLength(manifest),
      manifestUpload.checksumSha256 || null,
      lesson.lesson_id,
      lesson.storage_key
    ]
  );

  if (updated.rows.length !== 1) {
    throw new Error('Dữ liệu bài học đã thay đổi trong lúc migration; không cập nhật con trỏ manifest.');
  }

  return { manifestKey };
}

async function migrateLesson(lesson) {
  const currentManifestResponse = await storage.fetchPrivateObject(
    lesson.storage_key,
    lesson.storage_bucket || 'videos',
    null,
    lesson.storage_provider || 'r2'
  );
  if (!currentManifestResponse?.ok) {
    return { status: 'skipped', reason: `Không đọc được manifest hiện tại (${currentManifestResponse?.status || 'unknown'})` };
  }
  const currentManifest = await currentManifestResponse.text();
  if (!isEncryptedDashManifest(currentManifest)) {
    return { status: 'skipped', reason: 'Manifest đã là clear DASH' };
  }

  const sourceKey = path.posix.join(path.posix.dirname(lesson.storage_key), 'source.mp4');
  const sourceExists = await storage.checkObjectExists(
    sourceKey,
    lesson.storage_bucket || 'videos',
    lesson.storage_provider || 'r2'
  );

  if (!sourceExists) {
    return { status: 'skipped', reason: `Thiếu MP4 nguồn: ${sourceKey}` };
  }
  if (!applyChanges) return { status: 'ready', sourceKey };

  const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'elearn-clear-dash-'));
  const safeTempDirectory = assertSafeTempDirectory(tempDirectory);
  try {
    const sourceResponse = await storage.fetchPrivateObject(
      sourceKey,
      lesson.storage_bucket || 'videos',
      null,
      lesson.storage_provider || 'r2'
    );
    if (!sourceResponse?.ok) throw new Error(`Không thể đọc MP4 nguồn (${sourceResponse?.status || 'unknown'}).`);

    const localSourcePath = path.join(safeTempDirectory, 'source.mp4');
    await pipeline(Readable.fromWeb(sourceResponse.body), fs.createWriteStream(localSourcePath));
    const result = await uploadClearDashBundle(lesson, localSourcePath);
    return { status: 'migrated', manifestKey: result.manifestKey };
  } finally {
    await fs.promises.rm(safeTempDirectory, { recursive: true, force: true });
  }
}

async function main() {
  if (lessonArgument && (!Number.isInteger(lessonId) || lessonId <= 0)) {
    throw new Error('--lesson phải là một số nguyên dương.');
  }

  const params = [];
  let lessonFilter = '';
  if (lessonId) {
    params.push(lessonId);
    lessonFilter = `AND lesson_id = $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT lesson_id, title, content_url, storage_key, storage_provider, storage_bucket
     FROM lessons
     WHERE content_type = 'video'
       AND storage_provider = 'r2'
       AND LOWER(COALESCE(storage_key, '')) LIKE '%.mpd'
       ${lessonFilter}
     ORDER BY lesson_id`,
    params
  );

  console.log(`[Clear DASH Migration] Chế độ: ${applyChanges ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[Clear DASH Migration] Tìm thấy ${rows.length} bài học DASH trên R2.`);

  for (const lesson of rows) {
    try {
      const result = await migrateLesson(lesson);
      console.log(`[Lesson ${lesson.lesson_id}] ${result.status}: ${result.manifestKey || result.sourceKey || result.reason}`);
    } catch (error) {
      console.error(`[Lesson ${lesson.lesson_id}] failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

main()
  .catch(error => {
    console.error('[Clear DASH Migration] Thất bại:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
