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

exports.getSubjects = async (req, res, next) => {
  try {
    const subjects = await coursesService.getSubjects();
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách môn học thành công',
      subjects
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy file để tải lên'
      });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({
      success: true,
      message: 'Tải file lên thành công',
      fileUrl,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    next(error);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    // instructor_id lấy từ auth middleware (req.user.user_id)
    const instructorId = req.user.user_id;
    const course = await coursesService.createCourse(req.body, instructorId);
    
    res.status(201).json({
      success: true,
      message: 'Tạo khóa học thành công',
      data: course
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Trả về đường dẫn file để frontend lưu vào lesson/course
    const fileUrl = `/uploads/${req.file.destination.split('uploads/')[1]}/${req.file.filename}`;
    
    res.status(200).json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
