/**
 * Script Audit & Migration Tài nguyên Media Bài giảng (TASK-DURABLE-LESSON-MEDIA-PIPELINE-01)
 * 
 * Chế độ chạy:
 *   node scripts/audit_and_migrate_media.js --dry-run
 *   node scripts/audit_and_migrate_media.js --apply
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/database');
const {
  uploadVideoToSupabase,
  uploadDocumentToSupabase,
  checkObjectExists,
  computeSha256
} = require('../src/utils/supabaseStorage');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply;

const BACKUP_DIR = path.resolve(__dirname, '../backups');

async function runAuditAndMigrate() {
  console.log('================================================================');
  console.log(`🎬 AUDIT & MIGRATE LESSON MEDIA ASSETS PIPELINE`);
  console.log(`📌 Chế độ hoạt động: ${isApply ? '🚀 APPLY (Ghi vào Storage & CSDL)' : '🔍 DRY-RUN (Chỉ kiểm tra & báo cáo, không ghi CSDL)'}`);
  console.log('================================================================\n');

  await db.testConnection();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupMapping = {
    timestamp: new Date().toISOString(),
    mode: isApply ? 'apply' : 'dry-run',
    lessons: [],
    materials: [],
    missingSources: []
  };

  // -------------------------------------------------------------
  // 1. Quét toàn bộ bài học (lessons)
  // -------------------------------------------------------------
  console.log('📋 [1/3] Đang quét danh sách bài học (lessons)...');
  const lessonsRes = await db.query(`
    SELECT l.lesson_id, l.title, l.content_type, l.content_url, l.storage_provider,
           l.storage_bucket, l.storage_key, l.mime_type, l.size_bytes, l.checksum_sha256, l.media_status,
           s.course_id, c.instructor_id
    FROM lessons l
    JOIN sections s ON l.section_id = s.section_id
    JOIN courses c ON s.course_id = c.course_id
    ORDER BY l.lesson_id ASC
  `);

  const lessons = lessonsRes.rows;
  console.log(`👉 Tổng số bài học tìm thấy: ${lessons.length}\n`);

  let lessonSupabaseCount = 0;
  let lessonExternalCount = 0;
  let lessonLocalMigratedCount = 0;
  let lessonMissingCount = 0;
  let lessonTextQuizCount = 0;

  for (const les of lessons) {
    const rawUrl = les.content_url || '';
    const contentType = (les.content_type || '').toLowerCase();

    if (['quiz', 'text', 'speaking'].includes(contentType) || (!rawUrl && contentType !== 'video' && contentType !== 'pdf')) {
      lessonTextQuizCount++;
      continue;
    }

    const instructorId = les.instructor_id || 'common';
    const isPdf = contentType === 'pdf' || rawUrl.endsWith('.pdf');
    const bucketName = isPdf ? 'documents' : 'videos';
    const targetMime = isPdf ? 'application/pdf' : 'video/mp4';

    // A. Link ngoài HTTP / HTTPS
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      if (!rawUrl.includes('supabase.co')) {
        lessonExternalCount++;
        backupMapping.lessons.push({
          lessonId: les.lesson_id,
          title: les.title,
          category: 'EXTERNAL_URL',
          originalUrl: rawUrl,
          status: 'READY'
        });
        continue;
      }
    }

    // B. Đã là Supabase Storage Key
    if (rawUrl && !rawUrl.startsWith('/uploads/') && !rawUrl.startsWith('uploads/')) {
      const cleanKey = rawUrl.replace(/^\/+/, '');
      const existsOnStorage = await checkObjectExists(cleanKey, bucketName);

      if (existsOnStorage) {
        lessonSupabaseCount++;
        backupMapping.lessons.push({
          lessonId: les.lesson_id,
          title: les.title,
          category: 'SUPABASE_OBJECT',
          storageKey: cleanKey,
          storageBucket: bucketName,
          status: 'READY'
        });

        if (isApply && (!les.storage_key || les.media_status !== 'READY')) {
          await db.query(`
            UPDATE lessons 
            SET storage_provider = 'supabase', storage_bucket = $1, storage_key = $2,
                mime_type = $3, media_status = 'READY'
            WHERE lesson_id = $4
          `, [bucketName, cleanKey, targetMime, les.lesson_id]);
        }
      } else {
        lessonMissingCount++;
        console.warn(`❌ [MISSING] Lesson #${les.lesson_id} ("${les.title}"): Supabase object không tồn tại (${cleanKey})`);
        backupMapping.missingSources.push({
          type: 'lesson',
          id: les.lesson_id,
          title: les.title,
          courseId: les.course_id,
          instructorId,
          originalUrl: rawUrl,
          reason: 'SUPABASE_OBJECT_NOT_FOUND'
        });

        if (isApply) {
          await db.query(`
            UPDATE lessons 
            SET media_status = 'MISSING_SOURCE'
            WHERE lesson_id = $1
          `, [les.lesson_id]);
        }
      }
      continue;
    }

    // C. File local Railway path (/uploads/...)
    if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
      const localRelative = rawUrl.replace(/^\//, '');
      const localFullPath = path.resolve(__dirname, '../../', localRelative);

      if (fs.existsSync(localFullPath)) {
        const stats = fs.statSync(localFullPath);
        const checksum = computeSha256(localFullPath);
        const ext = path.extname(localFullPath).toLowerCase();
        const baseName = path.basename(localFullPath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const objectKey = `courses/${instructorId}/${crypto.randomUUID()}/${baseName}${ext}`;

        console.log(`📦 [LOCAL FOUND] Lesson #${les.lesson_id} ("${les.title}") -> Sẵn sàng migrate lên Supabase ('${bucketName}/${objectKey}')`);

        if (isApply) {
          let uploadRes;
          if (isPdf) {
            uploadRes = await uploadDocumentToSupabase(localFullPath, objectKey, 'application/pdf');
          } else {
            uploadRes = await uploadVideoToSupabase(localFullPath, objectKey, 'video/mp4');
          }

          if (uploadRes.success) {
            await db.query(`
              UPDATE lessons
              SET storage_provider = 'supabase',
                  storage_bucket = $1,
                  storage_key = $2,
                  content_url = $2,
                  mime_type = $3,
                  size_bytes = $4,
                  checksum_sha256 = $5,
                  media_status = 'READY'
              WHERE lesson_id = $6
            `, [bucketName, uploadRes.storageKey, targetMime, stats.size, checksum, les.lesson_id]);
            lessonLocalMigratedCount++;
            console.log(`   ✅ Đã upload & cập nhật DB thành công cho lesson #${les.lesson_id}`);
          } else {
            console.error(`   ❌ Lỗi upload lesson #${les.lesson_id}:`, uploadRes.error);
          }
        } else {
          lessonLocalMigratedCount++;
        }

        backupMapping.lessons.push({
          lessonId: les.lesson_id,
          title: les.title,
          category: 'LOCAL_MIGRATED',
          originalUrl: rawUrl,
          targetStorageKey: objectKey,
          targetBucket: bucketName
        });
      } else {
        lessonMissingCount++;
        console.warn(`⚠️ [MISSING SOURCE] Lesson #${les.lesson_id} ("${les.title}"): File cục bộ không tồn tại (${rawUrl})`);
        backupMapping.missingSources.push({
          type: 'lesson',
          id: les.lesson_id,
          title: les.title,
          courseId: les.course_id,
          instructorId,
          originalUrl: rawUrl,
          reason: 'LOCAL_FILE_NOT_FOUND_ON_DISK'
        });

        if (isApply) {
          await db.query(`
            UPDATE lessons 
            SET media_status = 'MISSING_SOURCE'
            WHERE lesson_id = $1
          `, [les.lesson_id]);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Quét toàn bộ tài liệu đính kèm (lesson_materials)
  // -------------------------------------------------------------
  console.log('\n📋 [2/3] Đang quét danh sách tài liệu đính kèm (lesson_materials)...');
  const materialsRes = await db.query(`
    SELECT m.*, l.title AS lesson_title, s.course_id, c.instructor_id
    FROM lesson_materials m
    JOIN lessons l ON m.lesson_id = l.lesson_id
    JOIN sections s ON l.section_id = s.section_id
    JOIN courses c ON s.course_id = c.course_id
    ORDER BY m.material_id ASC
  `);

  const materials = materialsRes.rows;
  console.log(`👉 Tổng số tài liệu đính kèm tìm thấy: ${materials.length}\n`);

  let matSupabaseCount = 0;
  let matLocalMigratedCount = 0;
  let matMissingCount = 0;

  for (const mat of materials) {
    const rawUrl = mat.file_url || '';
    const cleanKey = rawUrl.replace(/^\/+/, '');

    // A. Supabase object
    if (!rawUrl.startsWith('/uploads/') && !rawUrl.startsWith('uploads/') && !rawUrl.startsWith('http')) {
      const exists = await checkObjectExists(cleanKey, 'documents');
      if (exists) {
        matSupabaseCount++;
        backupMapping.materials.push({
          materialId: mat.material_id,
          lessonId: mat.lesson_id,
          fileName: mat.file_name,
          category: 'SUPABASE_OBJECT',
          storageKey: cleanKey,
          status: 'READY'
        });

        if (isApply && (!mat.storage_key || mat.media_status !== 'READY')) {
          await db.query(`
            UPDATE lesson_materials
            SET storage_provider = 'supabase', storage_bucket = 'documents', storage_key = $1,
                mime_type = 'application/pdf', media_status = 'READY'
            WHERE material_id = $2
          `, [cleanKey, mat.material_id]);
        }
      } else {
        matMissingCount++;
        console.warn(`❌ [MISSING] Material #${mat.material_id} ("${mat.file_name}"): Supabase object không tồn tại (${cleanKey})`);
        backupMapping.missingSources.push({
          type: 'material',
          id: mat.material_id,
          lessonId: mat.lesson_id,
          title: mat.file_name,
          courseId: mat.course_id,
          instructorId: mat.instructor_id,
          originalUrl: rawUrl,
          reason: 'SUPABASE_OBJECT_NOT_FOUND'
        });

        if (isApply) {
          await db.query(`
            UPDATE lesson_materials
            SET media_status = 'MISSING_SOURCE'
            WHERE material_id = $1
          `, [mat.material_id]);
        }
      }
      continue;
    }

    // B. Local file
    if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
      const localRelative = rawUrl.replace(/^\//, '');
      const localFullPath = path.resolve(__dirname, '../../', localRelative);

      if (fs.existsSync(localFullPath)) {
        const stats = fs.statSync(localFullPath);
        const checksum = computeSha256(localFullPath);
        const ext = path.extname(localFullPath).toLowerCase();
        const baseName = path.basename(localFullPath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const objectKey = `courses/materials/${mat.lesson_id}/${crypto.randomUUID()}/${baseName}${ext}`;

        console.log(`📦 [LOCAL FOUND] Material #${mat.material_id} ("${mat.file_name}") -> Sẵn sàng migrate lên Supabase ('documents/${objectKey}')`);

        if (isApply) {
          const uploadRes = await uploadDocumentToSupabase(localFullPath, objectKey, 'application/pdf');
          if (uploadRes.success) {
            await db.query(`
              UPDATE lesson_materials
              SET storage_provider = 'supabase',
                  storage_bucket = 'documents',
                  storage_key = $1,
                  file_url = $1,
                  mime_type = 'application/pdf',
                  size_bytes = $2,
                  checksum_sha256 = $3,
                  media_status = 'READY'
              WHERE material_id = $4
            `, [uploadRes.storageKey, stats.size, checksum, mat.material_id]);
            matLocalMigratedCount++;
            console.log(`   ✅ Đã upload & cập nhật DB thành công cho material #${mat.material_id}`);
          } else {
            console.error(`   ❌ Lỗi upload material #${mat.material_id}:`, uploadRes.error);
          }
        } else {
          matLocalMigratedCount++;
        }

        backupMapping.materials.push({
          materialId: mat.material_id,
          lessonId: mat.lesson_id,
          fileName: mat.file_name,
          category: 'LOCAL_MIGRATED',
          originalUrl: rawUrl,
          targetStorageKey: objectKey
        });
      } else {
        matMissingCount++;
        console.warn(`⚠️ [MISSING SOURCE] Material #${mat.material_id} ("${mat.file_name}"): File cục bộ không tồn tại (${rawUrl})`);
        backupMapping.missingSources.push({
          type: 'material',
          id: mat.material_id,
          lessonId: mat.lesson_id,
          title: mat.file_name,
          courseId: mat.course_id,
          instructorId: mat.instructor_id,
          originalUrl: rawUrl,
          reason: 'LOCAL_FILE_NOT_FOUND_ON_DISK'
        });

        if (isApply) {
          await db.query(`
            UPDATE lesson_materials
            SET media_status = 'MISSING_SOURCE'
            WHERE material_id = $1
          `, [mat.material_id]);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Xuất báo cáo và lưu file backup mapping
  // -------------------------------------------------------------
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupFile = path.join(BACKUP_DIR, `media_migration_backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupMapping, null, 2), 'utf-8');

  console.log('\n================================================================');
  console.log('📊 TỔNG KẾT KẾT QUẢ AUDIT MEDIA ASSETS');
  console.log('================================================================');
  console.log(`🔹 Tổng số bài học (Lessons): ${lessons.length}`);
  console.log(`   - Text / Quiz / Speaking (Không có media file): ${lessonTextQuizCount}`);
  console.log(`   - Đã lưu trên Supabase Storage (Hợp lệ): ${lessonSupabaseCount}`);
  console.log(`   - Link ngoài (External CDN/URL): ${lessonExternalCount}`);
  console.log(`   - File local có thể migrate: ${lessonLocalMigratedCount}`);
  console.log(`   - File bị mất nguồn (MISSING_SOURCE): ${lessonMissingCount}`);
  console.log('----------------------------------------------------------------');
  console.log(`🔹 Tổng số tài liệu đính kèm (Materials): ${materials.length}`);
  console.log(`   - Đã lưu trên Supabase Storage (Hợp lệ): ${matSupabaseCount}`);
  console.log(`   - File local có thể migrate: ${matLocalMigratedCount}`);
  console.log(`   - File bị mất nguồn (MISSING_SOURCE): ${matMissingCount}`);
  console.log('================================================================');
  console.log(`💾 File sao lưu mapping đã lưu tại: ${backupFile}`);

  if (backupMapping.missingSources.length > 0) {
    console.log(`\n⚠️ DANH SÁCH TÀI NGUYÊN CẦN GIẢNG VIÊN UPLOAD LẠI (${backupMapping.missingSources.length} mục):`);
    backupMapping.missingSources.forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.type.toUpperCase()}] ID: ${item.id} | Tiêu đề: "${item.title}" | Khóa học ID: ${item.courseId} | URL cũ: ${item.originalUrl}`);
    });
  } else {
    console.log('\n🎉 Toàn bộ tài nguyên media đều hoàn hảo, không có file nào bị thiếu!');
  }

  console.log('\n================================================================\n');
  process.exit(0);
}

runAuditAndMigrate().catch(err => {
  console.error('❌ Lỗi khi thực thi Audit & Migrate Media:', err);
  process.exit(1);
});
