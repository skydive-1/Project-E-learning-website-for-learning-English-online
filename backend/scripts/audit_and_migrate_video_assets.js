/**
 * Video Asset Audit & Migration Script
 * Usage:
 *   node backend/scripts/audit_and_migrate_video_assets.js --dry-run
 *   node backend/scripts/audit_and_migrate_video_assets.js --apply
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');
const {
  uploadVideoToSupabase,
  checkObjectExists,
  ensureVideosBucketExists
} = require('../src/utils/supabaseStorage');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = args.includes('--dry-run') || !isApply;

const DOCS_DIR = path.resolve(__dirname, '../../docs');
const BACKUP_JSON_PATH = path.join(DOCS_DIR, 'VIDEO-ASSET-MIGRATION-RESULTS.json');

async function main() {
  console.log('===============================================================');
  console.log(`🎬 VIDEO ASSET AUDIT & MIGRATION TOOL [${isApply ? 'MODE: APPLY' : 'MODE: DRY-RUN'}]`);
  console.log('===============================================================\n');

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  // Đảm bảo bucket 'videos' sẵn sàng
  const bucketReady = await ensureVideosBucketExists('videos');
  console.log(`📦 Supabase 'videos' Bucket Status: ${bucketReady ? '✅ Sẵn sàng' : '⚠️ Cảnh báo kết nối'}\n`);

  // 1. Truy vấn toàn bộ bài học video
  const queryResult = await db.query(`
    SELECT l.lesson_id, l.section_id, l.title, l.content_type, l.content_url, s.course_id
    FROM lessons l
    JOIN sections s ON l.section_id = s.section_id
    WHERE l.content_type = 'video'
    ORDER BY l.lesson_id ASC
  `);

  const lessons = queryResult.rows;
  console.log(`📊 Tổng số bài học video trong CSDL: ${lessons.length} bài học\n`);

  const auditReport = {
    executedAt: new Date().toISOString(),
    mode: isApply ? 'APPLY' : 'DRY-RUN',
    summary: {
      total: lessons.length,
      supabaseExists: 0,
      localMp4Migrated: 0,
      externalUrl: 0,
      missingSource: 0,
      failed: 0
    },
    lessons: []
  };

  const backendRootDir = path.resolve(__dirname, '../');

  for (const lesson of lessons) {
    const rawUrl = lesson.content_url || '';
    const itemReport = {
      lessonId: lesson.lesson_id,
      courseId: lesson.course_id,
      title: lesson.title,
      originalUrl: rawUrl,
      newUrl: rawUrl,
      status: 'UNKNOWN',
      action: 'NONE',
      reason: ''
    };

    if (!rawUrl || rawUrl.trim() === '') {
      itemReport.status = 'MISSING_SOURCE';
      itemReport.action = 'REQUIRE_REUPLOAD';
      itemReport.reason = 'Đường dẫn content_url trong CSDL đang rỗng.';
      auditReport.summary.missingSource++;
      auditReport.lessons.push(itemReport);
      continue;
    }

    // A. External URL (Youtube, CDN ngoài...)
    if ((rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !rawUrl.includes('supabase.co')) {
      itemReport.status = 'EXTERNAL_URL';
      itemReport.action = 'KEEP_AS_IS';
      itemReport.reason = 'Video sử dụng URL CDN / nhà cung cấp bên ngoài.';
      auditReport.summary.externalUrl++;
      auditReport.lessons.push(itemReport);
      continue;
    }

    // B. Supabase Storage Object (đã lưu storage key)
    if (!rawUrl.startsWith('/uploads/') && !rawUrl.startsWith('uploads/')) {
      const existsOnSupabase = await checkObjectExists(rawUrl, 'videos');
      if (existsOnSupabase) {
        itemReport.status = 'SUPABASE_OBJECT_EXISTS';
        itemReport.action = 'KEEP_AS_IS';
        itemReport.reason = 'Tệp đã tồn tại an toàn trên Supabase Storage bucket videos.';
        auditReport.summary.supabaseExists++;
        auditReport.lessons.push(itemReport);
        continue;
      }
    }

    // C. Local File / DASH MPD
    let localRelativePath = rawUrl.replace(/^\//, '');
    let localPhysicalPath = path.resolve(backendRootDir, localRelativePath);
    let isDash = rawUrl.includes('_drm.mpd') || rawUrl.endsWith('.mpd');
    let sourceMp4Path = null;

    if (isDash) {
      // Tìm MP4 gốc tương ứng (thay _drm.mpd -> .mp4)
      const potentialMp4Relative = localRelativePath.replace('_drm.mpd', '.mp4').replace('.mpd', '.mp4');
      const potentialMp4Physical = path.resolve(backendRootDir, potentialMp4Relative);
      if (fs.existsSync(potentialMp4Physical)) {
        sourceMp4Path = potentialMp4Physical;
        localRelativePath = potentialMp4Relative;
        localPhysicalPath = potentialMp4Physical;
      }
    } else {
      if (fs.existsSync(localPhysicalPath)) {
        sourceMp4Path = localPhysicalPath;
      }
    }

    // Nếu không tìm thấy file vật lý trên đĩa
    if (!sourceMp4Path || !fs.existsSync(sourceMp4Path)) {
      itemReport.status = 'MISSING_SOURCE';
      itemReport.action = 'REQUIRE_REUPLOAD';
      itemReport.reason = isDash 
        ? `Tệp DASH Manifest và tệp MP4 gốc tương ứng không tồn tại trên đĩa (${localPhysicalPath}).`
        : `Tệp video MP4 cục bộ không tồn tại trên đĩa (${localPhysicalPath}).`;
      auditReport.summary.missingSource++;
      auditReport.lessons.push(itemReport);
      continue;
    }

    // File tồn tại trên đĩa -> Tiến hành audit / migrate
    const stat = fs.statSync(sourceMp4Path);
    const assetId = crypto.randomUUID();
    const cleanFileName = path.basename(sourceMp4Path).replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetStorageKey = `courses/migrated/${lesson.course_id}/${assetId}/${cleanFileName}`;

    itemReport.status = isDash ? 'DRM_MPD_SOURCE_FOUND' : 'LOCAL_MP4_EXISTS';
    itemReport.fileSize = stat.size;
    itemReport.targetStorageKey = targetStorageKey;

    if (isDryRun) {
      if (stat.size > 52428800) {
        itemReport.action = 'SERVE_VIA_LOCAL_STREAM';
        itemReport.reason = `Tệp MP4 hợp lệ (${(stat.size / 1024 / 1024).toFixed(2)} MB) vượt quá giới hạn 50MB của Supabase Standard Tier. Tiếp tục phát qua Local Stream Endpoint (HTTP Range 206).`;
      } else {
        itemReport.action = 'WOULD_MIGRATE_TO_SUPABASE';
        itemReport.newUrl = targetStorageKey;
        itemReport.reason = `Tệp MP4 hợp lệ (${(stat.size / 1024 / 1024).toFixed(2)} MB). Sẵn sàng chuyển sang Supabase Storage khi chạy --apply.`;
      }
      auditReport.summary.localMp4Migrated++;
    } else if (isApply) {
      if (stat.size > 52428800) {
        console.log(`ℹ️ [Local Stream] Lesson ID ${lesson.lesson_id} [${cleanFileName}] (${(stat.size / 1024 / 1024).toFixed(2)} MB) vượt giới hạn 50MB Supabase Tier -> Giữ nguồn Local Streaming Range 206.`);
        itemReport.action = 'KEEP_LOCAL_RANGE_STREAM';
        itemReport.reason = `Tệp MP4 tồn tại trên đĩa cục bộ (${(stat.size / 1024 / 1024).toFixed(2)} MB). Được phát trực tiếp qua Local Stream Range 206.`;
        auditReport.summary.localMp4Migrated++;
      } else {
        console.log(`⏳ Đang tải Lesson ID ${lesson.lesson_id} [${cleanFileName}] (${(stat.size / 1024 / 1024).toFixed(2)} MB) lên Supabase...`);
        const uploadResult = await uploadVideoToSupabase(sourceMp4Path, targetStorageKey, 'video/mp4');

        if (uploadResult.success) {
          // Kiểm tra xác thực object trên Supabase
          const verified = await checkObjectExists(targetStorageKey, 'videos');
          if (verified) {
            // Cập nhật CSDL trong Transaction
            const client = await db.pool.connect();
            try {
              await client.query('BEGIN');
              await client.query('UPDATE lessons SET content_url = $1 WHERE lesson_id = $2', [targetStorageKey, lesson.lesson_id]);
              await client.query('COMMIT');

              itemReport.action = 'MIGRATED_AND_UPDATED_DB';
              itemReport.newUrl = targetStorageKey;
              itemReport.reason = 'Upload Supabase thành công và đã cập nhật content_url trong CSDL.';
              auditReport.summary.localMp4Migrated++;
              console.log(`✅ [Migrated] Lesson ${lesson.lesson_id} -> ${targetStorageKey}`);
            } catch (dbErr) {
              await client.query('ROLLBACK');
              itemReport.action = 'DB_UPDATE_FAILED';
              itemReport.reason = `Upload thành công nhưng lỗi cập nhật CSDL: ${dbErr.message}`;
              auditReport.summary.failed++;
              console.error(`❌ [DB Error] Lesson ${lesson.lesson_id}:`, dbErr.message);
            } finally {
              client.release();
            }
          } else {
            itemReport.action = 'VERIFICATION_FAILED';
            itemReport.reason = 'Upload xong nhưng không tìm thấy object trên Supabase bucket videos.';
            auditReport.summary.failed++;
            console.error(`❌ [Verify Error] Lesson ${lesson.lesson_id} không tồn tại sau upload.`);
          }
        } else {
          itemReport.action = 'UPLOAD_FAILED';
          itemReport.reason = `Upload Supabase thất bại: ${uploadResult.error}`;
          auditReport.summary.failed++;
          console.error(`❌ [Upload Error] Lesson ${lesson.lesson_id}:`, uploadResult.error);
        }
      }
    }

    auditReport.lessons.push(itemReport);
  }

  // 2. Xuất kết quả ra file JSON
  fs.writeFileSync(BACKUP_JSON_PATH, JSON.stringify(auditReport, null, 2), 'utf8');
  console.log(`\n💾 Đã lưu báo cáo kết quả chi tiết tại: ${BACKUP_JSON_PATH}\n`);

  console.log('================== KẾT QUẢ TỔNG HỢP ==================');
  console.log(`🔹 Tổng số bài học video:        ${auditReport.summary.total}`);
  console.log(`🔹 Đã tồn tại trên Supabase:      ${auditReport.summary.supabaseExists}`);
  console.log(`🔹 Local MP4 (Chuyển đổi/Đủ điều kiện): ${auditReport.summary.localMp4Migrated}`);
  console.log(`🔹 URL ngoài (External):          ${auditReport.summary.externalUrl}`);
  console.log(`⚠️ Mất file gốc (MISSING_SOURCE): ${auditReport.summary.missingSource}`);
  console.log(`❌ Thất bại (Failed):              ${auditReport.summary.failed}`);
  console.log('======================================================\n');

  const missingList = auditReport.lessons.filter(l => l.status === 'MISSING_SOURCE');
  if (missingList.length > 0) {
    console.log('⚠️ DANH SÁCH BÀI HỌC CẦN GIẢNG VIÊN UPLOAD LẠI VIDEO (MISSING_SOURCE):');
    missingList.forEach(m => {
      console.log(`  - Lesson ID: ${m.lessonId} | Course ID: ${m.courseId} | Tiêu đề: "${m.title}" | Path cũ: ${m.originalUrl}`);
    });
    console.log('\n');
  }

  return auditReport;
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('❌ Lỗi thực thi migration script:', err);
    process.exit(1);
  });
}

module.exports = { main };
