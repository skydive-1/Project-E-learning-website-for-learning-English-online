const db = require('../../../config/database');

class CoursesService {
  async getSubjects() {
    const result = await db.query('SELECT * FROM subjects ORDER BY subject_id');
    return result.rows;
  }

  async getAllCourses() {
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
      JOIN subjects s ON c.subject_id = s.subject_id
      ORDER BY c.course_id DESC
    `;
    const result = await db.query(queryText);
    return result.rows;
  }

  async createCourse(courseData, instructorId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const startDate = courseData.startDate || new Date();
      // Default to 1 year from now
      const defaultEndDate = new Date();
      defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
      const endDate = courseData.endDate || defaultEndDate;
      const status = courseData.status !== undefined ? parseInt(courseData.status) : 1;
      const subjectId = parseInt(courseData.subjectId);
      
      // 1. Chèn khóa học vào bảng courses
      const courseResult = await client.query(`
        INSERT INTO courses (subject_id, course_name, start_date, end_date, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING course_id, course_name, start_date, end_date, status
      `, [subjectId, courseData.courseName, startDate, endDate, status]);
      
      const newCourse = courseResult.rows[0];
      const courseId = newCourse.course_id;
      
      // 2. Chèn các chương (sections) và bài học (lessons)
      if (courseData.sections && Array.isArray(courseData.sections)) {
        for (let sIdx = 0; sIdx < courseData.sections.length; sIdx++) {
          const section = courseData.sections[sIdx];
          const sectionOrder = section.orderIndex !== undefined ? section.orderIndex : sIdx + 1;
          
          const sectionResult = await client.query(`
            INSERT INTO sections (course_id, title, order_index)
            VALUES ($1, $2, $3)
            RETURNING section_id
          `, [courseId, section.title, sectionOrder]);
          
          const sectionId = sectionResult.rows[0].section_id;
          
          if (section.lessons && Array.isArray(section.lessons)) {
            for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
              const lesson = section.lessons[lIdx];
              const lessonOrder = lesson.orderIndex !== undefined ? lesson.orderIndex : lIdx + 1;
              const contentType = lesson.contentType || lesson.type || 'video';
              const contentUrl = lesson.contentUrl || lesson.url || '';
              
              await client.query(`
                INSERT INTO lessons (section_id, title, content_type, content_url, order_index)
                VALUES ($1, $2, $3, $4, $5)
              `, [sectionId, lesson.title, contentType, contentUrl, lessonOrder]);
            }
          }
        }
      }
      
      await client.query('COMMIT');
      return newCourse;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new CoursesService();
