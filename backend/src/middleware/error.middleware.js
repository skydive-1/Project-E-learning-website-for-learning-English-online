/**
 * Global Error Handler Middleware
 * - Xử lý tất cả lỗi từ các modules
 * - Không để lỗi 1 module crash cả app
 * - Centralized error handling
 */

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`
    ❌ ERROR [${status}]:
    - Message: ${message}
    - URL: ${req.method} ${req.url}
    - Time: ${new Date().toISOString()}
  `);

  // Auth errors
  if (err.name === 'AuthError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: message
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: message
    });
  }

  // Database errors
  if (err.name === 'DatabaseError') {
    return res.status(503).json({
      success: false,
      error: 'Database connection error',
      message: 'Vui lòng thử lại sau'
    });
  }

  // Chatbot errors (không crash cả app)
  if (err.name === 'ChatbotError') {
    return res.status(503).json({
      success: false,
      error: 'Chatbot service unavailable',
      message: 'Tính năng chatbot hiện tạm thời không có sẵn'
    });
  }

  // Default error
  res.status(status).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
