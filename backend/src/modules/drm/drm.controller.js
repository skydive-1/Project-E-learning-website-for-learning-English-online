/**
 * DRM Controller - W3C EME ClearKey License Server
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: DRM Security & License Management
 */

const {
  generateLessonDrmKeys,
  getLessonDrmKeyReference,
  buildClearKeyJwkResponse
} = require('../../utils/drm.util');
const coursesService = require('../courses/services/courses.service');

/**
 * Endpoint xử lý yêu cầu cấp DRM License chuẩn W3C EME ClearKey JWK (RFC 7517)
 * Path: POST /api/drm/license & OPTIONS /api/drm/license
 */
const getClearKeyLicense = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // 1. Kiểm tra xác thực người dùng (bắt buộc phải qua authenticate middleware)
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Bạn cần đăng nhập để yêu cầu khóa giải mã DRM'
      });
    }

    let rawBody = req.body;

    // Trích xuất JSON nếu req.body nhận từ W3C EME dạng Buffer hoặc String
    if (Buffer.isBuffer(rawBody)) {
      try {
        rawBody = JSON.parse(rawBody.toString('utf-8'));
      } catch (e) {
        rawBody = {};
      }
    } else if (typeof rawBody === 'string') {
      try {
        rawBody = JSON.parse(rawBody);
      } catch (e) {
        rawBody = {};
      }
    }

    let lessonId = req.query.lessonId || rawBody?.lessonId || req.params?.lessonId;
    let kids = rawBody?.kids || [];

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        code: 'LESSON_ID_REQUIRED',
        message: 'Yêu cầu DRM license phải chỉ rõ lessonId.'
      });
    }

    // 2. Kiểm tra phân quyền: User có quyền truy cập bài học này không
    const hasAccess = await coursesService.canUserAccessLesson(user.id, lessonId, user.roleId);
    if (!hasAccess) {
      console.warn(`🔒 [DRM Access Denied]: User ${user.id} (${user.email}) bị từ chối cấp key cho Lesson ${lessonId}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Bạn không có quyền truy cập khóa giải mã DRM của bài học này (chưa đăng ký khóa học hoặc khóa học chưa phát hành)'
      });
    }

    const lesson = await coursesService.getLessonById(lessonId);
    if (!lesson || lesson.content_type !== 'video' || !String(lesson.content_url || '').includes('.mpd')) {
      return res.status(409).json({
        success: false,
        code: 'DRM_MEDIA_NOT_READY',
        message: 'Bài học chưa có luồng DASH DRM sẵn sàng.'
      });
    }

    // Video mới dùng UUID asset; video legacy dùng lessonId.
    const keyReference = getLessonDrmKeyReference(lesson, lessonId);
    const drmPair = generateLessonDrmKeys(keyReference);

    // Không cho client dùng lessonId hợp lệ để yêu cầu một KID khác. ClearKey
    // vẫn là DRM mức cơ bản, nhưng license endpoint không được trở thành oracle
    // cấp khóa tùy ý.
    if (Array.isArray(kids) && kids.length > 0 && !kids.includes(drmPair.keyIdBase64Url)) {
      return res.status(403).json({
        success: false,
        code: 'DRM_KEY_ID_MISMATCH',
        message: 'Key ID yêu cầu không thuộc video của bài học này.'
      });
    }

    // Đóng gói cấu trúc W3C ClearKey JSON Web Key (JWK)
    const jwkResponse = buildClearKeyJwkResponse([
      {
        keyId: drmPair.keyId,
        secretKey: drmPair.secretKey
      }
    ]);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json(jwkResponse);
  } catch (error) {
    console.error('❌ [DRM Controller Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cấp DRM License do lỗi hệ thống server.'
    });
  }
};

/**
 * API lấy thông tin cấu hình DRM Key cho từng bài học (phục vụ Frontend / Packager)
 * Path: GET /api/drm/info/:lessonId
 */
const getLessonDrmInfo = async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu tham số lessonId'
      });
    }

    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Bạn cần đăng nhập để xem thông tin DRM'
      });
    }

    const hasAccess = await coursesService.canUserAccessLesson(user.id, lessonId, user.roleId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Bạn không có quyền truy cập thông tin DRM của bài học này'
      });
    }

    const lesson = await coursesService.getLessonById(lessonId);
    const isDrmReady = Boolean(
      lesson?.content_type === 'video' && String(lesson.content_url || '').includes('.mpd')
    );
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).json({
      success: true,
      data: {
        lessonId: parseInt(lessonId, 10),
        keySystem: 'org.w3.clearkey',
        isDrmReady,
        licenseUrl: `/api/drm/license/${lessonId}`
      }
    });
  } catch (error) {
    console.error('❌ [DRM Info Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin DRM'
    });
  }
};

module.exports = {
  getClearKeyLicense,
  getLessonDrmInfo
};
