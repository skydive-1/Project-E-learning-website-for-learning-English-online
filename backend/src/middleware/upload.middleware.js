/**
 * Upload Middleware - Cấu hình tải file (Video, PDF, Audio) sử dụng Multer
 * Bổ sung kiểm tra Magic Bytes / File Signature chuyên sâu cho Audio
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đường dẫn lưu file upload
const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu trữ disk storage
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
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// Bộ lọc định dạng file chung cho Course / Video
const generalFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'video/avi',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  const allowedExtensions = ['.pdf', '.mp4', '.mov', '.mkv', '.avi', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng tệp không hợp lệ. Chỉ cho phép tệp PDF, Video hoặc Hình ảnh.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: generalFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB — Phù hợp Supabase Storage 1GB free plan (~20 video)
  }
});

// Memory storage cho buffer upload
const memoryStorage = multer.memoryStorage();
upload.memory = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// =========================================================================
// CẤU HÌNH UPLOAD CHUYÊN BIỆT CHO AUDIO (SPEAKING & VOICE CHATBOT)
// =========================================================================

// Whitelist chính xác MIME types và extension tương thích
const AUDIO_MIME_MAP = {
  'audio/webm': ['.webm'],
  'audio/ogg': ['.ogg', '.oga'],
  'application/ogg': ['.ogg', '.oga'],
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/wave': ['.wav'],
  'audio/mpeg': ['.mp3'],
  'audio/mp3': ['.mp3'],
  'audio/mp4': ['.mp4', '.m4a'],
  'audio/x-m4a': ['.m4a'],
  'audio/aac': ['.aac']
};

const ALLOWED_AUDIO_MIMES = Object.keys(AUDIO_MIME_MAP);
const ALLOWED_AUDIO_EXTENSIONS = ['.webm', '.ogg', '.oga', '.wav', '.mp3', '.mp4', '.m4a', '.aac'];

/**
 * Kiểm tra Magic Bytes / Signature của buffer âm thanh
 */
function isValidAudioBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }

  // 1. WAV: RIFF....WAVE
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return true;
  }

  // 2. OGG: OggS
  if (buffer.toString('ascii', 0, 4) === 'OggS') {
    return true;
  }

  // 3. WebM: EBML Header (1A 45 DF A3)
  if (buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return true;
  }

  // 4. MP3: ID3 Header (49 44 33) hoặc MPEG Frame Sync (FF FB / FF F3 / FF F2 / FF FA / FF E3)
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    return true;
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    return true;
  }

  // 5. M4A / MP4 Audio: ftyp box tại offset 4
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return true;
  }

  return false;
}

const audioFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  // Kiểm tra MIME whitelist chính xác (không dùng startsWith audio/ bừa bãi)
  const isMimeAllowed = ALLOWED_AUDIO_MIMES.includes(mime);
  const isExtAllowed = ALLOWED_AUDIO_EXTENSIONS.includes(ext) || ext === ''; // Trình duyệt ghi âm blob thường không có extension

  if (!isMimeAllowed || (!isExtAllowed && ext !== '')) {
    const err = new Error('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận các định dạng âm thanh (WebM, WAV, MP3, OGG, M4A).');
    err.code = 'UNSUPPORTED_AUDIO_TYPE';
    err.status = 400;
    return cb(err, false);
  }

  // Nếu cả MIME và EXT đều có, kiểm tra tính tương thích giữa chúng
  if (ext && AUDIO_MIME_MAP[mime] && !AUDIO_MIME_MAP[mime].includes(ext)) {
    const err = new Error(`Phần mở rộng tệp '${ext}' không khớp với loại MIME '${mime}'.`);
    err.code = 'UNSUPPORTED_AUDIO_TYPE';
    err.status = 400;
    return cb(err, false);
  }

  cb(null, true);
};

const uploadAudioMemory = multer({
  storage: memoryStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit -> MulterError LIMIT_FILE_SIZE
  }
});

/**
 * Middleware kiểm tra Magic Bytes nhị phân sau khi file được nạp vào memory buffer
 */
const verifyAudioMagicBytes = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const buf = req.file.buffer;
  if (!buf || !isValidAudioBuffer(buf)) {
    const err = new Error('Nội dung tệp không phải là định dạng âm thanh hợp lệ (Magic Bytes kiểm tra thất bại).');
    err.code = 'UNSUPPORTED_AUDIO_TYPE';
    err.status = 400;
    return next(err);
  }

  next();
};

// Cấu hình tải tài liệu bài học (Lesson Material PDF)
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

upload.audioMemory = uploadAudioMemory;
upload.verifyAudioMagicBytes = verifyAudioMagicBytes;
upload.isValidAudioBuffer = isValidAudioBuffer;
upload.materialPdf = uploadMaterialPdf;

module.exports = upload;
