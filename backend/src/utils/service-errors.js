/**
 * Service Error Handler Utility
 * - Centralizes error handling logic for backend services.
 * - Formats and re-throws errors with appropriate names and status codes.
 */

const handleServiceError = (error, contextMessage) => {
  console.error(`❌ [Service Error] ${contextMessage}:`, error);

  // If it already has a status code, preserve it
  if (error.status) {
    throw error;
  }

  const serviceError = new Error(error.message || contextMessage || 'Có lỗi xảy ra trong quá trình xử lý');
  serviceError.name = error.name && error.name !== 'Error' ? error.name : 'ServerError';
  serviceError.status = 500;
  throw serviceError;
};

module.exports = {
  handleServiceError
};
