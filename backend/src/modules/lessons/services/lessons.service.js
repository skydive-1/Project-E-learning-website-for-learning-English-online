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
          ORDER BY s.order_index ASC, l.order_index ASC
        `;
        const result = await db.query(queryText, [parseInt(courseId, 10)]);
        return result.rows;
      } else if (sectionId) {
        const queryText = `
          SELECT * FROM lessons 
          WHERE section_id = $1
          ORDER BY order_index ASC
        `;
        const result = await db.query(queryText, [parseInt(sectionId, 10)]);
        return result.rows;
      }
      return [];
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy danh sách bài giảng');
    }
  }

  /**
   * Tạo bài học mới trong một chương học (section)
   */
  async createLesson(sectionId, lessonData) {
    try {
      const { 
        title, 
        contentType, content_type, 
        contentUrl, content_url, 
        orderIndex, order_index,
        speakingSentences, speaking_sentences,
        speakingQuestions, speaking_questions
      } = lessonData;
      
      const type = contentType || content_type || 'video';
      const url = contentUrl || content_url || '';
      const order = orderIndex || order_index || 1;
      const sentences = speakingSentences || speaking_sentences || '';
      const questions = speakingQuestions || speaking_questions || '';

      const queryText = `
        INSERT INTO lessons (section_id, title, content_type, content_url, order_index, speaking_sentences, speaking_questions, pdf_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
        RETURNING *
      `;
      const values = [parseInt(sectionId, 10), title, type, url, parseInt(order, 10), sentences, questions];
      const result = await db.query(queryText, values);
      return result.rows[0];
    } catch (error) {
      handleServiceError(error, 'Lỗi tạo bài giảng');
    }
  }

  /**
   * Cập nhật bài học
   */
  async updateLesson(lessonId, lessonData) {
    try {
      const parsedLessonId = parseInt(lessonId, 10);
      const existingRes = await db.query(
        'SELECT lesson_id, content_type, content_url, COALESCE(pdf_version, 1) AS pdf_version FROM lessons WHERE lesson_id = $1',
        [parsedLessonId]
      );
      if (existingRes.rows.length === 0) {
        const error = new Error('Bài học không tồn tại');
        error.status = 404;
        throw error;
      }
      const existing = existingRes.rows[0];

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

      const rawNewContentType = contentType !== undefined ? contentType : content_type;
      const rawNewContentUrl = contentUrl !== undefined ? contentUrl : content_url;

      // Xác định xem có thay đổi tài liệu PDF để tăng pdf_version không
      let shouldIncrementPdfVersion = false;
      const oldType = existing.content_type;
      const oldUrl = existing.content_url;
      const effectiveType = rawNewContentType !== undefined ? rawNewContentType : oldType;

      if (rawNewContentType !== undefined || rawNewContentUrl !== undefined) {
        const urlChanged = rawNewContentUrl !== undefined && String(oldUrl || '').trim() !== String(rawNewContentUrl || '').trim();
        const typeChanged = rawNewContentType !== undefined && String(oldType || '').trim() !== String(rawNewContentType || '').trim();

        if (urlChanged && (oldType === 'pdf' || effectiveType === 'pdf')) {
          shouldIncrementPdfVersion = true;
        } else if (typeChanged && (oldType === 'pdf' || effectiveType === 'pdf')) {
          shouldIncrementPdfVersion = true;
        }
      }

      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
      }
      if (rawNewContentType !== undefined) {
        updates.push(`content_type = $${paramIndex++}`);
        values.push(rawNewContentType);
      }
      if (rawNewContentUrl !== undefined) {
        updates.push(`content_url = $${paramIndex++}`);
        values.push(rawNewContentUrl);
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

      if (shouldIncrementPdfVersion) {
        updates.push(`pdf_version = COALESCE(pdf_version, 1) + 1`);
      }

      if (updates.length === 0) {
        const result = await db.query('SELECT * FROM lessons WHERE lesson_id = $1', [parsedLessonId]);
        return result.rows[0];
      }

      values.push(parsedLessonId);
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
      const result = await db.query('DELETE FROM lessons WHERE lesson_id = $1 RETURNING lesson_id', [parseInt(lessonId, 10)]);
      return result.rows.length > 0;
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

      const relativeUrl = `/uploads/courses/documents/${file.filename}`;
      const sizeKb = Math.round(file.size / 1024) || 1;

      // 1. Lưu thông tin tài liệu vào CSDL
      const insertQuery = `
        INSERT INTO lesson_materials (lesson_id, file_name, file_url, file_type, file_size_kb, uploaded_by, pdf_version)
        VALUES ($1, $2, $3, $4, $5, $6, 1)
        RETURNING material_id, lesson_id, file_name, file_url, file_type, file_size_kb, pdf_version, created_at
      `;
      const result = await db.query(insertQuery, [
        cleanLessonId,
        file.originalname,
        relativeUrl,
        file.mimetype || 'application/pdf',
        sizeKb,
        userId
      ]);

      const material = result.rows[0];

      // 2. Trích xuất text từ tệp PDF và nạp vào Pinecone RAG
      const { extractTextFromPdf } = require('../../../utils/pdfExtractor.util');
      const extractedText = await extractTextFromPdf(file.path);

      if (extractedText && extractedText.trim()) {
        const { ingestPdfDocument } = require('./ragIngestion.service');
        // Nạp vector chạy ngầm bất đồng bộ không chặn luồng phản hồi
        ingestPdfDocument(cleanLessonId, material.material_id, file.originalname, extractedText).catch(ragErr => {
          console.error(`[RAG Ingestion] Lỗi nạp vector tài liệu ${material.material_id}:`, ragErr.message);
        });
      }

      return material;
    } catch (error) {
      handleServiceError(error, 'Lỗi tải lên tài liệu bài học');
    }
  }

  /**
   * Lấy danh sách tài liệu đính kèm của một bài học
   */
  async getLessonMaterials(lessonId) {
    try {
      const cleanLessonId = parseInt(lessonId, 10);
      const query = `
        SELECT material_id, lesson_id, file_name, file_url, file_type, file_size_kb, pdf_version, created_at
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
      const checkQuery = `SELECT file_url FROM lesson_materials WHERE material_id = $1 AND lesson_id = $2`;
      const checkRes = await db.query(checkQuery, [cleanMaterialId, cleanLessonId]);
      if (checkRes.rows.length === 0) {
        const error = new Error('Không tìm thấy tài liệu đính kèm để xóa.');
        error.status = 404;
        throw error;
      }

      const fileUrl = checkRes.rows[0].file_url;

      // 2. Xóa trong CSDL
      await db.query(`DELETE FROM lesson_materials WHERE material_id = $1`, [cleanMaterialId]);

      // 3. Xóa file vật lý trên đĩa
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

      // 4. Xóa vector trong Pinecone
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
        'SELECT material_id, file_name, file_url, file_type, file_size_kb, pdf_version, created_at FROM lesson_materials WHERE lesson_id = $1 ORDER BY material_id ASC',
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
