/**
 * Comments Service - Nghiệp vụ quản lý bình luận, thảo luận bài học
 */

const db = require('../../../config/database');

class CommentsService {
  /**
   * Lấy bình luận của bài học dưới dạng cây phân luồng (Threaded Comments)
   * @param {number} lessonId - ID của bài học
   * @param {number} currentUserId - ID người dùng hiện tại (để kiểm tra trạng thái upvote)
   */
  async getCommentsByLesson(lessonId, currentUserId) {
    // Kiểm tra bài học tồn tại
    const lessonCheck = await db.query('SELECT 1 FROM lessons WHERE lesson_id = $1', [lessonId]);
    if (lessonCheck.rows.length === 0) {
      const error = new Error('Bài học không tồn tại');
      error.status = 404;
      throw error;
    }

    const queryText = `
      SELECT 
        c.comment_id,
        c.lesson_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.is_pinned,
        c.created_at,
        c.updated_at,
        u.full_name AS user_full_name,
        u.profile_picture_url AS user_avatar,
        r.role_name AS user_role,
        r.role_id AS user_role_id,
        parent_u.user_id AS reply_to_user_id,
        parent_u.full_name AS reply_to_user_name,
        (SELECT COUNT(*)::int FROM comment_upvotes WHERE comment_id = c.comment_id) AS upvotes_count,
        EXISTS(SELECT 1 FROM comment_upvotes WHERE comment_id = c.comment_id AND user_id = $2) AS is_upvoted
      FROM lesson_comments c
      JOIN users u ON c.user_id = u.user_id
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN lesson_comments parent_c ON c.parent_id = parent_c.comment_id
      LEFT JOIN users parent_u ON parent_c.user_id = parent_u.user_id
      WHERE c.lesson_id = $1
      ORDER BY c.created_at ASC;
    `;

    const result = await db.query(queryText, [lessonId, currentUserId || 0]);
    const comments = result.rows;

    // Xây dựng cấu trúc cây (Threaded)
    const commentMap = {};
    const rootComments = [];

    // Khởi tạo map và thêm trường replies
    comments.forEach(comment => {
      comment.replies = [];
      commentMap[comment.comment_id] = comment;
    });

    // Gom nhóm replies và roots
    comments.forEach(comment => {
      if (comment.parent_id) {
        const parent = commentMap[comment.parent_id];
        if (parent) {
          parent.replies.push(comment);
        } else {
          // Nếu parent_id không tồn tại trong map (phòng hờ dữ liệu lỗi), coi như root
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    // Sắp xếp các bình luận gốc (roots): ghim lên đầu, tiếp theo là mới nhất ở trên
    rootComments.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return rootComments;
  }

  /**
   * Tạo bình luận mới hoặc phản hồi bình luận
   */
  async createComment(userId, lessonId, content, parentId = null) {
    // 1. Kiểm tra bài học tồn tại
    const lessonCheck = await db.query('SELECT 1 FROM lessons WHERE lesson_id = $1', [lessonId]);
    if (lessonCheck.rows.length === 0) {
      const error = new Error('Bài học không tồn tại');
      error.status = 404;
      throw error;
    }

    // 2. Nếu là phản hồi (reply), kiểm tra bình luận cha tồn tại và thuộc cùng lesson
    if (parentId) {
      const parentCheck = await db.query(
        'SELECT lesson_id FROM lesson_comments WHERE comment_id = $1', 
        [parentId]
      );
      if (parentCheck.rows.length === 0) {
        const error = new Error('Bình luận phản hồi không tồn tại');
        error.status = 400;
        throw error;
      }
      if (parentCheck.rows[0].lesson_id !== parseInt(lessonId, 10)) {
        const error = new Error('Bình luận phản hồi phải thuộc cùng bài học');
        error.status = 400;
        throw error;
      }
    }

    // 3. Thêm bình luận mới
    const insertQuery = `
      INSERT INTO lesson_comments (user_id, lesson_id, content, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING comment_id;
    `;
    const insertResult = await db.query(insertQuery, [userId, lessonId, content, parentId]);
    const newCommentId = insertResult.rows[0].comment_id;

    // 4. Lấy lại thông tin đầy đủ của bình luận vừa tạo để trả về
    const fetchQuery = `
      SELECT 
        c.comment_id,
        c.lesson_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.is_pinned,
        c.created_at,
        c.updated_at,
        u.full_name AS user_full_name,
        u.profile_picture_url AS user_avatar,
        r.role_name AS user_role,
        r.role_id AS user_role_id,
        parent_u.user_id AS reply_to_user_id,
        parent_u.full_name AS reply_to_user_name,
        0 AS upvotes_count,
        false AS is_upvoted,
        CAST('[]' AS JSON) AS replies
      FROM lesson_comments c
      JOIN users u ON c.user_id = u.user_id
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN lesson_comments parent_c ON c.parent_id = parent_c.comment_id
      LEFT JOIN users parent_u ON parent_c.user_id = parent_u.user_id
      WHERE c.comment_id = $1;
    `;
    const fetchResult = await db.query(fetchQuery, [newCommentId]);
    return fetchResult.rows[0];
  }

  /**
   * Cập nhật nội dung bình luận
   */
  async updateComment(commentId, userId, content) {
    const commentCheck = await db.query('SELECT user_id FROM lesson_comments WHERE comment_id = $1', [commentId]);
    if (commentCheck.rows.length === 0) {
      const error = new Error('Bình luận không tồn tại');
      error.status = 404;
      throw error;
    }

    if (commentCheck.rows[0].user_id !== userId) {
      const error = new Error('Bạn không có quyền chỉnh sửa bình luận này');
      error.status = 403;
      throw error;
    }

    const updateQuery = `
      UPDATE lesson_comments
      SET content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE comment_id = $2
      RETURNING *;
    `;
    const result = await db.query(updateQuery, [content, commentId]);
    return result.rows[0];
  }

  /**
   * Xóa bình luận
   */
  async deleteComment(commentId, userId, userRoleId) {
    const queryCheck = `
      SELECT 
        lc.user_id AS comment_owner_id,
        c.instructor_id AS course_instructor_id
      FROM lesson_comments lc
      JOIN lessons l ON lc.lesson_id = l.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE lc.comment_id = $1;
    `;
    const checkResult = await db.query(queryCheck, [commentId]);
    if (checkResult.rows.length === 0) {
      const error = new Error('Bình luận không tồn tại');
      error.status = 404;
      throw error;
    }

    const { comment_owner_id, course_instructor_id } = checkResult.rows[0];

    // Quyền xóa: Chủ nhân bình luận, Admin (role_id = 1), hoặc Giảng viên của khóa học (course_instructor_id)
    const isAdmin = userRoleId === 1;
    const isInstructor = userRoleId === 2 && course_instructor_id === userId;
    const isOwner = comment_owner_id === userId;

    if (!isAdmin && !isInstructor && !isOwner) {
      const error = new Error('Bạn không có quyền xóa bình luận này');
      error.status = 403;
      throw error;
    }

    await db.query('DELETE FROM lesson_comments WHERE comment_id = $1', [commentId]);
    return { success: true, message: 'Xóa bình luận thành công' };
  }

  /**
   * Thả tim / Upvote bình luận (Toggle upvote)
   */
  async toggleUpvote(commentId, userId) {
    // Kiểm tra bình luận tồn tại
    const commentCheck = await db.query('SELECT 1 FROM lesson_comments WHERE comment_id = $1', [commentId]);
    if (commentCheck.rows.length === 0) {
      const error = new Error('Bình luận không tồn tại');
      error.status = 404;
      throw error;
    }

    // Kiểm tra xem đã upvote chưa
    const upvoteCheck = await db.query(
      'SELECT 1 FROM comment_upvotes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    let isUpvotedNow = false;
    if (upvoteCheck.rows.length > 0) {
      // Đã upvote -> Bỏ upvote
      await db.query(
        'DELETE FROM comment_upvotes WHERE comment_id = $1 AND user_id = $2',
        [commentId, userId]
      );
    } else {
      // Chưa upvote -> Thêm upvote
      await db.query(
        'INSERT INTO comment_upvotes (comment_id, user_id) VALUES ($1, $2)',
        [commentId, userId]
      );
      isUpvotedNow = true;
    }

    // Lấy lại số lượng upvote mới nhất
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS count FROM comment_upvotes WHERE comment_id = $1',
      [commentId]
    );

    return {
      upvoted: isUpvotedNow,
      upvotesCount: countResult.rows[0].count
    };
  }

  /**
   * Ghim / Bỏ ghim bình luận
   * Chỉ có Giảng viên của khóa học hoặc Admin mới được phép ghim bình luận
   */
  async togglePin(commentId, userId, userRoleId) {
    const queryCheck = `
      SELECT 
        lc.comment_id,
        lc.is_pinned,
        c.instructor_id AS course_instructor_id
      FROM lesson_comments lc
      JOIN lessons l ON lc.lesson_id = l.lesson_id
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE lc.comment_id = $1;
    `;
    const checkResult = await db.query(queryCheck, [commentId]);
    if (checkResult.rows.length === 0) {
      const error = new Error('Bình luận không tồn tại');
      error.status = 404;
      throw error;
    }

    const { is_pinned, course_instructor_id } = checkResult.rows[0];

    // Quyền ghim: Admin (role_id = 1) hoặc Giảng viên phụ trách khóa học (course_instructor_id === userId)
    const isAdmin = userRoleId === 1;
    const isInstructor = userRoleId === 2 && course_instructor_id === userId;

    if (!isAdmin && !isInstructor) {
      const error = new Error('Bạn không có quyền ghim bình luận của bài học này');
      error.status = 403;
      throw error;
    }

    const newPinStatus = !is_pinned;
    
    // Nếu ghim, chúng ta có thể tùy ý ghim nhiều bình luận hoặc chỉ cho phép ghim 1 bình luận mỗi bài học.
    // Thông thường, chỉ nên cho phép 1 bình luận được ghim chính để hiển thị nổi bật nhất.
    // Tuy nhiên để tối đa trải nghiệm, chúng ta sẽ gỡ ghim các bình luận khác trong bài học này nếu ghim bình luận mới.
    if (newPinStatus) {
      // Lấy lessonId của bình luận này
      const lessonQuery = await db.query('SELECT lesson_id FROM lesson_comments WHERE comment_id = $1', [commentId]);
      const lessonId = lessonQuery.rows[0].lesson_id;
      
      // Gỡ ghim toàn bộ các bình luận khác của bài học này trước
      await db.query(
        'UPDATE lesson_comments SET is_pinned = FALSE WHERE lesson_id = $1 AND comment_id != $2',
        [lessonId, commentId]
      );
    }

    // Cập nhật trạng thái ghim của bình luận hiện tại
    const updateResult = await db.query(
      'UPDATE lesson_comments SET is_pinned = $1 WHERE comment_id = $2 RETURNING is_pinned',
      [newPinStatus, commentId]
    );

    return {
      isPinned: updateResult.rows[0].is_pinned,
      message: newPinStatus ? 'Ghim bình luận thành công' : 'Bỏ ghim bình luận thành công'
    };
  }
}

module.exports = new CommentsService();
