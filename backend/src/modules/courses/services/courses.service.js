const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');
const orphanCleanupService = require('../../../utils/orphanCleanup.service');
const supabaseStorage = require('../../../utils/supabaseStorage');

class CoursesService {
  async getAllCourses(filterPublished = true) {
    try {
      let queryText = `
        SELECT 
          c.course_id, c.subject_id, c.course_name, c.description, c.instructor_id,
          c.thumbnail_url, c.price, c.status, c.created_at, c.updated_at,
          c.start_date, c.end_date,
          u.full_name as instructor_name,
          s.subject_name
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.user_id
        LEFT JOIN subjects s ON c.subject_id = s.subject_id
      `;

      const values = [];
      if (filterPublished) {
        queryText += ` WHERE c.status = 'published'`;
      }
      queryText += ` ORDER BY c.created_at DESC`;

      const result = await db.query(queryText, values);
      return result.rows.map(course => ({
        ...course,
        status: course.status === 'published' ? 1 : 0
      }));
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy danh sách khóa học');
    }
  }

  async getSubjects() {
    try {
      const result = await db.query('SELECT * FROM subjects ORDER BY subject_id ASC');
      return result.rows;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy danh sách môn học');
    }
  }

  /**
   * Helper phân giải và chuẩn hóa metadata lưu trữ của một bài học
   */
  _resolveMediaMetadata(les) {
    const contentType = (les.contentType || les.content_type || les.type || 'video').toLowerCase();
    const contentUrl = les.contentUrl || les.content_url || '';
    const isNonMedia = ['quiz', 'text', 'speaking'].includes(contentType) || (!contentUrl && !les.storageKey && !les.storage_key);

    if (isNonMedia) {
      return {
        contentType,
        contentUrl: '',
        storageProvider: null,
        storageBucket: null,
        storageKey: null,
        mimeType: null,
        sizeBytes: 0,
        checksumSha256: null,
        mediaStatus: null,
        isNonMedia: true
      };
    }

    const isPdf = contentType === 'pdf' || contentUrl.endsWith('.pdf') || (les.storageKey && les.storageKey.endsWith('.pdf'));
    const isExternal = (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) && !contentUrl.includes('supabase.co');

    if (isExternal) {
      return {
        contentType,
        contentUrl,
        storageProvider: 'external',
        storageBucket: null,
        storageKey: null,
        mimeType: isPdf ? 'application/pdf' : 'video/mp4',
        sizeBytes: les.sizeBytes || les.size_bytes || 0,
        checksumSha256: null,
        mediaStatus: 'READY',
        isNonMedia: false
      };
    }

    const storageKey = les.storageKey || les.storage_key || (contentUrl && !contentUrl.startsWith('/uploads/') && !contentUrl.startsWith('uploads/') ? contentUrl.replace(/^\/+/, '') : null);
    const storageBucket = les.storageBucket || les.storage_bucket || (isPdf ? 'documents' : 'videos');
    const storageProvider = les.storageProvider || les.storage_provider || (storageKey ? 'supabase' : (contentUrl.startsWith('/uploads/') ? 'local' : 'external'));
    const mimeType = les.mimeType || les.mime_type || (isPdf ? 'application/pdf' : 'video/mp4');
    const sizeBytes = Number(les.sizeBytes || les.size_bytes) || 0;
    const checksumSha256 = les.checksumSha256 || les.checksum_sha256 || null;
    const mediaStatus = les.mediaStatus || les.media_status || (storageKey ? 'READY' : 'PENDING_AUDIT');

    return {
      contentType,
      contentUrl: storageKey || contentUrl,
      storageProvider,
      storageBucket,
      storageKey,
      mimeType,
      sizeBytes,
      checksumSha256,
      mediaStatus,
      isNonMedia: false
    };
  }

