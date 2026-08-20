const db = require('../config/database');
const supabaseStorage = require('./supabaseStorage');

/**
 * Service dọn dẹp các tài nguyên mồ côi (Orphan Assets Cleanup)
 * Đảm bảo:
 * 1. Không lưu tài nguyên chết.
 * 2. Idempotent và chỉ xóa khỏi Object Storage sau khi DB commit thành công hoặc rollback an toàn.
 * 3. Kiểm tra đa tham chiếu (shared reference guard) để không xóa nhầm asset được bài học khác sử dụng.
 * 
 * Phụ trách: NGUYỄN THANH LIÊM (Backend & Security Developer) & LÊ ĐÌNH CHƯƠNG (Database Administrator)
 */
class OrphanCleanupService {
  /**
   * Thu thập danh sách storage keys của tất cả bài học và tài liệu thuộc một khóa học
   * @param {number|string} courseId 
   * @param {object} [client] - Postgres transaction client (tùy chọn)
   * @returns {Promise<Array<{key: string, bucket: string, provider: string}>>}
   */
  async collectAssetsFromCourse(courseId, client = null) {
    const runner = client || db;
    try {
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
    } catch (err) {
      console.warn(`⚠️ [OrphanCleanup] Lỗi thu thập assets của courseId=${courseId}:`, err.message);
      return [];
    }
  }

  /**
   * Thu thập danh sách storage keys của tất cả bài học thuộc một section
   * @param {number|string} sectionId 
   * @param {object} [client] 
   * @returns {Promise<Array<{key: string, bucket: string, provider: string}>>}
   */
  async collectAssetsFromSection(sectionId, client = null) {
    const runner = client || db;
    try {
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
    } catch (err) {
      console.warn(`⚠️ [OrphanCleanup] Lỗi thu thập assets của sectionId=${sectionId}:`, err.message);
      return [];
    }
  }

  /**
   * Thu thập danh sách storage keys của một bài học và các tài liệu đính kèm
   * @param {number|string} lessonId 
   * @param {object} [client] 
   * @returns {Promise<Array<{key: string, bucket: string, provider: string}>>}
   */
  async collectAssetsFromLesson(lessonId, client = null) {
    const runner = client || db;
    try {
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
    } catch (err) {
      console.warn(`⚠️ [OrphanCleanup] Lỗi thu thập assets của lessonId=${lessonId}:`, err.message);
      return [];
    }
  }

  /**
   * Kiểm tra xem một storage_key có đang được bài học hoặc tài liệu nào khác tham chiếu không
   * @param {string} storageKey 
   * @returns {Promise<boolean>} True nếu vẫn còn được tham chiếu, False nếu là mồ côi
   */
  async isKeyReferenced(storageKey) {
    if (!storageKey) return false;
    try {
      const res = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM lessons WHERE storage_key = $1) +
          (SELECT COUNT(*) FROM lesson_materials WHERE storage_key = $1) AS total_ref
      `, [storageKey]);

      const count = parseInt(res.rows[0]?.total_ref || 0, 10);
      return count > 0;
    } catch (err) {
      console.warn(`⚠️ [OrphanCleanup] Lỗi kiểm tra tham chiếu cho key=${storageKey}:`, err.message);
      // Giữ nguyên an toàn (không xóa nếu gặp lỗi kiểm tra)
      return true;
    }
  }

  /**
   * Thực hiện dọn dẹp danh sách storage keys khỏi Supabase Storage nếu không còn ai tham chiếu
   * @param {Array<{key: string, bucket?: string, provider?: string}>} assetsList 
   * @returns {Promise<{cleanedCount: number, errors: Array<string>}>}
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
          }
        } else {
          console.debug(`ℹ️ [OrphanCleanup] Bỏ qua file còn tham chiếu: ${bucket}/${key}`);
        }
      } catch (e) {
        errors.push(`Lỗi dọn dẹp ${bucket}/${key}: ${e.message}`);
        console.warn(`⚠️ [OrphanCleanup] Lỗi dọn dẹp ${bucket}/${key}:`, e.message);
      }
    }

    return { cleanedCount, errors };
  }

  /**
   * Dọn dẹp khẩn cấp các file mới upload khi DB Transaction bị Rollback
   * @param {Array<{key: string, bucket?: string}>} newlyUploadedAssets 
   */
  async rollbackNewUploads(newlyUploadedAssets = []) {
    if (!Array.isArray(newlyUploadedAssets) || newlyUploadedAssets.length === 0) return;

    for (const item of newlyUploadedAssets) {
      if (item && item.key) {
        try {
          const bucket = item.bucket || (item.key.endsWith('.pdf') ? 'documents' : 'videos');
          await supabaseStorage.deleteStorageObject(item.key, bucket);
          console.log(`🔄 [OrphanCleanup] Đã rollback file upload mồ côi sau DB Rollback: ${bucket}/${item.key}`);
        } catch (e) {
          console.warn(`⚠️ [OrphanCleanup] Không thể rollback file ${item.key}:`, e.message);
        }
      }
    }
  }
}

module.exports = new OrphanCleanupService();
