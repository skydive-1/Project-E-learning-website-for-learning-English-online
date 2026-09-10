const path = require('path');

const BLOCKED_DIRECT_VIDEO_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.ogv', '.mpd', '.m3u8', '.m4s', '.ts'
]);

function blockDirectVideoAccess(req, res, next) {
  const requestedExtension = path.extname(req.path || '').toLowerCase();
  if (!BLOCKED_DIRECT_VIDEO_EXTENSIONS.has(requestedExtension)) return next();
  return res.status(403).json({
    success: false,
    code: 'DIRECT_VIDEO_ACCESS_BLOCKED',
    message: 'Không được phép tải trực tiếp tệp video. Hãy sử dụng luồng phát có vé.'
  });
}

module.exports = {
  BLOCKED_DIRECT_VIDEO_EXTENSIONS,
  blockDirectVideoAccess
};
