/**
 * Instructor Controller - Tiếp nhận và phản hồi các request quản lý của giảng viên
 */

const instructorService = require('../services/instructor.service');

exports.getStudents = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const students = await instructorService.getStudents(instructorId);
    
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách học viên thành công',
      data: students
    });
  } catch (error) {
    next(error);
  }
};

exports.getPerformance = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const performanceData = await instructorService.getPerformance(instructorId);
    
    res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu hiệu suất thành công',
      data: performanceData
    });
  } catch (error) {
    next(error);
  }
};
