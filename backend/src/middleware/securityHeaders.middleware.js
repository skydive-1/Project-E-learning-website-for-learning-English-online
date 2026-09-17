/**
 * Security Headers Middleware (OWASP Standard)
 * - Thiết lập các HTTP response headers bảo vệ ứng dụng khỏi Clickjacking, MIME-sniffing, XSS.
 * - Ép buộc HTTPS qua Strict-Transport-Security (HSTS) khi ở môi trường Production.
 * - Zero-cost, zero-external-dependency (không làm nặng node_modules).
 */

const isProductionOrSecure = (req) => (
  process.env.NODE_ENV === 'production' ||
  req.secure === true ||
  req.headers['x-forwarded-proto'] === 'https'
);

const securityHeaders = (req, res, next) => {
  // 1. Chống MIME-sniffing (buộc trình duyệt tuân thủ Content-Type khai báo)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. Chống tấn công Clickjacking (không cho trang khác lén nhúng iframe trang web này)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // 3. Chuẩn OWASP: Tắt X-XSS-Protection cũ kỹ (tránh các lỗ hổng do trình duyệt tự động chặn sai)
  res.setHeader('X-XSS-Protection', '0');

  // 4. Kiểm soát thông tin Referrer khi người dùng điều hướng ra ngoài
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 5. Cross-Origin Resource Policy: cho phép frontend (Vercel/localhost) tải tài nguyên media (video DASH, audio, PDF)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // 6. HSTS (HTTP Strict Transport Security): Ép buộc trình duyệt luôn giao tiếp qua HTTPS trong 1 năm
  if (isProductionOrSecure(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

module.exports = securityHeaders;
