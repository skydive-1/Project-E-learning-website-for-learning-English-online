const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');
const orphanCleanupService = require('../../../utils/orphanCleanup.service');

class CoursesService {
  async getSubjects() {
    try {
      const result = await db.query('SELECT * FROM subjects ORDER BY subject_id');
      return result.rows;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy danh sách môn học');
    }
  }

  async getAllCourses(filterPublished = true) {
    try {
      // filterPublished=true  → chỉ trả về khóa học đã publish (cho học viên / public)
      // filterPublished=false → trả về tất cả (cho giảng viên / admin)
      const whereClause = filterPublished ? `WHERE c.status = 'published'` : '';
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
        ${whereClause}
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

  /**
   * Phân loại và chuẩn hóa metadata lưu trữ bền vững cho từng bài học
   */
  _resolveMediaMetadata(lessonData) {
    const contentType = lessonData.contentType || lessonData.type || 'video';
    const contentUrl = lessonData.contentUrl || lessonData.url || '';
    const isNonMedia = contentType === 'quiz' || contentType === 'speaking' || contentType === 'text';

    if (isNonMedia) {
      return {
        contentType,
        contentUrl,
        storageProvider: null,
        storageBucket: null,
        storageKey: null,
        mimeType: null,
        sizeBytes: 0,
        checksumSha256: null,
        mediaStatus: 'READY'
      };
    }

    const isPdf = contentType === 'pdf' || (contentUrl && contentUrl.endsWith('.pdf'));
    const isExternal = contentUrl && (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) && !contentUrl.includes('supabase.co');
    const isLocal = contentUrl && contentUrl.startsWith('/uploads/');

    let storageKey = lessonData.storageKey || null;
    let storageBucket = lessonData.storageBucket || null;
    let storageProvider = lessonData.storageProvider || null;
    let mimeType = lessonData.mimeType || (isPdf ? 'application/pdf' : 'video/mp4');
    let sizeBytes = lessonData.sizeBytes || 0;
    let checksumSha256 = lessonData.checksumSha256 || null;
    let mediaStatus = lessonData.mediaStatus || (contentUrl ? 'READY' : null);

    if (isExternal) {
      storageProvider = 'external';
      storageBucket = null;
      storageKey = null;
      mediaStatus = 'READY';
    } else if (isLocal) {
      storageProvider = 'local';
      storageBucket = null;
      storageKey = contentUrl;
      mediaStatus = 'READY';
    } else {
      // Supabase Storage
      storageProvider = storageProvider || 'supabase';
      storageBucket = storageBucket || (isPdf ? 'documents' : 'videos');
      storageKey = storageKey || (contentUrl && !contentUrl.startsWith('http') ? contentUrl : null);
    }

    return {
      contentType: isPdf ? 'pdf' : (contentType || 'video'),
      contentUrl,
      storageProvider,
      storageBucket,
      storageKey,
      mimeType,
      sizeBytes,
      checksumSha256,
      mediaStatus
    };
  }

  async createCourse(courseData, instructorId) {
    const client = await db.pool.connect();
    const newlyUploadedKeys = [];
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

      // 1. Chèn khóa học vào bảng courses
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
          await this._insertSection(client, courseId, sections[i], i + 1, newlyUploadedKeys);
        }
      }

      await client.query('COMMIT');

      // Map status for frontend compatibility
      newCourse.status = newCourse.status === 'published' ? 1 : 0;

      return newCourse;
    } catch (error) {
      await client.query('ROLLBACK');
      // Dọn dẹp rollback an toàn cho các asset mới upload nếu DB thất bại
      if (newlyUploadedKeys.length > 0) {
        orphanCleanupService.rollbackNewUploads(newlyUploadedKeys).catch(() => {});
      }
      handleServiceError(error, 'Lỗi tạo khóa học');
    } finally {
      client.release();
    }
  }

  /**
   * Helper để chèn section
   */
  async _insertSection(client, courseId, sectionData, defaultOrder, trackedKeys = []) {
    const orderIndex = sectionData.orderIndex !== undefined ? sectionData.orderIndex : defaultOrder;

    const result = await client.query(`
      INSERT INTO sections (course_id, title, order_index)
      VALUES ($1, $2, $3)
      RETURNING section_id
    `, [courseId, sectionData.title, orderIndex]);

    const sectionId = result.rows[0].section_id;

    if (sectionData.lessons && Array.isArray(sectionData.lessons)) {
      for (let i = 0; i < sectionData.lessons.length; i++) {
        await this._insertLesson(client, sectionId, sectionData.lessons[i], i + 1, trackedKeys);
      }
    }
  }

  /**
   * Helper để chèn bài học
   */
  async _insertLesson(client, sectionId, lessonData, defaultOrder, trackedKeys = []) {
    const orderIndex = lessonData.orderIndex !== undefined ? lessonData.orderIndex : defaultOrder;
    const speakingSentences = lessonData.speakingSentences || lessonData.speaking_sentences || '';
    const speakingQuestions = lessonData.speakingQuestions || lessonData.speaking_questions || '';

    const meta = this._resolveMediaMetadata(lessonData);

    if (meta.storageKey) {
      trackedKeys.push({ key: meta.storageKey, bucket: meta.storageBucket });
    }

    await client.query(`
      INSERT INTO lessons (
        section_id, title, content_type, content_url, order_index, speaking_sentences, speaking_questions,
        storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      sectionId, lessonData.title, meta.contentType, meta.contentUrl, orderIndex, speakingSentences, speakingQuestions,
      meta.storageProvider, meta.storageBucket, meta.storageKey, meta.mimeType, meta.sizeBytes, meta.checksumSha256, meta.mediaStatus
    ]);
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

      return course;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin chi tiết khóa học');
    }
  }

  async updateCourse(courseId, courseData) {
    const client = await db.pool.connect();
    const newlyUploadedKeys = [];
    const assetsToCleanup = [];

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

          // Get existing lesson IDs and old storage keys for this section if updating
          let existingLessons = [];
          if (isExistingSection) {
            const existingLessonsRes = await client.query(
              'SELECT lesson_id, storage_key, storage_bucket FROM lessons WHERE section_id = $1',
              [secId]
            );
            existingLessons = existingLessonsRes.rows;
          }
          const existingLessonIds = existingLessons.map(r => r.lesson_id);

          // Process lessons
          if (sec.lessons && Array.isArray(sec.lessons)) {
            for (let j = 0; j < sec.lessons.length; j++) {
              const les = sec.lessons[j];
              const lessonOrder = les.orderIndex || (j + 1);
              const speakingSentences = les.speakingSentences || les.speaking_sentences || '';
              const speakingQuestions = les.speakingQuestions || les.speaking_questions || '';

              const meta = this._resolveMediaMetadata(les);
              if (meta.storageKey) {
                newlyUploadedKeys.push({ key: meta.storageKey, bucket: meta.storageBucket });
              }

              let lesId;
              const isExistingLesson = les.id && Number.isInteger(Number(les.id)) && Number(les.id) < 1000000000;

              if (isExistingLesson && existingLessonIds.includes(Number(les.id))) {
                // Check if storage asset was replaced
                const oldLesson = existingLessons.find(el => el.lesson_id === Number(les.id));
                if (oldLesson && oldLesson.storage_key && meta.storageKey && oldLesson.storage_key !== meta.storageKey) {
                  assetsToCleanup.push({ key: oldLesson.storage_key, bucket: oldLesson.storage_bucket });
                }

                // Update existing lesson
                lesId = Number(les.id);
                await client.query(
                  `UPDATE lessons 
                   SET title = $1, content_type = $2, content_url = $3, order_index = $4, 
                       speaking_sentences = $5, speaking_questions = $6,
                       storage_provider = COALESCE($7, storage_provider),
                       storage_bucket = COALESCE($8, storage_bucket),
                       storage_key = COALESCE($9, storage_key),
                       mime_type = COALESCE($10, mime_type),
                       size_bytes = CASE WHEN $11 > 0 THEN $11 ELSE size_bytes END,
                       checksum_sha256 = COALESCE($12, checksum_sha256),
                       media_status = COALESCE($13, media_status)
                   WHERE lesson_id = $14`,
                  [
                    les.title, meta.contentType, meta.contentUrl, lessonOrder, speakingSentences, speakingQuestions,
                    meta.storageProvider, meta.storageBucket, meta.storageKey, meta.mimeType, meta.sizeBytes, meta.checksumSha256, meta.mediaStatus,
                    lesId
                  ]
                );
              } else {
                // Insert new lesson
                const insertLesRes = await client.query(
                  `INSERT INTO lessons (
                     section_id, title, content_type, content_url, order_index, speaking_sentences, speaking_questions,
                     storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
                   )
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                   RETURNING lesson_id`,
                  [
                    secId, les.title, meta.contentType, meta.contentUrl, lessonOrder, speakingSentences, speakingQuestions,
                    meta.storageProvider, meta.storageBucket, meta.storageKey, meta.mimeType, meta.sizeBytes, meta.checksumSha256, meta.mediaStatus
                  ]
                );
                lesId = insertLesRes.rows[0].lesson_id;
              }
              currentLessonIds.push(lesId);
            }
          }

          // Thu thập và xóa các bài học bị xóa trong section này
          if (isExistingSection) {
            const removedLessonsRes = await client.query(
              'SELECT storage_key, storage_bucket FROM lessons WHERE section_id = $1 AND NOT (lesson_id = ANY($2::int[])) AND storage_key IS NOT NULL',
              [secId, currentLessonIds.length > 0 ? currentLessonIds : [-1]]
            );
            removedLessonsRes.rows.forEach(r => assetsToCleanup.push({ key: r.storage_key, bucket: r.storage_bucket }));

            await client.query(
              'DELETE FROM lessons WHERE section_id = $1 AND NOT (lesson_id = ANY($2::int[]))',
              [secId, currentLessonIds.length > 0 ? currentLessonIds : [-1]]
            );
          }
        }

        // Thu thập và xóa các section bị xóa khỏi khóa học
        const removedSectionsRes = await client.query(
          `SELECT l.storage_key, l.storage_bucket 
           FROM lessons l 
           JOIN sections s ON l.section_id = s.section_id 
           WHERE s.course_id = $1 AND NOT (s.section_id = ANY($2::int[])) AND l.storage_key IS NOT NULL`,
          [courseId, currentSectionIds.length > 0 ? currentSectionIds : [-1]]
        );
        removedSectionsRes.rows.forEach(r => assetsToCleanup.push({ key: r.storage_key, bucket: r.storage_bucket }));

        await client.query(
          'DELETE FROM sections WHERE course_id = $1 AND NOT (section_id = ANY($2::int[]))',
          [courseId, currentSectionIds.length > 0 ? currentSectionIds : [-1]]
        );
      }

      await client.query('COMMIT');

      // Thực hiện dọn dẹp các asset mồ côi ngoài luồng sau khi DB Commit thành công
      if (assetsToCleanup.length > 0) {
        orphanCleanupService.cleanupUnreferencedAssets(assetsToCleanup).catch((err) => {
          console.warn('⚠️ [CoursesService.updateCourse] Cảnh báo dọn dẹp orphan asset:', err.message);
        });
      }

      return await this.getCourseById(courseId);
    } catch (error) {
      await client.query('ROLLBACK');
      if (newlyUploadedKeys.length > 0) {
        orphanCleanupService.rollbackNewUploads(newlyUploadedKeys).catch(() => {});
      }
      handleServiceError(error, 'Lỗi cập nhật khóa học');
    } finally {
      client.release();
    }
  }

  async deleteCourse(courseId) {
    try {
      // 1. Thu thập danh sách storage keys trước khi xóa DB
      const assetsToCleanup = await orphanCleanupService.collectAssetsFromCourse(courseId);

      // 2. Xóa khóa học trong database (Cascade xóa sections, lessons, materials)
      const result = await db.query('DELETE FROM courses WHERE course_id = $1 RETURNING course_id', [courseId]);
      const deleted = result.rows.length > 0;

      // 3. Dọn dẹp các storage object mồ côi trên Supabase
      if (deleted && assetsToCleanup.length > 0) {
        orphanCleanupService.cleanupUnreferencedAssets(assetsToCleanup).catch((err) => {
          console.warn('⚠️ [CoursesService.deleteCourse] Cảnh báo dọn dẹp orphan asset:', err.message);
        });
      }

      return deleted;
    } catch (error) {
      handleServiceError(error, 'Lỗi xóa khóa học');
    }
  }

  /**
   * Kiểm tra quyền truy cập của người dùng đối với một bài học cụ thể (DRM / Video Access)
   * @param {number|string} userId ID của người dùng
   * @param {number|string} lessonId ID của bài học
   * @param {number} [roleId] ID vai trò (1: Admin, 2: Instructor, 3: Student)
   * @returns {Promise<boolean>} True nếu có quyền truy cập, False nếu không
   */
  async canUserAccessLesson(userId, lessonId, roleId) {
    try {
      const parsedUserId = parseInt(userId, 10);
      const parsedLessonId = parseInt(lessonId, 10);
      const parsedRoleId = parseInt(roleId, 10);

      if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
        return false;
      }

      // 1. Admin (Role ID = 1) có toàn quyền truy cập tất cả bài học
      if (parsedRoleId === 1) {
        return true;
      }

      // 2. Tìm thông tin khóa học chứa bài học này
      const lessonQuery = `
        SELECT l.lesson_id, s.course_id, c.instructor_id, c.status
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE l.lesson_id = $1
      `;
      const lessonRes = await db.query(lessonQuery, [parsedLessonId]);
      if (lessonRes.rows.length === 0) {
        return false;
      }

      const { instructor_id, status } = lessonRes.rows[0];

      // 3. Instructor (Role ID = 2) có quyền nếu là giảng viên của khóa học hoặc khóa học đã published
      if (parsedRoleId === 2) {
        if (instructor_id === parsedUserId || status === 'published') {
          return true;
        }
        return false;
      }

      // 4. Student / Học viên (Role ID = 3 hoặc người dùng thông thường):
      // Có quyền nếu khóa học đã published hoặc đã có bản ghi học tập trong user_progress
      if (status === 'published') {
        return true;
      }

      // Nếu khóa học đang ở trạng thái draft/archived, kiểm tra xem học viên đã từng có tiến độ học tập chưa
      if (parsedUserId) {
        const progressRes = await db.query(
          'SELECT progress_id FROM user_progress WHERE user_id = $1 AND lesson_id = $2 LIMIT 1',
          [parsedUserId, parsedLessonId]
        );
        if (progressRes.rows.length > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ [CoursesService.canUserAccessLesson Error]:', error);
      return false;
    }
  }
}

module.exports = new CoursesService();
