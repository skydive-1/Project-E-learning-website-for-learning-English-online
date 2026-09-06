/**
 * Auth Middleware - Xác thực JWT Token và Phân quyền (Kiểm tra CSDL thực tế)
 * TASK-AUTH-SESSION-HOTFIX-01
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const {
  createClientFingerprint,
  getRequestSourceOrigin,
  getVideoTicketFromRequest,
  isAllowedMediaSource,
  isAutomatedDownloader,
  registerTicketRequest
} = require('../utils/videoSecurity.util');
const { isSuperAdminUser } = require('../utils/superAdmin.util');

/**
 * Middleware xác thực người dùng đã đăng nhập (kiểm tra JWT & CSDL thực tế)
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'AuthRequiredError',
        message: 'Không có token xác thực, quyền truy cập bị từ chối'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_CONFIG_ERROR',
        error: 'AuthConfigError',
        message: 'Lỗi cấu hình hệ thống xác thực máy chủ'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          error: 'TokenExpiredError',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        });
      }
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        error: 'TokenInvalidError',
        message: 'Mã xác thực không hợp lệ. Vui lòng đăng nhập lại.'
      });
    }

    // Kiểm tra trực tiếp dữ liệu từ CSDL Postgres để đảm bảo tài khoản còn tồn tại và lấy role mới nhất
    const userRes = await db.query(
      'SELECT user_id, email, username, full_name, role_id FROM users WHERE user_id = $1 OR email = $2',
      [decoded.id || 0, decoded.email || '']
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: 'USER_DELETED',
        error: 'UserDeleted',
        message: 'Tài khoản này đã bị xóa hoặc không còn tồn tại trên hệ thống. Vui lòng đăng nhập lại.'
      });
    }

    const dbUser = userRes.rows[0];

    // Bảo vệ logic: Đảm bảo thông tin trong token khớp chính xác với CSDL để tránh các lỗ hổng logic OR
    if (decoded.id && dbUser.user_id !== decoded.id) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        error: 'TokenInvalidError',
        message: 'Thông tin mã xác thực không hợp lệ. Vui lòng đăng nhập lại.'
      });
    }
    if (decoded.email && dbUser.email.toLowerCase() !== decoded.email.toLowerCase()) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        error: 'TokenInvalidError',
        message: 'Thông tin mã xác thực không hợp lệ. Vui lòng đăng nhập lại.'
      });
    }

    // Gán thông tin thực tế mới nhất từ CSDL vào req.user (đảm bảo lấy role_id mới nhất từ DB)
    const roleName = dbUser.role_id === 1 ? 'admin' : (dbUser.role_id === 2 ? 'instructor' : 'student');
    req.user = {
      ...decoded,
      id: dbUser.user_id,
      email: dbUser.email,
      username: dbUser.username,
      fullName: dbUser.full_name,
      roleId: dbUser.role_id,
      role: roleName
    };
    req.user.isSuperAdmin = isSuperAdminUser(req.user);

    // Cập nhật mốc hoạt động gần nhất phục vụ Realtime Online Tracking
    db.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE user_id = $1', [dbUser.user_id]).catch(() => {});

    next();
  } catch (error) {
    const status = error.status || 500;
    const isServerError = status >= 500;
    return res.status(status).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      error: error.name || 'ServerError',
      message: isServerError ? 'Lỗi xử lý xác thực trên máy chủ' : (error.message || 'Lỗi xác thực')
    });
  }
};

/**
 * Middleware xác thực tùy chọn: nếu có token hợp lệ thì gán req.user, nếu không thì bỏ qua (không bị từ chối).
 * Dùng cho các route công khai có hành vi khác nhau giữa người dùng đăng nhập và không đăng nhập.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token || !process.env.JWT_SECRET) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await db.query(
      'SELECT user_id, email, username, full_name, role_id FROM users WHERE user_id = $1 OR email = $2',
      [decoded.id || 0, decoded.email || '']
    );

    if (userRes.rows.length === 0) {
      req.user = null;
      return next();
    }

    const dbUser = userRes.rows[0];

    // Bảo vệ logic: Đảm bảo thông tin trong token khớp chính xác với CSDL
    if (decoded.id && dbUser.user_id !== decoded.id) {
      req.user = null;
      return next();
    }
    if (decoded.email && dbUser.email.toLowerCase() !== decoded.email.toLowerCase()) {
      req.user = null;
      return next();
    }

    const roleName = dbUser.role_id === 1 ? 'admin' : (dbUser.role_id === 2 ? 'instructor' : 'student');
    req.user = {
      ...decoded,
      id: dbUser.user_id,
      email: dbUser.email,
      username: dbUser.username,
      fullName: dbUser.full_name,
      roleId: dbUser.role_id,
      role: roleName
    };
    req.user.isSuperAdmin = isSuperAdminUser(req.user);
    next();
  } catch (error) {
    // Token lỗi hoặc hết hạn: bỏ qua, tiếp tục như anonymous
    req.user = null;
    next();
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Người dùng chưa được xác thực'
      });
    }

    // Nếu không truyền roles hoặc roles rỗng, cho phép tất cả đã đăng nhập
    if (roles.length === 0) return next();

    const userRoleId = parseInt(req.user.roleId, 10);
    const userRoleName = req.user.role || (userRoleId === 1 ? 'admin' : (userRoleId === 2 ? 'instructor' : 'student'));

    const isAuthorized = roles.some(role => {
      if (typeof role === 'number') return role === userRoleId;
      if (typeof role === 'string') return role.toLowerCase() === userRoleName.toLowerCase();
      return false;
    });

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'PermissionError',
        message: 'Bạn không có quyền thực hiện hành động này'
      });
    }

    next();
  };
};

/**
 * Middleware xác thực video qua cookie HttpOnly hoặc X-Video-Ticket.
 */
