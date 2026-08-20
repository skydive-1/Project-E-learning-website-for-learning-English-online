const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const lessonsService = require('../services/lessons.service');
const coursesService = require('../../courses/services/courses.service');
const supabaseStorage = require('../../../utils/supabaseStorage');
const { resolveSafePath, UPLOADS_ROOT } = require('../../../utils/safePath.util');

function sendDashFile(res, filePath, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return fs.createReadStream(filePath).pipe(res);
}

async function resolveReadyDashLesson(req, res) {
  const lesson = await coursesService.getLessonById(req.params.lessonId);
  if (!lesson) {
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bài giảng' });
    return null;
  }
  if (lesson.content_type !== 'video' || lesson.media_status !== 'READY') {
    res.status(409).json({ success: false, code: 'MEDIA_NOT_READY', message: 'Video chưa sẵn sàng' });
    return null;
  }
  const manifestPath = resolveSafePath(UPLOADS_ROOT, lesson.content_url || '', { checkExists: true });
  if (!manifestPath || path.extname(manifestPath).toLowerCase() !== '.mpd') {
    res.status(404).json({ success: false, code: 'DASH_NOT_FOUND', message: 'DASH manifest không tồn tại' });
    return null;
  }
  return { lesson, manifestPath };
}

exports.streamDashManifest = async (req, res, next) => {
  try {
    const resolved = await resolveReadyDashLesson(req, res);
    if (!resolved) return;
    const manifest = await fs.promises.readFile(resolved.manifestPath, 'utf8');
    const references = [...manifest.matchAll(/(?:media|initialization|sourceURL)=["']([^"']+)["']/gi)].map(m => m[1]);
    const dashDir = path.dirname(resolved.manifestPath);
    if (references.some(ref => !/^[A-Za-z0-9_.-]+$/.test(ref) || !resolveSafePath(dashDir, ref, { checkExists: true }))) {
      return res.status(422).json({ success: false, code: 'INVALID_DASH_MANIFEST', message: 'Manifest chứa đường dẫn segment không hợp lệ' });
    }
    return sendDashFile(res, resolved.manifestPath, 'application/dash+xml');
  } catch (error) { next(error); }
};

exports.streamDashSegment = async (req, res, next) => {
  try {
    const segment = req.params.segmentFile;
    if (!segment || !/^[A-Za-z0-9_.-]+$/.test(segment) || (!segment.endsWith('.m4s') && !segment.endsWith('.mp4'))) {
      return res.status(400).json({ success: false, code: 'INVALID_DASH_SEGMENT', message: 'Tên segment không hợp lệ' });
    }
    const resolved = await resolveReadyDashLesson(req, res);
    if (!resolved) return;
    const segmentPath = resolveSafePath(path.dirname(resolved.manifestPath), segment, { checkExists: true });
    if (!segmentPath) return res.status(404).json({ success: false, code: 'DASH_SEGMENT_NOT_FOUND', message: 'Segment không tồn tại' });
    return sendDashFile(res, segmentPath, segment.endsWith('.m4s') ? 'video/iso.segment' : 'video/mp4');
  } catch (error) { next(error); }
};

