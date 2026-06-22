/**
 * Upload Middleware - Cấu hình tải file (Video & PDF) sử dụng Multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đường dẫn lưu file upload
const uploadDir = path.join(__dirname, '../../uploads');

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu trữ
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Đặt tên file độc nhất: timestamp-random-tên_gốc
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// Bộ lọc định dạng file (kiểm tra kép cả MIME type và Đuôi mở rộng file)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'video/avi'
  ];

  const allowedExtensions = ['.pdf', '.mp4', '.mov', '.mkv', '.avi'];
  const ext = path.extname(file.originalname).toLowerCase();

  // Kiểm tra MIME type
  const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);
  // Kiểm tra Đuôi mở rộng file
  const isExtAllowed = allowedExtensions.includes(ext);

  if (isMimeAllowed && isExtAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng tệp không hợp lệ hoặc không được hỗ trợ. Chỉ cho phép tệp PDF và Video (MP4, MOV, MKV, AVI).'), false);
  }
};

// Khởi tạo multer với giới hạn 100MB cho video
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  }
});

module.exports = upload;
