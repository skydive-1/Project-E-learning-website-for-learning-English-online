/**
 * Service Quản lý & Dọn dẹp Tài nguyên Mồ côi (Orphan Assets Cleanup & Pending Uploads)
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer) & LÊ ĐÌNH CHƯƠNG (Database Administrator)
 * Module: Durable Storage & Integrity Lifecycle
 */

const db = require('../config/database');
const supabaseStorage = require('./supabaseStorage');

class OrphanCleanupService {
  /**
   * Đăng ký tệp vừa tải lên vào bảng pending_media_uploads (Hợp đồng upload tạm thời)
   */
  async registerPendingUpload({
    uploadId,
    instructorId,
    storageKey,
    storageBucket,
    mimeType,
    sizeBytes = 0,
    checksumSha256
  }) {
    if (!uploadId || !storageKey || !storageBucket || !checksumSha256) {
      throw new Error('Thiếu thông tin bắt buộc để đăng ký pending upload');
    }

    const query = `
      INSERT INTO pending_media_uploads (
        upload_id, instructor_id, storage_provider, storage_bucket,
        storage_key, mime_type, size_bytes, checksum_sha256, status
      )
      VALUES ($1, $2, 'supabase', $3, $4, $5, $6, $7, 'PENDING')
      RETURNING *
    `;

    const res = await db.query(query, [
      uploadId,
      instructorId,
      storageBucket,
      storageKey,
      mimeType,
      sizeBytes,
      checksumSha256
    ]);

    return res.rows[0];
  }

  /**
   * Khóa và xác thực hợp lệ quyền sử dụng tệp tải lên tạm thời (Claim Pending Upload)
   * Sử dụng SELECT ... FOR UPDATE để chống race condition double-claim
   */
  async claimPendingUpload({
    uploadId,
    instructorId,
    userRole,
    storageKey,
    storageBucket,
    mimeType,
    sizeBytes,
    checksumSha256,
    client
  }) {
    if (!uploadId) return null;
    const runner = client || db;

    const query = `
      SELECT * 
      FROM pending_media_uploads 
      WHERE upload_id = $1 
      FOR UPDATE
    `;

    const res = await runner.query(query, [uploadId]);
    if (res.rows.length === 0) {
      throw new Error(`Không tìm thấy phiên tải lên tạm thời pendingUploadId=${uploadId}`);
    }

    const pending = res.rows[0];

    // 1. Kiểm tra trạng thái và hạn sử dụng TTL
    if (pending.status !== 'PENDING') {
      throw new Error(`Tài nguyên upload (${uploadId}) không ở trạng thái sẵn sàng để liên kết (status=${pending.status})`);
    }

    if (new Date(pending.expires_at) <= new Date()) {
      throw new Error(`Phiên tải lên uploadId=${uploadId} đã hết hạn TTL.`);
    }

    // 2. Kiểm tra quyền sở hữu (Chỉ chủ sở hữu hoặc Admin mới được liên kết)
    const isAdmin = userRole === 1 || userRole === '1';
    if (!isAdmin && String(pending.instructor_id) !== String(instructorId)) {
      throw new Error('Bạn không có quyền liên kết tài nguyên do giảng viên khác tải lên.');
    }

    // 3. So khớp chặt chẽ toàn bộ metadata
    if (pending.storage_key !== storageKey) {
      throw new Error(`Storage key không khớp với phiên upload (${pending.storage_key} vs ${storageKey})`);
    }
    if (pending.storage_provider !== 'supabase') {
      throw new Error('Storage provider không khớp với pending upload');
    }
    if (pending.storage_bucket !== storageBucket) {
      throw new Error(`Storage bucket không khớp (${pending.storage_bucket} vs ${storageBucket})`);
    }
    if (pending.mime_type !== mimeType) {
      throw new Error('MIME type không khớp với tệp đã upload.');
    }
    if (String(pending.size_bytes) !== String(sizeBytes)) {
      throw new Error('Kích thước tệp không khớp với pending upload.');
    }
    if (pending.checksum_sha256 !== checksumSha256) {
      throw new Error('Mã băm SHA-256 không khớp với tệp đã upload.');
    }

    // 4. Kiểm tra sự tồn tại thực tế trên Supabase Storage
    const exists = await supabaseStorage.checkObjectExists(pending.storage_key, pending.storage_bucket);
    if (!exists) {
      throw new Error(`Tài nguyên ${pending.storage_key} không tồn tại thực tế trên Supabase Storage.`);
    }

    // Đánh dấu CLAIMING trong transaction
    await runner.query(
      `UPDATE pending_media_uploads SET status = 'CLAIMING', claimed_at = CURRENT_TIMESTAMP WHERE upload_id = $1`,
      [uploadId]
    );

    return pending;
  }

