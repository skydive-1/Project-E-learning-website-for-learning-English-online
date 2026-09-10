'use strict';

/**
 * Audit and optionally process durable media cleanup rows.
 * Default mode is strictly read-only. Object deletion needs two explicit flags:
 *   npm run admin-alerts:cleanup -- --execute --confirm=DELETE_ORPHAN_OBJECTS
 */

const db = require('../../src/config/database');

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const confirmed = args.has('--confirm=DELETE_ORPHAN_OBJECTS');
const limitArg = process.argv.slice(2).find((arg) => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1]) || 50, 1), 200);

async function audit() {
  const schemaColumnsResult = await db.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('pending_media_uploads', 'failed_storage_deletions')
  `);
  const columns = new Set(schemaColumnsResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const hasCourseColumn = columns.has('pending_media_uploads.course_id');
  const hasClaimedAt = columns.has('pending_media_uploads.claimed_at');
  const hasCleaningStartedAt = columns.has('pending_media_uploads.cleaning_started_at');
  const hasPendingUploadId = columns.has('failed_storage_deletions.pending_upload_id');
  const legacyCourseIdExpression = `((regexp_match(p.storage_key,
    '(^|/)courses/([^/]*-)?([0-9]{1,9})(/|$)', 'i'))[3])::INT`;
  const courseIdExpression = hasCourseColumn ? 'p.course_id' : legacyCourseIdExpression;
  const courseJoin = `LEFT JOIN courses c ON c.course_id = ${courseIdExpression}`;
  const courseExistsExpression = '(c.course_id IS NOT NULL)';
  const lifecycleTimes = [
    hasCleaningStartedAt ? 'p.cleaning_started_at' : null,
    hasClaimedAt ? 'p.claimed_at' : null,
    'p.created_at'
  ].filter(Boolean).join(', ');
  const pendingUploadIdExpression = hasPendingUploadId ? 'd.pending_upload_id' : 'NULL::UUID';

  const [pending, deletions] = await Promise.all([
    db.query(`
      SELECT p.upload_id, ${courseIdExpression} AS course_id, p.instructor_id, p.status,
             p.storage_provider, p.storage_bucket, p.storage_key,
             p.created_at, p.expires_at,
             ${courseExistsExpression} AS course_exists,
             EXISTS (
               SELECT 1 FROM lessons l WHERE l.storage_key = p.storage_key
               UNION ALL
               SELECT 1 FROM lesson_materials m WHERE m.storage_key = p.storage_key
             ) AS is_referenced
      FROM pending_media_uploads p
      ${courseJoin}
      WHERE (p.expires_at < CURRENT_TIMESTAMP AND p.status = 'PENDING')
         OR (p.status IN ('CLAIMING', 'CLEANING')
             AND COALESCE(${lifecycleTimes})
             < CURRENT_TIMESTAMP - INTERVAL '15 minutes')
      ORDER BY p.created_at ASC
      LIMIT $1
    `, [limit]),
    db.query(`
      SELECT d.deletion_id, ${pendingUploadIdExpression} AS pending_upload_id, d.status, d.retry_count,
             d.storage_provider, d.storage_bucket, d.storage_key,
             d.last_error, d.next_retry_at
      FROM failed_storage_deletions d
      WHERE d.status IN ('PENDING_RETRY', 'FAILED_PERMANENT')
      ORDER BY d.deletion_id ASC
      LIMIT $1
    `, [limit])
  ]);

  const report = {
    mode: execute ? 'execute-requested' : 'dry-run',
    generatedAt: new Date().toISOString(),
    limit,
    pendingUploads: pending.rows,
    failedStorageDeletions: deletions.rows,
    summary: {
      pendingUploadCourseLinkMigrationApplied: hasCourseColumn,
      pendingUploads: pending.rowCount,
      unreferencedPendingUploads: pending.rows.filter((row) => !row.is_referenced).length,
      pendingUploadsWithoutLiveCourse: pending.rows.filter((row) => !row.course_exists).length,
      failedStorageDeletions: deletions.rowCount
    }
  };

  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  await audit();

  if (!execute) {
    console.log('\nDRY-RUN: Không có database row hoặc storage object nào bị thay đổi.');
    return;
  }
  if (!confirmed) {
    throw new Error('Từ chối execute: cần thêm --confirm=DELETE_ORPHAN_OBJECTS');
  }

  const cleanup = require('../../src/utils/orphanCleanup.service');
  const expiredResult = await cleanup.cleanupExpiredPendingUploads(limit);
  const retryResult = await cleanup.processFailedStorageDeletions(limit);
  console.log(JSON.stringify({ expiredResult, retryResult }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
