const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const coursesService = require('../services/courses.service');
const supabaseStorage = require('../../../utils/supabaseStorage');
const orphanCleanupService = require('../../../utils/orphanCleanup.service');
const { sanitizeLessonMediaForClient } = require('../../../utils/videoSecurity.util');
const { packageVideoToDash } = require('../../../utils/dashPackager.util');
const { isSuperAdminUser } = require('../../../utils/superAdmin.util');
const { buildCourseAssetPrefix } = require('../../../utils/mediaObjectKey.util');

async function registerUploadedObject(req, uploadResult, storageBucket, mimeType, { cleanupOnFailure = true } = {}) {
  const pendingUploadId = crypto.randomUUID();
  try {
    await orphanCleanupService.registerPendingUpload({
      uploadId: pendingUploadId,
      instructorId: req.user?.id || req.user?.userId,
      courseId: req.body?.courseId,
      storageKey: uploadResult.storageKey,
      storageBucket: uploadResult.storageBucket || storageBucket,
      storageProvider: uploadResult.storageProvider || 'r2',
      mimeType: uploadResult.mimeType || mimeType,
      sizeBytes: uploadResult.sizeBytes,
      checksumSha256: uploadResult.checksumSha256,
      originalName: req.file?.originalname
    });
    return pendingUploadId;
  } catch (error) {
    if (cleanupOnFailure) {
      await orphanCleanupService.rollbackUploadedAssetBundle([{
        key: uploadResult.storageKey,
        bucket: uploadResult.storageBucket || storageBucket,
        provider: uploadResult.storageProvider || 'r2'
      }]);
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
    res.set('Cache-Control', 'no-store');
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
  const dashTempPaths = [];
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
    const isImage = req.file.mimetype.startsWith('image/');
    const isAudio = req.file.mimetype.startsWith('audio/');

    const instructorId = req.user?.id || req.user?.userId || 'common';
    const assetId = crypto.randomUUID();
    const courseIdentity = {
      courseName: req.body?.courseName,
      courseId: req.body?.courseId,
      fallbackId: `draft-${instructorId}`,
      sectionName: req.body?.sectionName,
      sectionOrder: req.body?.sectionOrder,
      lessonName: req.body?.lessonName,
      lessonOrder: req.body?.lessonOrder
    };
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

      const assetPrefix = buildCourseAssetPrefix({
        ...courseIdentity,
        mediaKind: 'video',
        assetId
      });
      const dashEnabled = process.env.ENABLE_DASH_PACKAGING === 'true';
      const objectKey = `${assetPrefix}/${safeBaseName}.mp4`;
      const uploadResult = await supabaseStorage.uploadVideoToSupabase(
        req.file.path,
        dashEnabled ? `${assetPrefix}/source.mp4` : objectKey,
        'video/mp4'
      );

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

      if (dashEnabled) {
        const packageResult = await packageVideoToDash(req.file.path, assetId);
        if (!packageResult.success) {
          await orphanCleanupService.rollbackUploadedAssetBundle([uploadResult]);
          return res.status(500).json({
            success: false,
            code: 'DASH_PACKAGING_FAILED',
            message: `Không thể đóng gói video DASH: ${packageResult.error}`
          });
        }

        dashTempPaths.push(
          packageResult.mpdPath,
          packageResult.videoPath,
          packageResult.audioPath
        );
        const rawManifest = await fs.promises.readFile(packageResult.mpdPath, 'utf8');
        const rewrittenManifest = rawManifest
          .replaceAll(path.basename(packageResult.videoPath), 'video.mp4')
          .replaceAll(path.basename(packageResult.audioPath), 'audio.mp4');

        const videoUpload = await supabaseStorage.uploadPrivateObject(
          packageResult.videoPath,
          `${assetPrefix}/video.mp4`,
          'videos',
          'video/mp4'
        );
        const audioUpload = videoUpload.success
          ? await supabaseStorage.uploadPrivateObject(
              packageResult.audioPath,
              `${assetPrefix}/audio.mp4`,
              'videos',
              'audio/mp4'
            )
          : { success: false, error: videoUpload.error };
        const manifestUpload = audioUpload.success
          ? await supabaseStorage.uploadPrivateObject(
              Buffer.from(rewrittenManifest, 'utf8'),
              `${assetPrefix}/manifest.mpd`,
              'videos',
              'application/dash+xml'
            )
          : { success: false, error: audioUpload.error };

        const uploadedAssets = [uploadResult, videoUpload, audioUpload, manifestUpload]
          .filter(item => item?.storageKey);
        if (!videoUpload.success || !audioUpload.success || !manifestUpload.success) {
          await orphanCleanupService.rollbackUploadedAssetBundle(uploadedAssets);
          return res.status(500).json({
            success: false,
            code: 'DASH_STORAGE_UPLOAD_FAILED',
            message: manifestUpload.error || audioUpload.error || videoUpload.error || 'Upload asset DASH thất bại.'
          });
        }

        let pendingUploadId;
        try {
          pendingUploadId = await registerUploadedObject(
            req,
            manifestUpload,
            'videos',
            'application/dash+xml',
            { cleanupOnFailure: false }
          );
        } catch (error) {
          await orphanCleanupService.rollbackUploadedAssetBundle(uploadedAssets);
          throw error;
        }

        return res.status(200).json({
          success: true,
          message: 'Tải lên và đóng gói video DASH thành công',
          pendingUploadId,
          fileUrl: manifestUpload.storageKey,
          storageKey: manifestUpload.storageKey,
          storageProvider: 'r2',
          storageBucket: manifestUpload.storageBucket,
          mimeType: 'application/dash+xml',
          sizeBytes: manifestUpload.sizeBytes,
          checksumSha256: manifestUpload.checksumSha256,
          mediaStatus: 'PENDING',
          playbackType: 'dash',
          originalName: req.file.originalname,
          mimetype: 'application/dash+xml',
          isDrmProtected: false
        });
      }

      // Đăng ký pending upload vào cơ sở dữ liệu
      const pendingUploadId = await registerUploadedObject(req, uploadResult, 'videos', 'video/mp4');

      return res.status(200).json({
        success: true,
        message: 'Tải video lên Cloudflare R2 thành công',
        pendingUploadId,
        fileUrl: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        storageProvider: 'r2',
        storageBucket: uploadResult.storageBucket,
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

      const assetPrefix = buildCourseAssetPrefix({
        ...courseIdentity,
        mediaKind: 'pdf',
        assetId
      });
      const objectKey = `${assetPrefix}/${safeBaseName}.pdf`;
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
        message: 'Tải tài liệu PDF lên Cloudflare R2 thành công',
        pendingUploadId,
        fileUrl: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        storageProvider: 'r2',
        storageBucket: uploadResult.storageBucket,
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

    // 3. AUDIO VÀ HÌNH ẢNH LỚN
    if (isAudio || isImage) {
      const mediaKind = isAudio ? 'audio' : 'image';
      const assetPrefix = buildCourseAssetPrefix({
        ...courseIdentity,
        mediaKind,
        assetId
      });
      const objectKey = `${assetPrefix}/${safeBaseName}${ext}`;
      const uploadResult = await supabaseStorage.uploadPrivateObject(
        req.file.path,
        objectKey,
        mediaKind,
        req.file.mimetype
      );
      if (!uploadResult.success) {
        return res.status(uploadResult.code === 'FILE_TOO_LARGE' ? 400 : 500).json({
          success: false,
          code: uploadResult.code || 'UPLOAD_FAILED',
          message: uploadResult.error || `Tải ${mediaKind} lên Cloudflare R2 thất bại`
        });
      }

      const pendingUploadId = await registerUploadedObject(
        req,
        uploadResult,
        uploadResult.storageBucket,
        req.file.mimetype
      );
      return res.status(200).json({
        success: true,
        message: `Tải ${mediaKind} lên Cloudflare R2 thành công`,
        pendingUploadId,
        fileUrl: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        storageProvider: 'r2',
        storageBucket: uploadResult.storageBucket,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        checksumSha256: uploadResult.checksumSha256,
        mediaStatus: 'PENDING',
        playbackType: mediaKind,
        originalName: req.file.originalname,
        mimetype: uploadResult.mimeType,
        isDrmProtected: false
      });
    }

    // 4. TỪ CHỐI ĐỊNH DẠNG KHÔNG HỢP LỆ
    return res.status(400).json({
      success: false,
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Hệ thống chỉ hỗ trợ video MP4, PDF, audio và hình ảnh.'
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
    for (const dashPath of dashTempPaths) {
      if (dashPath && dashPath !== tempFilePath && fs.existsSync(dashPath)) {
        try {
          fs.unlinkSync(dashPath);
        } catch (cleanupErr) {
          console.warn('⚠️ Lỗi dọn dẹp asset DASH tạm:', cleanupErr.message);
        }
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

    const safeLesson = sanitizeLessonMediaForClient(lesson);
    res.status(200).json({
      success: true,
      lesson: {
        ...safeLesson,
        playbackType,
        isDrmProtected: false
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
    const safeCourse = {
      ...course,
      sections: (course.sections || []).map(section => ({
        ...section,
        lessons: (section.lessons || []).map(sanitizeLessonMediaForClient)
      }))
    };
    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết khóa học thành công',
      course: safeCourse
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
    const canDeleteAnyCourse = isSuperAdminUser(req.user);
    const result = await coursesService.deleteCourse(courseId, userId, userRole, canDeleteAnyCourse);
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

exports.submitForReview = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.roleId || req.user?.role || 2;
    const result = await coursesService.submitCourseForReview(courseId, userId, userRole);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.approveCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const adminUserId = req.user?.id || req.user?.userId;
    const result = await coursesService.approveCourse(courseId, adminUserId);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const adminUserId = req.user?.id || req.user?.userId;
    const { reason } = req.body || {};
    const result = await coursesService.rejectCourse(courseId, adminUserId, reason);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getCourseTranscriptPipeline = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const result = await coursesService.getCourseTranscriptPipeline(courseId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
