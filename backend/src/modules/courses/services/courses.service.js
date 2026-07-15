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
      return result.rows.map(row => ({
        ...row,
        status: row.status === 'published' ? 1 : 0
      }));
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

      let finalStatus = 'draft';
      if (status === 1 || status === '1' || status === 'published') {
        finalStatus = 'published';
      } else if (status === 2 || status === '2' || status === 'archived') {
        finalStatus = 'archived';
      }
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

      // Map status for frontend compatibility
      newCourse.status = newCourse.status === 'published' ? 1 : 0;

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
    const speakingSentences = lessonData.speakingSentences || lessonData.speaking_sentences || '';
    const speakingQuestions = lessonData.speakingQuestions || lessonData.speaking_questions || '';

    await client.query(`
      INSERT INTO lessons (section_id, title, content_type, content_url, order_index, speaking_sentences, speaking_questions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sectionId, lessonData.title, contentType, contentUrl, orderIndex, speakingSentences, speakingQuestions]);
  }

  async getLessonById(lessonId) {
    try {
      const queryText = `
        SELECT l.*, s.course_id 
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        WHERE l.lesson_id = $1
      `;
      const result = await db.query(queryText, [lessonId]);
      return result.rows[0];
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy chi tiết bài học');
    }
  }

  async getCourseById(courseId) {
    try {
      const queryText = `
        SELECT 
          c.*,
          s.section_id, s.title AS section_title, s.order_index AS section_order,
          l.lesson_id, l.title AS lesson_title, l.content_type, l.content_url, l.order_index AS lesson_order,
          l.speaking_sentences, l.speaking_questions
        FROM courses c
        LEFT JOIN sections s ON c.course_id = s.course_id
        LEFT JOIN lessons l ON s.section_id = l.section_id
        WHERE c.course_id = $1
        ORDER BY s.order_index ASC, l.order_index ASC
      `;

      const result = await db.query(queryText, [courseId]);
      if (result.rows.length === 0) return null;

      const {
        section_id, section_title, section_order,
        lesson_id, lesson_title, content_type, content_url, lesson_order,
        speaking_sentences, speaking_questions,
        ...courseData
      } = result.rows[0];

      const course = {
        ...courseData,
        status: courseData.status === 'published' ? 1 : 0,
        sections: []
      };

      const sectionMap = new Map();

      result.rows.forEach(row => {
        if (row.section_id && !sectionMap.has(row.section_id)) {
          const newSection = {
            section_id: row.section_id,
            course_id: row.course_id,
            title: row.section_title,
            order_index: row.section_order,
            lessons: []
          };
          sectionMap.set(row.section_id, newSection);
          course.sections.push(newSection);
        }

        if (row.lesson_id) {
          const section = sectionMap.get(row.section_id);
          section.lessons.push({
            lesson_id: row.lesson_id,
            section_id: row.section_id,
            title: row.lesson_title,
            content_type: row.content_type,
            content_url: row.content_url,
            order_index: row.lesson_order,
            speaking_sentences: row.speaking_sentences || '',
            speaking_questions: row.speaking_questions || ''
          });
        }
      });

      for (let section of course.sections) {
        if (section.lessons && section.lessons.length > 0) {
          for (let lesson of section.lessons) {
            if (lesson.content_type === 'video' && lesson.content_url) {
              try {
                const { generateSignedUrl } = require('../../../utils/supabaseStorage');
                lesson.content_url = await generateSignedUrl(lesson.content_url, 'videos', 3600);
              } catch (e) {
                console.error('Failed to generate signed url for lesson', lesson.lesson_id, e);
              }
            }
          }
        }
      }

      return course;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin chi tiết khóa học');
    }
  }

  async updateCourse(courseId, courseData) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const {
        subjectId,
        courseName,
        description,
        thumbnail_url,
        price,
        status,
        startDate,
        endDate,
        sections
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
        let dbStatus = 'draft';
        if (status === 1 || status === '1' || status === 'published') {
          dbStatus = 'published';
        } else if (status === 2 || status === '2' || status === 'archived') {
          dbStatus = 'archived';
        } else if (status === null) {
          dbStatus = null;
        }
        values.push(dbStatus);
      }
      if (startDate !== undefined) {
        updates.push(`start_date = $${paramIndex++}`);
        values.push(startDate || null);
      }
      if (endDate !== undefined) {
        updates.push(`end_date = $${paramIndex++}`);
        values.push(endDate || null);
      }

      if (updates.length > 0) {
        values.push(courseId);
        const queryText = `
          UPDATE courses 
          SET ${updates.join(', ')} 
          WHERE course_id = $${paramIndex}
        `;
        await client.query(queryText, values);
      }

      // --- SYNCHRONIZE SECTIONS AND LESSONS ---
      if (sections && Array.isArray(sections)) {
        // 1. Get existing section IDs of the course
        const existingSectionsRes = await client.query(
          'SELECT section_id FROM sections WHERE course_id = $1',
          [courseId]
        );
        const existingSectionIds = existingSectionsRes.rows.map(r => r.section_id);

        const currentSectionIds = [];
        const currentLessonIds = [];

        for (let i = 0; i < sections.length; i++) {
          const sec = sections[i];
          const sectionOrder = sec.orderIndex || (i + 1);
          let secId;

          const isExistingSection = sec.id && Number.isInteger(Number(sec.id)) && Number(sec.id) < 1000000000;

          if (isExistingSection && existingSectionIds.includes(Number(sec.id))) {
            // Update existing section
            secId = Number(sec.id);
            await client.query(
              'UPDATE sections SET title = $1, order_index = $2 WHERE section_id = $3',
              [sec.title, sectionOrder, secId]
            );
          } else {
            // Insert new section
            const insertSecRes = await client.query(
              'INSERT INTO sections (course_id, title, order_index) VALUES ($1, $2, $3) RETURNING section_id',
              [courseId, sec.title, sectionOrder]
            );
            secId = insertSecRes.rows[0].section_id;
          }
          currentSectionIds.push(secId);

          // Get existing lesson IDs for this section if updating
          let existingLessonIds = [];
          if (isExistingSection) {
            const existingLessonsRes = await client.query(
              'SELECT lesson_id FROM lessons WHERE section_id = $1',
              [secId]
            );
            existingLessonIds = existingLessonsRes.rows.map(r => r.lesson_id);
          }

          // Process lessons
          if (sec.lessons && Array.isArray(sec.lessons)) {
            for (let j = 0; j < sec.lessons.length; j++) {
              const les = sec.lessons[j];
              const lessonOrder = les.orderIndex || (j + 1);
              const contentType = les.contentType || les.type || 'video';
              const contentUrl = les.contentUrl || '';
              const speakingSentences = les.speakingSentences || les.speaking_sentences || '';
              const speakingQuestions = les.speakingQuestions || les.speaking_questions || '';
              let lesId;

              const isExistingLesson = les.id && Number.isInteger(Number(les.id)) && Number(les.id) < 1000000000;

              if (isExistingLesson && existingLessonIds.includes(Number(les.id))) {
                // Update existing lesson
                lesId = Number(les.id);
                await client.query(
                  `UPDATE lessons 
                   SET title = $1, content_type = $2, content_url = $3, order_index = $4, 
                       speaking_sentences = $5, speaking_questions = $6 
                   WHERE lesson_id = $7`,
                  [les.title, contentType, contentUrl, lessonOrder, speakingSentences, speakingQuestions, lesId]
                );
              } else {
                // Insert new lesson
                const insertLesRes = await client.query(
                  `INSERT INTO lessons (section_id, title, content_type, content_url, order_index, speaking_sentences, speaking_questions)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING lesson_id`,
                  [secId, les.title, contentType, contentUrl, lessonOrder, speakingSentences, speakingQuestions]
                );
                lesId = insertLesRes.rows[0].lesson_id;
              }
              currentLessonIds.push(lesId);
            }
          }

          // Delete lessons of this section that were removed
          if (isExistingSection) {
            await client.query(
              'DELETE FROM lessons WHERE section_id = $1 AND NOT (lesson_id = ANY($2::int[]))',
              [secId, currentLessonIds.length > 0 ? currentLessonIds : [-1]]
            );
          }
        }

        // Delete sections of this course that were removed
        await client.query(
          'DELETE FROM sections WHERE course_id = $1 AND NOT (section_id = ANY($2::int[]))',
          [courseId, currentSectionIds.length > 0 ? currentSectionIds : [-1]]
        );
      }

      await client.query('COMMIT');
      return await this.getCourseById(courseId);
    } catch (error) {
      await client.query('ROLLBACK');
      handleServiceError(error, 'Lỗi cập nhật khóa học');
    } finally {
      client.release();
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
