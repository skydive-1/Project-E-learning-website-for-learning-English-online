/**
 * Logger Middleware
 * - Ghi lại thông tin của các request gửi đến server
 */

const loggerMiddleware = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
};

module.exports = loggerMiddleware;
