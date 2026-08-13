/**
 * Comments Controller - Điều phối HTTP requests liên quan đến bình luận bài học
 */

const commentsService = require('../services/comments.service');

/**
 * Lấy danh sách bình luận của bài học (Threaded Comments)
 */
exports.getCommentsByLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const currentUserId = req.user?.id;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'lessonId không hợp lệ'
      });
    }

    const comments = await commentsService.getCommentsByLesson(parseInt(lessonId, 10), currentUserId);

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách bình luận thành công',
      comments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gửi bình luận mới hoặc phản hồi bình luận khác
 */
exports.createComment = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user.id;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'lessonId không hợp lệ'
      });
    }

    if (!content || String(content).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận không được để trống'
      });
    }

    const comment = await commentsService.createComment(
      userId,
      parseInt(lessonId, 10),
      content.trim(),
      parentId ? parseInt(parentId, 10) : null
    );

    res.status(201).json({
      success: true,
      message: 'Đăng bình luận thành công',
      comment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Chỉnh sửa bình luận
 */
exports.updateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'commentId không hợp lệ'
      });
    }

    if (!content || String(content).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận không được để trống'
      });
    }

    const comment = await commentsService.updateComment(
      parseInt(commentId, 10),
      userId,
      content.trim()
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật bình luận thành công',
      comment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa bình luận
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRoleId = req.user.roleId;

    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'commentId không hợp lệ'
      });
    }

    const result = await commentsService.deleteComment(
      parseInt(commentId, 10),
      userId,
      userRoleId
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Thả tim / Upvote bình luận
 */
exports.toggleUpvote = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'commentId không hợp lệ'
      });
    }

    const result = await commentsService.toggleUpvote(parseInt(commentId, 10), userId);

    res.status(200).json({
      success: true,
      message: result.upvoted ? 'Đã upvote bình luận' : 'Đã bỏ upvote bình luận',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ghim bình luận
 */
exports.togglePin = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRoleId = req.user.roleId;

    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'commentId không hợp lệ'
      });
    }

    const result = await commentsService.togglePin(
      parseInt(commentId, 10),
      userId,
      userRoleId
    );

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};
