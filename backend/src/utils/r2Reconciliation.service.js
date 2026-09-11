'use strict';

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getConfig } = require('./r2Storage');
const { pool } = require('../config/database');

/**
 * Service Quét Tự Động & Đối Chiếu Dọn Dẹp File Rác Cloudflare R2
 * Author: LÊ ĐÌNH CHƯƠNG (Database & Infrastructure) & NGUYỄN THANH LIÊM (Backend)
 */
class R2ReconciliationService {
  /**
   * Quét và đối chiếu toàn bộ tệp trên R2 với cơ sở dữ liệu
   * @param {Object} options 
   * @param {boolean} options.dryRun - Nếu true, chỉ quét báo cáo chứ không xóa
   * @param {boolean} options.autoDelete - Nếu true, tự động xóa các file rác phát hiện được
   */
  async reconcile({ dryRun = false, autoDelete = true } = {}) {
    const config = getConfig();
    if (!config.bucket || !config.endpoint) {
      throw new Error('Cloudflare R2 chưa được cấu hình đầy đủ (R2_BUCKET, R2_ENDPOINT).');
    }

    const client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
    });

    // 1. Quét toàn bộ objects trên R2
    let allObjects = [];
    let token = undefined;
    do {
      const res = await client.send(new ListObjectsV2Command({
        Bucket: config.bucket,
        ContinuationToken: token
      }));
      if (res.Contents) allObjects.push(...res.Contents);
      token = res.NextContinuationToken;
    } while (token);

    if (allObjects.length === 0) {
      return { totalScanned: 0, activeCount: 0, orphanCount: 0, freedBytes: 0, deletedCount: 0, remainingCount: 0 };
    }

    // 2. Thu thập danh sách tệp và khóa học đang hoạt động từ PostgreSQL
    const [coursesRes, lessonsRes, materialsRes] = await Promise.all([
      pool.query('SELECT course_id FROM courses'),
      pool.query('SELECT lesson_id, section_id, storage_key FROM lessons WHERE storage_key IS NOT NULL'),
      pool.query('SELECT material_id, lesson_id, storage_key FROM lesson_materials WHERE storage_key IS NOT NULL')
    ]);

    const activeCourseIds = new Set(coursesRes.rows.map(r => Number(r.course_id)));
    const activeKeys = new Set();
    const activeFolders = new Set();

    for (const r of lessonsRes.rows) {
      if (r.storage_key) {
        activeKeys.add(r.storage_key);
        const folder = r.storage_key.substring(0, r.storage_key.lastIndexOf('/'));
        if (folder) activeFolders.add(folder);
      }
    }
    for (const r of materialsRes.rows) {
      if (r.storage_key) activeKeys.add(r.storage_key);
    }

    // 3. Phân loại tệp hợp lệ vs tệp mồ côi
    const activeObjects = [];
    const orphanObjects = [];

    for (const obj of allObjects) {
      const key = obj.Key;
      let isActive = false;

      // 3.1. Khớp chính xác key trong DB
      if (activeKeys.has(key)) {
        isActive = true;
      } else {
        // 3.2. Khớp thư mục cha (cho tệp audio.mp4, video.mp4, source.mp4 đi kèm manifest.mpd)
        const folder = key.substring(0, key.lastIndexOf('/'));
        if (folder && activeFolders.has(folder)) {
          isActive = true;
        } else {
          // 3.3. Khớp ID khóa học theo tiền tố courses/...-<courseId>/
          const courseMatch = key.match(/^courses\/.*?(\d+)\//);
          if (courseMatch && activeCourseIds.has(Number(courseMatch[1]))) {
            isActive = true;
          }
        }
      }

      if (isActive) {
        activeObjects.push(obj);
      } else {
        orphanObjects.push(obj);
      }
    }

    let deletedCount = 0;
    let freedBytes = 0;

    // 4. Tự động xóa các tệp rác nếu autoDelete = true và dryRun = false
    if (!dryRun && autoDelete && orphanObjects.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < orphanObjects.length; i += batchSize) {
        const batch = orphanObjects.slice(i, i + batchSize);
        await client.send(new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: {
            Objects: batch.map(o => ({ Key: o.Key })),
            Quiet: true
          }
        }));
        deletedCount += batch.length;
        freedBytes += batch.reduce((sum, o) => sum + (o.Size || 0), 0);
      }

      // Cập nhật trạng thái media_assets trong DB
      const deletedKeys = orphanObjects.map(o => o.Key);
      await pool.query(`
        UPDATE media_assets
        SET status = 'DELETED', deleted_at = NOW(), updated_at = NOW()
        WHERE object_key = ANY($1) AND status != 'DELETED'
      `, [deletedKeys]).catch((err) => {
        console.warn('[R2Reconciliation] Cập nhật media_assets thất bại (non-fatal):', err.message);
      });
    }

    return {
      totalScanned: allObjects.length,
      activeCount: activeObjects.length,
      orphanCount: orphanObjects.length,
      deletedCount: dryRun ? 0 : deletedCount,
      freedBytes: dryRun ? orphanObjects.reduce((s, o) => s + (o.Size || 0), 0) : freedBytes,
      freedMb: Number(((dryRun ? orphanObjects.reduce((s, o) => s + (o.Size || 0), 0) : freedBytes) / (1024 * 1024)).toFixed(2)),
      remainingCount: activeObjects.length
    };
  }
}

module.exports = new R2ReconciliationService();
