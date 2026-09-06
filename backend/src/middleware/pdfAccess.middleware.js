/**
 * PDF Access Middleware - Xác thực truy cập tài liệu và bài giảng PDF
 * Module: Lesson Media Security & Document Protection
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 *
 * CẢNH BÁO BẢO MẬT:
 * Middleware này CHỈ ĐƯỢC PHÉP áp dụng cho các route xem/tải file tĩnh (PDF)
 * cần hỗ trợ mở trực tiếp từ trình duyệt qua thẻ <a href> hoặc window.open.
 * TUYỆT ĐỐI KHÔNG ĐƯỢC dùng làm middleware xác thực chung cho các API route khác
 * (như /api/admin/*, /api/auth/*, v.v.) để tránh rò rỉ JWT qua URL query parameter.
 * KHÔNG ĐƯỢC import hoặc sử dụng ở bất kỳ file *.routes.js nào ngoài lessons.routes.js.
 */

const { verifyTokenAndLoadUser } = require('./auth.middleware');

/**
 * Middleware xác thực truy cập tài liệu PDF:
 * 1. Ưu tiên đọc Authorization: Bearer <token> từ Request Header (chuẩn SPA fetch/XHR).
 * 2. Fallback sang req.query.token khi không có header (dành riêng cho thẻ <a> / window.open / trình duyệt tải trực tiếp).
 * 3. Tái sử dụng verifyTokenAndLoadUser từ auth.middleware để đảm bảo đồng nhất 100% logic JWT & DB check.
 */
const authenticatePdfAccess = async (req, res, next) => {
  try {
    let token = null;

    // 1. Ưu tiên đọc header Authorization Bearer (fetch/axios từ client)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fallback: đọc req.query.token (chỉ dùng cho mở trực tiếp qua thẻ <a> / window.open)
    if ((!token || token.trim() === '') && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'AuthRequiredError',
        message: 'Không có token xác thực, quyền truy cập tài liệu bị từ chối'
      });
    }

    // Xác thực JWT token và nạp user từ CSDL (tái sử dụng logic chuẩn từ auth.middleware)
    req.user = await verifyTokenAndLoadUser(token);
    next();
  } catch (error) {
    const status = error.status || 500;
    const isServerError = status >= 500;
    return res.status(status).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      error: error.name || 'ServerError',
      message: isServerError ? 'Lỗi xử lý xác thực trên máy chủ' : (error.message || 'Lỗi xác thực')
    });
  }
};

module.exports = {
  authenticatePdfAccess
};
