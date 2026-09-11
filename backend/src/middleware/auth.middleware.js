/**
 * Auth Middleware - Xác thực JWT Token và Phân quyền (Kiểm tra CSDL thực tế)
 * TASK-AUTH-SESSION-HOTFIX-01
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const {
  createClientFingerprint,
  getPublicVideoTicketFromRequest,
  getRequestSourceOrigin,
  getVideoTicketFromRequest,
  isAllowedMediaSource,
  isAutomatedDownloader,
  registerTicketRequest
} = require('../utils/videoSecurity.util');
const { isSuperAdminUser } = require('../utils/superAdmin.util');

/**
 * Xác thực JWT token và nạp thông tin người dùng từ CSDL PostgreSQL.
 * Hàm dùng chung cho authenticate() và authenticatePdfAccess().
 */
const verifyTokenAndLoadUser = async (token) => {
  if (!token || token.trim() === '') {
    const err = new Error('Không có token xác thực, quyền truy cập bị từ chối');
    err.status = 401;
    err.code = 'AUTH_REQUIRED';
    err.name = 'AuthRequiredError';
    throw err;
  }

  if (!process.env.JWT_SECRET) {
    const err = new Error('Lỗi cấu hình hệ thống xác thực máy chủ');
    err.status = 500;
    err.code = 'AUTH_CONFIG_ERROR';
    err.name = 'AuthConfigError';
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtErr) {
    if (jwtErr.name === 'TokenExpiredError') {
      const err = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      err.status = 401;
      err.code = 'TOKEN_EXPIRED';
      err.name = 'TokenExpiredError';
      throw err;
    }
    const err = new Error('Mã xác thực không hợp lệ. Vui lòng đăng nhập lại.');
    err.status = 401;
    err.code = 'TOKEN_INVALID';
    err.name = 'TokenInvalidError';
    throw err;
  }

  // Kiểm tra trực tiếp dữ liệu từ CSDL Postgres để đảm bảo tài khoản còn tồn tại và lấy role mới nhất
  const userRes = await db.query(
    'SELECT user_id, email, username, full_name, role_id FROM users WHERE user_id = $1 OR email = $2',
    [decoded.id || 0, decoded.email || '']
  );

  if (userRes.rows.length === 0) {
    const err = new Error('Tài khoản này đã bị xóa hoặc không còn tồn tại trên hệ thống. Vui lòng đăng nhập lại.');
    err.status = 401;
    err.code = 'USER_DELETED';
    err.name = 'UserDeleted';
    throw err;
  }

  const dbUser = userRes.rows[0];

  // Bảo vệ logic: Đảm bảo thông tin trong token khớp chính xác với CSDL để tránh các lỗ hổng logic OR
  if (decoded.id && dbUser.user_id !== decoded.id) {
    const err = new Error('Thông tin mã xác thực không hợp lệ. Vui lòng đăng nhập lại.');
    err.status = 401;
    err.code = 'TOKEN_INVALID';
    err.name = 'TokenInvalidError';
    throw err;
  }
  if (decoded.email && dbUser.email.toLowerCase() !== decoded.email.toLowerCase()) {
    const err = new Error('Thông tin mã xác thực không hợp lệ. Vui lòng đăng nhập lại.');
    err.status = 401;
    err.code = 'TOKEN_INVALID';
    err.name = 'TokenInvalidError';
    throw err;
  }

  // Gán thông tin thực tế mới nhất từ CSDL vào req.user (đảm bảo lấy role_id mới nhất từ DB)
  const roleName = dbUser.role_id === 1 ? 'admin' : (dbUser.role_id === 2 ? 'instructor' : 'student');
  const user = {
    ...decoded,
    id: dbUser.user_id,
    email: dbUser.email,
    username: dbUser.username,
    fullName: dbUser.full_name,
    roleId: dbUser.role_id,
    role: roleName
  };
  user.isSuperAdmin = isSuperAdminUser(user);

  // Cập nhật mốc hoạt động gần nhất phục vụ Realtime Online Tracking
  db.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE user_id = $1', [dbUser.user_id]).catch(() => {});

  return user;
};

