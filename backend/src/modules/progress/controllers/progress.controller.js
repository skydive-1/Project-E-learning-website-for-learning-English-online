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
    
    // Lấy isCompleted từ client, hỗ trợ cả camelCase và snake_case. Mặc định là true nếu không truyền.
    let isCompleted = req.body.isCompleted !== undefined ? req.body.isCompleted : req.body.is_completed;
    if (isCompleted === undefined) {
      isCompleted = true;
    } else {
      isCompleted = String(isCompleted).toLowerCase() === 'true' || isCompleted === true || isCompleted === 1 || isCompleted === '1';
    }

    if (!userId || !lessonId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin userId hoặc lessonId'
      });
    }

    const progress = await progressService.recordProgress(userId, lessonId, isCompleted);

    res.status(200).json({
      success: true,
      message: 'Ghi nhận tiến độ học tập thành công',
      progress
    });
  } catch (error) {
    next(error);
  }
};
