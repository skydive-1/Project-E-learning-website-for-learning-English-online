/**
 * Safe Path Traversal Resolver & Symlink Boundary Guard
 * Author: NGUYỄN THANH LIÊM (Backend & Security Developer)
 * Module: Security & Local File Protection
 */

const path = require('path');
const fs = require('fs');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const UPLOADS_ROOT = path.resolve(BACKEND_ROOT, 'uploads');

/**
 * Phân giải đường dẫn an toàn bên trong thư mục cơ sở (Base Directory)
 * Bảo vệ chống:
 * - Path Traversal (../, /uploads/../../.env, /uploads/../uploads_evil/secret)
 * - Symlink Escape (symlink trỏ ra ngoài thư mục cơ sở)
 * - Null Byte Injection
 * 
 * @param {string} baseDir Thư mục gốc được phép truy cập (mặc định UPLOADS_ROOT)
 * @param {string} targetPath Đường dẫn tương đối hoặc URL tương đối nhận từ client
 * @param {object} options { checkExists: boolean }
 * @returns {string|null} Đường dẫn tuyệt đối an toàn hoặc null nếu không hợp lệ / phát hiện tấn công
 */
function resolveSafePath(baseDir = UPLOADS_ROOT, targetPath = '', options = { checkExists: false }) {
  if (!targetPath || typeof targetPath !== 'string') return null;

  // Loại bỏ Null byte
  if (targetPath.includes('\0')) {
    console.warn(`🚨 [SafePath Security] Phát hiện Null Byte injection trong path: ${targetPath}`);
    return null;
  }

  // Chuẩn hóa baseDir tuyệt đối
  const normalizedBase = path.resolve(baseDir);

  // Xóa tiền tố /uploads/ hoặc uploads/ nếu baseDir là UPLOADS_ROOT
  let sanitizedRelative = targetPath;
  if (normalizedBase === UPLOADS_ROOT) {
    sanitizedRelative = sanitizedRelative.replace(/^\/?uploads\/?/, '');
  }
  sanitizedRelative = sanitizedRelative.replace(/^\/+/, '');

  // Phân giải đường dẫn tuyệt đối
  const resolved = path.resolve(normalizedBase, sanitizedRelative);

  // 1. Kiểm tra biên giới hạn Boundary Check
  const isInside = resolved === normalizedBase || resolved.startsWith(normalizedBase + path.sep);
  if (!isInside) {
    console.warn(`🚨 [SafePath Security] Phát hiện Path Traversal vượt ranh giới: base=${normalizedBase}, resolved=${resolved}`);
    return null;
  }

  // 2. Kiểm tra Symlink Escape nếu file/folder tồn tại
  if (fs.existsSync(resolved)) {
    try {
      const realResolved = fs.realpathSync(resolved);
      const isRealInside = realResolved === normalizedBase || realRealInside(normalizedBase, realResolved);
      if (!isRealInside) {
        console.warn(`🚨 [SafePath Security] Phát hiện Symlink Escape: target=${resolved} -> real=${realResolved}`);
        return null;
      }
      return realResolved;
    } catch (e) {
      if (e.code === 'ENOENT') {
        // File không tồn tại
        if (options.checkExists) return null;
        return resolved;
      }
      console.warn(`⚠️ [SafePath Security] Lỗi kiểm tra realpath: ${e.message}`);
      return null;
    }
  }

  if (options.checkExists) {
    return null;
  }

  return resolved;
}

function realRealInside(base, target) {
  return target === base || target.startsWith(base + path.sep);
}

module.exports = {
  resolveSafePath,
  UPLOADS_ROOT,
  BACKEND_ROOT
};
