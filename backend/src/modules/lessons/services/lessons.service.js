const fs = require('fs');
const path = require('path');
const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

class LessonsService {
  /**
   * Lấy danh sách bài giảng theo query filter
   */
  async getLessonsByQuery({ courseId, sectionId }) {
    try {
      if (courseId) {
        const queryText = `
          SELECT l.*, s.title as section_title, s.course_id
          FROM lessons l
          JOIN sections s ON l.section_id = s.section_id
          WHERE s.course_id = $1
          ORDER BY s.order_index, l.order_index
        `;
        const result = await db.query(queryText, [parseInt(courseId, 10)]);
        return result.rows || [];
      } else if (sectionId) {
        const queryText = `
          SELECT * FROM lessons 
          WHERE section_id = $1 
          ORDER BY order_index
        `;
        const result = await db.query(queryText, [parseInt(sectionId, 10)]);
        return result.rows || [];
      }
      return [];
    } catch (error) {
      handleServiceError(error, 'Lỗi truy vấn danh sách bài học');
    }
  }

  /**
   * Tạo bài học mới
   */
  async createLesson(lessonData) {
    try {
      const { 
        sectionId, section_id, 
        title, 
        contentType, content_type, 
        contentUrl, content_url, 
        orderIndex, order_index,
        speakingSentences, speaking_sentences,
        speakingQuestions, speaking_questions
      } = lessonData;
      
      const finalSectionId = parseInt(sectionId || section_id, 10);
      const finalTitle = title;
      const finalContentType = contentType || content_type || 'video';
      const finalContentUrl = contentUrl || content_url || '';
      const finalOrderIndex = parseInt(orderIndex || order_index, 10) || 1;
      const finalSpeakingSentences = speakingSentences || speaking_sentences || '';
      const finalSpeakingQuestions = speakingQuestions || speaking_questions || '';

      if (!finalSectionId || !finalTitle) {
        const error = new Error('Thiếu thông tin section_id hoặc tiêu đề bài học');
        error.status = 400;
        throw error;
      }

      // Kiểm tra xem section/chương học có tồn tại không
      const sectionRes = await db.query('SELECT section_id, course_id FROM sections WHERE section_id = $1', [finalSectionId]);
      if (sectionRes.rows.length === 0) {
        const error = new Error('Chương học (section_id) không tồn tại');
        error.status = 400;
        throw error;
      }

      const queryText = `
        INSERT INTO lessons (section_id, title, content_type, content_url, order_index, speaking_sentences, speaking_questions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const result = await db.query(queryText, [
        finalSectionId, 
        finalTitle, 
        finalContentType, 
        finalContentUrl, 
        finalOrderIndex, 
        finalSpeakingSentences, 
        finalSpeakingQuestions
      ]);
      return result.rows[0];
    } catch (error) {
      handleServiceError(error, 'Lỗi tạo bài giảng mới');
    }
  }

  /**
   * Cập nhật bài học
   */
  async updateLesson(lessonId, lessonData) {
    try {
      const { 
        title, 
        contentType, content_type, 
        contentUrl, content_url, 
        orderIndex, order_index, 
        sectionId, section_id,
        speakingSentences, speaking_sentences,
        speakingQuestions, speaking_questions
      } = lessonData;
      
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
      }
      if (contentType !== undefined || content_type !== undefined) {
        updates.push(`content_type = $${paramIndex++}`);
        values.push(contentType || content_type);
      }
      if (contentUrl !== undefined || content_url !== undefined) {
        updates.push(`content_url = $${paramIndex++}`);
        values.push(contentUrl !== undefined ? contentUrl : content_url);
      }
      if (orderIndex !== undefined || order_index !== undefined) {
        updates.push(`order_index = $${paramIndex++}`);
        values.push(parseInt(orderIndex || order_index, 10));
      }
      if (speakingSentences !== undefined || speaking_sentences !== undefined) {
        updates.push(`speaking_sentences = $${paramIndex++}`);
        values.push(speakingSentences !== undefined ? speakingSentences : speaking_sentences);
      }
      if (speakingQuestions !== undefined || speaking_questions !== undefined) {
        updates.push(`speaking_questions = $${paramIndex++}`);
        values.push(speakingQuestions !== undefined ? speakingQuestions : speaking_questions);
      }
      if (sectionId !== undefined || section_id !== undefined) {
        const finalSectionId = parseInt(sectionId || section_id, 10);
        // Kiểm tra section tồn tại trước khi cập nhật
        const sectionRes = await db.query('SELECT section_id FROM sections WHERE section_id = $1', [finalSectionId]);
        if (sectionRes.rows.length === 0) {
          const error = new Error('Chương học (section_id) mới không tồn tại');
          error.status = 400;
          throw error;
        }
        updates.push(`section_id = $${paramIndex++}`);
        values.push(finalSectionId);
      }

      if (updates.length === 0) {
        const result = await db.query('SELECT * FROM lessons WHERE lesson_id = $1', [lessonId]);
        return result.rows[0];
      }

      values.push(parseInt(lessonId, 10));
      const queryText = `
        UPDATE lessons
        SET ${updates.join(', ')}
        WHERE lesson_id = $${paramIndex}
        RETURNING *
      `;
      const result = await db.query(queryText, values);
      return result.rows[0];
    } catch (error) {
      handleServiceError(error, 'Lỗi cập nhật bài giảng');
    }
  }

  /**
   * Xóa bài học
   */
  async deleteLesson(lessonId) {
    try {
      const cleanLessonId = parseInt(lessonId, 10);
      const orphanCleanupService = require('../../../utils/orphanCleanup.service');
      const assetsToCleanup = await orphanCleanupService.collectAssetsFromLesson(cleanLessonId);

      const result = await db.query('DELETE FROM lessons WHERE lesson_id = $1 RETURNING lesson_id', [cleanLessonId]);
      const deleted = result.rows.length > 0;

      if (deleted && assetsToCleanup.length > 0) {
        orphanCleanupService.cleanupUnreferencedAssets(assetsToCleanup).catch((err) => {
          console.warn('⚠️ [LessonsService.deleteLesson] Cảnh báo dọn dẹp orphan asset:', err.message);
        });
      }

      return deleted;
    } catch (error) {
      handleServiceError(error, 'Lỗi xóa bài giảng');
    }
  }

  /**
   * Kiểm tra quyền sở hữu bài học/khóa học của Giảng viên (Owner-check)
   */
  async checkLessonOwnership(lessonId, userId, userRole) {
    if (userRole === 1) return true; // Admin có toàn quyền
    const query = `
      SELECT c.instructor_id
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE l.lesson_id = $1
    `;
    const res = await db.query(query, [parseInt(lessonId, 10)]);
    if (res.rows.length === 0) return false;
    return Number(res.rows[0].instructor_id) === Number(userId);
  }

  /**
   * Upload tài liệu đính kèm (PDF), trích xuất text và nạp vào Pinecone RAG
   */
  async uploadLessonMaterial(lessonId, file, userId, userRole) {
    let tempFilePath = null;
    let uploadedStorageKey = null;

    try {
      const cleanLessonId = parseInt(lessonId, 10);
      const isOwner = await this.checkLessonOwnership(cleanLessonId, userId, userRole);
      if (!isOwner) {
        const error = new Error('Bạn không có quyền quản lý tài liệu của khóa học này.');
        error.status = 403;
        throw error;
      }

      if (!file) {
        const error = new Error('Không có tệp tin nào được tải lên.');
        error.status = 400;
        throw error;
      }

      tempFilePath = file.path;

      // 1. Validate PDF file
      const { validatePdfFile } = require('../../../utils/pdfValidator.util');
      const validation = await validatePdfFile(file.path);
      if (!validation.isValid) {
        const error = new Error(validation.message || 'Tệp tải lên không phải là định dạng PDF hợp lệ.');
        error.status = 400;
        error.code = validation.code || 'INVALID_PDF';
        throw error;
      }

      // 2. Upload lên Supabase Storage bucket 'documents'
      const { uploadDocumentToSupabase, deleteStorageObject } = require('../../../utils/supabaseStorage');
      const crypto = require('crypto');
      const ext = path.extname(file.originalname).toLowerCase();
      const rawBaseName = path.basename(file.originalname, ext);
      const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const assetId = crypto.randomUUID();
      const objectKey = `courses/materials/${cleanLessonId}/${assetId}/${safeBaseName}.pdf`;

      const uploadResult = await uploadDocumentToSupabase(file.path, objectKey, 'application/pdf');
      if (!uploadResult.success) {
        const error = new Error(`Tải tài liệu PDF lên Supabase Storage thất bại: ${uploadResult.error || 'Lỗi không xác định'}`);
        error.status = 500;
        error.code = uploadResult.code || 'STORAGE_UPLOAD_ERROR';
        throw error;
      }

      uploadedStorageKey = uploadResult.storageKey;
      const sizeKb = Math.round(uploadResult.sizeBytes / 1024) || 1;

      // 3. Lưu thông tin tài liệu vào CSDL trong transaction
      let material;
      try {
        const insertQuery = `
          INSERT INTO lesson_materials (
            lesson_id, file_name, file_url, file_type, file_size_kb, uploaded_by,
            storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING material_id, lesson_id, file_name, file_url, file_type, file_size_kb,
                    storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status, created_at
        `;
        const result = await db.query(insertQuery, [
          cleanLessonId,
          file.originalname,
          uploadResult.storageKey, // Lưu storage key vào file_url để tương thích
          'application/pdf',
          sizeKb,
          userId,
          'supabase',
          'documents',
          uploadResult.storageKey,
          'application/pdf',
          uploadResult.sizeBytes,
          uploadResult.checksumSha256,
          'READY'
        ]);

        material = result.rows[0];
      } catch (dbErr) {
        // Rollback orphan object trên Supabase Storage nếu DB insert thất bại
        if (uploadedStorageKey) {
          deleteStorageObject(uploadedStorageKey, 'documents').catch(delErr => {
            console.warn('⚠️ Lỗi xóa orphan document object sau DB failure:', delErr.message);
          });
        }
        throw dbErr;
      }

      // 4. Trích xuất text từ tệp PDF và nạp vào Pinecone RAG
      const { extractTextFromPdf } = require('../../../utils/pdfExtractor.util');
      const extractedText = await extractTextFromPdf(file.path);

      if (extractedText && extractedText.trim()) {
        const { ingestPdfDocument } = require('./ragIngestion.service');
        // Nạp vector chạy ngầm bất đồng bộ không chặn luồng phản hồi; nếu Pinecone lỗi vẫn giữ nguyên PDF
        ingestPdfDocument(cleanLessonId, material.material_id, file.originalname, extractedText).catch(ragErr => {
          console.error(`[RAG Ingestion] Lỗi nạp vector tài liệu ${material.material_id}:`, ragErr.message);
        });
      }

      return material;
    } catch (error) {
      handleServiceError(error, 'Lỗi tải lên tài liệu bài học');
    } finally {
      // Dọn dẹp file tạm Multer
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.warn('⚠️ Lỗi dọn dẹp file tạm Multer:', cleanupErr.message);
        }
      }
    }
  }

  /**
   * Lấy danh sách tài liệu đính kèm của một bài học
   */
  async getLessonMaterials(lessonId) {
    try {
      const cleanLessonId = parseInt(lessonId, 10);
      const query = `
        SELECT material_id, lesson_id, file_name, file_url, file_type, file_size_kb,
               storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status, created_at
        FROM lesson_materials
        WHERE lesson_id = $1
        ORDER BY material_id ASC
      `;
      const result = await db.query(query, [cleanLessonId]);
      return result.rows || [];
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy danh sách tài liệu đính kèm');
    }
  }

  /**
   * Xóa tài liệu đính kèm (Kèm Owner-Check và dọn dẹp vector Pinecone)
   */
  async deleteLessonMaterial(lessonId, materialId, userId, userRole) {
    try {
      const cleanLessonId = parseInt(lessonId, 10);
      const cleanMaterialId = parseInt(materialId, 10);

      const isOwner = await this.checkLessonOwnership(cleanLessonId, userId, userRole);
      if (!isOwner) {
        const error = new Error('Bạn không có quyền xóa tài liệu của khóa học này.');
        error.status = 403;
        throw error;
      }

      // 1. Lấy thông tin file trước khi xóa
      const checkQuery = `
        SELECT material_id, file_url, storage_key, storage_bucket 
        FROM lesson_materials 
        WHERE material_id = $1 AND lesson_id = $2
      `;
      const checkRes = await db.query(checkQuery, [cleanMaterialId, cleanLessonId]);
      if (checkRes.rows.length === 0) {
        const error = new Error('Không tìm thấy tài liệu đính kèm để xóa.');
        error.status = 404;
        throw error;
      }

      const mat = checkRes.rows[0];
      const fileUrl = mat.file_url;
      const storageKey = mat.storage_key || (fileUrl && !fileUrl.startsWith('/uploads/') ? fileUrl : null);
      const storageBucket = mat.storage_bucket || 'documents';

      // 2. Xóa trong CSDL
      await db.query(`DELETE FROM lesson_materials WHERE material_id = $1`, [cleanMaterialId]);

      // 3. Xóa trên Supabase Storage nếu là storage object và không còn tham chiếu nào khác
      if (storageKey) {
        try {
          const orphanCleanupService = require('../../../utils/orphanCleanup.service');
          await orphanCleanupService.cleanupUnreferencedAssets([{ key: storageKey, bucket: storageBucket }]);
        } catch (e) {
          console.warn(`[Storage Delete] Cảnh báo lỗi xóa object ${storageKey} trên Supabase:`, e.message);
        }
      }

      // 4. Xóa file vật lý trên đĩa nếu là file local legacy
      if (fileUrl && fileUrl.startsWith('/uploads/')) {
        const path = require('path');
        const fs = require('fs');
        const absoluteFilePath = path.resolve(__dirname, '../../../../', fileUrl.replace(/^\//, ''));
        if (fs.existsSync(absoluteFilePath)) {
          try {
            fs.unlinkSync(absoluteFilePath);
          } catch (e) {
            console.warn(`[File Delete] Cảnh báo lỗi xóa file vật lý ${absoluteFilePath}:`, e.message);
          }
        }
      }

      // 5. Xóa vector trong Pinecone
      const { deleteMaterialVectors } = require('./ragIngestion.service');
      deleteMaterialVectors(cleanMaterialId).catch(err => {
        console.warn(`[RAG Vector Delete] Cảnh báo xóa vector materialId=${cleanMaterialId}:`, err.message);
      });

      return true;
    } catch (error) {
      handleServiceError(error, 'Lỗi xóa tài liệu đính kèm');
    }
  }

  /**
   * Lấy chi tiết một bài học (Kèm danh sách tài liệu đính kèm resources)
   */
  async getLessonById(lessonId) {
    try {
      const cleanLessonId = parseInt(lessonId, 10);
      const result = await db.query('SELECT * FROM lessons WHERE lesson_id = $1', [cleanLessonId]);
      const lesson = result.rows[0];
      if (!lesson) return null;

      if (lesson.content_type === 'video' && lesson.content_url) {
        lesson.content_url = await require('../../../utils/supabaseStorage').generateSignedUrl(lesson.content_url, 'videos', 3600);
      }

      // Lấy danh sách tài liệu đính kèm từ bảng lesson_materials
      const materialsRes = await db.query(
        'SELECT material_id, file_name, file_url, file_type, file_size_kb, created_at FROM lesson_materials WHERE lesson_id = $1 ORDER BY material_id ASC',
        [cleanLessonId]
      );

      lesson.materials = materialsRes.rows || [];
      return lesson;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin bài giảng');
    }
  }
}

module.exports = new LessonsService();
