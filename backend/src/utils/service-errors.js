/**
 * Service Error Handler Utility
 * - Centralizes error handling logic for backend services.
 * - Formats and re-throws errors with appropriate names and status codes.
 */

const handleServiceError = (error, contextMessage) => {
  // If it's already a formatted error (has name and status), just re-throw it
  if (error.name && error.status && error.name !== 'Error') {
    throw error;
  }

  console.error(`❌ [Service Error] ${contextMessage}:`, error);

  // Default to DatabaseError if it's an unhandled error from the database/infrastructure
  const serviceError = new Error(error.message || contextMessage || 'Có lỗi xảy ra trong quá trình xử lý hoặc kết nối cơ sở dữ liệu');
  serviceError.name = 'DatabaseError';
  serviceError.status = 503;
  throw serviceError;
};

module.exports = {
  handleServiceError
};
