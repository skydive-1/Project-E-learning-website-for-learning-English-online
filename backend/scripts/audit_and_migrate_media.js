/**
 * Script Audit & Migration Tài nguyên Media Bài giảng (TASK-DURABLE-LESSON-MEDIA-PIPELINE-01 / R2)
 * 
 * Chế độ chạy:
 *   node scripts/audit_and_migrate_media.js --dry-run
 *   node scripts/audit_and_migrate_media.js --apply
 * 
 * Phụ trách: NGUYỄN THANH LIÊM (Backend & Security Developer) & LÊ ĐÌNH CHƯƠNG (Database Administrator)
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

const BACKEND_ROOT = path.resolve(__dirname, '..');
const UPLOADS_ROOT = path.resolve(BACKEND_ROOT, 'uploads');
const BACKUP_DIR = path.resolve(BACKEND_ROOT, 'backups');

/**
 * Trích xuất bucket và key từ URL Supabase đầy đủ
 * @param {string} url 
 * @returns {{ bucket: string, key: string } | null}
 */
function parseSupabaseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('supabase.co')) return null;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const markerIndex = pathParts.findIndex(p => ['public', 'sign', 'authenticated'].includes(p));
    if (markerIndex !== -1 && pathParts.length > markerIndex + 2) {
      const bucket = pathParts[markerIndex + 1];
      const key = pathParts.slice(markerIndex + 2).join('/');
      return { bucket, key };
    }
  } catch (e) {
    // URL parse error
  }
  return null;
}

/**
 * Phân giải đường dẫn file cục bộ trong backend/uploads và chống Path Traversal
 * @param {string} rawUrl 
 * @returns {string|null} Đường dẫn tuyệt đối an toàn hoặc null nếu không hợp lệ / traversal
 */
function resolveLocalUploadPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (!rawUrl.startsWith('/uploads/') && !rawUrl.startsWith('uploads/')) return null;

  const sanitizedRelative = rawUrl.replace(/^\/?uploads\/?/, '');
  const resolved = path.resolve(UPLOADS_ROOT, sanitizedRelative);

  // Bảo vệ chống Path Traversal: đường dẫn phân giải BẮT BUỘC nằm trong UPLOADS_ROOT
  if (!resolved.startsWith(UPLOADS_ROOT)) {
    console.warn(`🚨 [Path Traversal Blocked] Từ chối truy cập đường dẫn bất hợp lệ: ${rawUrl}`);
    return null;
  }
  return resolved;
}

/**
 * Hàm thuần phân loại nguồn tài nguyên (Pure Classifier Function)
 * @param {object} item 
 * @returns {object} Phân loại tài nguyên
 */
function classifyMediaSource({ storageKey, contentUrl, contentType }) {
  const type = (contentType || '').toLowerCase();
  const rawUrl = contentUrl || '';

  if (['quiz', 'text', 'speaking'].includes(type) || (!rawUrl && !storageKey && type !== 'video' && type !== 'pdf')) {
    return {
      category: 'NON_MEDIA',
      bucket: null,
      key: null,
      isPdf: false,
      mimeType: null
    };
  }

  const isPdf = type === 'pdf' || rawUrl.endsWith('.pdf') || (storageKey && storageKey.endsWith('.pdf'));
  const bucket = isPdf ? 'documents' : 'videos';
  const mimeType = isPdf ? 'application/pdf' : 'video/mp4';

  if (!rawUrl && !storageKey) {
    return {
      category: 'EMPTY_SOURCE',
      bucket,
      key: null,
      isPdf,
      mimeType
    };
  }

  // 1. Kiểm tra URL Supabase đầy đủ
  const supabaseParsed = parseSupabaseStorageUrl(rawUrl);
  if (supabaseParsed) {
    return {
      category: 'SUPABASE_FULL_URL',
      bucket: supabaseParsed.bucket || bucket,
      key: supabaseParsed.key,
      isPdf,
      mimeType
    };
  }

  // 2. Link ngoài HTTP / HTTPS khác
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return {
      category: 'EXTERNAL_URL',
      bucket: null,
      key: null,
      isPdf,
      mimeType
    };
  }

  // 3. Đường dẫn file cục bộ (/uploads/...)
  if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
    return {
      category: 'LOCAL_PATH',
      bucket,
      key: null,
      isPdf,
      mimeType
    };
  }

  // 4. Supabase Storage Key
  const effectiveKey = storageKey || rawUrl.replace(/^\/+/, '');
  return {
    category: 'SUPABASE_KEY',
    bucket,
    key: effectiveKey,
    isPdf,
    mimeType
  };
}

