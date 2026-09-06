/**
 * Utility gắn JWT Token xác thực cho các liên kết xem/tải tài liệu PDF
 * Module: Lesson Document Protection & Authenticated PDF Access
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 *
 * Hỗ trợ middleware authenticatePdfAccess phía backend:
 * - Tự động append param `?token=<jwt>` từ localStorage vào các URL khớp route PDF.
 * - Giữ nguyên query param đã có (vd: ?stream=true).
 * - Hỗ trợ cả URL tuyệt đối (http/https) lẫn URL tương đối (/api/...).
 * - Nếu không khớp route PDF hoặc chưa đăng nhập, trả về URL gốc không đổi.
 */

// Pattern nhận diện 4 route PDF cần bảo vệ:
// 1. /lessons/:lessonId/pdf
// 2. /lessons/:lessonId/pdf/download
// 3. /lessons/:lessonId/materials/:materialId/preview
// 4. /lessons/:lessonId/materials/:materialId/download
const PROTECTED_PDF_ROUTE_REGEX = /\/lessons\/[^/]+\/(pdf(\/download)?|materials\/[^/]+\/(preview|download))$/i;

/**
 * Gắn token vào URL tài liệu PDF nếu khớp pattern và có session token
 * @param {string} url - URL cần gắn token (tuyệt đối hoặc tương đối)
 * @returns {string} URL đã gắn token hoặc URL gốc
 */
export function withPdfAuthToken(url) {
  if (!url || typeof url !== 'string') return url;

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token || token.trim() === '') return url;

  try {
    const dummyOrigin = 'http://localhost';
    const isRelative = !url.startsWith('http://') && !url.startsWith('https://');
    const parsed = new URL(url, dummyOrigin);

    if (!PROTECTED_PDF_ROUTE_REGEX.test(parsed.pathname)) {
      return url;
    }

    parsed.searchParams.set('token', token);

    if (isRelative) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch (_) {
    return url;
  }
}

export default withPdfAuthToken;
