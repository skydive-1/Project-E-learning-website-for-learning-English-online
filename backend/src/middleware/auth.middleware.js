/**
 * Auth Middleware - Xác thực JWT Token và Phân quyền (Kiểm tra CSDL thực tế)
 * TASK-AUTH-SESSION-HOTFIX-01
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware xác thực người dùng đã đăng nhập (kiểm tra JWT & CSDL thực tế)
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'AuthRequiredError',
        message: 'Không có token xác thực, quyền truy cập bị từ chối'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'AuthRequiredError',
        message: 'Không có token xác thực, quyền truy cập bị từ chối'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_CONFIG_ERROR',
        error: 'AuthConfigError',
        message: 'Lỗi cấu hình hệ thống xác thực máy chủ'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          error: 'TokenExpiredError',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        });
      }
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        error: 'TokenInvalidError',
        message: 'Mã xác thực không hợp lệ. Vui lòng đăng nhập lại.'
      });
    }

    // Kiểm tra trực tiếp dữ liệu từ CSDL Postgres để đảm bảo tài khoản còn tồn tại và lấy role mới nhất
    const userRes = await db.query(
      'SELECT user_id, email, username, full_name, role_id FROM users WHERE user_id = $1 OR email = $2',
      [decoded.id || 0, decoded.email || '']
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: 'USER_DELETED',
        error: 'UserDeleted',
        message: 'Tài khoản này đã bị xóa hoặc không còn tồn tại trên hệ thống. Vui lòng đăng nhập lại.'
      });
    }

    const dbUser = userRes.rows[0];

    // Gán thông tin thực tế mới nhất từ CSDL vào req.user (đảm bảo lấy role_id mới nhất từ DB)
    req.user = {
      ...decoded,
      id: dbUser.user_id,
      email: dbUser.email,
      username: dbUser.username,
      fullName: dbUser.full_name,
      roleId: dbUser.role_id
    };

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

/**
 * Middleware xác thực tùy chọn: nếu có token hợp lệ thì gán req.user, nếu không thì bỏ qua (không bị từ chối).
 * Dùng cho các route công khai có hành vi khác nhau giữa người dùng đăng nhập và không đăng nhập.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token || !process.env.JWT_SECRET) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await db.query(
      'SELECT user_id, email, username, full_name, role_id FROM users WHERE user_id = $1 OR email = $2',
      [decoded.id || 0, decoded.email || '']
    );

    if (userRes.rows.length === 0) {
      req.user = null;
      return next();
    }

    const dbUser = userRes.rows[0];
    req.user = {
      ...decoded,
      id: dbUser.user_id,
      email: dbUser.email,
      username: dbUser.username,
      fullName: dbUser.full_name,
      roleId: dbUser.role_id
    };
    next();
  } catch (error) {
    // Token lỗi hoặc hết hạn: bỏ qua, tiếp tục như anonymous
    req.user = null;
    next();
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Người dùng chưa được xác thực'
      });
    }

    // Nếu không truyền roles hoặc roles rỗng, cho phép tất cả đã đăng nhập
    if (roles.length === 0) return next();

    // Chuyển role về số để so sánh chính xác
    const userRole = parseInt(req.user.roleId, 10);

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'PermissionError',
        message: 'Bạn không có quyền thực hiện hành động này'
      });
    }

    next();
  };
};

/**
 * Middleware xác thực video qua query parameter token / ticket (Chống IDM, Hotlink & Tải lậu)
 */
const authenticateVideoToken = (req, res, next) => {
  try {
    // 🔒 1. Chặn các công cụ download tự động bên ngoài
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    if (
      userAgent.includes('idm') ||
      userAgent.includes('internet download manager') ||
      userAgent.includes('freedownloadmanager') ||
      userAgent.includes('aria2') ||
      userAgent.includes('wget') ||
      userAgent.includes('curl')
    ) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Forbidden: Automated download managers are strictly prohibited.'
      });
    }

    // 🔒 2. Chặn Hotlink & Xác thực Referer / Origin
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const sourceHeader = origin || referer || '';

    if (sourceHeader) {
      const allowedPatterns = ['localhost', '127.0.0.1', 'vercel.app', 'railway.app'];
      const isAllowed = allowedPatterns.some(pattern => sourceHeader.includes(pattern));
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Hotlink Protection: Yêu cầu truy cập tài nguyên bị từ chối do không thuộc tên miền chính thức.'
        });
      }
    }

    // 🔒 3. Xác thực Token / Ticket
    const token = req.query.ticket || req.query.token;
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Không có token xác thực, quyền truy cập video bị từ chối'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_CONFIG_ERROR',
        message: 'JWT_SECRET chưa được cấu hình trên hệ thống'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Token/Ticket video đã hết hạn hoặc không hợp lệ (Short-lived 60s Token)'
    });
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  authenticateVideoToken
};
