/**
 * Global Error Handler Middleware
 * - Xử lý tất cả lỗi từ các modules
 * - Đảm bảo trả về cả `code` định danh và `message`
 * - Xử lý chuẩn xác mã lỗi Multer: LIMIT_FILE_SIZE -> HTTP 413 AUDIO_TOO_LARGE
 */

const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let code = err.code || null;
  let message = err.message || 'Internal Server Error';

  // Xử lý lỗi tải file từ Multer
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'AUDIO_TOO_LARGE';
      message = 'Dung lượng tệp vượt quá giới hạn cho phép (tối đa 10 MB).';
    } else {
      status = 400;
      code = err.code || 'UPLOAD_ERROR';
    }
  }

  // Auth errors
  if (err.name === 'AuthError') {
    status = 401;
    code = code || 'UNAUTHORIZED';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    status = 400;
    code = code || 'VALIDATION_ERROR';
  }

  // Database errors
  if (err.name === 'DatabaseError') {
    status = err.status || 500;
    code = code || 'DATABASE_ERROR';
  }

  // Fallback default code
  if (!code) {
    if (status === 400) code = 'BAD_REQUEST';
    else if (status === 401) code = 'UNAUTHORIZED';
    else if (status === 403) code = 'FORBIDDEN';
    else if (status === 404) code = 'NOT_FOUND';
    else if (status === 413) code = 'AUDIO_TOO_LARGE';
    else if (status === 422) code = 'UNPROCESSABLE_ENTITY';
    else if (status === 503) code = 'SERVICE_UNAVAILABLE';
    else code = 'INTERNAL_ERROR';
  }

  console.error(JSON.stringify({
    level: 'error',
    event: 'request_error',
    requestId: req.requestId || null,
    status,
    code,
    message,
    method: req.method,
    path: req.path,
    stack: err.stack || null,
    timestamp: new Date().toISOString()
  }));

  const responseBody = {
    success: false,
    code: code,
    message: status === 500 ? 'Lỗi nội bộ máy chủ.' : message,
    timestamp: new Date().toISOString(),
    requestId: req.requestId || null
  };

  if (err.details && status < 500) {
    responseBody.details = err.details;
  }

  res.status(status).json(responseBody);
};

module.exports = errorHandler;
