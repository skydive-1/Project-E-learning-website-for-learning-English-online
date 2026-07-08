/**
 * Auth Middleware - Xác thực JWT Token và Phân quyền
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware xác thực người dùng đã đăng nhập (kiểm tra JWT)
 */
const authenticate = (req, res, next) => {
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
    
    // decoded sẽ chứa: { id, email, username, role }
    req.user = decoded;
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
 * Middleware phân quyền (Kiểm tra vai trò người dùng)
 * @param {Array} roles - Danh sách các role ID được phép (1: Admin, 2: Instructor, 3: Student)
 */
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
    const userRole = parseInt(req.user.roleId);

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
    
    // decoded chứa: { id, email, username, roleId } hoặc tương đương
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
  authorize,
  authenticateVideoToken
};
