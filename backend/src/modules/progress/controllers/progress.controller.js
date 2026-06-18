/**
 * Progress Controller - Điều phối HTTP request về tiến trình học tập
 */

const progressService = require('../services/progress.service');

exports.getProgressByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const progress = await progressService.getProgressByUserId(userId);
    
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
    const userId = req.body.userId || req.body.user_id;
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
