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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-key-change-this');
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'AuthError',
      message: 'Token không hợp lệ hoặc đã hết hạn'
    });
  }
};

module.exports = authMiddleware;
