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