const authenticateVideoToken = (req, res, next) => {
  try {
    // Lớp nhận diện nhanh. Đây chỉ là tín hiệu phụ; vé ràng buộc client/cookie và
    // giới hạn kết nối song song ở dưới mới là lớp bảo vệ chính.
    if (isAutomatedDownloader(req)) {
      return res.status(403).json({
        success: false,
        code: 'DOWNLOAD_MANAGER_BLOCKED',
        message: 'Forbidden: Automated download managers are strictly prohibited.'
      });
    }

    // Chỉ chấp nhận Origin/Referer khớp chính xác FRONTEND_URL. Không dùng so
    // khớp chuỗi kiểu "*.vercel.app" vì một domain của kẻ khác cũng có thể khớp.
    if (!isAllowedMediaSource(req)) {
      return res.status(403).json({
        success: false,
        code: 'HOTLINK_BLOCKED',
        message: 'Hotlink Protection: nguồn yêu cầu không thuộc tên miền frontend đã cấu hình.'
      });
    }

    // Native <video> dùng cookie HttpOnly; Shaka dùng X-Video-Ticket. Query ticket
    // bị tắt mặc định để IDM và access log không lấy được vé từ URL.
    const { token, transport } = getVideoTicketFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        code: transport === 'disabled-query' ? 'QUERY_TICKET_DISABLED' : 'AUTH_REQUIRED',
        message: transport === 'disabled-query'
          ? 'Vé xem video trên URL không được chấp nhận.'
          : 'Không có vé xác thực trong cookie/header, quyền truy cập video bị từ chối.'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_CONFIG_ERROR',
        message: 'JWT_SECRET chưa được cấu hình trên hệ thống'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // Kiểm tra loại token để đảm bảo đây là video ticket hợp lệ, chứ không phải session token dài hạn
    if (decoded.type !== 'video_stream_ticket') {
      return res.status(403).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Mã xác thực không đúng loại vé xem video'
      });
    }

    // Kiểm tra tính nhất quán của lessonId giữa URL và Token
    if (req.params.lessonId && String(decoded.lessonId) !== String(req.params.lessonId)) {
      return res.status(403).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Vé xem video không khớp với bài học yêu cầu'
      });
    }

    if (decoded.clientHash && decoded.clientHash !== createClientFingerprint(req)) {
      return res.status(403).json({
        success: false,
        code: 'CLIENT_MISMATCH',
        message: 'Vé xem video không thuộc phiên trình duyệt hiện tại.'
      });
    }

    const requestOrigin = getRequestSourceOrigin(req);
    if (decoded.origin && requestOrigin && decoded.origin !== requestOrigin) {
      return res.status(403).json({
        success: false,
        code: 'ORIGIN_MISMATCH',
        message: 'Nguồn phát video không khớp với nguồn đã cấp vé.'
      });
    }

    if (!registerTicketRequest(req, res, decoded)) {
      return res.status(429).json({
        success: false,
        code: 'PARALLEL_STREAM_LIMIT',
        message: 'Quá nhiều kết nối tải video song song cho cùng một vé phát.'
      });
    }

    req.user = decoded;
    req.videoTicketTransport = transport;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        error: 'TokenExpiredError',
        message: 'Vé xem video đã hết hạn (Short-lived 60s Token). Vui lòng thử lại.'
      });
    }
    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        code: error.code || 'TOKEN_INVALID',
        message: error.message
      });
    }
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Token/Ticket video đã hết hạn hoặc không hợp lệ (Short-lived 60s Token)'
    });
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  authenticateVideoToken
};
