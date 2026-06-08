/**
 * Auth Middleware - Xác thực JWT Token
 */

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
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

module.exports = authMiddleware;
