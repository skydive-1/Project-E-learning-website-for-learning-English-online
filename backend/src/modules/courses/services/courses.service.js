const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');
const orphanCleanupService = require('../../../utils/orphanCleanup.service');
const supabaseStorage = require('../../../utils/supabaseStorage');
const lessonStreamCache = require('../../../utils/lessonStreamCache');
const { getRequiredPlaybackKeys } = require('../../../utils/mediaAssetGroup.util');
const { validateOpenClozeQuestion } = require('../../quizzes/utils/openCloze.util');
const {
  extractYoutubeVideoId,
  normalizeYoutubeUrl
} = require('../../../utils/youtubeTranscript.util');

const ACADEMY_ROADMAPS = new Set(['basic', 'toeic', 'ielts']);
const SUBJECT_ROADMAP_DEFAULTS = new Map([
  [1, 'ielts'],
  [2, 'toeic'],
  [4, 'basic'],
  [5, 'basic']
]);

class CoursesService {
  _resolveAcademyRoadmap(requestedRoadmap, { subjectId, courseName, description } = {}) {
    if (requestedRoadmap !== undefined) {
      const normalizedRoadmap = String(requestedRoadmap || '').trim().toLowerCase();
      if (!normalizedRoadmap) return null;
      if (!ACADEMY_ROADMAPS.has(normalizedRoadmap)) {
        const error = new Error('Lộ trình Academy không hợp lệ. Vui lòng chọn Cơ bản, TOEIC hoặc IELTS.');
        error.status = 400;
        error.code = 'INVALID_ACADEMY_ROADMAP';
        throw error;
      }
      return normalizedRoadmap;
    }

    const subjectRoadmap = SUBJECT_ROADMAP_DEFAULTS.get(Number(subjectId));
    if (subjectRoadmap) return subjectRoadmap;

    const searchableText = `${courseName || ''} ${description || ''}`.toLowerCase();
    if (searchableText.includes('toeic')) return 'toeic';
    if (searchableText.includes('ielts')) return 'ielts';
    if (/\b(basic|beginner|foundation)\b/.test(searchableText)) return 'basic';
    return null;
  }

  /**
   * Media video/pdf/audio/ảnh có thể đã được upload lên R2 TRƯỚC KHI khóa học có
   * course_id thật (lúc đang tạo khóa học mới, frontend chưa biết ID), nên object
   * key lúc đó dùng thư mục tạm "courses/<ten>-draft-<instructorId>/...". Hàm này
   * chạy NGAY SAU KHI transaction tạo khóa học COMMIT, dời các object đó về đúng
   * thư mục chính thức "courses/<ten>-<courseId>/...". Đây là best-effort: nếu R2
   * lỗi (vd. thiếu quyền, mạng), khóa học vẫn coi là tạo thành công — chỉ log cảnh
   * báo — vì việc tổ chức lại thư mục không phải điều kiện bắt buộc để dùng khóa học.
   */
  async _reorganizeCourseMediaFolders(courseId) {
    if (!courseId) return;
    try {
      const { reorganizeCourseMedia } = require('../../../utils/r2CourseReorganizer');
      const report = await reorganizeCourseMedia(courseId);
      if (report.failed > 0) {
        console.warn(
          `[R2 auto-organize] Khóa học #${courseId}: ${report.moved}/${report.total} thành công, ` +
          `${report.failed} lỗi: ${report.failures.map(f => `${f.ref} (${f.message})`).join('; ')}`
        );
      } else if (report.moved > 0) {
        console.log(`[R2 auto-organize] Khóa học #${courseId}: đã dời ${report.moved} media về đúng thư mục.`);
      }
    } catch (error) {
      console.warn(`[R2 auto-organize] Không thể tổ chức lại thư mục cho khóa học #${courseId}: ${error.message}`);
    }
  }

  /**
   * Chuẩn hóa toàn bộ media của khóa học về Cloudflare R2 khi PUBLISH.
   *
   * Chạy ASYNC (best-effort) ngay sau khi transaction COMMIT thành công:
   *   1. Migrate file legacy Supabase → R2 (nếu có)
   *   2. Tổ chức lại thư mục R2 đúng cấu trúc chuẩn
   *
   * Không throw — chỉ log warning nếu có lỗi, không được phép làm hỏng
   * luồng publish chính.
   */
  async _migrateCourseMediaOnPublish(courseId) {
    if (!courseId) return;
    try {
      const { migrateCourseAllMedia } = require('../../../utils/r2CourseReorganizer');
      const report = await migrateCourseAllMedia(courseId);
      if (report && report.totalFailed > 0) {
        console.warn(
          `[Publish] Chuẩn hóa media khóa học #${courseId}: ` +
          `${report.totalMigrated} thành công, ${report.totalFailed} lỗi.`
        );
      } else if (report && report.totalMigrated > 0) {
        console.log(
          `[Publish] Khóa học #${courseId}: đã chuẩn hóa ${report.totalMigrated} media lên Cloudflare R2.`
        );
      }
    } catch (error) {
      console.warn(`[Publish] Không thể chuẩn hóa media cho khóa học #${courseId}: ${error.message}`);
    }
  }