/**
 * Middleware xác thực người dùng đã đăng nhập (kiểm tra JWT & CSDL thực tế)
 * CHỈ chấp nhận token qua Authorization header (Bearer <token>).
 * KHÔNG chấp nhận query parameter hay cookie để phòng chống rò rỉ token và CSRF.
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'AuthRequiredError',
        message: 'Không có token xác thực, quyền truy cập bị từ chối'
      });
    }

    req.user = await verifyTokenAndLoadUser(token);
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

/**
 * Xác thực vé SSE ngắn hạn. Native EventSource không hỗ trợ Authorization
 * header, vì vậy chỉ endpoint realtime này được phép nhận `?ticket=`.
 * Session JWT dài hạn trong `?token=` vẫn bị từ chối ở mọi route.
 */
const authenticateInstructorRealtimeTicket = async (req, res, next) => {
  try {
    const ticket = typeof req.query?.ticket === 'string' ? req.query.ticket.trim() : '';
    if (!ticket) {
      return res.status(401).json({
        success: false,
        code: 'REALTIME_TICKET_REQUIRED',
        message: 'Thiếu vé kết nối realtime.'
      });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_CONFIG_ERROR',
        message: 'Lỗi cấu hình hệ thống xác thực máy chủ'
      });
    }

    const decoded = jwt.verify(ticket, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type !== 'instructor_realtime_ticket') {
      return res.status(403).json({
        success: false,
        code: 'REALTIME_TICKET_INVALID',
        message: 'Mã xác thực không đúng loại vé realtime.'
      });
    }

    // Nạp lại user từ DB để tài khoản bị xóa/đổi quyền không thể tiếp tục mở SSE.
    req.user = await verifyTokenAndLoadUser(ticket);
    return next();
  } catch (error) {
    const expired = error?.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      code: expired ? 'REALTIME_TICKET_EXPIRED' : (error?.code || 'REALTIME_TICKET_INVALID'),
      message: expired ? 'Vé realtime đã hết hạn.' : 'Vé realtime không hợp lệ.'
    });
  }
};

/**
 * Xác thực vé ngắn hạn dành riêng cho video giao diện công khai.
 * Cookie này tách khỏi vé bài học để các video ở Footer/Home không ghi đè
 * quyền phát video bài giảng đang mở.
 */
const authenticatePublicVideoToken = (req, res, next) => {
  try {
    if (isAutomatedDownloader(req)) {
      return res.status(403).json({
        success: false,
        code: 'DOWNLOAD_MANAGER_BLOCKED',
        message: 'Forbidden: Automated download managers are strictly prohibited.'
      });
    }

    if (!isAllowedMediaSource(req)) {
      return res.status(403).json({
        success: false,
        code: 'HOTLINK_BLOCKED',
        message: 'Hotlink Protection: nguồn yêu cầu không thuộc tên miền frontend đã cấu hình.'
      });
    }

    const { token, transport } = getPublicVideoTicketFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Không có vé phát video giao diện trong cookie/header.'
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
    if (decoded.type !== 'public_video_stream_ticket') {
      return res.status(403).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Mã xác thực không đúng loại vé video giao diện'
      });
    }

    if (decoded.clientHash && decoded.clientHash !== createClientFingerprint(req)) {
      return res.status(403).json({
        success: false,
        code: 'CLIENT_MISMATCH',
        message: 'Vé phát không thuộc phiên trình duyệt hiện tại.'
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

    req.publicVideoTicket = decoded;
    req.videoTicketTransport = transport;
    return next();
  } catch (error) {
    return res.status(error.name === 'TokenExpiredError' ? 401 : 403).json({
      success: false,
      code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      message: error.name === 'TokenExpiredError'
        ? 'Vé phát video đã hết hạn. Vui lòng tải lại vé.'
        : 'Vé phát video không hợp lệ.'
    });
  }
};

module.exports = {
  authenticate,
  authenticateInstructorRealtimeTicket,
  authenticatePublicVideoToken,
  optionalAuthenticate,
  authorize,
  authenticateVideoToken,
  verifyTokenAndLoadUser
};

