const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const coursesService = require('../services/courses.service');
const supabaseStorage = require('../../../utils/supabaseStorage');
const orphanCleanupService = require('../../../utils/orphanCleanup.service');

async function registerUploadedObject(req, uploadResult, storageBucket, mimeType) {
  const pendingUploadId = crypto.randomUUID();
  try {
    await orphanCleanupService.registerPendingUpload({
      uploadId: pendingUploadId,
      instructorId: req.user?.id || req.user?.userId,
      storageKey: uploadResult.storageKey,
      storageBucket,
      mimeType,
      sizeBytes: uploadResult.sizeBytes,
      checksumSha256: uploadResult.checksumSha256
    });
    return pendingUploadId;
  } catch (error) {
    let deleted = false;
    try { deleted = await supabaseStorage.deleteStorageObject(uploadResult.storageKey, storageBucket); } catch (_) {}
    if (!deleted) {
      await orphanCleanupService.recordFailedDeletion(uploadResult.storageKey, storageBucket, `Pending registration failed: ${error.message}`);
    }
    const registrationError = new Error('Không thể đăng ký phiên tải lên; tệp chưa được liên kết');
    registrationError.status = 500;
    registrationError.code = 'PENDING_UPLOAD_REGISTRATION_FAILED';
    throw registrationError;
  }
}

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
    const isPdf = req.file.mimetype === 'application/pdf' || ext === '.pdf';

    const instructorId = req.user?.id || req.user?.userId || 'common';
    const assetId = crypto.randomUUID();
    const rawBaseName = path.basename(req.file.originalname, ext);
    const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. XỬ LÝ VIDEO BÀI GIẢNG (Bucket 'videos')
    if (isVideo) {
      if (ext !== '.mp4' || req.file.mimetype !== 'video/mp4') {
        return res.status(400).json({
          success: false,
          code: 'UNSUPPORTED_VIDEO_FORMAT',
          message: 'Hệ thống chỉ chấp nhận tệp video định dạng MP4 chuẩn (MIME video/mp4, đuôi .mp4).'
        });
      }

      const objectKey = `courses/${instructorId}/${assetId}/${safeBaseName}.mp4`;
      const uploadResult = await supabaseStorage.uploadVideoToSupabase(req.file.path, objectKey, 'video/mp4');

      if (!uploadResult.success) {
        const statusCode = (uploadResult.code === 'INVALID_VIDEO_CONTAINER' || 
                            uploadResult.code === 'UNSUPPORTED_VIDEO_CODEC' ||
                            uploadResult.code === 'FILE_TOO_LARGE' ||
                            uploadResult.code === 'EMPTY_FILE') ? 400 : 500;
        return res.status(statusCode).json({
          success: false,
          code: uploadResult.code || 'UPLOAD_FAILED',
          message: uploadResult.error || 'Tải video lên máy chủ lưu trữ thất bại'
        });
      }

      // Đăng ký pending upload vào cơ sở dữ liệu
      const pendingUploadId = await registerUploadedObject(req, uploadResult, 'videos', 'video/mp4');

      // [DRM] Ghi nhận chủ đích: video mới hiện phát không mã hóa DRM.
      // Shaka Packager ĐÃ được cài đặt trong Dockerfile (/usr/local/bin/shaka-packager).
      // Quyết định tạm tắt DRM inline là có chủ đích: đóng gói DASH tốn 30–120s,
      // nếu chạy đồng bộ trong request sẽ timeout. DRM async background là bước tiếp theo
      // khi hệ thống đã ổn định hoàn toàn — xem task DRM-ASYNC-INTEGRATION.
      console.info(
        `[DRM] Video storageKey="${uploadResult.storageKey}" (pendingUploadId=${pendingUploadId}) ` +
        `hiện đang phát không mã hóa — DRM tạm thời tắt có chủ đích: ` +
        `đóng gói DASH cần chạy async background, chưa tích hợp. ` +
        `isDrmProtected=false là quyết định rõ ràng, KHÔNG phải lỗi bị bỏ quên.`
      );

      return res.status(200).json({
        success: true,
        message: 'Tải video lên Supabase Storage thành công',
        pendingUploadId,
        fileUrl: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        storageProvider: 'supabase',
        storageBucket: 'videos',
        mimeType: 'video/mp4',
        sizeBytes: uploadResult.sizeBytes,
        checksumSha256: uploadResult.checksumSha256,
        mediaStatus: 'PENDING',
        playbackType: 'mp4',
        originalName: req.file.originalname,
        mimetype: 'video/mp4',
        isDrmProtected: false
      });
    }

    // 2. XỬ LÝ TÀI LIỆU PDF BÀI GIẢNG (Bucket 'documents')
    if (isPdf) {
      if (ext !== '.pdf') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PDF_FORMAT',
          message: 'Tài liệu phải có định dạng PDF với đuôi .pdf.'
        });
      }

      const objectKey = `courses/${instructorId}/${assetId}/${safeBaseName}.pdf`;
      const uploadResult = await supabaseStorage.uploadDocumentToSupabase(req.file.path, objectKey, 'application/pdf');

      if (!uploadResult.success) {
        const statusCode = (uploadResult.code === 'INVALID_PDF_FORMAT' ||
                            uploadResult.code === 'EMPTY_FILE' ||
                            uploadResult.code === 'FILE_TOO_LARGE') ? 400 : 500;
        return res.status(statusCode).json({
          success: false,
          code: uploadResult.code || 'UPLOAD_FAILED',
          message: uploadResult.error || 'Tải tài liệu PDF lên máy chủ lưu trữ thất bại'
        });
      }

      // Đăng ký pending upload vào cơ sở dữ liệu
      const pendingUploadId = await registerUploadedObject(req, uploadResult, 'documents', 'application/pdf');

      return res.status(200).json({
        success: true,
        message: 'Tải tài liệu PDF lên Supabase Storage thành công',
        pendingUploadId,
        fileUrl: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        storageProvider: 'supabase',
        storageBucket: 'documents',
        mimeType: 'application/pdf',
        sizeBytes: uploadResult.sizeBytes,
        checksumSha256: uploadResult.checksumSha256,
        mediaStatus: 'PENDING',
        playbackType: 'pdf',
        originalName: req.file.originalname,
        mimetype: 'application/pdf',
        isDrmProtected: false
      });
    }

    // 3. TỪ CHỐI ĐỊNH DẠNG KHÔNG HỢP LỆ
    return res.status(400).json({
      success: false,
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Hệ thống chỉ hỗ trợ tải lên bài giảng dạng Video (MP4 H.264/AAC) hoặc Tài liệu (PDF).'
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
    // Bắt buộc lấy instructorId duy nhất từ token đã xác thực
    const instructorId = req.user.id || req.user.userId;
    const userRole = req.user.roleId || req.user.role || 2;
    const course = await coursesService.createCourse(req.body, instructorId, userRole);
    
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
  // Alias gọi thẳng sang uploadFile để bảo đảm tính thống nhất
  return exports.uploadFile(req, res, (err) => {
    if (err) {
      res.status(err.status || 500).json({ success: false, message: err.message });
    }
  });
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
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.roleId || req.user?.role || 2;
    const course = await coursesService.updateCourse(courseId, req.body, userId, userRole);
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
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.roleId || req.user?.role || 2;
    const result = await coursesService.deleteCourse(courseId, userId, userRole);
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
