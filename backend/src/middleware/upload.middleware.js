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
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    
    let subDir = '';
    if (mime.startsWith('video/') || ['.mp4', '.mov', '.mkv', '.avi'].includes(ext)) {
      subDir = 'courses/videos';
    } else if (mime === 'application/pdf' || ext === '.pdf') {
      subDir = 'courses/documents';
    } else if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      subDir = 'courses/thumbnails';
    } else if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.webm'].includes(ext)) {
      subDir = 'chatbot/audio';
    }

    const targetDir = path.join(uploadDir, subDir);

    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
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
    'video/avi',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/webm',
    'audio/wave'
  ];

  const allowedExtensions = ['.pdf', '.mp4', '.mov', '.mkv', '.avi', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.wav', '.ogg', '.m4a', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();

  // Kiểm tra MIME type
  const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);
  // Kiểm tra Đuôi mở rộng file
  const isExtAllowed = allowedExtensions.includes(ext);

  if (isMimeAllowed && isExtAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng tệp không hợp lệ. Cho phép tệp PDF, Video, Hình ảnh và Âm thanh (MP3, WAV, OGG, M4A, WEBM).'), false);
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

// Thêm cấu hình memory storage để upload nhanh chóng vào buffer (giảm độ trễ đọc/ghi đĩa cho audio)
const memoryStorage = multer.memoryStorage();
upload.memory = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});

// Cấu hình tải tài liệu bài học (Lesson Material PDF): Tối đa 20MB, chỉ chấp nhận PDF
const materialPdfFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfExt = ext === '.pdf';

  if (isPdfMime && isPdfExt) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng tệp không hợp lệ: Tài liệu đính kèm chỉ chấp nhận tệp định dạng PDF (.pdf).'), false);
  }
};

const uploadMaterialPdf = multer({
  storage: storage,
  fileFilter: materialPdfFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB limit
  }
});

upload.materialPdf = uploadMaterialPdf;

module.exports = upload;
