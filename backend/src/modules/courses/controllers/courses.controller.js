const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const coursesService = require('../services/courses.service');
const { packageVideoToDrmDash } = require('../../../utils/drmPackager.util');
const { uploadVideoToSupabase, deleteStorageObject } = require('../../../utils/supabaseStorage');

exports.getAllCourses = async (req, res, next) => {
  try {
    // Chỉ trả về tất cả khóa học (bao gồm cả draft) khi có tham số includeDrafts=true hoặc all=true VÀ người dùng là Admin hoặc Instructor.
    // Đối với trang danh mục khóa học chung (/courses) hoặc học viên -> luôn chỉ lấy published.
    const userRole = req.user?.roleId || req.user?.role || null;
    const isAdminOrInstructor = userRole === 1 || userRole === 2 ||
                                 userRole === '1' || userRole === '2';
    const includeDrafts = (req.query.includeDrafts === 'true' || req.query.all === 'true');
    const filterPublished = !(isAdminOrInstructor && includeDrafts);

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
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy file để tải lên'
      });
    }

    tempFilePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isVideo = req.file.mimetype.startsWith('video/') || ['.mp4', '.mov', '.mkv', '.avi'].includes(ext);
    const enableDrm = process.env.ENABLE_DRM_PACKAGING === 'true';

    // 1. XỬ LÝ VIDEO
    if (isVideo) {
      // Yêu cầu nghiêm ngặt: Chỉ chấp nhận định dạng MP4 thuần
      if (ext !== '.mp4' || req.file.mimetype !== 'video/mp4') {
        return res.status(400).json({
          success: false,
          message: 'Hệ thống chỉ chấp nhận tệp video định dạng MP4 chuẩn (MIME video/mp4, đuôi .mp4).'
        });
      }

      // Khi DRM Packaging được kích hoạt rõ ràng bằng feature flag
      if (enableDrm) {
        const lessonId = req.body?.lessonId || Date.now();
        const drmResult = await packageVideoToDrmDash(req.file.path, lessonId);
        if (drmResult.success && drmResult.mpdUrl) {
          return res.status(200).json({
            success: true,
            message: 'Tải file lên và đóng gói mã hóa DRM DASH thành công',
            fileUrl: drmResult.mpdUrl,
            storageKey: drmResult.mpdUrl,
            playbackType: 'dash',
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            isDrmProtected: true
          });
        }
      }

      // Mặc định (ENABLE_DRM_PACKAGING=false): Upload trực tiếp lên Supabase Storage bucket 'videos'
      const instructorId = req.user?.id || req.user?.userId || 'common';
      const assetId = crypto.randomUUID();
      const rawBaseName = path.basename(req.file.originalname, ext);
      const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const objectKey = `courses/${instructorId}/${assetId}/${safeBaseName}.mp4`;

      const uploadResult = await uploadVideoToSupabase(req.file.path, objectKey, 'video/mp4');

      if (!uploadResult.success) {
        return res.status(500).json({
          success: false,
          message: `Tải video lên Supabase Storage thất bại: ${uploadResult.error || 'Lỗi không xác định'}`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Tải video lên Supabase Storage thành công',
        fileUrl: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        playbackType: 'mp4',
        originalName: req.file.originalname,
        mimetype: 'video/mp4',
        isDrmProtected: false
      });
    }

    // 2. XỬ LÝ CÁC LOẠI TỆP KHÁC (Tài liệu PDF, Hình ảnh)
    const destNormalized = req.file.destination.replace(/\\/g, '/');
    const uploadIdx = destNormalized.indexOf('/uploads');
    const subFolder = uploadIdx !== -1 ? destNormalized.substring(uploadIdx + 8) : '';
    const fileUrl = `/uploads${subFolder}/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: 'Tải file lên thành công',
      fileUrl,
      storageKey: fileUrl,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      isDrmProtected: false
    });
  } catch (error) {
    next(error);
  } finally {
    // Dọn dẹp file tạm Multer sau khi hoàn tất upload
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.warn('⚠️ Lỗi dọn dẹp file tạm Multer:', cleanupErr.message);
      }
    }
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
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isVideo = req.file.mimetype.startsWith('video/') || ['.mp4', '.mov', '.mkv', '.avi'].includes(ext);
    const enableDrm = process.env.ENABLE_DRM_PACKAGING === 'true';

    if (isVideo) {
      if (ext !== '.mp4' || req.file.mimetype !== 'video/mp4') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ chấp nhận tệp video MP4 chuẩn.'
        });
      }

      if (enableDrm) {
        const lessonId = req.body?.lessonId || Date.now();
        const drmResult = await packageVideoToDrmDash(req.file.path, lessonId);
        if (drmResult.success && drmResult.mpdUrl) {
          return res.status(200).json({
            success: true,
            url: drmResult.mpdUrl,
            storageKey: drmResult.mpdUrl,
            playbackType: 'dash',
            isDrmProtected: true
          });
        }
      }

      const instructorId = req.user?.id || req.user?.userId || 'common';
      const assetId = crypto.randomUUID();
      const rawBaseName = path.basename(req.file.originalname, ext);
      const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const objectKey = `courses/${instructorId}/${assetId}/${safeBaseName}.mp4`;

      const uploadResult = await uploadVideoToSupabase(req.file.path, objectKey, 'video/mp4');

      if (!uploadResult.success) {
        return res.status(500).json({
          success: false,
          message: `Lỗi upload Supabase: ${uploadResult.error}`
        });
      }

      return res.status(200).json({
        success: true,
        url: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        playbackType: 'mp4',
        isDrmProtected: false
      });
    }

    const destNormalized = req.file.destination.replace(/\\/g, '/');
    const uploadIdx = destNormalized.indexOf('/uploads');
    const subFolder = uploadIdx !== -1 ? destNormalized.substring(uploadIdx + 8) : '';
    const fileUrl = `/uploads${subFolder}/${req.file.filename}`;

    res.status(200).json({
      success: true,
      url: fileUrl,
      storageKey: fileUrl,
      isDrmProtected: false
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.warn('⚠️ Lỗi dọn dẹp file tạm Multer:', cleanupErr.message);
      }
    }
  }
};

exports.getLessonById = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await coursesService.getLessonById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng'
      });
    }

    const isVideo = lesson.content_type === 'video';
    const isDash = lesson.content_url && lesson.content_url.includes('.mpd');
    const playbackType = isDash ? 'dash' : (isVideo ? 'mp4' : 'other');

    res.status(200).json({
      success: true,
      lesson: {
        ...lesson,
        playbackType,
        isDrmProtected: isDash
      }
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
