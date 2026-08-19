const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const lessonsService = require('../services/lessons.service');

// Sinh Short-Lived Video Streaming Ticket (Hiệu lực 60 giây - Chống tải lậu & Hotlink)
exports.getVideoTicket = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const origin = req.headers.origin || req.headers.referer || '';

    const ticket = jwt.sign(
      {
        userId,
        lessonId,
        origin,
        type: 'video_stream_ticket'
      },
      process.env.JWT_SECRET || 'elearning_video_secure_jwt_secret',
      { expiresIn: '60s' }
    );

    return res.status(200).json({
      success: true,
      ticket,
      expiresIn: 60,
      streamUrl: `/api/lessons/video/stream/${lessonId}?ticket=${ticket}`
    });
  } catch (error) {
    next(error);
  }
};

exports.getLessonsByQuery = async (req, res, next) => {
  try {
    const { courseId, sectionId } = req.query;
    const lessons = await lessonsService.getLessonsByQuery({ courseId, sectionId });
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách bài giảng thành công',
      lessons
    });
  } catch (error) {
    next(error);
  }
};

exports.createLesson = async (req, res, next) => {
  try {
    const lesson = await lessonsService.createLesson(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo bài giảng mới thành công',
      lesson
    });
  } catch (error) {
    next(error);
  }
};

exports.updateLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await lessonsService.updateLesson(lessonId, req.body);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng để cập nhật'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Cập nhật bài giảng thành công',
      lesson
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const result = await lessonsService.deleteLesson(lessonId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng để xóa'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Xóa bài giảng thành công'
    });
  } catch (error) {
    next(error);
  }
};

const coursesService = require('../../courses/services/courses.service');
const { generateSignedUrl } = require('../../../utils/supabaseStorage');

exports.streamLessonVideo = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.roleId || req.user?.role || 3;

    // 🔒 1. Kiểm tra phân quyền truy cập bài học (Owner / Admin / Published / Enrolled)
    const hasAccess = await coursesService.canUserAccessLesson(userId, lessonId, userRole);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Quyền truy cập bị từ chối: Bạn không có quyền xem video bài học này.'
      });
    }

    const lesson = await coursesService.getLessonById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng'
      });
    }

    if (lesson.content_type !== 'video' || !lesson.content_url) {
      return res.status(400).json({
        success: false,
        message: 'Bài giảng này không chứa tài nguyên video'
      });
    }

    // 🔒 2. Chặn các công cụ download tự động bên ngoài
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isAutomatedDownloader = userAgent.includes('idm') || 
                                 userAgent.includes('internet download manager') ||
                                 userAgent.includes('freedownloadmanager') ||
                                 userAgent.includes('aria2') ||
                                 userAgent.includes('wget') ||
                                 userAgent.includes('curl');

    if (isAutomatedDownloader) {
      return res.status(403).json({
        success: false,
        message: 'Quyền truy cập bị từ chối: Hệ thống không cho phép tải video qua các công cụ download tự động.'
      });
    }

    // 🔒 3. Thiết lập Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    const contentUrl = lesson.content_url;

    // A. Nếu là link trực tiếp CDN / External
    if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) {
      return res.redirect(contentUrl);
    }

    // B. Nếu là Supabase Storage Key (courses/...)
    if (!contentUrl.startsWith('/uploads/') && !contentUrl.startsWith('uploads/')) {
      const signedPlaybackUrl = await generateSignedUrl(contentUrl, 'videos', 3600);
      if (signedPlaybackUrl) {
        return res.redirect(signedPlaybackUrl);
      }
    }

    // C. Nếu là file video cục bộ (Legacy local file)
    const filePath = path.resolve(__dirname, '../../../../', contentUrl.replace(/^\//, ''));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Tệp video không tồn tại trên hệ thống hoặc đã bị xóa.'
      });
    }

    const isDashManifest = filePath.endsWith('.mpd');
    const contentType = isDashManifest ? 'application/dash+xml' : 'video/mp4';

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range && !isDashManifest) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || start >= fileSize || (parts[1] && isNaN(end))) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
          'Content-Type': contentType
        });
        return res.end();
      }

      if (end >= fileSize) {
        end = fileSize - 1;
      }

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline; filename="video_stream.mp4"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private'
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Accept-Ranges': 'bytes',
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': isDashManifest ? 'inline; filename="manifest.mpd"' : 'inline; filename="video_stream.mp4"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private'
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Helper định dạng URL tài liệu động theo host runtime
 */
function resolveMaterialUrl(req, fileUrl) {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
  return `${baseUrl.replace(/\/$/, '')}/${fileUrl.replace(/^\//, '')}`;
}

function formatMaterialItem(req, m) {
  return {
    id: m.material_id,
    name: m.file_name,
    url: resolveMaterialUrl(req, m.file_url),
    fileType: m.file_type || 'application/pdf',
    sizeKb: m.file_size_kb || 0,
    createdAt: m.created_at
  };
}

/**
 * Upload tài liệu đính kèm bài học (Giảng viên / Admin)
 */
exports.uploadMaterial = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const userRole = parseInt(req.user?.roleId || req.user?.role, 10);
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng đính kèm tệp tin PDF hợp lệ (tối đa 20MB)'
      });
    }

    const material = await lessonsService.uploadLessonMaterial(lessonId, file, userId, userRole);

    return res.status(201).json({
      success: true,
      message: 'Tải lên tài liệu đính kèm thành công',
      material: formatMaterialItem(req, material)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tài liệu đính kèm của một bài học
 */
exports.getMaterialsByLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const rawMaterials = await lessonsService.getLessonMaterials(lessonId);
    const materials = rawMaterials.map(m => formatMaterialItem(req, m));

    return res.status(200).json({
      success: true,
      materials
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa tài liệu đính kèm (Owner-check Giảng viên / Admin)
 */
exports.deleteMaterial = async (req, res, next) => {
  try {
    const { lessonId, materialId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const userRole = parseInt(req.user?.roleId || req.user?.role, 10);

    await lessonsService.deleteLessonMaterial(lessonId, materialId, userId, userRole);

    return res.status(200).json({
      success: true,
      message: 'Đã xóa tài liệu đính kèm và vector AI liên quan'
    });
  } catch (error) {
    next(error);
  }
};
