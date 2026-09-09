const db = require('../../../config/database');
const coursesService = require('../../courses/services/courses.service');

const DISCUSSION_STATUSES = new Set(['pending', 'answered', 'resolved']);

const createError = (message, status = 400, code = 'DISCUSSION_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const positiveInteger = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createError(`${fieldName} không hợp lệ`, 400, 'VALIDATION_ERROR');
  }
  return parsed;
};

const cleanText = (value, fieldName, maxLength, { minLength = 1, optional = false } = {}) => {
  if ((value === undefined || value === null) && optional) return null;
  const cleaned = String(value || '').trim();
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    throw createError(
      `${fieldName} phải có từ ${minLength} đến ${maxLength} ký tự`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return cleaned;
};

const roleIdOf = user => Number.parseInt(user?.roleId ?? user?.role_id, 10);

const formatTimestamp = seconds => {
  if (seconds === null || seconds === undefined) return null;
  const safeSeconds = Math.max(0, Number.parseInt(seconds, 10) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

const mapReply = row => ({
  id: row.reply_id,
  author: {
    id: row.author_id,
    name: row.author_name,
    avatar: row.author_avatar || null,
    role: Number(row.author_role_id) === 3 ? 'student' : 'instructor',
    title: Number(row.author_role_id) === 3 ? null : 'Giảng viên phụ trách'
  },
  content: row.content,
  aiResponse: row.ai_response || null,
  timestampSeconds: row.video_timestamp_seconds,
  timestampFormatted: formatTimestamp(row.video_timestamp_seconds),
  createdAt: row.created_at,
  isInstructor: Number(row.author_role_id) !== 3
});

const mapDiscussion = row => ({
  id: row.discussion_id,
  courseId: row.course_id,
  courseName: row.course_name,
  lessonId: row.lesson_id,
  lessonTitle: row.lesson_title,
  timestampSeconds: row.video_timestamp_seconds,
  timestampFormatted: formatTimestamp(row.video_timestamp_seconds),
  student: {
    id: row.student_id,
    name: row.student_name,
    avatar: row.student_avatar || null,
    role: 'student'
  },
  instructor: {
    id: row.instructor_id,
    name: row.instructor_name,
    avatar: row.instructor_avatar || null,
    role: 'instructor'
  },
  title: row.title,
  content: row.content,
  aiResponse: row.ai_response || null,
  status: row.status,
  unread: Boolean(row.unread),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastActivityAt: row.last_activity_at,
  replies: []
});

const mapAnnouncement = row => ({
  id: row.announcement_id,
  courseId: row.course_id,
  courseName: row.course_name,
  instructorName: row.instructor_name,
  instructorAvatar: row.instructor_avatar || null,
  title: row.title,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  viewsCount: Number.parseInt(row.views_count || 0, 10),
  isRead: Boolean(row.is_read)
});

class DiscussionsService {
  async getLessonContext(lessonId) {
    const result = await db.query(`
      SELECT l.lesson_id, l.title AS lesson_title, c.course_id, c.course_name,
             c.instructor_id, c.status AS course_status, c.price
      FROM lessons l
      JOIN sections s ON s.section_id = l.section_id
      JOIN courses c ON c.course_id = s.course_id
      WHERE l.lesson_id = $1
    `, [lessonId]);

    if (result.rows.length === 0) {
      throw createError('Bài học không tồn tại', 404, 'LESSON_NOT_FOUND');
    }
    return result.rows[0];
  }

  async assertStudentLessonAccess(user, lessonId) {
    if (roleIdOf(user) !== 3) {
      throw createError('Chỉ học viên mới có thể gửi câu hỏi cho giảng viên', 403, 'STUDENT_ONLY');
    }

    const context = await this.getLessonContext(lessonId);
    const canAccess = await coursesService.canUserAccessLesson(user.id, lessonId, user.roleId);
    if (!canAccess) {
      throw createError('Bạn chưa có quyền truy cập khóa học này', 403, 'COURSE_ACCESS_DENIED');
    }
    return context;
  }

  async getThreadAccess(discussionId, user) {
    const result = await db.query(`
      SELECT d.*, c.instructor_id
      FROM course_discussions d
      JOIN courses c ON c.course_id = d.course_id
      WHERE d.discussion_id = $1
    `, [discussionId]);

    if (result.rows.length === 0) {
      throw createError('Cuộc trao đổi không tồn tại', 404, 'DISCUSSION_NOT_FOUND');
    }

    const thread = result.rows[0];
    const roleId = roleIdOf(user);
    const allowed = roleId === 1
      || (roleId === 2 && Number(thread.instructor_id) === Number(user.id))
      || (roleId === 3 && Number(thread.student_id) === Number(user.id));

    if (!allowed) {
      throw createError('Bạn không có quyền truy cập cuộc trao đổi này', 403, 'DISCUSSION_ACCESS_DENIED');
    }
    return thread;
  }

  async hydrateReplies(discussions) {
    if (discussions.length === 0) return discussions;
    const ids = discussions.map(item => item.id);
    const repliesResult = await db.query(`
      SELECT r.reply_id, r.discussion_id, r.author_id, r.content, r.created_at,
             r.ai_response, r.video_timestamp_seconds,
             u.full_name AS author_name, u.profile_picture_url AS author_avatar,
             u.role_id AS author_role_id
      FROM course_discussion_replies r
      JOIN users u ON u.user_id = r.author_id
      WHERE r.discussion_id = ANY($1::bigint[])
      ORDER BY r.created_at ASC, r.reply_id ASC
    `, [ids]);

    const byDiscussion = new Map();
    for (const row of repliesResult.rows) {
      const key = String(row.discussion_id);
      if (!byDiscussion.has(key)) byDiscussion.set(key, []);
      byDiscussion.get(key).push(mapReply(row));
    }
    for (const discussion of discussions) {
      discussion.replies = byDiscussion.get(String(discussion.id)) || [];
    }
    return discussions;
  }

  async listStudentDiscussions(user, lessonId) {
    const context = await this.assertStudentLessonAccess(user, lessonId);
    const result = await db.query(`
      SELECT d.*, c.course_name, l.title AS lesson_title,
             student.full_name AS student_name,
             student.profile_picture_url AS student_avatar,
             instructor.user_id AS instructor_id,
             instructor.full_name AS instructor_name,
             instructor.profile_picture_url AS instructor_avatar,
             d.student_unread AS unread
      FROM course_discussions d
      JOIN courses c ON c.course_id = d.course_id
      JOIN lessons l ON l.lesson_id = d.lesson_id
      JOIN users student ON student.user_id = d.student_id
      JOIN users instructor ON instructor.user_id = c.instructor_id
      WHERE d.student_id = $1 AND d.course_id = $2 AND d.lesson_id = $3
      ORDER BY d.last_activity_at DESC
      LIMIT 100
    `, [user.id, context.course_id, lessonId]);

    const discussions = await this.hydrateReplies(result.rows.map(mapDiscussion));
    const announcements = await this.listCourseAnnouncements(context.course_id, user.id);
    return {
      courseId: context.course_id,
      instructor: discussions[0]?.instructor || await this.getCourseInstructor(context.course_id),
      discussions,
      announcements,
      unreadCount: discussions.filter(item => item.unread).length
    };
  }

  async getCourseInstructor(courseId) {
    const result = await db.query(`
      SELECT u.user_id AS id, u.full_name AS name, u.profile_picture_url AS avatar
      FROM courses c
      JOIN users u ON u.user_id = c.instructor_id
      WHERE c.course_id = $1
    `, [courseId]);
    return result.rows[0] || null;
  }

  async createDiscussion(user, payload) {
    const lessonId = positiveInteger(payload.lessonId, 'lessonId');
    const title = cleanText(payload.title, 'Tiêu đề', 180, { minLength: 3 });
    const content = cleanText(payload.content, 'Nội dung', 5000, { minLength: 1 });
    const aiResponse = cleanText(payload.aiResponse, 'Phản hồi AI', 12000, { optional: true });
    const context = await this.assertStudentLessonAccess(user, lessonId);

    let timestampSeconds = null;
    if (payload.timestampSeconds !== undefined && payload.timestampSeconds !== null) {
      timestampSeconds = Number.parseInt(payload.timestampSeconds, 10);
      if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds < 0) {
        throw createError('Mốc thời gian video không hợp lệ', 400, 'VALIDATION_ERROR');
      }
    }

    const result = await db.query(`
      INSERT INTO course_discussions (
        course_id, lesson_id, student_id, title, content, ai_response,
        video_timestamp_seconds, status, student_unread, instructor_unread
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', FALSE, TRUE)
      RETURNING discussion_id
    `, [context.course_id, lessonId, user.id, title, content, aiResponse, timestampSeconds]);

    return this.getDiscussion(result.rows[0].discussion_id, user);
  }

  /**
   * Gửi một tin nhắn theo kiểu direct message. Backend tự tìm cuộc trao đổi đang mở
   * của đúng học viên + bài học; client không được tự chọn thread của người khác.
   */
  async sendStudentMessage(user, payload) {
    const lessonId = positiveInteger(payload.lessonId, 'lessonId');
    const content = cleanText(payload.content, 'Nội dung tin nhắn', 5000);
    const aiResponse = cleanText(payload.aiResponse, 'Phản hồi AI', 12000, { optional: true });
    const context = await this.assertStudentLessonAccess(user, lessonId);

    let timestampSeconds = null;
    if (payload.timestampSeconds !== undefined && payload.timestampSeconds !== null) {
      timestampSeconds = Number.parseInt(payload.timestampSeconds, 10);
      if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds < 0) {
        throw createError('Mốc thời gian video không hợp lệ', 400, 'VALIDATION_ERROR');
      }
    }

    const compactTitle = content.replace(/\s+/g, ' ').slice(0, 180);
    const title = compactTitle.length >= 3 ? compactTitle : `Tin nhắn: ${compactTitle}`;
    const client = await db.getClient();
    let discussionId;

    try {
      await client.query('BEGIN');
      // Chặn hai request gửi đầu tiên đồng thời tạo ra hai thread cho cùng bài học.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`course-chat:${context.course_id}:lesson:${lessonId}:student:${user.id}`]
      );

      const activeThread = await client.query(`
        SELECT discussion_id
        FROM course_discussions
        WHERE course_id = $1
          AND lesson_id = $2
          AND student_id = $3
          AND status <> 'resolved'
        ORDER BY last_activity_at DESC, discussion_id DESC
        LIMIT 1
        FOR UPDATE
      `, [context.course_id, lessonId, user.id]);

      if (activeThread.rows.length > 0) {
        discussionId = activeThread.rows[0].discussion_id;
        await client.query(`
          INSERT INTO course_discussion_replies (
            discussion_id, author_id, content, ai_response, video_timestamp_seconds
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [discussionId, user.id, content, aiResponse, timestampSeconds]);
        await client.query(`
          UPDATE course_discussions
          SET status = 'pending',
              student_unread = FALSE,
              instructor_unread = TRUE,
              updated_at = CURRENT_TIMESTAMP,
              last_activity_at = CURRENT_TIMESTAMP
          WHERE discussion_id = $1
        `, [discussionId]);
      } else {
        const created = await client.query(`
          INSERT INTO course_discussions (
            course_id, lesson_id, student_id, title, content, ai_response,
            video_timestamp_seconds, status, student_unread, instructor_unread
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', FALSE, TRUE)
          RETURNING discussion_id
        `, [context.course_id, lessonId, user.id, title, content, aiResponse, timestampSeconds]);
        discussionId = created.rows[0].discussion_id;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getDiscussion(discussionId, user);
  }

  async getDiscussion(discussionId, user) {
    await this.getThreadAccess(discussionId, user);
    const unreadColumn = roleIdOf(user) === 3 ? 'd.student_unread' : 'd.instructor_unread';
    const result = await db.query(`
      SELECT d.*, c.course_name, l.title AS lesson_title,
             student.full_name AS student_name,
             student.profile_picture_url AS student_avatar,
             instructor.user_id AS instructor_id,
             instructor.full_name AS instructor_name,
             instructor.profile_picture_url AS instructor_avatar,
             ${unreadColumn} AS unread
      FROM course_discussions d
      JOIN courses c ON c.course_id = d.course_id
      JOIN lessons l ON l.lesson_id = d.lesson_id
      JOIN users student ON student.user_id = d.student_id
      JOIN users instructor ON instructor.user_id = c.instructor_id
      WHERE d.discussion_id = $1
    `, [discussionId]);
    return (await this.hydrateReplies(result.rows.map(mapDiscussion)))[0];
  }

  async addReply(user, discussionIdValue, contentValue, metadata = {}) {
    const discussionId = positiveInteger(discussionIdValue, 'discussionId');
    const content = cleanText(contentValue, 'Nội dung phản hồi', 5000);
    await this.getThreadAccess(discussionId, user);
    const isStudent = roleIdOf(user) === 3;
    const aiResponse = cleanText(metadata.aiResponse, 'Phản hồi AI', 12000, { optional: true });
    let timestampSeconds = null;
    if (metadata.timestampSeconds !== undefined && metadata.timestampSeconds !== null) {
      timestampSeconds = Number.parseInt(metadata.timestampSeconds, 10);
      if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds < 0) {
        throw createError('Mốc thời gian video không hợp lệ', 400, 'VALIDATION_ERROR');
      }
    }
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO course_discussion_replies (
          discussion_id, author_id, content, ai_response, video_timestamp_seconds
        )
        VALUES ($1, $2, $3, $4, $5)
      `, [discussionId, user.id, content, aiResponse, timestampSeconds]);
      await client.query(`
        UPDATE course_discussions
        SET status = $2,
            student_unread = $3,
            instructor_unread = $4,
            updated_at = CURRENT_TIMESTAMP,
            last_activity_at = CURRENT_TIMESTAMP
        WHERE discussion_id = $1
      `, [discussionId, isStudent ? 'pending' : 'answered', !isStudent, isStudent]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getDiscussion(discussionId, user);
  }

  async updateStatus(user, discussionIdValue, requestedStatus) {
    const discussionId = positiveInteger(discussionIdValue, 'discussionId');
    if (!DISCUSSION_STATUSES.has(requestedStatus)) {
      throw createError('Trạng thái cuộc trao đổi không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    const thread = await this.getThreadAccess(discussionId, user);

    let nextStatus = requestedStatus;
    if (requestedStatus !== 'resolved') {
      const instructorReply = await db.query(`
        SELECT 1
        FROM course_discussion_replies r
        JOIN users u ON u.user_id = r.author_id
        WHERE r.discussion_id = $1 AND u.role_id IN (1, 2)
        LIMIT 1
      `, [discussionId]);
      nextStatus = instructorReply.rows.length > 0 ? 'answered' : 'pending';
    }

    if (roleIdOf(user) === 3 && thread.status !== 'resolved' && nextStatus !== 'resolved') {
      throw createError('Học viên chỉ có thể đánh dấu câu hỏi đã giải đáp hoặc mở lại câu hỏi', 403, 'STATUS_CHANGE_DENIED');
    }

    await db.query(`
      UPDATE course_discussions
      SET status = $2, updated_at = CURRENT_TIMESTAMP, last_activity_at = CURRENT_TIMESTAMP
      WHERE discussion_id = $1
    `, [discussionId, nextStatus]);
    return this.getDiscussion(discussionId, user);
  }

  async markDiscussionRead(user, discussionIdValue) {
    const discussionId = positiveInteger(discussionIdValue, 'discussionId');
    await this.getThreadAccess(discussionId, user);
    const column = roleIdOf(user) === 3 ? 'student_unread' : 'instructor_unread';
    await db.query(`UPDATE course_discussions SET ${column} = FALSE WHERE discussion_id = $1`, [discussionId]);
    return { discussionId, unread: false };
  }

  async listInstructorDiscussions(user, filters = {}) {
    const roleId = roleIdOf(user);
    if (![1, 2].includes(roleId)) {
      throw createError('Chỉ giảng viên mới có thể xem hộp thư hỗ trợ', 403, 'INSTRUCTOR_ONLY');
    }

    const params = [];
    const where = [];
    if (roleId === 2) {
      params.push(user.id);
      where.push(`c.instructor_id = $${params.length}`);
    }
    if (filters.courseId && filters.courseId !== 'all') {
      params.push(positiveInteger(filters.courseId, 'courseId'));
      where.push(`d.course_id = $${params.length}`);
    }
    if (filters.status && filters.status !== 'all') {
      if (!DISCUSSION_STATUSES.has(filters.status)) {
        throw createError('Bộ lọc trạng thái không hợp lệ', 400, 'VALIDATION_ERROR');
      }
      params.push(filters.status);
      where.push(`d.status = $${params.length}`);
    }
    if (filters.search) {
      const search = cleanText(filters.search, 'Từ khóa', 100, { minLength: 1 });
      params.push(`%${search}%`);
      where.push(`(d.title ILIKE $${params.length} OR d.content ILIKE $${params.length} OR student.full_name ILIKE $${params.length})`);
    }

    const result = await db.query(`
      SELECT d.*, c.course_name, l.title AS lesson_title,
             student.full_name AS student_name,
             student.profile_picture_url AS student_avatar,
             instructor.user_id AS instructor_id,
             instructor.full_name AS instructor_name,
             instructor.profile_picture_url AS instructor_avatar,
             d.instructor_unread AS unread
      FROM course_discussions d
      JOIN courses c ON c.course_id = d.course_id
      JOIN lessons l ON l.lesson_id = d.lesson_id
      JOIN users student ON student.user_id = d.student_id
      JOIN users instructor ON instructor.user_id = c.instructor_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY (d.status = 'pending') DESC, d.instructor_unread DESC, d.last_activity_at DESC
      LIMIT 200
    `, params);

    return this.hydrateReplies(result.rows.map(mapDiscussion));
  }

  async getInstructorSummary(user) {
    const roleId = roleIdOf(user);
    if (![1, 2].includes(roleId)) {
      throw createError('Chỉ giảng viên mới có thể xem thống kê tương tác', 403, 'INSTRUCTOR_ONLY');
    }
    const params = roleId === 2 ? [user.id] : [];
    const ownerFilter = roleId === 2 ? 'WHERE c.instructor_id = $1' : '';
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE d.status = 'pending')::int AS pending_count,
        COUNT(*) FILTER (WHERE d.instructor_unread = TRUE)::int AS unread_count,
        COUNT(*)::int AS total_count
      FROM course_discussions d
      JOIN courses c ON c.course_id = d.course_id
      ${ownerFilter}
    `, params);
    return {
      pendingCount: Number(result.rows[0]?.pending_count || 0),
      unreadCount: Number(result.rows[0]?.unread_count || 0),
      totalCount: Number(result.rows[0]?.total_count || 0)
    };
  }

  async listCourseAnnouncements(courseId, currentUserId = null) {
    const result = await db.query(`
      SELECT a.*, c.course_name, u.full_name AS instructor_name,
             u.profile_picture_url AS instructor_avatar,
             COUNT(ar.user_id)::int AS views_count,
             BOOL_OR(ar.user_id = $2) AS is_read
      FROM course_announcements a
      JOIN courses c ON c.course_id = a.course_id
      JOIN users u ON u.user_id = a.instructor_id
      LEFT JOIN course_announcement_reads ar ON ar.announcement_id = a.announcement_id
      WHERE a.course_id = $1
      GROUP BY a.announcement_id, c.course_name, u.full_name, u.profile_picture_url
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [courseId, currentUserId || 0]);
    return result.rows.map(mapAnnouncement);
  }

  async listInstructorAnnouncements(user) {
    const roleId = roleIdOf(user);
    if (![1, 2].includes(roleId)) {
      throw createError('Chỉ giảng viên mới có thể quản lý thông báo', 403, 'INSTRUCTOR_ONLY');
    }
    const params = roleId === 2 ? [user.id] : [];
    const ownerFilter = roleId === 2 ? 'WHERE c.instructor_id = $1' : '';
    const result = await db.query(`
      SELECT a.*, c.course_name, u.full_name AS instructor_name,
             u.profile_picture_url AS instructor_avatar,
             COUNT(ar.user_id)::int AS views_count,
             FALSE AS is_read
      FROM course_announcements a
      JOIN courses c ON c.course_id = a.course_id
      JOIN users u ON u.user_id = a.instructor_id
      LEFT JOIN course_announcement_reads ar ON ar.announcement_id = a.announcement_id
      ${ownerFilter}
      GROUP BY a.announcement_id, c.course_name, u.full_name, u.profile_picture_url
      ORDER BY a.created_at DESC
      LIMIT 200
    `, params);
    return result.rows.map(mapAnnouncement);
  }

  async createAnnouncement(user, payload) {
    const roleId = roleIdOf(user);
    if (![1, 2].includes(roleId)) {
      throw createError('Chỉ giảng viên mới có thể tạo thông báo', 403, 'INSTRUCTOR_ONLY');
    }
    const courseId = positiveInteger(payload.courseId, 'courseId');
    const title = cleanText(payload.title, 'Tiêu đề', 180, { minLength: 3 });
    const content = cleanText(payload.content, 'Nội dung', 10000);
    const courseResult = await db.query('SELECT course_id, instructor_id FROM courses WHERE course_id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      throw createError('Khóa học không tồn tại', 404, 'COURSE_NOT_FOUND');
    }
    if (roleId === 2 && Number(courseResult.rows[0].instructor_id) !== Number(user.id)) {
      throw createError('Bạn không thể gửi thông báo cho khóa học của giảng viên khác', 403, 'COURSE_ACCESS_DENIED');
    }

    const result = await db.query(`
      INSERT INTO course_announcements (course_id, instructor_id, title, content)
      VALUES ($1, $2, $3, $4)
      RETURNING announcement_id
    `, [courseId, user.id, title, content]);
    const announcements = await this.listInstructorAnnouncements(user);
    return announcements.find(item => Number(item.id) === Number(result.rows[0].announcement_id));
  }

  async markAnnouncementRead(user, announcementIdValue) {
    if (roleIdOf(user) !== 3) {
      throw createError('Chỉ học viên mới đánh dấu thông báo đã đọc', 403, 'STUDENT_ONLY');
    }
    const announcementId = positiveInteger(announcementIdValue, 'announcementId');
    const result = await db.query(`
      SELECT a.course_id,
             (SELECT l.lesson_id FROM lessons l JOIN sections s ON s.section_id = l.section_id
              WHERE s.course_id = a.course_id ORDER BY l.lesson_id LIMIT 1) AS lesson_id
      FROM course_announcements a
      WHERE a.announcement_id = $1
    `, [announcementId]);
    if (result.rows.length === 0) {
      throw createError('Thông báo không tồn tại', 404, 'ANNOUNCEMENT_NOT_FOUND');
    }
    const lessonId = result.rows[0].lesson_id;
    if (!lessonId || !(await coursesService.canUserAccessLesson(user.id, lessonId, user.roleId))) {
      throw createError('Bạn không có quyền đọc thông báo này', 403, 'COURSE_ACCESS_DENIED');
    }

    await db.query(`
      INSERT INTO course_announcement_reads (announcement_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (announcement_id, user_id) DO NOTHING
    `, [announcementId, user.id]);
    return { announcementId, isRead: true };
  }
}

module.exports = new DiscussionsService();
module.exports._private = {
  cleanText,
  createError,
  formatTimestamp,
  mapAnnouncement,
  mapDiscussion,
  mapReply,
  positiveInteger,
  roleIdOf
};