  /**
   * Đánh dấu các pending uploads đã liên kết thành công vào khóa học (COMMITTED)
   */
  async commitPendingUploads(uploadIds = [], client = null) {
    if (!Array.isArray(uploadIds) || uploadIds.length === 0) return;
    const runner = client || db;

    await runner.query(
      `UPDATE pending_media_uploads SET status = 'COMMITTED' WHERE upload_id = ANY($1::uuid[])`,
      [uploadIds]
    );
  }

  /**
   * Thu thập danh sách storage keys của tất cả bài học và tài liệu thuộc một khóa học
   */
  async collectAssetsFromCourse(courseId, client = null) {
    const runner = client || db;
    const query = `
        SELECT 
          l.storage_key, 
          l.storage_bucket, 
          l.storage_provider,
          l.content_url
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        WHERE s.course_id = $1 AND l.storage_key IS NOT NULL
        UNION ALL
        SELECT 
          m.storage_key, 
          m.storage_bucket, 
          m.storage_provider,
          m.file_url AS content_url
        FROM lesson_materials m
        JOIN lessons l ON m.lesson_id = l.lesson_id
        JOIN sections s ON l.section_id = s.section_id
        WHERE s.course_id = $1 AND m.storage_key IS NOT NULL
      `;
    const res = await runner.query(query, [courseId]);
    return res.rows.map(r => ({
        key: r.storage_key,
        bucket: r.storage_bucket || (r.storage_key.endsWith('.pdf') ? 'documents' : 'videos'),
        provider: r.storage_provider || 'supabase'
      }));
  }

  /**
   * Thu thập danh sách storage keys của tất cả bài học thuộc một section
   */
  async collectAssetsFromSection(sectionId, client = null) {
    const runner = client || db;
    const query = `
        SELECT 
          l.storage_key, 
          l.storage_bucket, 
          l.storage_provider
        FROM lessons l
        WHERE l.section_id = $1 AND l.storage_key IS NOT NULL
        UNION ALL
        SELECT 
          m.storage_key, 
          m.storage_bucket, 
          m.storage_provider
        FROM lesson_materials m
        JOIN lessons l ON m.lesson_id = l.lesson_id
        WHERE l.section_id = $1 AND m.storage_key IS NOT NULL
      `;
    const res = await runner.query(query, [sectionId]);
    return res.rows.map(r => ({
        key: r.storage_key,
        bucket: r.storage_bucket || (r.storage_key.endsWith('.pdf') ? 'documents' : 'videos'),
        provider: r.storage_provider || 'supabase'
      }));
  }

  /**
   * Thu thập danh sách storage keys của một bài học và các tài liệu đính kèm
   */
  async collectAssetsFromLesson(lessonId, client = null) {
    const runner = client || db;
    const query = `
        SELECT 
          l.storage_key, 
          l.storage_bucket, 
          l.storage_provider
        FROM lessons l
        WHERE l.lesson_id = $1 AND l.storage_key IS NOT NULL
        UNION ALL
        SELECT 
          m.storage_key, 
          m.storage_bucket, 
          m.storage_provider
        FROM lesson_materials m
        WHERE m.lesson_id = $1 AND m.storage_key IS NOT NULL
      `;
    const res = await runner.query(query, [lessonId]);
    return res.rows.map(r => ({
        key: r.storage_key,
        bucket: r.storage_bucket || (r.storage_key.endsWith('.pdf') ? 'documents' : 'videos'),
        provider: r.storage_provider || 'supabase'
      }));
  }