  async _queueAutoSubtitles(lessonIds = []) {
    const uniqueLessonIds = [...new Set(lessonIds.map(Number).filter(Number.isInteger))];
    if (uniqueLessonIds.length === 0) return;

    const subtitlesService = require('../../lessons/services/subtitles.service');
    const results = await Promise.allSettled(
      uniqueLessonIds.map(lessonId => subtitlesService.queueAutoGeneration(lessonId))
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(
          `[Auto-Subtitle] Không thể xếp hàng bài học ${uniqueLessonIds[index]}: ${result.reason?.message || result.reason}`
        );
      }
    });
  }

  async getAllCourses(filterPublished = true) {
    try {
      let queryText = `
        SELECT 
          c.course_id, c.subject_id, c.course_name, c.description, c.academy_roadmap, c.instructor_id,
          c.thumbnail_url, c.price, c.status, c.created_at, c.updated_at,
          c.start_date, c.end_date,
          u.full_name as instructor_name,
          s.subject_name,
          COALESCE(ts.total_media_lessons, 0)::int AS total_media_lessons,
          COALESCE(ts.ready_transcripts, 0)::int AS ready_transcripts,
          COALESCE(ts.processing_transcripts, 0)::int AS processing_transcripts,
          COALESCE(ts.failed_transcripts, 0)::int AS failed_transcripts,
          COALESCE(ts.missing_transcripts, 0)::int AS missing_transcripts
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.user_id
        LEFT JOIN subjects s ON c.subject_id = s.subject_id
        LEFT JOIN (
          SELECT 
            sec.course_id,
            COUNT(l.lesson_id) FILTER (WHERE l.content_type IN ('video', 'youtube')) AS total_media_lessons,
            COUNT(l.lesson_id) FILTER (WHERE l.content_type IN ('video', 'youtube') AND ls.subtitle_status = 'ready') AS ready_transcripts,
            COUNT(l.lesson_id) FILTER (WHERE l.content_type IN ('video', 'youtube') AND ls.subtitle_status IN ('pending', 'processing')) AS processing_transcripts,
            COUNT(l.lesson_id) FILTER (WHERE l.content_type IN ('video', 'youtube') AND ls.subtitle_status = 'failed') AS failed_transcripts,
            COUNT(l.lesson_id) FILTER (WHERE l.content_type IN ('video', 'youtube') AND (ls.subtitle_status IS NULL OR ls.subtitle_status = 'none')) AS missing_transcripts
          FROM sections sec
          JOIN lessons l ON l.section_id = sec.section_id
          LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
          GROUP BY sec.course_id
        ) ts ON ts.course_id = c.course_id
      `;

      const values = [];
      if (filterPublished) {
        queryText += ` WHERE c.status = 'published'`;
      }
      queryText += ` ORDER BY c.created_at DESC`;

      const result = await db.query(queryText, values);
      return result.rows.map(course => {
        const isPublished = course.status === 'published';
        const isPendingReview = course.status === 'pending_review';
        const totalMedia = Number(course.total_media_lessons) || 0;
        const readyTranscripts = Number(course.ready_transcripts) || 0;
        return {
          ...course,
          status_name: course.status,
          status: isPublished ? 1 : (isPendingReview ? 'pending_review' : 0),
          transcript_summary: {
            total: totalMedia,
            total_video_lessons: totalMedia,
            ready: readyTranscripts,
            ready_transcripts: readyTranscripts,
            processing: Number(course.processing_transcripts) || 0,
            failed: Number(course.failed_transcripts) || 0,
            missing: Number(course.missing_transcripts) || 0,
            progress_percent: totalMedia > 0 ? Math.round((readyTranscripts / totalMedia) * 100) : 100
          }
        };
      });
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
    const rawType = (les.contentType || les.content_type || les.type || 'video').toLowerCase();
    const rawContentUrl = String(les.contentUrl || les.content_url || les.youtubeUrl || les.youtube_url || '').trim();
    const youtubeVideoId = extractYoutubeVideoId(rawContentUrl);
    const isYoutube = rawType === 'youtube' || Boolean(youtubeVideoId);
    const contentType = isYoutube ? 'youtube' : rawType;
    const contentUrl = youtubeVideoId ? normalizeYoutubeUrl(rawContentUrl) : rawContentUrl;
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

    if (isYoutube) {
      return {
        contentType: 'youtube',
        contentUrl,
        storageProvider: 'youtube',
        storageBucket: null,
        storageKey: null,
        mimeType: 'video/youtube',
        sizeBytes: 0,
        checksumSha256: null,
        mediaStatus: youtubeVideoId ? 'READY' : 'INVALID',
        isNonMedia: false
      };
    }

    const isPdf = contentType === 'pdf' || contentUrl.endsWith('.pdf') || (les.storageKey && les.storageKey.endsWith('.pdf'));
    const isExternal = (contentUrl.startsWith('http://') || contentUrl.startsWith('https://'))
      && !contentUrl.includes('supabase.co')
      && !contentUrl.includes('r2.cloudflarestorage.com');

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
    const storageProvider = les.storageProvider || les.storage_provider || (storageKey ? 'r2' : (contentUrl.startsWith('/uploads/') ? 'local' : 'external'));
    const mimeType = les.mimeType || les.mime_type || (isPdf ? 'application/pdf' : 'video/mp4');
    const sizeBytes = Number(les.sizeBytes || les.size_bytes) || 0;
    const checksumSha256 = les.checksumSha256 || les.checksum_sha256 || null;
    const mediaStatus = les.mediaStatus || les.media_status || 'PENDING_AUDIT';

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
   * Đồng bộ bộ câu hỏi gắn với một bài học ngay trong transaction của khóa học.
   * Chỉ xử lý khi client gửi quizQuestions; payload cũ không có field này sẽ
   * không vô tình xóa quiz đã tồn tại.
   */
  async _syncLessonQuiz(client, courseId, lessonId, lessonData) {
    if (!Object.prototype.hasOwnProperty.call(lessonData, 'quizQuestions')) return;

    const questions = Array.isArray(lessonData.quizQuestions) ? lessonData.quizQuestions : [];
    if (questions.length === 0) {
      // Không suy diễn "không tải được quiz" thành lệnh xóa dữ liệu. Chỉ xóa
      // khi giao diện gửi ý định xóa tường minh.
      if (lessonData.quizDeleted === true) {
        await client.query(
          'DELETE FROM quizzes WHERE course_id = $1 AND lesson_id = $2',
          [courseId, lessonId]
        );
      }
      return;
    }

    const existingQuizRes = await client.query(
      `SELECT quiz_id FROM quizzes
       WHERE course_id = $1 AND lesson_id = $2
       ORDER BY quiz_id DESC
       LIMIT 1 FOR UPDATE`,
      [courseId, lessonId]
    );

    const title = String(lessonData.quizTitle || `Trắc nghiệm: ${lessonData.title || ''}`).trim();
    const description = String(lessonData.quizDescription || `Bài kiểm tra cho bài học: ${lessonData.title || ''}`).trim();
    const difficulty = lessonData.quizDifficulty || 'Medium';
    const timeLimit = parseInt(lessonData.quizTimeLimit, 10) || 15;
    let quizId;

    let existingQuestionsRes = null;
    if (existingQuizRes.rows.length > 0) {
      quizId = existingQuizRes.rows[0].quiz_id;
      existingQuestionsRes = await client.query(
        'SELECT question_id, question_text, options, correct_answer, question_type, audio_url, passage_text FROM questions WHERE quiz_id = $1',
        [quizId]
      );
      await client.query(
        `UPDATE quizzes
         SET title = $1, description = $2, difficulty = $3, time_limit = $4,
             course_id = $5, lesson_id = $6
         WHERE quiz_id = $7`,
        [title, description, difficulty, timeLimit, courseId, lessonId, quizId]
      );
      await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);
    } else {
      const quizResult = await client.query(
        `INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, NULL)
         RETURNING quiz_id`,
        [courseId, lessonId, title, description, difficulty, timeLimit]
      );
      quizId = quizResult.rows[0].quiz_id;
    }

    for (const question of questions) {
      const questionText = String(question.question_text || question.questionText || question.question || '').trim();
      const explanation = String(question.explanation || '').trim();
      const questionType = String(question.question_type || question.questionType || 'multiple_choice').toLowerCase();
      let options = Array.isArray(question.options) ? question.options : [];
      let correctAnswer = question.correct_answer ?? question.correctAnswer ?? question.answer ?? '';

      if (!questionText) {
        const error = new Error('Nội dung câu hỏi quiz không được để trống.');
        error.status = 400;
        error.code = 'INVALID_QUIZ_QUESTION';
        throw error;
      }

      if (questionType === 'open_cloze') {
        // Fallback: Nếu options (gaps) bị thiếu answer nhưng trong DB đã có câu hỏi này, khôi phục lại answer từ DB
        if (existingQuestionsRes && existingQuestionsRes.rows.length > 0) {
          const matchedDbQ = existingQuestionsRes.rows.find(q =>
            (question.question_id && Number(q.question_id) === Number(question.question_id)) ||
            (q.question_text && q.question_text.trim() === questionText)
          );
          if (matchedDbQ) {
            let dbOptions = matchedDbQ.options;
            if (typeof dbOptions === 'string') {
              try { dbOptions = JSON.parse(dbOptions); } catch (_) { dbOptions = []; }
            }
            if (Array.isArray(dbOptions)) {
              const dbGapsMap = new Map();
              dbOptions.forEach(g => {
                if (g && (g.id !== undefined || g.gapId !== undefined)) {
                  dbGapsMap.set(String(g.id ?? g.gapId), g);
                }
              });
              options = options.map((gap, idx) => {
                const gapKey = String(gap?.id ?? gap?.gapId ?? idx + 1);
                const dbGap = dbGapsMap.get(gapKey) || dbOptions[idx];
                const curAnswer = (gap && gap.answer !== undefined) ? String(gap.answer).trim() : '';
                if (!curAnswer && dbGap && dbGap.answer) {
                  return {
                    ...gap,
                    answer: dbGap.answer,
                    acceptedAnswers: (gap?.acceptedAnswers && gap.acceptedAnswers.length > 0)
                      ? gap.acceptedAnswers
                      : (dbGap.acceptedAnswers || dbGap.accepted_answers || [])
                  };
                }
                return gap;
              });
            }
          }
        }

        const validated = validateOpenClozeQuestion({ questionText, gaps: options });
        options = validated.gaps;
        correctAnswer = '';
      }

      const audioUrl = question.audio_url || question.audioUrl || null;
      const passageText = question.passage_text || question.passageText || null;
      await client.query(
        `INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, question_type, audio_url, passage_text)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)`,
        [quizId, questionText, JSON.stringify(options), correctAnswer, explanation, questionType, audioUrl, passageText]
      );
    }
  }

  async _validateStoredCourseForPublish(client, courseId, { repairableExistingSources = new Map() } = {}) {
    const result = await client.query(`
      SELECT l.lesson_id, l.title, l.content_type, l.storage_provider, l.storage_bucket,
             l.storage_key, l.mime_type, l.size_bytes, l.checksum_sha256, l.media_status,
             l.content_url
      FROM lessons l JOIN sections s ON s.section_id = l.section_id
      WHERE s.course_id = $1
    `, [courseId]);
    if (result.rows.length === 0) {
      const err = new Error('Khóa học phải có ít nhất một bài học trước khi xuất bản.');
      err.status = 400; err.code = 'INVALID_COURSE_STRUCTURE'; throw err;
    }
    for (const lesson of result.rows) {
      if (String(lesson.content_type).toLowerCase() === 'youtube') {
        if (!extractYoutubeVideoId(lesson.content_url || '')) {
          const err = new Error(`Bài học "${lesson.title || lesson.lesson_id}" có đường link YouTube không hợp lệ.`);
          err.status = 400; err.code = 'INVALID_YOUTUBE_URL'; throw err;
        }
        continue;
      }
      if (['quiz', 'text', 'speaking'].includes(String(lesson.content_type).toLowerCase())) continue;
      const validExternal = ['external', 'youtube'].includes(lesson.storage_provider) && /^https?:\/\//i.test(lesson.content_url || '') && !(lesson.content_url || '').includes('supabase.co');
      const hasInternalMetadata = ['r2', 'supabase'].includes(lesson.storage_provider)
        && lesson.storage_bucket && lesson.storage_key && lesson.mime_type;
      const validInternal = hasInternalMetadata && lesson.media_status === 'READY';
      const currentSource = lesson.storage_key || lesson.content_url || '';
      const isUnchangedRepairSource = repairableExistingSources.get(Number(lesson.lesson_id)) === currentSource;
      if (!validExternal && !validInternal) {
        // Một khóa đã published có thể đang chứa media cũ bị mất. Cho phép
        // lưu lần lượt từng bài sửa chữa, nhưng chỉ với đúng source đã tồn tại
        // trước transaction; media mới vẫn phải qua pending upload/claim.
        if (hasInternalMetadata && isUnchangedRepairSource && lesson.media_status === 'MISSING_SOURCE') {
          continue;
        }
        const err = new Error(`Bài học "${lesson.title || lesson.lesson_id}" có media chưa được xác thực.`);
        err.status = 400; err.code = 'UNVERIFIED_MEDIA_ASSETS'; throw err;
      }
      if (validInternal) {
        const requiredKeys = getRequiredPlaybackKeys(lesson.storage_key);
        const existence = await Promise.all(requiredKeys.map(key => (
          supabaseStorage.checkObjectExists(key, lesson.storage_bucket, lesson.storage_provider)
        )));
        const missingKeys = requiredKeys.filter((_, index) => !existence[index]);
        if (missingKeys.length > 0) {
          if (isUnchangedRepairSource) {
            await client.query(
              `UPDATE lessons
               SET media_status = 'MISSING_SOURCE'
               WHERE lesson_id = $1
                 AND COALESCE(storage_key, content_url, '') = $2`,
              [lesson.lesson_id, currentSource]
            );
            continue;
          }
          const err = new Error(
            `Media của bài học "${lesson.title || lesson.lesson_id}" chưa đầy đủ trên storage ` +
            `(thiếu ${missingKeys.map(key => key.split('/').pop()).join(', ')}).`
          );
          err.status = 400; err.code = 'MEDIA_OBJECT_MISSING'; throw err;
        }
      }
    }
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

          if (meta.contentType === 'youtube' && meta.mediaStatus !== 'READY') {
            const err = new Error(`Bài học "${les.title || 'Chưa đặt tên'}" có đường link YouTube không hợp lệ.`);
            err.status = 400;
            err.code = 'INVALID_YOUTUBE_URL';
            throw err;
          }

          // Nếu là media nội bộ (video/pdf), bắt buộc phải có storageKey và trạng thái READY
          if (['r2', 'supabase'].includes(meta.storageProvider)) {
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
    const subtitleLessonIds = [];

    try {
      await client.query('BEGIN');

      const {
        subjectId,
        courseName,
        description,
        academyRoadmap,
        thumbnail_url,
        price,
        status,
        startDate,
        endDate,
        sections
      } = courseData;

      if (!courseName || !String(courseName).trim()) {
        const error = new Error('Tên khóa học không được để trống.');
        error.status = 400;
        error.code = 'COURSE_NAME_REQUIRED';
        throw error;
      }

      if (String(courseName).trim().length > 50) {
        const error = new Error('Tên khóa học không được vượt quá 50 ký tự.');
        error.status = 400;
        error.code = 'COURSE_NAME_TOO_LONG';
        throw error;
      }

      if (!subjectId) {
        const error = new Error('Vui lòng chọn môn học cho khóa học.');
        error.status = 400;
        error.code = 'SUBJECT_REQUIRED';
        throw error;
      }

      let finalStatus = 'draft';
      if (status === 'pending_review') {
        finalStatus = 'pending_review';
      } else if (status === 1 || status === '1' || status === 'published') {
        // Chỉ Admin mới có quyền publish trực tiếp lúc khởi tạo; Giảng viên phải qua Cổng kiểm duyệt
        if (userRole === 1) {
          finalStatus = 'published';
        } else {
          finalStatus = 'pending_review';
        }
      } else if (status === 2 || status === '2' || status === 'archived') {
        finalStatus = 'archived';
      }
      const finalPrice = price || 0;
      const finalSubjectId = subjectId ? parseInt(subjectId, 10) : null;
      const finalAcademyRoadmap = this._resolveAcademyRoadmap(academyRoadmap, {
        subjectId: finalSubjectId,
        courseName,
        description
      });
      if (finalStatus === 'published' && !finalAcademyRoadmap) {
        const error = new Error('Vui lòng chọn lộ trình Academy trước khi xuất bản khóa học.');
        error.status = 400;
        error.code = 'ACADEMY_ROADMAP_REQUIRED';
        throw error;
      }
      const finalStartDate = startDate || courseData.start_date || new Date().toISOString().split('T')[0];
      const finalEndDate = endDate || courseData.end_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Chèn khóa học; publish validation chạy trên database state sau khi claim media.
      const courseResult = await client.query(`
        INSERT INTO courses (
          subject_id, 
          course_name, 
          description, 
          academy_roadmap,
          instructor_id, 
          thumbnail_url, 
          price, 
          status, 
          start_date, 
          end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        finalSubjectId,
        courseName,
        description,
        finalAcademyRoadmap,
        instructorId,
        thumbnail_url,
        finalPrice,
        finalStatus,
        finalStartDate,
        finalEndDate
      ]);

      const newCourse = courseResult.rows[0];
      const courseId = newCourse.course_id;

      // 3. Chèn các chương (sections) và bài học (lessons) kèm xác thực pending uploads
      if (sections && Array.isArray(sections)) {
        for (let i = 0; i < sections.length; i++) {
          await this._insertSection(
            client, courseId, sections[i], i + 1,
            newlyUploadedKeys, claimedUploadIds, instructorId, userRole, subtitleLessonIds
          );
        }
      }

      if (claimedUploadIds.length > 0) {
        await orphanCleanupService.commitPendingUploads(claimedUploadIds, client);
      }
      if (finalStatus === 'published') await this._validateStoredCourseForPublish(client, courseId);
      await client.query('COMMIT');

      // Chuẩn hóa media (best-effort, async): chỉ chạy migrate Supabase → R2 đầy đủ khi
      // khóa học được PUBLISH ngay từ lúc tạo; nếu lưu draft thì chỉ tổ chức lại thư mục
      // R2 (không có gì để migrate từ Supabase với khóa học vừa tạo), để nhất quán với updateCourse.
      if (finalStatus === 'published') {
        this._migrateCourseMediaOnPublish(courseId).catch(() => {});
      } else {
        this._reorganizeCourseMediaFolders(courseId).catch(() => {});
      }
      await this._queueAutoSubtitles(subtitleLessonIds);

      newCourse.status = newCourse.status === 'published' ? 1 : 0;
      return newCourse;
    } catch (error) {
      await client.query('ROLLBACK');
      handleServiceError(error, 'Lỗi tạo khóa học');
    } finally {
      client.release();
    }
  }

  async _insertSection(client, courseId, sectionData, defaultOrder, trackedKeys = [], claimedUploadIds = [], instructorId, userRole, subtitleLessonIds = []) {
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
          client, courseId, sectionId, sectionData.lessons[i], i + 1,
          trackedKeys, claimedUploadIds, instructorId, userRole, subtitleLessonIds
        );
      }
    }
  }

  async _insertLesson(client, courseId, sectionId, lessonData, defaultOrder, trackedKeys = [], claimedUploadIds = [], instructorId, userRole, subtitleLessonIds = []) {
    const orderIndex = lessonData.orderIndex !== undefined ? lessonData.orderIndex : defaultOrder;
    const speakingSentences = lessonData.speakingSentences || lessonData.speaking_sentences || '';
    const speakingQuestions = lessonData.speakingQuestions || lessonData.speaking_questions || '';

    let meta = this._resolveMediaMetadata(lessonData);

    // Xác thực và claim pending upload nếu có
    const pendingUploadId = lessonData.pendingUploadId || lessonData.pending_upload_id;
    if (pendingUploadId && meta.storageKey) {
      const pending = await orphanCleanupService.claimPendingUpload({
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
      meta = { ...meta, contentUrl: pending.storage_key, storageProvider: pending.storage_provider,
        storageBucket: pending.storage_bucket, storageKey: pending.storage_key, mimeType: pending.mime_type,
        sizeBytes: Number(pending.size_bytes), checksumSha256: pending.checksum_sha256, mediaStatus: 'READY' };
      claimedUploadIds.push(pendingUploadId);
      trackedKeys.push({ key: meta.storageKey, bucket: meta.storageBucket });
    } else if (meta.storageKey && ['r2', 'supabase'].includes(meta.storageProvider)) {
      const err = new Error('Media private mới bắt buộc phải có pendingUploadId hợp lệ.');
      err.status = 400; err.code = 'PENDING_UPLOAD_REQUIRED'; throw err;
    }

    const lessonResult = await client.query(`
      INSERT INTO lessons (
        section_id, title, content_type, content_url, order_index, speaking_sentences, speaking_questions,
        storage_provider, storage_bucket, storage_key, mime_type, size_bytes, checksum_sha256, media_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING lesson_id
    `, [
      sectionId, lessonData.title, meta.contentType, meta.contentUrl, orderIndex, speakingSentences, speakingQuestions,
      meta.storageProvider, meta.storageBucket, meta.storageKey, meta.mimeType, meta.sizeBytes, meta.checksumSha256, meta.mediaStatus
    ]);

    const lessonId = lessonResult.rows[0].lesson_id;
    await this._syncLessonQuiz(client, courseId, lessonId, lessonData);
    if (['video', 'youtube'].includes(meta.contentType) && meta.contentUrl) subtitleLessonIds.push(lessonId);
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
    const subtitleLessonIds = [];
    const lessonIdsToInvalidate = new Set();
    const repairableExistingSources = new Map();

    try {
      await client.query('BEGIN');

      // Luôn khóa và đọc trạng thái hiện tại để không bypass validation khi payload bỏ status.
      const ownerCheckRes = await client.query(
        `SELECT course_id, instructor_id, status, subject_id, course_name, description, academy_roadmap
         FROM courses WHERE course_id = $1 FOR UPDATE`,
        [courseId]
      );

      if (ownerCheckRes.rows.length === 0) {
        const error = new Error('Không tìm thấy khóa học để cập nhật');
        error.status = 404;
        throw error;
      }

      const existingCourse = ownerCheckRes.rows[0];
      if (userId !== undefined && userId !== null) {
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
        academyRoadmap,
        thumbnail_url,
        price,
        status,
        startDate,
        endDate,
        sections
      } = courseData;

      let finalStatus = undefined;
      if (status !== undefined) {
        if (status === 'pending_review') {
          finalStatus = 'pending_review';
        } else if (status === 1 || status === '1' || status === 'published') {
          // Bảo vệ khóa học cũ: Nếu khóa học đã từng published hoặc người thực hiện là Admin, cho phép tiếp tục giữ/cập nhật published
          if (existingCourse.status === 'published' || userRole === 1) {
            finalStatus = 'published';
          } else {
            // Khóa học chưa từng xuất bản mà gửi publish -> chuyển sang hàng đợi kiểm duyệt
            finalStatus = 'pending_review';
          }
        } else if (status === 2 || status === '2' || status === 'archived') {
          finalStatus = 'archived';
        } else if (status === null) {
          finalStatus = null;
        } else {
          finalStatus = 'draft';
        }
      }

      const updates = [];
      const values = [];
      let paramIndex = 1;

      const effectiveSubjectId = subjectId !== undefined ? subjectId : existingCourse.subject_id;
      const effectiveCourseName = courseName !== undefined ? courseName : existingCourse.course_name;
      const effectiveDescription = description !== undefined ? description : existingCourse.description;
      const roadmapInput = academyRoadmap !== undefined
        ? academyRoadmap
        : (subjectId !== undefined ? undefined : existingCourse.academy_roadmap);
      const finalAcademyRoadmap = this._resolveAcademyRoadmap(roadmapInput, {
        subjectId: effectiveSubjectId,
        courseName: effectiveCourseName,
        description: effectiveDescription
      });
      const resultingStatusForMetadata = finalStatus === undefined ? existingCourse.status : finalStatus;
      if (resultingStatusForMetadata === 'published' && !finalAcademyRoadmap && finalStatus !== undefined) {
        const error = new Error('Vui lòng chọn lộ trình Academy trước khi xuất bản khóa học.');
        error.status = 400;
        error.code = 'ACADEMY_ROADMAP_REQUIRED';
        throw error;
      }

      if (subjectId !== undefined) {
        updates.push(`subject_id = $${paramIndex++}`);
        values.push(subjectId ? parseInt(subjectId, 10) : null);
      }
      if (courseName !== undefined) {
        if (courseName && String(courseName).trim().length > 50) {
          const error = new Error('Tên khóa học không được vượt quá 50 ký tự.');
          error.status = 400;
          error.code = 'COURSE_NAME_TOO_LONG';
          throw error;
        }
        updates.push(`course_name = $${paramIndex++}`);
        values.push(courseName);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (finalAcademyRoadmap !== (existingCourse.academy_roadmap || null)) {
        updates.push(`academy_roadmap = $${paramIndex++}`);
        values.push(finalAcademyRoadmap);
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
        const existingCourseLessonsRes = await client.query(
          `SELECT l.lesson_id, COALESCE(NULLIF(l.storage_key, ''), l.content_url) AS source_url
           FROM lessons l
           JOIN sections s ON s.section_id = l.section_id
           WHERE s.course_id = $1`,
          [courseId]
        );
        for (const row of existingCourseLessonsRes.rows) {
          lessonIdsToInvalidate.add(row.lesson_id);
          if (row.source_url) repairableExistingSources.set(Number(row.lesson_id), row.source_url);
        }

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
              `SELECT lesson_id, content_type, content_url, storage_provider, storage_key,
                      storage_bucket, mime_type, size_bytes, checksum_sha256, media_status
               FROM lessons WHERE section_id = $1`,
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

              let meta = this._resolveMediaMetadata(les);
              const pendingUploadId = les.pendingUploadId || les.pending_upload_id;
              const candidateLessonId = les.id && Number.isInteger(Number(les.id)) ? Number(les.id) : null;
              const oldLessonForClaim = existingLessons.find(el => el.lesson_id === candidateLessonId);

              // Claim pending upload nếu có
              if (pendingUploadId && meta.storageKey) {
                const pending = await orphanCleanupService.claimPendingUpload({
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
                meta = { ...meta, contentUrl: pending.storage_key, storageProvider: pending.storage_provider,
                  storageBucket: pending.storage_bucket, storageKey: pending.storage_key, mimeType: pending.mime_type,
                  sizeBytes: Number(pending.size_bytes), checksumSha256: pending.checksum_sha256, mediaStatus: 'READY' };
                claimedUploadIds.push(pendingUploadId);
                newlyUploadedKeys.push({ key: meta.storageKey, bucket: meta.storageBucket });
              } else if (meta.storageKey && ['r2', 'supabase'].includes(meta.storageProvider)) {
                if (!oldLessonForClaim || oldLessonForClaim.storage_key !== meta.storageKey) {
                  const err = new Error('Thay đổi media private bắt buộc phải có pendingUploadId hợp lệ.');
                  err.status = 400; err.code = 'PENDING_UPLOAD_REQUIRED'; throw err;
                }
                meta = { ...meta, contentUrl: oldLessonForClaim.storage_key,
                  storageProvider: oldLessonForClaim.storage_provider, storageBucket: oldLessonForClaim.storage_bucket,
                  storageKey: oldLessonForClaim.storage_key, mimeType: oldLessonForClaim.mime_type,
                  sizeBytes: Number(oldLessonForClaim.size_bytes), checksumSha256: oldLessonForClaim.checksum_sha256,
                  mediaStatus: oldLessonForClaim.media_status || 'PENDING_AUDIT' };
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
                  if (
                    oldLesson
                    && oldLesson.storage_key
                    && ['r2', 'supabase'].includes(oldLesson.storage_provider)
                    && oldLesson.storage_key !== meta.storageKey
                  ) {
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

                  if (['video', 'youtube'].includes(meta.contentType) && meta.contentUrl
                    && (oldLesson?.content_type !== meta.contentType || oldLesson?.content_url !== meta.contentUrl)) {
                    subtitleLessonIds.push(lesId);
                  }
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
                if (['video', 'youtube'].includes(meta.contentType) && meta.contentUrl) subtitleLessonIds.push(lesId);
              }
              currentLessonIds.push(lesId);
              await this._syncLessonQuiz(client, courseId, lesId, les);
            }
          }

          // Thu thập và xóa các bài học bị gỡ bỏ khỏi section
          if (isExistingSection) {
            const removedLessonsRes = await client.query(
              'SELECT lesson_id FROM lessons WHERE section_id = $1 AND NOT (lesson_id = ANY($2::int[]))',
              [secId, currentLessonIds.length > 0 ? currentLessonIds : [-1]]
            );
            for (const row of removedLessonsRes.rows) {
              assetsToCleanup.push(...await orphanCleanupService.collectAssetsFromLesson(row.lesson_id, client));
            }

            await client.query(
              'DELETE FROM lessons WHERE section_id = $1 AND NOT (lesson_id = ANY($2::int[]))',
              [secId, currentLessonIds.length > 0 ? currentLessonIds : [-1]]
            );
          }
        }

        // Thu thập và xóa các section bị gỡ bỏ khỏi khóa học
        const removedSectionsRes = await client.query(
          `SELECT section_id FROM sections
           WHERE course_id = $1 AND NOT (section_id = ANY($2::int[]))`,
          [courseId, currentSectionIds.length > 0 ? currentSectionIds : [-1]]
        );
        for (const row of removedSectionsRes.rows) {
          assetsToCleanup.push(...await orphanCleanupService.collectAssetsFromSection(row.section_id, client));
        }

        await client.query(
          'DELETE FROM sections WHERE course_id = $1 AND NOT (section_id = ANY($2::int[]))',
          [courseId, currentSectionIds.length > 0 ? currentSectionIds : [-1]]
        );
      }

      if (claimedUploadIds.length > 0) {
        await orphanCleanupService.commitPendingUploads(claimedUploadIds, client);
      }
      const resultingStatus = finalStatus === undefined ? existingCourse.status : finalStatus;
      if (resultingStatus === 'published') {
        await this._validateStoredCourseForPublish(client, courseId, {
          repairableExistingSources: existingCourse.status === 'published'
            ? repairableExistingSources
            : new Map()
        });
      }
      await client.query('COMMIT');

      for (const lessonId of lessonIdsToInvalidate) {
        lessonStreamCache.invalidateLessonStreamCache(lessonId);
      }

      await this._queueAutoSubtitles(subtitleLessonIds);

      // Khi PUBLISH: tự động chuẩn hóa toàn bộ media về Cloudflare R2 (async, best-effort)
      if (resultingStatus === 'published') {
        this._migrateCourseMediaOnPublish(courseId).catch(() => {});
      } else {
        // Nếu chỉ cập nhật (không publish), vẫn tổ chức lại thư mục R2 nếu có media mới
        this._reorganizeCourseMediaFolders(courseId).catch(() => {});
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
      handleServiceError(error, 'Lỗi cập nhật khóa học');
    } finally {
      client.release();
    }
  }

  async deleteCourse(courseId, userId, userRole = 2, canDeleteAnyCourse = false) {
    const client = await db.pool.connect();
    let assetsToCleanup = [];
    let pendingUploadsToCleanup = [];

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
        const isOwner = Number(existingCourse.instructor_id) === Number(userId);
        if (!canDeleteAnyCourse && !isOwner) {
          const isAdmin = userRole === 1 || userRole === '1';
          const error = new Error(isAdmin
            ? 'Chỉ Super Admin mới có quyền xóa khóa học của giảng viên khác.'
            : 'Bạn không có quyền xóa khóa học của giảng viên khác.');
          error.status = 403;
          error.code = isAdmin ? 'SUPER_ADMIN_REQUIRED' : 'COURSE_OWNERSHIP_REQUIRED';
          throw error;
        }
      }

      // 2. Thu thập danh sách storage keys trước khi xóa DB trong transaction
      assetsToCleanup = await orphanCleanupService.collectAssetsFromCourse(courseId, client);

      // 2b. Khóa logic các upload liên quan trước khi cascade xóa quan hệ.
      // Nếu bước này lỗi thì transaction phải rollback (fail-closed).
      pendingUploadsToCleanup = await orphanCleanupService.cleanupPendingUploadsForCourse(courseId, client);

      // 3. Xóa khóa học trong database (Cascade xóa sections, lessons, materials)
      const result = await client.query('DELETE FROM courses WHERE course_id = $1 RETURNING course_id', [courseId]);
      const deleted = result.rows.length > 0;

      await client.query('COMMIT');

      // 4. Dọn storage sau COMMIT. Pending rows là durable retry record;
      // loại key trùng khỏi danh sách thường để tránh gửi hai lệnh xóa.
      if (deleted && (pendingUploadsToCleanup.length > 0 || assetsToCleanup.length > 0)) {
        const pendingKeys = new Set(pendingUploadsToCleanup.map((item) => item.storage_key));
        const remainingAssets = assetsToCleanup.filter((item) => !pendingKeys.has(item.key));
        (async () => {
          await orphanCleanupService.cleanupPendingUploadRows(pendingUploadsToCleanup);
          await orphanCleanupService.cleanupUnreferencedAssets(remainingAssets);
        })().catch((err) => {
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

  /**
   * Giảng viên hoặc Admin gửi khóa học vào Cổng kiểm duyệt (Publishing Gate)
   */
  async submitCourseForReview(courseId, userId, userRole) {
    const cleanCourseId = parseInt(courseId, 10);
    if (!cleanCourseId) {
      const err = new Error('Mã khóa học không hợp lệ');
      err.status = 400;
      throw err;
    }

    const { rows } = await db.query(
      'SELECT course_id, instructor_id, status, course_name FROM courses WHERE course_id = $1',
      [cleanCourseId]
    );
    if (rows.length === 0) {
      const err = new Error('Không tìm thấy khóa học');
      err.status = 404;
      throw err;
    }
    const course = rows[0];

    // Chỉ Admin hoặc chính Giảng viên sở hữu khóa học mới được gửi duyệt
    if (userRole !== 1 && Number(course.instructor_id) !== Number(userId)) {
      const err = new Error('Bạn không có quyền gửi kiểm duyệt khóa học này');
      err.status = 403;
      throw err;
    }

    // Kiểm tra cấu trúc: Phải có ít nhất 1 bài học
    const lessonRes = await db.query(`
      SELECT l.lesson_id, l.title, l.content_type, l.media_status
      FROM lessons l
      JOIN sections s ON s.section_id = l.section_id
      WHERE s.course_id = $1
    `, [cleanCourseId]);

    if (lessonRes.rows.length === 0) {
      const err = new Error('Khóa học phải có ít nhất một bài học trước khi gửi kiểm duyệt.');
      err.status = 400;
      err.code = 'INVALID_COURSE_STRUCTURE';
      throw err;
    }

    // Cập nhật trạng thái sang pending_review
    await db.query(
      "UPDATE courses SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP WHERE course_id = $1",
      [cleanCourseId]
    );

    // Kích hoạt tự động xếp hàng bóc tách phụ đề và câu hỏi cho tất cả bài giảng video
    const mediaLessonIds = lessonRes.rows
      .filter(l => ['video', 'youtube'].includes(String(l.content_type).toLowerCase()))
      .map(l => Number(l.lesson_id));

    if (mediaLessonIds.length > 0) {
      this._queueAutoSubtitles(mediaLessonIds).catch(err => {
        console.warn(`[PublishingGate] Lỗi kích hoạt hàng đợi phụ đề cho course ${cleanCourseId}:`, err.message);
      });
    }

    return {
      courseId: cleanCourseId,
      status: 'pending_review',
      message: 'Khóa học đã được gửi tới Cổng kiểm duyệt. Hệ thống AI đang tự động bóc tách phụ đề và chuẩn bị câu hỏi thảo luận.',
      queuedLessonsCount: mediaLessonIds.length
    };
  }

  /**
   * Admin phê duyệt và chính thức xuất bản khóa học (Publishing Gate Approve)
   */
  async approveCourse(courseId, adminUserId) {
    const cleanCourseId = parseInt(courseId, 10);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT course_id, status, course_name, academy_roadmap FROM courses WHERE course_id = $1 FOR UPDATE',
        [cleanCourseId]
      );
      if (rows.length === 0) {
        const err = new Error('Không tìm thấy khóa học');
        err.status = 404;
        throw err;
      }
      const course = rows[0];

      // Kiểm tra lộ trình Academy bắt buộc
      if (!course.academy_roadmap) {
        const err = new Error('Khóa học cần có lộ trình Academy trước khi xuất bản.');
        err.status = 400;
        err.code = 'ACADEMY_ROADMAP_REQUIRED';
        throw err;
      }

      // Kiểm định toàn vẹn file media trên storage R2
      await this._validateStoredCourseForPublish(client, cleanCourseId);

      // Cập nhật sang published
      await client.query(
        "UPDATE courses SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE course_id = $1",
        [cleanCourseId]
      );

      await client.query('COMMIT');

      return {
        courseId: cleanCourseId,
        status: 'published',
        message: `Khóa học "${course.course_name}" đã được phê duyệt và chính thức xuất bản!`
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Admin từ chối phê duyệt khóa học (Publishing Gate Reject)
   */
  async rejectCourse(courseId, adminUserId, reason = '') {
    const cleanCourseId = parseInt(courseId, 10);
    const { rows } = await db.query(
      'SELECT course_id, status, course_name FROM courses WHERE course_id = $1',
      [cleanCourseId]
    );
    if (rows.length === 0) {
      const err = new Error('Không tìm thấy khóa học');
      err.status = 404;
      throw err;
    }
    const course = rows[0];

    await db.query(
      "UPDATE courses SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE course_id = $1",
      [cleanCourseId]
    );

    return {
      courseId: cleanCourseId,
      status: 'draft',
      message: `Khóa học "${course.course_name}" đã được chuyển về bản nháp để giảng viên hoàn thiện thêm.`,
      reason: reason || 'Cần bổ sung hoặc hoàn thiện thêm nội dung bài học.'
    };
  }

  /**
   * Lấy chi tiết toàn bộ tiến trình Transcript Automation của khóa học cho Admin Pipeline Modal
   */
  async getCourseTranscriptPipeline(courseId) {
    const cleanCourseId = parseInt(courseId, 10);
    if (!cleanCourseId) {
      const err = new Error('Mã khóa học không hợp lệ');
      err.status = 400;
      throw err;
    }

    const courseRes = await db.query(`
      SELECT c.course_id, c.course_name, c.status, c.created_at, c.updated_at,
             u.full_name AS instructor_name, u.email AS instructor_email,
             s.subject_name
      FROM courses c
      LEFT JOIN users u ON u.user_id = c.instructor_id
      LEFT JOIN subjects s ON s.subject_id = c.subject_id
      WHERE c.course_id = $1
    `, [cleanCourseId]);

    if (courseRes.rows.length === 0) {
      const err = new Error('Không tìm thấy khóa học');
      err.status = 404;
      throw err;
    }
    const course = courseRes.rows[0];

    const { rows: lessons } = await db.query(`
      SELECT 
        l.lesson_id,
        l.title AS lesson_title,
        l.content_type,
        l.content_url,
        l.storage_key,
        l.media_status,
        s.section_id,
        s.title AS section_title,
        s.order_index AS section_order,
        l.order_index AS lesson_order,
        ls.subtitle_status,
        ls.error_code,
        ls.error_message,
        ls.updated_at AS subtitle_updated_at,
        CASE
          WHEN jsonb_typeof(COALESCE(ls.cues, '[]'::jsonb)) = 'array'
          THEN jsonb_array_length(COALESCE(ls.cues, '[]'::jsonb))
          ELSE 0
        END AS cue_count,
        CASE 
          WHEN q.questions IS NOT NULL AND jsonb_typeof(q.questions) = 'array' AND jsonb_array_length(q.questions) > 0
          THEN true ELSE false 
        END AS has_suggested_questions,
        COALESCE(jsonb_array_length(q.questions), 0) AS suggested_questions_count,
        job_sub.status AS subtitle_job_status,
        job_sub.attempts AS subtitle_job_attempts,
        job_sub.max_attempts AS subtitle_job_max_attempts,
        job_sub.last_error_code AS subtitle_job_error_code,
        job_sub.last_error_message AS subtitle_job_error_message
      FROM lessons l
      JOIN sections s ON s.section_id = l.section_id
      LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
      LEFT JOIN lesson_suggested_questions q ON q.lesson_id = l.lesson_id
      LEFT JOIN background_jobs job_sub 
        ON job_sub.job_type = 'subtitle_generation' AND job_sub.dedupe_key = 'lesson:' || l.lesson_id
      WHERE s.course_id = $1
      ORDER BY s.order_index, l.order_index, l.lesson_id
    `, [cleanCourseId]);

    const totalMediaLessons = lessons.filter(l => ['video', 'youtube'].includes(String(l.content_type).toLowerCase()));
    const readyTranscripts = totalMediaLessons.filter(l => l.subtitle_status === 'ready');
    const processingTranscripts = totalMediaLessons.filter(l => ['pending', 'processing'].includes(l.subtitle_status));
    const failedTranscripts = totalMediaLessons.filter(l => l.subtitle_status === 'failed');

    const totalLessons = lessons.length;
    const mediaReadyCount = totalMediaLessons.filter(l => l.media_status === 'READY' || l.content_type === 'youtube').length;
    const questionsReadyCount = totalMediaLessons.filter(l => l.has_suggested_questions).length;

    const totalMedia = totalMediaLessons.length;
    const stage1Percent = totalMedia > 0 ? Math.round((mediaReadyCount / totalMedia) * 100) : 100;
    const stage2Percent = totalMedia > 0 ? Math.round((readyTranscripts.length / totalMedia) * 100) : 100;
    const stage3Percent = stage2Percent;
    const stage4Percent = totalMedia > 0 ? Math.round((questionsReadyCount / totalMedia) * 100) : 100;

    const overallProgress = totalMedia > 0 
      ? Math.round((stage1Percent + stage2Percent + stage3Percent + stage4Percent) / 4)
      : 100;

    return {
      course: {
        ...course,
        status_name: course.status,
        status: course.status === 'published' ? 1 : (course.status === 'pending_review' ? 'pending_review' : 0)
      },
      summary: {
        totalLessons,
        totalMediaLessons: totalMedia,
        mediaReadyCount,
        readyTranscripts: readyTranscripts.length,
        processingTranscripts: processingTranscripts.length,
        failedTranscripts: failedTranscripts.length,
        questionsReadyCount,
        overallProgress,
        isFullyReady: totalMedia === 0 || (readyTranscripts.length === totalMedia && mediaReadyCount === totalMedia),
        stages: [
          {
            stage: 1,
            id: 'media_dash',
            title: 'Media & Luồng DASH',
            description: 'Đóng gói MPD và kiểm tra file trên Cloudflare R2',
            percent: stage1Percent,
            status: stage1Percent === 100 ? 'ready' : (mediaReadyCount > 0 ? 'processing' : 'pending')
          },
          {
            stage: 2,
            id: 'ai_transcription',
            title: 'AI Speech-to-Text & Phụ đề song ngữ',
            description: 'Gemini 3.7 Flash bóc tách Audio và dịch Anh - Việt chuẩn mili-giây',
            percent: stage2Percent,
            status: stage2Percent === 100 ? 'ready' : (processingTranscripts.length > 0 ? 'processing' : (failedTranscripts.length > 0 ? 'failed' : 'pending'))
          },
          {
            stage: 3,
            id: 'rag_ingestion',
            title: 'Nạp Cơ sở tri thức Vector RAG',
            description: 'Lưu ngữ cảnh bài học phục vụ AI Chatbot hỏi đáp tức thời',
            percent: stage3Percent,
            status: stage3Percent === 100 ? 'ready' : (stage2Percent > 0 ? 'processing' : 'pending')
          },
          {
            stage: 4,
            id: 'suggested_questions',
            title: 'Bộ câu hỏi thảo luận gợi ý',
            description: 'AI tạo 4 câu hỏi thảo luận sư phạm bám sát nội dung video',
            percent: stage4Percent,
            status: stage4Percent === 100 ? 'ready' : (questionsReadyCount > 0 ? 'processing' : 'pending')
          }
        ]
      },
      lessons
    };
  }
}

module.exports = new CoursesService();