async function runAuditAndMigrate(options = {}) {
  const args = process.argv.slice(2);
  const isApply = options.apply !== undefined ? options.apply : args.includes('--apply');

  console.log('================================================================');
  console.log(`🎬 AUDIT & MIGRATE LESSON MEDIA ASSETS PIPELINE`);
  console.log(`📌 Chế độ hoạt động: ${isApply ? '🚀 APPLY (Ghi vào Storage & CSDL)' : '🔍 DRY-RUN (Chỉ kiểm tra & báo cáo, không ghi CSDL)'}`);
  console.log(`📁 Thư mục uploads cục bộ: ${UPLOADS_ROOT}`);
  console.log('================================================================\n');

  if (typeof db.testConnection === 'function') {
    await db.testConnection();
  }

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
    const classification = classifyMediaSource({
      storageKey: les.storage_key,
      contentUrl: les.content_url,
      contentType: les.content_type
    });

    if (classification.category === 'NON_MEDIA') {
      lessonTextQuizCount++;
      continue;
    }

    const instructorId = les.instructor_id || 'common';

    if (classification.category === 'EXTERNAL_URL') {
      lessonExternalCount++;
      backupMapping.lessons.push({
        lessonId: les.lesson_id,
        title: les.title,
        category: 'EXTERNAL_URL',
        originalUrl: les.content_url,
        status: 'READY'
      });
      continue;
    }

    if (classification.category === 'EMPTY_SOURCE') {
      lessonMissingCount++;
      backupMapping.missingSources.push({
        type: 'lesson',
        id: les.lesson_id,
        title: les.title,
        courseId: les.course_id,
        instructorId,
        reason: 'EMPTY_CONTENT_URL'
      });
      if (isApply) {
        await db.query(`UPDATE lessons SET media_status = 'MISSING_SOURCE' WHERE lesson_id = $1`, [les.lesson_id]);
      }
      continue;
    }

    if (classification.category === 'SUPABASE_KEY' || classification.category === 'SUPABASE_FULL_URL') {
      const cleanKey = classification.key;
      const bucketName = classification.bucket;
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

        if (isApply && (!les.storage_key || les.media_status !== 'READY' || les.content_url !== cleanKey)) {
          await db.query(`
            UPDATE lessons 
            SET storage_provider = 'supabase', storage_bucket = $1, storage_key = $2,
                content_url = $2, mime_type = $3, media_status = 'READY'
            WHERE lesson_id = $4
          `, [bucketName, cleanKey, classification.mimeType, les.lesson_id]);
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
          originalUrl: les.content_url,
          reason: 'SUPABASE_OBJECT_NOT_FOUND'
        });

        if (isApply) {
          await db.query(`UPDATE lessons SET media_status = 'MISSING_SOURCE' WHERE lesson_id = $1`, [les.lesson_id]);
        }
      }
      continue;
    }

    if (classification.category === 'LOCAL_PATH') {
      const localFullPath = resolveLocalUploadPath(les.content_url);

      if (localFullPath && fs.existsSync(localFullPath)) {
        const stats = fs.statSync(localFullPath);
        const checksum = computeSha256(localFullPath);
        const ext = path.extname(localFullPath).toLowerCase();
        const baseName = path.basename(localFullPath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const objectKey = `courses/${instructorId}/${crypto.randomUUID()}/${baseName}${ext}`;
        const bucketName = classification.bucket;

        console.log(`📦 [LOCAL FOUND] Lesson #${les.lesson_id} ("${les.title}") -> Sẵn sàng migrate lên Supabase ('${bucketName}/${objectKey}')`);

        if (isApply) {
          let uploadRes;
          if (classification.isPdf) {
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
            `, [bucketName, uploadRes.storageKey, classification.mimeType, stats.size, checksum, les.lesson_id]);
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
          originalUrl: les.content_url,
          targetStorageKey: objectKey,
          targetBucket: bucketName
        });
      } else {
        lessonMissingCount++;
        console.warn(`⚠️ [MISSING SOURCE] Lesson #${les.lesson_id} ("${les.title}"): File cục bộ không tồn tại (${les.content_url})`);
        backupMapping.missingSources.push({
          type: 'lesson',
          id: les.lesson_id,
          title: les.title,
          courseId: les.course_id,
          instructorId,
          originalUrl: les.content_url,
          reason: 'LOCAL_FILE_NOT_FOUND_ON_DISK'
        });

        if (isApply) {
          await db.query(`UPDATE lessons SET media_status = 'MISSING_SOURCE' WHERE lesson_id = $1`, [les.lesson_id]);
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
    const classification = classifyMediaSource({
      storageKey: mat.storage_key,
      contentUrl: mat.file_url,
      contentType: 'pdf'
    });

    const instructorId = mat.instructor_id || 'common';

    if (classification.category === 'SUPABASE_KEY' || classification.category === 'SUPABASE_FULL_URL') {
      const cleanKey = classification.key;
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
          fileName: mat.file_name,
          lessonId: mat.lesson_id,
          reason: 'SUPABASE_OBJECT_NOT_FOUND'
        });

        if (isApply) {
          await db.query(`UPDATE lesson_materials SET media_status = 'MISSING_SOURCE' WHERE material_id = $1`, [mat.material_id]);
        }
      }
      continue;
    }

    if (classification.category === 'LOCAL_PATH') {
      const localFullPath = resolveLocalUploadPath(mat.file_url);

      if (localFullPath && fs.existsSync(localFullPath)) {
        const stats = fs.statSync(localFullPath);
        const checksum = computeSha256(localFullPath);
        const ext = path.extname(localFullPath).toLowerCase();
        const baseName = path.basename(localFullPath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const objectKey = `courses/${instructorId}/${crypto.randomUUID()}/${baseName}${ext}`;

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
          originalUrl: mat.file_url,
          targetStorageKey: objectKey
        });
      } else {
        matMissingCount++;
        console.warn(`⚠️ [MISSING SOURCE] Material #${mat.material_id} ("${mat.file_name}"): File cục bộ không tồn tại (${mat.file_url})`);
        backupMapping.missingSources.push({
          type: 'material',
          id: mat.material_id,
          fileName: mat.file_name,
          lessonId: mat.lesson_id,
          reason: 'LOCAL_FILE_NOT_FOUND_ON_DISK'
        });

        if (isApply) {
          await db.query(`UPDATE lesson_materials SET media_status = 'MISSING_SOURCE' WHERE material_id = $1`, [mat.material_id]);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Xuất báo cáo và Backup Mapping
  // -------------------------------------------------------------
  console.log('\n💾 [3/3] Xuất file Backup Mapping JSON...');
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupFilePath = path.join(BACKUP_DIR, `media_migration_mapping_${timestamp}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupMapping, null, 2), 'utf-8');
  console.log(`✅ File backup mapping đã được lưu tại: ${backupFilePath}\n`);

  console.log('================================================================');
  console.log('📊 TỔNG KẾT KẾT QUẢ AUDIT & MIGRATION:');
  console.log('================================================================');
  console.log(`- Bài học (Lessons):`);
  console.log(`  + Đã ở Supabase Storage:  ${lessonSupabaseCount}`);
  console.log(`  + Nguồn External (CDN):    ${lessonExternalCount}`);
  console.log(`  + Local file cần migrate: ${lessonLocalMigratedCount}`);
  console.log(`  + Bài học Text/Quiz/Nói:   ${lessonTextQuizCount}`);
  console.log(`  + Nguồn bị thiếu/mất:      ${lessonMissingCount}`);
  console.log(`- Tài liệu đính kèm (Materials):`);
  console.log(`  + Đã ở Supabase Storage:  ${matSupabaseCount}`);
  console.log(`  + Local file cần migrate: ${matLocalMigratedCount}`);
  console.log(`  + Nguồn bị thiếu/mất:      ${matMissingCount}`);
  console.log('================================================================\n');

  return {
    success: true,
    backupFilePath,
    stats: {
      lessonSupabaseCount,
      lessonExternalCount,
      lessonLocalMigratedCount,
      lessonTextQuizCount,
      lessonMissingCount,
      matSupabaseCount,
      matLocalMigratedCount,
      matMissingCount
    }
  };
}

// Chạy trực tiếp qua CLI
if (require.main === module) {
  runAuditAndMigrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Lỗi thực thi audit script:', err);
      process.exit(1);
    });
}

module.exports = {
  runAuditAndMigrate,
  classifyMediaSource,
  parseSupabaseStorageUrl,
  resolveLocalUploadPath,
  UPLOADS_ROOT
};