  /**
   * Kiểm tra xem một storage_key có đang được bài học hoặc tài liệu nào khác tham chiếu không
   * Quy tắc Fail-Closed: Nếu truy vấn lỗi, luôn trả về true (giữ nguyên file)
   */
  async getReferenceState(storageKey) {
    if (!storageKey) return { referenced: false, reliable: true };
    try {
      const res = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM lessons WHERE storage_key = $1) +
          (SELECT COUNT(*) FROM lesson_materials WHERE storage_key = $1) AS total_ref
      `, [storageKey]);

      const count = parseInt(res.rows[0]?.total_ref || 0, 10);
      return { referenced: count > 0, reliable: true };
    } catch (err) {
      console.warn(`⚠️ [OrphanCleanup] Lỗi kiểm tra tham chiếu cho key=${storageKey} (Fail-Closed: Giữ nguyên file):`, err.message);
      // Fail-Closed: giữ nguyên an toàn
      return { referenced: true, reliable: false, error: err };
    }
  }

  async isKeyReferenced(storageKey) {
    const state = await this.getReferenceState(storageKey);
    return state.referenced;
  }

  /**
   * Ghi nhận xóa storage thất bại vào hàng đợi retry failed_storage_deletions
   */
  async recordFailedDeletion(storageKey, storageBucket, errorMsg, pendingUploadId = null) {
    try {
      await db.query(`
        INSERT INTO failed_storage_deletions (
          storage_provider, storage_bucket, storage_key, retry_count, last_error, status, next_retry_at, pending_upload_id
        )
        VALUES ('supabase', $1, $2, 1, $3, 'PENDING_RETRY', CURRENT_TIMESTAMP + INTERVAL '5 minutes', $4)
        ON CONFLICT (storage_provider, storage_bucket, storage_key) DO UPDATE
        SET status = 'PENDING_RETRY', last_error = EXCLUDED.last_error,
            next_retry_at = LEAST(failed_storage_deletions.next_retry_at, EXCLUDED.next_retry_at),
            pending_upload_id = COALESCE(EXCLUDED.pending_upload_id, failed_storage_deletions.pending_upload_id)
      `, [storageBucket || 'videos', storageKey, errorMsg || 'Unknown deletion error', pendingUploadId]);
    } catch (e) {
      console.error(`🚨 [OrphanCleanup] Không thể lưu failed_storage_deletions cho ${storageKey}:`, e.message);
    }
  }

  /**
   * Thực hiện dọn dẹp danh sách storage keys khỏi Supabase Storage nếu không còn ai tham chiếu
   */
  async cleanupUnreferencedAssets(assetsList = []) {
    let cleanedCount = 0;
    const errors = [];

    if (!Array.isArray(assetsList) || assetsList.length === 0) {
      return { cleanedCount, errors };
    }

    const uniqueKeys = new Map();
    for (const item of assetsList) {
      if (item && item.key && (item.provider === 'supabase' || !item.provider)) {
        // Bỏ qua external URL hoặc local legacy path
        if (item.key.startsWith('http://') || item.key.startsWith('https://') || item.key.startsWith('/uploads/')) {
          continue;
        }
        const bucket = item.bucket || (item.key.endsWith('.pdf') ? 'documents' : 'videos');
        uniqueKeys.set(item.key, bucket);
      }
    }

    for (const [key, bucket] of uniqueKeys.entries()) {
      try {
        const isReferenced = await this.isKeyReferenced(key);
        if (!isReferenced) {
          const success = await supabaseStorage.deleteStorageObject(key, bucket);
          if (success) {
            cleanedCount++;
            console.log(`🧹 [OrphanCleanup] Đã dọn dẹp thành công file mồ côi: ${bucket}/${key}`);
          } else {
            const err = `deleteStorageObject returned false for ${bucket}/${key}`;
            errors.push(err);
            await this.recordFailedDeletion(key, bucket, err);
          }
        } else {
          console.debug(`ℹ️ [OrphanCleanup] Bỏ qua file còn tham chiếu: ${bucket}/${key}`);
        }
      } catch (e) {
        errors.push(`Lỗi dọn dẹp ${bucket}/${key}: ${e.message}`);
        console.warn(`⚠️ [OrphanCleanup] Lỗi dọn dẹp ${bucket}/${key}:`, e.message);
        await this.recordFailedDeletion(key, bucket, e.message);
      }
    }

    return { cleanedCount, errors };
  }

  /**
   * Dọn dẹp an toàn các file mới upload khi DB Transaction bị Rollback
   * Phải áp dụng shared-reference check (Fail-Closed) trước khi xóa
   */
  async rollbackNewUploads(newlyUploadedAssets = []) {
    if (!Array.isArray(newlyUploadedAssets) || newlyUploadedAssets.length === 0) return;

    for (const item of newlyUploadedAssets) {
      if (item && item.key) {
        // Bỏ qua link ngoài hoặc local
        if (item.key.startsWith('http://') || item.key.startsWith('https://') || item.key.startsWith('/uploads/')) {
          continue;
        }
        try {
          const isReferenced = await this.isKeyReferenced(item.key);
          if (!isReferenced) {
            const bucket = item.bucket || (item.key.endsWith('.pdf') ? 'documents' : 'videos');
            const success = await supabaseStorage.deleteStorageObject(item.key, bucket);
            if (success) {
              console.log(`🔄 [OrphanCleanup] Đã rollback file upload mồ côi sau DB Rollback: ${bucket}/${item.key}`);
            } else {
              await this.recordFailedDeletion(item.key, bucket, 'Rollback delete returned false');
            }
          }
        } catch (e) {
          console.warn(`⚠️ [OrphanCleanup] Không thể rollback file ${item.key}:`, e.message);
          await this.recordFailedDeletion(item.key, item.bucket, e.message);
        }
      }
    }
  }

  /**
   * Tiến trình dọn dẹp định kỳ các upload tạm hết hạn (TTL Cleanup)
   * Sử dụng Transaction + SELECT ... FOR UPDATE SKIP LOCKED và chuyển sang trạng thái CLEANING
   */
  async cleanupExpiredPendingUploads(limit = 50) {
    const client = await db.pool.connect();
    let cleaned = 0;
    try {
      await client.query('BEGIN');

      const selectQuery = `
        SELECT upload_id, storage_key, storage_bucket 
        FROM pending_media_uploads 
        WHERE (expires_at < CURRENT_TIMESTAMP AND status = 'PENDING')
           OR (status = 'CLEANING'
               AND cleaning_started_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
               AND NOT EXISTS (
                 SELECT 1 FROM failed_storage_deletions d
                 WHERE d.pending_upload_id = pending_media_uploads.upload_id
                   AND d.status IN ('PENDING_RETRY', 'FAILED_PERMANENT')
               ))
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `;
      const res = await client.query(selectQuery, [limit]);

      if (res.rows.length === 0) {
        await client.query('COMMIT');
        return { cleanedCount: 0 };
      }

      const uploadIds = res.rows.map(r => r.upload_id);
      await client.query(
        `UPDATE pending_media_uploads SET status = 'CLEANING', cleaning_started_at = CURRENT_TIMESTAMP WHERE upload_id = ANY($1::uuid[])`,
        [uploadIds]
      );

      await client.query('COMMIT');

      // Xóa các file trên storage sau khi đã chuyển trạng thái CLEANING
      for (const item of res.rows) {
        try {
          const reference = await this.getReferenceState(item.storage_key);
          if (!reference.reliable) {
            await db.query(`UPDATE pending_media_uploads SET status = 'PENDING', cleaning_started_at = NULL, expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes' WHERE upload_id = $1`, [item.upload_id]);
            continue;
          }
          if (reference.referenced) {
            await db.query(`UPDATE pending_media_uploads SET status = 'COMMITTED' WHERE upload_id = $1`, [item.upload_id]);
            continue;
          }
          const deleted = await supabaseStorage.deleteStorageObject(item.storage_key, item.storage_bucket);
          if (!deleted) throw new Error('deleteStorageObject returned false');
          await db.query(
            `UPDATE pending_media_uploads SET status = 'EXPIRED' WHERE upload_id = $1`,
            [item.upload_id]
          );
          cleaned++;
        } catch (delErr) {
          console.warn(`⚠️ [TTL Cleanup] Lỗi xóa file hết hạn ${item.storage_key}:`, delErr.message);
          await this.recordFailedDeletion(item.storage_key, item.storage_bucket, delErr.message, item.upload_id);
        }
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('🚨 [TTL Cleanup] Lỗi transaction dọn dẹp pending uploads:', e.message);
    } finally {
      client.release();
    }
    return { cleanedCount: cleaned };
  }

  /**
   * Worker xử lý lại hàng đợi xóa storage thất bại (Retry Deletion Queue)
   * Giới hạn tối đa 5 lần retry với Exponential Backoff
   */
  async processFailedStorageDeletions(limit = 50) {
    const client = await db.pool.connect();
    let processed = 0;
    try {
      await client.query('BEGIN');

      const query = `
        SELECT deletion_id, storage_key, storage_bucket, retry_count, pending_upload_id
        FROM failed_storage_deletions
        WHERE status = 'PENDING_RETRY' AND next_retry_at <= CURRENT_TIMESTAMP
        ORDER BY deletion_id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `;
      const res = await client.query(query, [limit]);

      if (res.rows.length === 0) {
        await client.query('COMMIT');
        return { processedCount: 0 };
      }

      for (const item of res.rows) {
        const reference = await this.getReferenceState(item.storage_key);
        if (!reference.reliable) {
          const backoffMinutes = Math.pow(2, Math.min(item.retry_count + 1, 5)) * 5;
          await client.query(
            `UPDATE failed_storage_deletions SET retry_count = retry_count + 1, last_error = $1,
             next_retry_at = CURRENT_TIMESTAMP + ($2 || ' minutes')::interval WHERE deletion_id = $3`,
            ['Reference check failed; deletion deferred', backoffMinutes, item.deletion_id]
          );
          continue;
        }
        if (reference.referenced) {
          // Nếu đã có tham chiếu mới, đánh dấu RESOLVED không cần xóa nữa
          await client.query(
            `UPDATE failed_storage_deletions SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE deletion_id = $1`,
            [item.deletion_id]
          );
          if (item.pending_upload_id) {
            await client.query(`UPDATE pending_media_uploads SET status = 'COMMITTED', cleaning_started_at = NULL WHERE upload_id = $1`, [item.pending_upload_id]);
          }
          processed++;
          continue;
        }

        try {
          const success = await supabaseStorage.deleteStorageObject(item.storage_key, item.storage_bucket);
          if (success) {
            await client.query(
              `UPDATE failed_storage_deletions SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE deletion_id = $1`,
              [item.deletion_id]
            );
            if (item.pending_upload_id) {
              await client.query(`UPDATE pending_media_uploads SET status = 'EXPIRED', cleaning_started_at = NULL WHERE upload_id = $1`, [item.pending_upload_id]);
            }
            processed++;
          } else {
            throw new Error('deleteStorageObject returned false');
          }
        } catch (err) {
          const newRetryCount = item.retry_count + 1;
          if (newRetryCount >= 5) {
            await client.query(
              `UPDATE failed_storage_deletions 
               SET status = 'FAILED_PERMANENT', retry_count = $1, last_error = $2
               WHERE deletion_id = $3`,
              [newRetryCount, err.message, item.deletion_id]
            );
          } else {
            // Exponential backoff: 2 ^ count * 5 minutes
            const backoffMinutes = Math.pow(2, newRetryCount) * 5;
            await client.query(
              `UPDATE failed_storage_deletions 
               SET retry_count = $1, last_error = $2, next_retry_at = CURRENT_TIMESTAMP + ($3 || ' minutes')::interval
               WHERE deletion_id = $4`,
              [newRetryCount, err.message, backoffMinutes, item.deletion_id]
            );
          }
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('🚨 [Retry Queue] Lỗi transaction xử lý retry deletions:', e.message);
    } finally {
      client.release();
    }
    return { processedCount: processed };
  }
}

module.exports = new OrphanCleanupService();