// Sinh Short-Lived Video Streaming Ticket (Hiệu lực 60 giây - Chống tải lậu & Hotlink)
exports.getVideoTicket = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const roleId = req.user?.roleId || req.user?.role || 3;
    const origin = req.headers.origin || req.headers.referer || '';

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_CONFIG_ERROR',
        message: 'Lỗi cấu hình hệ thống xác thực máy chủ'
      });
    }

    // 🔒 1. Kiểm tra phân quyền truy cập bài học (Owner / Admin / Published / Enrolled)
    const hasAccess = await coursesService.canUserAccessLesson(userId, lessonId, roleId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Quyền truy cập bị từ chối: Bạn không có quyền truy cập video bài học này.'
      });
    }

    // 🔒 2. Kiểm tra bài học tồn tại và có content_type === 'video'
    const lesson = await coursesService.getLessonById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Không tìm thấy bài giảng'
      });
    }

    if (lesson.content_type !== 'video') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_RESOURCE_TYPE',
        message: 'Bài giảng này không chứa tài nguyên video'
      });
    }

    // 🔒 3. Kiểm tra trạng thái media — Trả lỗi sớm nếu video chưa được upload hoặc bị thiếu nguồn
    if (!lesson.content_url) {
      return res.status(409).json({
        success: false,
        code: 'MEDIA_NOT_UPLOADED',
        message: 'Video bài học này chưa được tải lên. Vui lòng liên hệ giảng viên để cập nhật nội dung.'
      });
    }

    if (lesson.media_status === 'MISSING_SOURCE') {
      return res.status(409).json({
        success: false,
        code: 'MEDIA_MISSING_SOURCE',
        message: 'Nguồn video bài học không còn tồn tại trên hệ thống lưu trữ. Giảng viên cần tải lên lại video.'
      });
    }

    const ticket = jwt.sign(
      {
        id: userId,
        userId,
        roleId,
        lessonId: Number(lessonId) || lessonId,
        origin,
        type: 'video_stream_ticket'
      },
      process.env.JWT_SECRET,
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

    // 🔒 Kiểm tra trạng thái media trước khi stream — Tránh trả về JSON dưới dạng binary stream gây MEDIA_ELEMENT_ERROR
    if (lesson.media_status === 'MISSING_SOURCE') {
      return res.status(409).json({
        success: false,
        code: 'MEDIA_MISSING_SOURCE',
        message: 'Nguồn video bài học không còn tồn tại trên hệ thống lưu trữ. Giảng viên cần tải lên lại video.'
      });
    }

    if (!lesson.content_url && !lesson.storage_key) {
      return res.status(409).json({
        success: false,
        code: 'MEDIA_NOT_UPLOADED',
        message: 'Video bài học này chưa được tải lên. Vui lòng liên hệ giảng viên.'
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
      const signedPlaybackUrl = await supabaseStorage.generateSignedUrl(contentUrl, 'videos', 3600);
      if (signedPlaybackUrl) {
        return res.redirect(signedPlaybackUrl);
      }
    }

    // C. Nếu là file video cục bộ (Legacy local file)
    const { resolveSafePath, UPLOADS_ROOT } = require('../../../utils/safePath.util');
    const filePath = resolveSafePath(UPLOADS_ROOT, contentUrl, { checkExists: true });

    if (!filePath || !fs.existsSync(filePath)) {
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
function resolveMaterialUrl(req, material) {
  if (!material) return '';
  const fileUrl = material.file_url || material.storage_key || '';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;

  // Đối với storage key bền vững trên Supabase hoặc local: Trả về endpoint preview được bảo vệ
  if (material.material_id && material.lesson_id) {
    return `${baseUrl.replace(/\/$/, '')}/api/lessons/${material.lesson_id}/materials/${material.material_id}/preview`;
  }

  return `${baseUrl.replace(/\/$/, '')}/${fileUrl.replace(/^\//, '')}`;
}

function formatMaterialItem(req, m) {
  return {
    id: m.material_id,
    name: m.file_name,
    url: resolveMaterialUrl(req, m),
    storageKey: m.storage_key || m.file_url,
    storageBucket: m.storage_bucket || 'documents',
    storageProvider: m.storage_provider || 'supabase',
    mediaStatus: m.media_status || 'READY',
    fileType: m.mime_type || m.file_type || 'application/pdf',
    sizeKb: m.file_size_kb || Math.round((m.size_bytes || 0) / 1024) || 0,
    sizeBytes: m.size_bytes || 0,
    createdAt: m.created_at
  };
}

/**
 * Endpoint xem/tải tài liệu PDF an toàn (Giảng viên / Học viên đã đăng ký)
 */
exports.previewMaterial = async (req, res, next) => {
  try {
    const { lessonId, materialId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const userRole = parseInt(req.user?.roleId || req.user?.role || 3, 10);

    // 1. Kiểm tra quyền truy cập bài học
    const hasAccess = await coursesService.canUserAccessLesson(userId, lessonId, userRole);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập tài liệu của bài học này.'
      });
    }

    // 2. Lấy thông tin tài liệu
    const db = require('../../../config/database');
    const matRes = await db.query(
      `SELECT * FROM lesson_materials WHERE material_id = $1 AND lesson_id = $2`,
      [materialId, lessonId]
    );

    if (matRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài liệu đính kèm.'
      });
    }

    const mat = matRes.rows[0];
    const storageKey = mat.storage_key || mat.file_url;
    const storageBucket = mat.storage_bucket || 'documents';

    // 3. Nếu là link trực tiếp CDN
    if (storageKey && (storageKey.startsWith('http://') || storageKey.startsWith('https://'))) {
      return res.redirect(storageKey);
    }

    // 4. Nếu là Supabase Storage Object
    if (storageKey && !storageKey.startsWith('/uploads/') && !storageKey.startsWith('uploads/')) {
      const signedUrl = await supabaseStorage.generateSignedUrl(storageKey, storageBucket, 3600);
      if (signedUrl) {
        return res.redirect(signedUrl);
      }
    }

    // 5. Nếu là file local legacy
    const { resolveSafePath, UPLOADS_ROOT } = require('../../../utils/safePath.util');
    const filePath = resolveSafePath(UPLOADS_ROOT, mat.file_url || '', { checkExists: true });
    if (filePath && fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(mat.file_name)}"`);
      return fs.createReadStream(filePath).pipe(res);
    }

    return res.status(404).json({
      success: false,
      code: 'MISSING_SOURCE',
      message: 'Tài liệu không còn tồn tại trên máy chủ lưu trữ.'
    });
  } catch (error) {
    next(error);
  }
};

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
