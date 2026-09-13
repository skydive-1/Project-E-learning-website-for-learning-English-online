/**
 * Restore source.mp4 files omitted by the historical Supabase -> R2 manifest-only
 * migration. Dry-run is the default; no legacy object is ever deleted.
 *
 * Usage:
 *   node scripts/repair_legacy_dash_sources.js
 *   node scripts/repair_legacy_dash_sources.js --lesson=123
 *   node scripts/repair_legacy_dash_sources.js --apply
 *   node scripts/repair_legacy_dash_sources.js --apply --retry-transcripts
 */

require('dotenv').config();

const path = require('path');
const db = require('../src/config/database');
const storage = require('../src/utils/supabaseStorage');
const {
  listSupabaseFolderObjects,
  copySupabaseObjectToR2
} = require('../src/utils/r2CourseReorganizer');

const applyChanges = process.argv.includes('--apply');
const retryTranscripts = process.argv.includes('--retry-transcripts');
const lessonArgument = process.argv.find(argument => argument.startsWith('--lesson='));
const lessonId = lessonArgument ? Number(lessonArgument.slice('--lesson='.length)) : null;

function assetIdFromKey(storageKey) {
  return String(storageKey || '').match(
    /\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\//i
  )?.[1] || null;
}

function chooseLegacySource(keys) {
  const mp4Keys = keys.filter(key => String(key).toLowerCase().endsWith('.mp4'));
  return mp4Keys.find(key => path.posix.basename(key).toLowerCase() === 'source.mp4')
    || mp4Keys.find(key => path.posix.basename(key).toLowerCase().includes('source'))
    || null;
}

async function loadCandidates() {
  const params = [];
  let filter = '';
  if (lessonId) {
    params.push(lessonId);
    filter = `AND l.lesson_id = $${params.length}`;
  }
  const lessons = await db.query(
    `SELECT l.lesson_id, l.title, l.storage_key, l.storage_bucket, l.mime_type,
            ma.metadata
     FROM lessons l
     LEFT JOIN media_assets ma ON ma.media_id = l.media_asset_id
     WHERE l.content_type = 'video'
       AND l.storage_provider = 'r2'
       AND LOWER(COALESCE(l.storage_key, '')) LIKE '%.mpd'
       ${filter}
     ORDER BY l.lesson_id`,
    params
  );
  const legacy = await db.query(
    `SELECT media_id, storage_bucket, object_key
     FROM media_assets
     WHERE storage_provider = 'supabase'
       AND deleted_at IS NULL`
  );
  const legacyById = new Map(legacy.rows.map(row => [String(row.media_id).toLowerCase(), row]));

  return lessons.rows.map(lesson => {
    const metadata = lesson.metadata || {};
    const historical = legacyById.get(String(assetIdFromKey(lesson.storage_key) || '').toLowerCase());
    return {
      ...lesson,
      legacy_storage_key: metadata.legacyStorageKey || historical?.object_key || null,
      legacy_storage_bucket: metadata.legacyStorageBucket || historical?.storage_bucket || null
    };
  });
}

async function repairLesson(lesson) {
  const destinationKey = path.posix.join(path.posix.dirname(lesson.storage_key), 'source.mp4');
  if (await storage.checkObjectExists(destinationKey, lesson.storage_bucket, 'r2')) {
    return { status: 'healthy', destinationKey };
  }
  if (!lesson.legacy_storage_key || !lesson.legacy_storage_bucket) {
    return { status: 'unrecoverable', reason: 'Không còn metadata vị trí Supabase legacy.' };
  }

  const legacyKeys = await listSupabaseFolderObjects(
    lesson.legacy_storage_key,
    lesson.legacy_storage_bucket,
    { allowMissingManifest: true }
  );
  const sourceKey = chooseLegacySource(legacyKeys);
  if (!sourceKey) {
    return { status: 'unrecoverable', reason: 'Thư mục Supabase legacy không còn MP4 nguồn.' };
  }
  if (!applyChanges) return { status: 'recoverable', sourceKey, destinationKey };

  await copySupabaseObjectToR2(
    { source_bucket: lesson.legacy_storage_bucket, mime_type: 'video/mp4' },
    sourceKey,
    destinationKey
  );
  return { status: 'restored', sourceKey, destinationKey };
}

async function main() {
  if (lessonArgument && (!Number.isInteger(lessonId) || lessonId <= 0)) {
    throw new Error('--lesson phải là một số nguyên dương.');
  }
  if (retryTranscripts && !applyChanges) {
    throw new Error('--retry-transcripts chỉ dùng cùng --apply.');
  }

  const lessons = await loadCandidates();
  const report = { healthy: 0, recoverable: 0, restored: 0, unrecoverable: 0, failed: 0 };
  const restoredLessonIds = [];
  console.log(`[Repair DASH Source] Chế độ: ${applyChanges ? 'APPLY' : 'DRY-RUN'}; lessons=${lessons.length}`);

  for (const lesson of lessons) {
    try {
      const result = await repairLesson(lesson);
      report[result.status] += 1;
      if (result.status === 'restored') restoredLessonIds.push(lesson.lesson_id);
      console.log(`[Lesson ${lesson.lesson_id}] ${result.status}: ${result.destinationKey || result.reason}`);
    } catch (error) {
      report.failed += 1;
      console.error(`[Lesson ${lesson.lesson_id}] failed: ${error.message}`);
    }
  }

  if (retryTranscripts && restoredLessonIds.length > 0) {
    const subtitlesService = require('../src/modules/lessons/services/subtitles.service');
    await subtitlesService.recoverPendingNow({
      lessonIds: restoredLessonIds,
      limit: restoredLessonIds.length,
      includeFailed: true
    });
  }

  console.log('[Repair DASH Source] Kết quả:', report);
  if (!applyChanges && report.recoverable > 0) {
    console.log('Review kết quả rồi chạy lại với --apply. Nguồn Supabase legacy luôn được giữ nguyên.');
  }
  if (report.failed > 0) process.exitCode = 1;
}

if (require.main === module) {
  main()
    .catch(error => {
      console.error('[Repair DASH Source] Thất bại:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => db.pool.end());
}

module.exports = { assetIdFromKey, chooseLegacySource, loadCandidates, repairLesson, main };

