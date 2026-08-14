/**
 * Courses Controller - Điều phối HTTP request về khóa học
 */

const coursesService = require('../services/courses.service');
const { packageVideoToDrmDash } = require('../../../utils/drmPackager.util');

exports.getAllCourses = async (req, res, next) => {
  try {
    // Nếu người dùng là admin (1) hoặc instructor (2), trả về tất cả khóa học (cả draft).
    // Người dùng thường / không có token → chỉ lấy published.
    const userRole = req.user?.roleId || req.user?.role || null;
    const isAdminOrInstructor = userRole === 1 || userRole === 2 ||
                                 userRole === '1' || userRole === '2';
    const filterPublished = !isAdminOrInstructor;

    const courses = await coursesService.getAllCourses(filterPublished);
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
    
    const destNormalized = req.file.destination.replace(/\\/g, '/');
    const uploadIdx = destNormalized.indexOf('/uploads');
    const subFolder = uploadIdx !== -1 ? destNormalized.substring(uploadIdx + 8) : '';
    let fileUrl = `/uploads${subFolder}/${req.file.filename}`;

    // TỰ ĐỘNG KHÓA MÃ HÓA DRM CENC NẾU LÀ FILE VIDEO
    if (req.file.mimetype.startsWith('video/') || req.file.filename.endsWith('.mp4')) {
      const lessonId = req.body?.lessonId || Date.now();
      const drmResult = await packageVideoToDrmDash(req.file.path, lessonId);
      if (drmResult.success && drmResult.mpdUrl) {
        fileUrl = drmResult.mpdUrl;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Tải file lên và đóng gói mã hóa DRM thành công',
      fileUrl,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      isDrmProtected: true
    });
  } catch (error) {
    next(error);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    // instructor_id lấy từ auth middleware (req.user.id)
    const instructorId = req.user.id;
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

    const destNormalized = req.file.destination.replace(/\\/g, '/');
    const uploadIdx = destNormalized.indexOf('/uploads');
    const subFolder = uploadIdx !== -1 ? destNormalized.substring(uploadIdx + 8) : '';
    let fileUrl = `/uploads${subFolder}/${req.file.filename}`;
    
    // TỰ ĐỘNG KHÓA MÃ HÓA DRM CENC NẾU LÀ FILE VIDEO
    if (req.file.mimetype.startsWith('video/') || req.file.filename.endsWith('.mp4')) {
      const lessonId = req.body?.lessonId || Date.now();
      const drmResult = await packageVideoToDrmDash(req.file.path, lessonId);
      if (drmResult.success && drmResult.mpdUrl) {
        fileUrl = drmResult.mpdUrl;
      }
    }

    res.status(200).json({
      success: true,
      url: fileUrl,
      isDrmProtected: true
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLessonById = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await coursesService.getLessonById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài học'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết bài học thành công',
      lesson
    });
  } catch (error) {
    next(error);
  }
};

exports.getCourseById = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await coursesService.getCourseById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết khóa học thành công',
      course
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await coursesService.updateCourse(courseId, req.body);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học để cập nhật'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Cập nhật khóa học thành công',
      course
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const result = await coursesService.deleteCourse(courseId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học để xóa'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Xóa khóa học thành công'
    });
  } catch (error) {
    next(error);
  }
};
