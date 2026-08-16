/**
 * DRM Controller - W3C EME ClearKey License Server
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: DRM Security & License Management
 */

const { generateLessonDrmKeys, buildClearKeyJwkResponse } = require('../../utils/drm.util');
const coursesService = require('../courses/services/courses.service');

/**
 * Endpoint xử lý yêu cầu cấp DRM License chuẩn W3C EME ClearKey JWK (RFC 7517)
 * Path: POST /api/drm/license & OPTIONS /api/drm/license
 */
const getClearKeyLicense = async (req, res) => {
  // CORS Preflight Header handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    if (!lessonId && (!kids || kids.length === 0)) {
      lessonId = 1;
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

    // 3. Lấy thông tin cặp khóa DRM (Key ID & Secret Key) tương ứng với bài học
    const drmPair = generateLessonDrmKeys(lessonId || 1);

    // Đóng gói cấu trúc W3C ClearKey JSON Web Key (JWK)
    const jwkResponse = buildClearKeyJwkResponse([
      {
        keyId: drmPair.keyId,
        secretKey: drmPair.secretKey
      }
    ]);

    res.setHeader('Content-Type', 'application/json');
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    const drmInfo = generateLessonDrmKeys(lessonId);

    return res.status(200).json({
      success: true,
      data: {
        lessonId: parseInt(lessonId, 10),
        keySystem: 'org.w3.clearkey',
        keyIdHex: drmInfo.keyId,
        keyIdBase64Url: drmInfo.keyIdBase64Url,
        secretKeyHex: drmInfo.secretKey,
        secretKeyBase64Url: drmInfo.secretKeyBase64Url,
        licenseUrl: `/api/drm/license?lessonId=${lessonId}`
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
