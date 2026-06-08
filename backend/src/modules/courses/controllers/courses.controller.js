/**
 * Courses Controller - Điều phối HTTP request về khóa học
 */

const coursesService = require('../services/courses.service');

exports.getAllCourses = async (req, res, next) => {
  try {
    const courses = await coursesService.getAllCourses();
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách khóa học thành công',
      courses
    });
  } catch (error) {
    next(error);
  }
};
