const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware
 * - Ngăn chặn các đợt tấn công brute-force / DDoS / spamming API.
 * - Bảo vệ tài nguyên hệ thống và ngân sách API Gemini.
 */

// 1. Hạn mức gọi API chung (Default: Tối đa 100 requests / 15 phút cho mỗi IP)
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS) || 15 * 60 * 1000, // 15 phút
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX) || 100, // Số request tối đa
  standardHeaders: true, // Trả về thông tin giới hạn trong headers `RateLimit-*`
  legacyHeaders: false, // Tắt các header cũ `X-RateLimit-*`
  message: {
    success: false,
    message: 'Hệ thống nhận thấy quá nhiều yêu cầu từ IP của bạn. Vui lòng thử lại sau 15 phút.'
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

// 2. Hạn mức cho các API AI (Default: Tối đa 30 requests / 15 phút cho mỗi IP)
// Nhằm ngăn chặn spam chatbot gây cạn kiệt chi phí API Gemini
const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_AI_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AI_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã thực hiện quá nhiều yêu cầu AI. Vui lòng thử lại sau 15 phút để bảo vệ tài nguyên hệ thống.'
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

// 3. Hạn mức cho các API Quizzes (Default: Tối đa 30 requests / 15 phút cho mỗi IP)
// Tránh việc spam nộp bài tập / tạo câu hỏi liên tục làm quá tải Database
const quizLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_QUIZ_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_QUIZ_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều yêu cầu làm bài trắc nghiệm. Vui lòng thử lại sau 15 phút.'
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

module.exports = {
  globalLimiter,
  aiLimiter,
  quizLimiter
};
