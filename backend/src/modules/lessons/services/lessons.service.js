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
        const { generateSignedUrl } = require('../../../utils/supabaseStorage');
        await Promise.all(
          rows
            .filter(row => row.content_type === 'video' && row.content_url)
            .map(async (row) => {
              try {
                row.content_url = await generateSignedUrl(row.content_url, 'videos', 3600);
              } catch (e) {
                console.error('Failed to generate signed url for lesson', row.lesson_id, e);
              }
            })
        );
        return rows;
      } else if (sectionId) {
        const queryText = `
          SELECT * FROM lessons 
          WHERE section_id = $1 
          ORDER BY order_index
        `;
        const result = await db.query(queryText, [parseInt(sectionId, 10)]);
        const rows = result.rows;
        const { generateSignedUrl } = require('../../../utils/supabaseStorage');
        await Promise.all(
          rows
            .filter(row => row.content_type === 'video' && row.content_url)
            .map(async (row) => {
              try {
                row.content_url = await generateSignedUrl(row.content_url, 'videos', 3600);
              } catch (e) {
                console.error('Failed to generate signed url for lesson', row.lesson_id, e);
              }
            })
        );
        return rows;
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
      const result = await db.query('DELETE FROM lessons WHERE lesson_id = $1 RETURNING lesson_id', [parseInt(lessonId, 10)]);
      return result.rows.length > 0;
    } catch (error) {
      handleServiceError(error, 'Lỗi xóa bài giảng');
    }
  }

  /**
   * Lấy chi tiết một bài học
   */
  async getLessonById(lessonId) {
    try {
      const result = await db.query('SELECT * FROM lessons WHERE lesson_id = $1', [parseInt(lessonId, 10)]);
      const lesson = result.rows[0];
      if (lesson && lesson.content_type === 'video' && lesson.content_url) {
        lesson.content_url = await require('../../../utils/supabaseStorage').generateSignedUrl(lesson.content_url, 'videos', 3600);
      }
      return lesson;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin bài giảng');
    }
  }
}

module.exports = new LessonsService();
