const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

class CoursesService {
  async getSubjects() {
    try {
      const result = await db.query('SELECT * FROM subjects ORDER BY subject_id');
      return result.rows;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy danh sách môn học');
    }
  }

  async getAllCourses() {
    try {
      const queryText = `
        SELECT c.*, s.subject_name,
          COALESCE(
            (SELECT COUNT(*) FROM sections sec WHERE sec.course_id = c.course_id), 
            0
          )::integer AS sections_count,
          COALESCE(
            (SELECT COUNT(*) FROM lessons les WHERE les.section_id IN (
              SELECT section_id FROM sections sec WHERE sec.course_id = c.course_id
            )), 
            0
          )::integer AS lessons_count
        FROM courses c
        LEFT JOIN subjects s ON c.subject_id = s.subject_id
        ORDER BY c.course_id DESC
      `;
      const result = await db.query(queryText);
      return result.rows;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy danh sách khóa học');
    }
  }

  async createCourse(courseData, instructorId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { 
        courseName, 
        subjectId, 
        description, 
        thumbnail_url, 
        price, 
        status, 
        startDate, 
        endDate, 
        sections 
      } = courseData;
      
      const finalStatus = status || 'draft';
      const finalPrice = price || 0;
      const finalSubjectId = subjectId ? parseInt(subjectId) : null;
      
      // 1. Chèn khóa học vào bảng courses (Đã đồng bộ với Supabase)
      const courseResult = await client.query(`
        INSERT INTO courses (
          subject_id, 
          course_name, 
          description, 
          instructor_id, 
          thumbnail_url, 
          price, 
          status, 
          start_date, 
          end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        finalSubjectId, 
        courseName, 
        description, 
        instructorId, 
        thumbnail_url, 
        finalPrice, 
        finalStatus, 
        startDate || null, 
        endDate || null
      ]);
      
      const newCourse = courseResult.rows[0];
      const courseId = newCourse.course_id;
      
      // 2. Chèn các chương (sections) và bài học (lessons)
      if (sections && Array.isArray(sections)) {
        for (let i = 0; i < sections.length; i++) {
          await this._insertSection(client, courseId, sections[i], i + 1);
        }
      }
      
      await client.query('COMMIT');
      return newCourse;
    } catch (error) {
      await client.query('ROLLBACK');
      handleServiceError(error, 'Lỗi tạo khóa học');
    } finally {
      client.release();
    }
  }

  /**
   * Helper để chèn section
   */
  async _insertSection(client, courseId, sectionData, defaultOrder) {
    const orderIndex = sectionData.orderIndex !== undefined ? sectionData.orderIndex : defaultOrder;
    
    const result = await client.query(`
      INSERT INTO sections (course_id, title, order_index)
      VALUES ($1, $2, $3)
      RETURNING section_id
    `, [courseId, sectionData.title, orderIndex]);
    
    const sectionId = result.rows[0].section_id;
    
    if (sectionData.lessons && Array.isArray(sectionData.lessons)) {
      for (let i = 0; i < sectionData.lessons.length; i++) {
        await this._insertLesson(client, sectionId, sectionData.lessons[i], i + 1);
      }
    }
  }

  /**
   * Helper để chèn bài học
   */
  async _insertLesson(client, sectionId, lessonData, defaultOrder) {
    const orderIndex = lessonData.orderIndex !== undefined ? lessonData.orderIndex : defaultOrder;
    const contentType = lessonData.contentType || lessonData.type || 'video';
    const contentUrl = lessonData.contentUrl || lessonData.url || '';
    
    await client.query(`
      INSERT INTO lessons (section_id, title, content_type, content_url, order_index)
      VALUES ($1, $2, $3, $4, $5)
    `, [sectionId, lessonData.title, contentType, contentUrl, orderIndex]);
  }

  async getLessonById(lessonId) {
    try {
      const result = await db.query('SELECT * FROM lessons WHERE lesson_id = $1', [lessonId]);
      return result.rows[0];
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy chi tiết bài học');
    }
  }

  async getCourseById(courseId) {
    try {
      // 1. Lấy thông tin khóa học
      const courseRes = await db.query('SELECT * FROM courses WHERE course_id = $1', [courseId]);
      if (courseRes.rows.length === 0) return null;
      const course = courseRes.rows[0];

      // 2. Lấy danh sách chương (sections)
      const sectionsRes = await db.query('SELECT * FROM sections WHERE course_id = $1 ORDER BY order_index', [courseId]);
      const sections = sectionsRes.rows;

      // 3. Lấy danh sách bài giảng (lessons) cho mỗi chương
      for (const section of sections) {
        const lessonsRes = await db.query('SELECT * FROM lessons WHERE section_id = $1 ORDER BY order_index', [section.section_id]);
        section.lessons = lessonsRes.rows;
      }

      course.sections = sections;
      return course;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin chi tiết khóa học');
    }
  }

  async updateCourse(courseId, courseData) {
    try {
      const { 
        subjectId, 
        courseName, 
        description, 
        thumbnail_url, 
        price, 
        status, 
        startDate, 
        endDate 
      } = courseData;

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (subjectId !== undefined) {
        updates.push(`subject_id = $${paramIndex++}`);
        values.push(subjectId ? parseInt(subjectId, 10) : null);
      }
      if (courseName !== undefined) {
        updates.push(`course_name = $${paramIndex++}`);
        values.push(courseName);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (thumbnail_url !== undefined) {
        updates.push(`thumbnail_url = $${paramIndex++}`);
        values.push(thumbnail_url);
      }
      if (price !== undefined) {
        updates.push(`price = $${paramIndex++}`);
        values.push(price ? parseFloat(price) : 0);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status !== null ? (isNaN(status) ? status : parseInt(status, 10)) : null);
      }
      if (startDate !== undefined) {
        updates.push(`start_date = $${paramIndex++}`);
        values.push(startDate || null);
      }
      if (endDate !== undefined) {
        updates.push(`end_date = $${paramIndex++}`);
        values.push(endDate || null);
      }

      if (updates.length === 0) return await this.getCourseById(courseId);

      values.push(courseId);
      const queryText = `
        UPDATE courses 
        SET ${updates.join(', ')} 
        WHERE course_id = $${paramIndex}
        RETURNING *
      `;
      const result = await db.query(queryText, values);
      if (result.rows.length === 0) return null;

      return await this.getCourseById(courseId);
    } catch (error) {
      handleServiceError(error, 'Lỗi cập nhật khóa học');
    }
  }

  async deleteCourse(courseId) {
    try {
      const result = await db.query('DELETE FROM courses WHERE course_id = $1 RETURNING course_id', [courseId]);
      return result.rows.length > 0;
    } catch (error) {
      handleServiceError(error, 'Lỗi xóa khóa học');
    }
  }
}

module.exports = new CoursesService();