  /**
   * Helper kiểm tra tính hợp lệ của toàn bộ bài học khi xuất bản khóa học (Publish Validation)
   */
  _validateCourseForPublish(sections = []) {
    if (!Array.isArray(sections)) return;

    for (const sec of sections) {
      if (sec.lessons && Array.isArray(sec.lessons)) {
        for (const les of sec.lessons) {
          const meta = this._resolveMediaMetadata(les);
          if (meta.isNonMedia) continue;

          // Nếu là media nội bộ (video/pdf), bắt buộc phải có storageKey và trạng thái READY
          if (meta.storageProvider === 'supabase') {
            if (!meta.storageKey || meta.mediaStatus !== 'READY') {
              const err = new Error(`Bài học "${les.title || 'Chưa đặt tên'}" chưa hoàn tất tải lên hoặc chưa được xác thực (trạng thái: ${meta.mediaStatus || 'CHƯA_SẴN_SÀNG'}). Không thể xuất bản.`);
              err.status = 400;
              err.code = 'UNVERIFIED_MEDIA_ASSETS';
              throw err;
            }
          }
        }
      }
    }
  }

  async createCourse(courseData, instructorId, userRole = 2) {
    const client = await db.pool.connect();
    const newlyUploadedKeys = [];
    const claimedUploadIds = [];

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
      const finalSubjectId = subjectId ? parseInt(subjectId, 10) : null;

      // 1. Kiểm tra điều kiện xuất bản (Publish Validation) nếu khóa học xuất bản ngay
      if (finalStatus === 'published') {
        this._validateCourseForPublish(sections);
      }

      // 2. Chèn khóa học vào bảng courses (Bắt buộc gán instructorId từ authenticated token)
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

      // 3. Chèn các chương (sections) và bài học (lessons) kèm xác thực pending uploads
      if (sections && Array.isArray(sections)) {
        for (let i = 0; i < sections.length; i++) {
          await this._insertSection(
            client, courseId, sections[i], i + 1,
            newlyUploadedKeys, claimedUploadIds, instructorId, userRole
          );
        }
      }

      await client.query('COMMIT');

      // Đánh dấu các pending uploads đã committed thành công
      if (claimedUploadIds.length > 0) {
        orphanCleanupService.commitPendingUploads(claimedUploadIds).catch(() => {});
      }

      newCourse.status = newCourse.status === 'published' ? 1 : 0;
      return newCourse;
    } catch (error) {
      await client.query('ROLLBACK');
      if (newlyUploadedKeys.length > 0) {
        orphanCleanupService.rollbackNewUploads(newlyUploadedKeys).catch(() => {});
      }
      handleServiceError(error, 'Lỗi tạo khóa học');
    } finally {
      client.release();
    }
  }

  async _insertSection(client, courseId, sectionData, defaultOrder, trackedKeys = [], claimedUploadIds = [], instructorId, userRole) {
    const orderIndex = sectionData.orderIndex !== undefined ? sectionData.orderIndex : defaultOrder;

    const result = await client.query(`
      INSERT INTO sections (course_id, title, order_index)
      VALUES ($1, $2, $3)
      RETURNING section_id
    `, [courseId, sectionData.title, orderIndex]);

    const sectionId = result.rows[0].section_id;

    if (sectionData.lessons && Array.isArray(sectionData.lessons)) {
      for (let i = 0; i < sectionData.lessons.length; i++) {
        await this._insertLesson(
          client, sectionId, sectionData.lessons[i], i + 1,
          trackedKeys, claimedUploadIds, instructorId, userRole
        );
      }
    }
  }

  async _insertLesson(client, sectionId, lessonData, defaultOrder, trackedKeys = [], claimedUploadIds = [], instructorId, userRole) {
    const orderIndex = lessonData.orderIndex !== undefined ? lessonData.orderIndex : defaultOrder;
    const speakingSentences = lessonData.speakingSentences || lessonData.speaking_sentences || '';
    const speakingQuestions = lessonData.speakingQuestions || lessonData.speaking_questions || '';

    const meta = this._resolveMediaMetadata(lessonData);

    // Xác thực và claim pending upload nếu có
    const pendingUploadId = lessonData.pendingUploadId || lessonData.pending_upload_id;
    if (pendingUploadId && meta.storageKey) {
      await orphanCleanupService.claimPendingUpload({
        uploadId: pendingUploadId,
        instructorId,
        userRole,
        storageKey: meta.storageKey,
        storageBucket: meta.storageBucket,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        checksumSha256: meta.checksumSha256,
        client
      });
      claimedUploadIds.push(pendingUploadId);
      trackedKeys.push({ key: meta.storageKey, bucket: meta.storageBucket });
    } else if (meta.storageKey && meta.storageProvider === 'supabase') {
      // Nếu không có pendingUploadId nhưng khai báo Supabase storageKey, kiểm tra object tồn tại
      const exists = await supabaseStorage.checkObjectExists(meta.storageKey, meta.storageBucket);
      if (!exists) {
        const err = new Error(`Tài nguyên ${meta.storageKey} không tồn tại trên máy chủ lưu trữ.`);
        err.status = 400;
        throw err;
      }
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
          l.speaking_sentences, l.speaking_questions,
          l.storage_provider, l.storage_bucket, l.storage_key, l.mime_type, l.size_bytes, l.checksum_sha256, l.media_status
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
        storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status,
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
            speaking_questions: row.speaking_questions || '',
            storage_provider: row.storage_provider,
            storage_bucket: row.storage_bucket,
            storage_key: row.storage_key,
            mime_type: row.mime_type,
            size_bytes: Number(row.size_bytes) || 0,
            checksum_sha256: row.checksum_sha256,
            media_status: row.media_status
          });
        }
      });

      return course;
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin chi tiết khóa học');
    }
  }

  async updateCourse(courseId, courseData, userId, userRole = 2) {
    const client = await db.pool.connect();
    const newlyUploadedKeys = [];
    const claimedUploadIds = [];
    const assetsToCleanup = [];

    try {
      await client.query('BEGIN');

      // 1. Kiểm tra quyền sở hữu khóa học nếu có thông tin người dùng
      if (userId !== undefined && userId !== null) {
        const ownerCheckRes = await client.query(
          'SELECT course_id, instructor_id FROM courses WHERE course_id = $1 FOR UPDATE',
          [courseId]
        );

        if (ownerCheckRes.rows.length === 0) {
          const error = new Error('Không tìm thấy khóa học để cập nhật');
          error.status = 404;
          throw error;
        }

        const existingCourse = ownerCheckRes.rows[0];
        const isAdmin = userRole === 1 || userRole === '1';
        if (!isAdmin && Number(existingCourse.instructor_id) !== Number(userId)) {
          const error = new Error('Bạn không có quyền chỉnh sửa khóa học của giảng viên khác.');
          error.status = 403;
          throw error;
        }
      }

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

      let finalStatus = undefined;
      if (status !== undefined) {
        if (status === 1 || status === '1' || status === 'published') {
          finalStatus = 'published';
        } else if (status === 2 || status === '2' || status === 'archived') {
          finalStatus = 'archived';
        } else if (status === null) {
          finalStatus = null;
        } else {
          finalStatus = 'draft';
        }
      }

      // 2. Kiểm tra điều kiện xuất bản nếu cập nhật sang published
      if (finalStatus === 'published' && sections) {
        this._validateCourseForPublish(sections);
      }

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
      if (finalStatus !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(finalStatus);
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
            secId = Number(sec.id);
            await client.query(
              'UPDATE sections SET title = $1, order_index = $2 WHERE section_id = $3',
              [sec.title, sectionOrder, secId]
            );
          } else {
            const insertSecRes = await client.query(
              'INSERT INTO sections (course_id, title, order_index) VALUES ($1, $2, $3) RETURNING section_id',
              [courseId, sec.title, sectionOrder]
            );
            secId = insertSecRes.rows[0].section_id;
          }
          currentSectionIds.push(secId);

          let existingLessons = [];
          if (isExistingSection) {
            const existingLessonsRes = await client.query(
              'SELECT lesson_id, storage_key, storage_bucket FROM lessons WHERE section_id = $1',
              [secId]
            );
            existingLessons = existingLessonsRes.rows;
          }
          const existingLessonIds = existingLessons.map(r => r.lesson_id);

          if (sec.lessons && Array.isArray(sec.lessons)) {
            for (let j = 0; j < sec.lessons.length; j++) {
              const les = sec.lessons[j];
              const lessonOrder = les.orderIndex || (j + 1);
              const speakingSentences = les.speakingSentences || les.speaking_sentences || '';
              const speakingQuestions = les.speakingQuestions || les.speaking_questions || '';

              const meta = this._resolveMediaMetadata(les);
              const pendingUploadId = les.pendingUploadId || les.pending_upload_id;

              // Claim pending upload nếu có
              if (pendingUploadId && meta.storageKey) {
                await orphanCleanupService.claimPendingUpload({
                  uploadId: pendingUploadId,
                  instructorId: userId,
                  userRole,
                  storageKey: meta.storageKey,
                  storageBucket: meta.storageBucket,
                  mimeType: meta.mimeType,
                  sizeBytes: meta.sizeBytes,
                  checksumSha256: meta.checksumSha256,
                  client
                });
                claimedUploadIds.push(pendingUploadId);
                newlyUploadedKeys.push({ key: meta.storageKey, bucket: meta.storageBucket });
              } else if (meta.storageKey && meta.storageProvider === 'supabase') {
                const exists = await supabaseStorage.checkObjectExists(meta.storageKey, meta.storageBucket);
                if (!exists) {
                  const err = new Error(`Tài nguyên ${meta.storageKey} không tồn tại trên máy chủ lưu trữ.`);
                  err.status = 400;
                  throw err;
                }
              }

              let lesId;
              const isExistingLesson = les.id && Number.isInteger(Number(les.id)) && Number(les.id) < 1000000000;

              if (isExistingLesson && existingLessonIds.includes(Number(les.id))) {
                const oldLesson = existingLessons.find(el => el.lesson_id === Number(les.id));

                // A. Chuyển từ Media sang Non-Media (Text/Quiz/Speaking) -> Chủ động đặt NULL
                if (meta.isNonMedia) {
                  if (oldLesson && oldLesson.storage_key) {
                    assetsToCleanup.push({ key: oldLesson.storage_key, bucket: oldLesson.storage_bucket });
                  }
                  lesId = Number(les.id);
                  await client.query(
                    `UPDATE lessons 
                     SET title = $1, content_type = $2, content_url = '', order_index = $3, 
                         speaking_sentences = $4, speaking_questions = $5,
                         storage_provider = NULL, storage_bucket = NULL, storage_key = NULL,
                         mime_type = NULL, size_bytes = 0, checksum_sha256 = NULL, media_status = NULL
                     WHERE lesson_id = $6`,
                    [les.title, meta.contentType, lessonOrder, speakingSentences, speakingQuestions, lesId]
                  );
                } else {
                  // B. Cập nhật bài học media thông thường
                  if (oldLesson && oldLesson.storage_key && meta.storageKey && oldLesson.storage_key !== meta.storageKey) {
                    assetsToCleanup.push({ key: oldLesson.storage_key, bucket: oldLesson.storage_bucket });
                  }

                  lesId = Number(les.id);
                  await client.query(
                    `UPDATE lessons 
                     SET title = $1, content_type = $2, content_url = $3, order_index = $4, 
                         speaking_sentences = $5, speaking_questions = $6,
                         storage_provider = $7, storage_bucket = $8, storage_key = $9,
                         mime_type = $10, size_bytes = $11, checksum_sha256 = $12, media_status = $13
                     WHERE lesson_id = $14`,
                    [
                      les.title, meta.contentType, meta.contentUrl, lessonOrder, speakingSentences, speakingQuestions,
                      meta.storageProvider, meta.storageBucket, meta.storageKey, meta.mimeType, meta.sizeBytes, meta.checksumSha256, meta.mediaStatus,
                      lesId
                    ]
                  );
                }
              } else {
                // Thêm mới bài học vào section
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

          // Thu thập và xóa các bài học bị gỡ bỏ khỏi section
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

        // Thu thập và xóa các section bị gỡ bỏ khỏi khóa học
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

      // Commit các pending uploads
      if (claimedUploadIds.length > 0) {
        orphanCleanupService.commitPendingUploads(claimedUploadIds).catch(() => {});
      }

      // Dọn dẹp các storage object mồ côi ngoài luồng sau khi DB Commit thành công
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

  async deleteCourse(courseId, userId, userRole = 2) {
    const client = await db.pool.connect();
    let assetsToCleanup = [];

    try {
      await client.query('BEGIN');

      // 1. Kiểm tra quyền sở hữu khóa học trong transaction nếu có thông tin người dùng
      if (userId !== undefined && userId !== null) {
        const ownerCheckRes = await client.query(
          'SELECT course_id, instructor_id FROM courses WHERE course_id = $1 FOR UPDATE',
          [courseId]
        );

        if (ownerCheckRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }

        const existingCourse = ownerCheckRes.rows[0];
        const isAdmin = userRole === 1 || userRole === '1';
        if (!isAdmin && Number(existingCourse.instructor_id) !== Number(userId)) {
          const error = new Error('Bạn không có quyền xóa khóa học của giảng viên khác.');
          error.status = 403;
          throw error;
        }
      }

      // 2. Thu thập danh sách storage keys trước khi xóa DB trong transaction
      assetsToCleanup = await orphanCleanupService.collectAssetsFromCourse(courseId, client);

      // 3. Xóa khóa học trong database (Cascade xóa sections, lessons, materials)
      const result = await client.query('DELETE FROM courses WHERE course_id = $1 RETURNING course_id', [courseId]);
      const deleted = result.rows.length > 0;

      await client.query('COMMIT');

      // 4. Dọn dẹp các storage object mồ côi trên Supabase sau khi COMMIT thành công
      if (deleted && assetsToCleanup.length > 0) {
        orphanCleanupService.cleanupUnreferencedAssets(assetsToCleanup).catch((err) => {
          console.warn('⚠️ [CoursesService.deleteCourse] Cảnh báo dọn dẹp orphan asset:', err.message);
        });
      }

      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      handleServiceError(error, 'Lỗi xóa khóa học');
    } finally {
      client.release();
    }
  }

  /**
   * Kiểm tra quyền truy cập của người dùng đối với một bài học cụ thể (DRM / Video Access)
   */
  async canUserAccessLesson(userId, lessonId, roleId) {
    try {
      const parsedUserId = parseInt(userId, 10);
      const parsedLessonId = parseInt(lessonId, 10);
      const parsedRoleId = parseInt(roleId, 10);

      if (!parsedLessonId || isNaN(parsedLessonId)) return false;

      // 1. Admin (Role ID 1) luôn có toàn quyền truy cập
      if (parsedRoleId === 1) return true;

      // 2. Truy vấn khóa học và bài học
      const lessonQuery = `
        SELECT l.lesson_id, s.section_id, s.course_id, c.instructor_id, c.status as course_status, c.price
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE l.lesson_id = $1
      `;
      const lessonResult = await db.query(lessonQuery, [parsedLessonId]);
      if (lessonResult.rows.length === 0) return false;

      const courseInfo = lessonResult.rows[0];

      // 3. Giảng viên sở hữu khóa học (Instructor Owner) có toàn quyền truy cập
      if (parsedUserId && Number(courseInfo.instructor_id) === Number(parsedUserId)) {
        return true;
      }

      // 4. Nếu khóa học chưa xuất bản (draft / archived), người dùng khác không thể truy cập
      if (courseInfo.course_status !== 'published') {
        return false;
      }

      // 5. Khóa học miễn phí (price = 0 hoặc null) -> cho phép truy cập
      if (!courseInfo.price || parseFloat(courseInfo.price) === 0) {
        return true;
      }

      // 6. Khóa học trả phí -> Kiểm tra đăng ký (Enrolled)
      if (!parsedUserId || isNaN(parsedUserId)) return false;

      const enrollQuery = `
        SELECT enrollment_id, status 
        FROM enrollments 
        WHERE user_id = $1 AND course_id = $2 AND status = 'active'
      `;
      const enrollResult = await db.query(enrollQuery, [parsedUserId, courseInfo.course_id]);
      return enrollResult.rows.length > 0;
    } catch (error) {
      console.error('[canUserAccessLesson] Lỗi xác thực quyền bài học:', error);
      return false;
    }
  }
}

module.exports = new CoursesService();
