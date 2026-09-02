/**
 * Progress Controller - Điều phối HTTP request về tiến trình học tập
 */

const progressService = require('../services/progress.service');

exports.getProgressByUserId = async (req, res, next) => {
  try {
    let { userId } = req.params;
    if (userId === 'me') {
      userId = req.user.id;
    }

    // IDOR Protection: Học viên chỉ được xem tiến độ của chính mình. Admin (1) và Giảng viên (2) được xem tiến độ người khác.
    const loggedInUser = req.user;
    const targetUserId = parseInt(userId, 10);
    if (loggedInUser.id !== targetUserId && loggedInUser.roleId !== 1 && loggedInUser.roleId !== 2) {
      const error = new Error('Bạn không có quyền xem tiến trình học tập của người dùng này');
      error.status = 403;
      return next(error);
    }

    const progress = await progressService.getProgressByUserId(targetUserId);
    
    res.status(200).json({
      success: true,
      message: 'Lấy tiến trình học tập thành công',
      progress
    });
  } catch (error) {
    next(error);
  }
};

exports.recordProgress = async (req, res, next) => {
  try {
    // IDOR Protection: Học viên chỉ được ghi nhận tiến độ của bản thân.
    // Cưỡng chế userId về req.user.id đối với vai trò Học viên (Student).
    const loggedInUser = req.user;
    let userId = req.body.userId || req.body.user_id || loggedInUser.id;
    
    if (parseInt(userId, 10) !== loggedInUser.id && loggedInUser.roleId !== 1 && loggedInUser.roleId !== 2) {
      userId = loggedInUser.id;
    }

    const lessonId = req.body.lessonId || req.body.lesson_id;
    
    // Lấy isCompleted từ client, hỗ trợ cả camelCase và snake_case.
    let isCompleted = req.body.isCompleted !== undefined ? req.body.isCompleted : req.body.is_completed;
    if (isCompleted === undefined) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_COMPLETION_STATUS',
        message: 'Thiếu trạng thái isCompleted.'
      });
    }

    const normalizedCompletionStatus = String(isCompleted).toLowerCase();
    if (![true, false, 1, 0, '1', '0', 'true', 'false'].includes(isCompleted)
      && !['true', 'false', '1', '0'].includes(normalizedCompletionStatus)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_COMPLETION_STATUS',
        message: 'isCompleted phải là giá trị boolean.'
      });
    }
    isCompleted = normalizedCompletionStatus === 'true' || normalizedCompletionStatus === '1';

    const cleanUserId = parseInt(userId, 10);
    const cleanLessonId = parseInt(lessonId, 10);
    if (!Number.isInteger(cleanUserId) || cleanUserId <= 0 || !Number.isInteger(cleanLessonId) || cleanLessonId <= 0) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PROGRESS_IDENTIFIERS',
        message: 'userId và lessonId phải là số nguyên dương.'
      });
    }

    const progress = await progressService.recordProgress(cleanUserId, cleanLessonId, isCompleted);

    res.status(200).json({
      success: true,
      message: 'Ghi nhận tiến độ học tập thành công',
      progress
    });
  } catch (error) {
    next(error);
  }
};
