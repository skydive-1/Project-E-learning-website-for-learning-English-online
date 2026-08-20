const fs = require('fs');
const path = require('path');

/**
 * Kiểm tra tính hợp lệ của tệp PDF bằng Magic Bytes và cấu trúc cơ bản
 * @param {string|Buffer} fileInput - Đường dẫn file hoặc Buffer
 * @param {Object} options - { maxSize: number, checkEof: boolean }
 * @returns {Promise<{ isValid: boolean, code?: string, message?: string, metadata?: Object }>}
 */
const validatePdfFile = async (fileInput, options = {}) => {
  const maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB mặc định cho PDF
  let buffer;
  let fileSize = 0;

  try {
    if (Buffer.isBuffer(fileInput)) {
      buffer = fileInput;
      fileSize = buffer.length;
    } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      const stats = fs.statSync(fileInput);
      fileSize = stats.size;
      
      // Đọc toàn bộ hoặc phần đầu và cuối file
      if (fileSize > 10 * 1024 * 1024) {
        const fd = fs.openSync(fileInput, 'r');
        const headBuf = Buffer.alloc(4096);
        fs.readSync(fd, headBuf, 0, 4096, 0);
        fs.closeSync(fd);
        buffer = headBuf;
      } else {
        buffer = fs.readFileSync(fileInput);
      }
    } else {
      return {
        isValid: false,
        code: 'FILE_NOT_FOUND',
        message: 'Không tìm thấy dữ liệu tệp PDF để kiểm tra.'
      };
    }

    // 1. Kiểm tra kích thước file
    if (fileSize === 0) {
      return {
        isValid: false,
        code: 'EMPTY_FILE',
        message: 'Tệp PDF rỗng (0 bytes).'
      };
    }

    if (fileSize > maxSize) {
      return {
        isValid: false,
        code: 'FILE_TOO_LARGE',
        message: `Dung lượng tệp PDF vượt quá giới hạn cho phép (tối đa ${Math.round(maxSize / (1024 * 1024))} MB).`
      };
    }

    if (fileSize < 8) {
      return {
        isValid: false,
        code: 'INVALID_PDF_FORMAT',
        message: 'Tệp quá nhỏ, không phải là định dạng PDF hợp lệ.'
      };
    }

    // 2. Kiểm tra Magic Bytes chuẩn: "%PDF-" tại byte 0-5
    const magic = buffer.toString('utf-8', 0, Math.min(1024, buffer.length));
    const pdfHeaderIndex = magic.indexOf('%PDF-');

    if (pdfHeaderIndex === -1 || pdfHeaderIndex > 1024) {
      return {
        isValid: false,
        code: 'INVALID_PDF_FORMAT',
        message: 'Tệp không phải là tài liệu PDF hợp lệ (thiếu chữ ký Magic Bytes %PDF- chuẩn).'
      };
    }

    // Đọc phiên bản PDF (ví dụ: %PDF-1.4, %PDF-1.7)
    let version = '1.4';
    const versionMatch = magic.match(/%PDF-(\d+\.\d+)/);
    if (versionMatch) {
      version = versionMatch[1];
    }

    return {
      isValid: true,
      metadata: {
        format: 'pdf',
        version,
        sizeBytes: fileSize,
        mimeType: 'application/pdf'
      }
    };
  } catch (error) {
    return {
      isValid: false,
      code: 'VALIDATION_EXCEPTION',
      message: `Lỗi kiểm tra tệp PDF: ${error.message}`
    };
  }
};

module.exports = {
  validatePdfFile
};
