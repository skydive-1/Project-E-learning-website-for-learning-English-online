/**
 * Auth Middleware - Xác thực JWT Token và Phân quyền (Kiểm tra CSDL thực tế)
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
        error: 'AuthError',
        message: 'Không có token xác thực, quyền truy cập bị từ chối'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!process.env.JWT_SECRET) {
      const error = new Error('JWT_SECRET chưa được cấu hình trên hệ thống');
      error.name = 'AuthError';
      error.status = 500;
      throw error;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kiểm tra trực tiếp dữ liệu từ CSDL Postgres để đảm bảo tài khoản còn tồn tại và lấy role mới nhất
    const userRes = await db.query(
      'SELECT user_id, email, username, full_name, role_id FROM users WHERE user_id = $1 OR email = $2',
      [decoded.id || 0, decoded.email || '']
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
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
    const status = error.status || 401;
    return res.status(status).json({
      success: false,
      error: 'AuthError',
      message: error.message || 'Token không hợp lệ hoặc đã hết hạn'
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
    if (!process.env.JWT_SECRET) {
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
        error: 'PermissionError',
        message: 'Bạn không có quyền thực hiện hành động này'
      });
    }

    next();
  };
};

/**
 * Middleware xác thực video qua query parameter token
 */
const authenticateVideoToken = (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Không có token xác thực, quyền truy cập video bị từ chối'
      });
    }

    if (!process.env.JWT_SECRET) {
      const error = new Error('JWT_SECRET chưa được cấu hình trên hệ thống');
      error.status = 500;
      throw error;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token xác thực video không hợp lệ hoặc đã hết hạn'
    });
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  authenticateVideoToken
};
