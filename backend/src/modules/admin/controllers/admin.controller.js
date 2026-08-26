/**
 * Admin Controller - Tiếp nhận và xử lý yêu cầu quản trị từ client
 */

const adminService = require('../services/admin.service');
const db = require('../../../config/database');
const crypto = require('crypto');

/**
 * Lấy danh sách tất cả người dùng
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers();
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy dashboard tiến trình người dùng và sức khỏe hệ thống cho Admin.
 */
exports.getAnalyticsDashboard = async (req, res, next) => {
  try {
    const requestedRange = Number.parseInt(req.query.range, 10);
    const rangeDays = [7, 30, 90, 365].includes(requestedRange) ? requestedRange : 30;
    const dashboard = await adminService.getAnalyticsDashboard(rangeDays);

    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật vai trò cho người dùng
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;
    
    if (roleId === undefined || roleId === null) {
      const err = new Error('Thiếu thông tin vai trò mới (roleId)');
      err.status = 400;
      throw err;
    }

    // 1. Kiểm tra sự tồn tại của người dùng mục tiêu
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }

    // 2. Xác thực quyền Admin đối chiếu trực tiếp qua CSDL / JWT payload (role === 'admin' hoặc roleId === 1)
    const isAdmin = req.user?.role === 'admin' || req.user?.roleId === 1 || req.user?.role_id === 1;
    if (!isAdmin) {
      const err = new Error('Bạn không có quyền thực hiện hành động quản trị này');
      err.status = 403;
      throw err;
    }
    
    const updatedUser = await adminService.updateUserRole(userId, roleId);
    res.status(200).json({
      success: true,
      message: 'Cập nhật vai trò người dùng thành công',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa tài khoản người dùng
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Ngăn chặn admin tự xóa tài khoản của chính họ
    if (parseInt(userId) === parseInt(req.user.id)) {
      const err = new Error('Bạn không thể tự xóa tài khoản của chính mình');
      err.status = 400;
      throw err;
    }

    // 1. Kiểm tra sự tồn tại của người dùng mục tiêu
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }

    // 2. Xác thực quyền Admin đối chiếu trực tiếp qua CSDL / JWT payload (role === 'admin' hoặc roleId === 1)
    const isAdmin = req.user?.role === 'admin' || req.user?.roleId === 1 || req.user?.role_id === 1;
    if (!isAdmin) {
      const err = new Error('Bạn không có quyền thực hiện hành động quản trị này');
      err.status = 403;
      throw err;
    }
    
    const deletedUser = await adminService.deleteUser(userId);
    res.status(200).json({
      success: true,
      message: 'Xóa tài khoản người dùng thành công',
      user: deletedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset token cho một tài khoản cụ thể
 */
exports.resetUserToken = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // 1. Kiểm tra sự tồn tại của người dùng mục tiêu
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }

    // 2. Xác thực quyền Admin đối chiếu trực tiếp qua CSDL / JWT payload (role === 'admin' hoặc roleId === 1)
    const isAdmin = req.user?.role === 'admin' || req.user?.roleId === 1 || req.user?.role_id === 1;
    if (!isAdmin) {
      const err = new Error('Bạn không có quyền thực hiện hành động quản trị này');
      err.status = 403;
      throw err;
    }

    const result = await adminService.resetUserToken(userId);
    res.status(200).json({
      success: true,
      message: 'Đã reset hạn mức Token AI của tài khoản này về 0',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset token hàng loạt theo Role (Student/Instructor)
 */
exports.resetTokensByRole = async (req, res, next) => {
  try {
    const { roleId } = req.body;
    if (!roleId) {
      const err = new Error('Thiếu thông tin vai trò (roleId)');
      err.status = 400;
      throw err;
    }

    // RÀNG BUỘC: Chỉ Super Admin mới được phép reset token cho nhóm Admin (roleId = 1)
    const isSuperAdmin = isSuperAdminEmail(req.user?.email);
    if (parseInt(roleId, 10) === 1 && !isSuperAdmin) {
      const err = new Error('Bạn không có quyền reset token cho nhóm Admin. Chỉ Super Admin mới có quyền này.');
      err.status = 403;
      throw err;
    }
    
    const result = await adminService.resetTokensByRole(parseInt(roleId, 10));
    
    const roleName = parseInt(roleId, 10) === 2 ? 'Giảng viên' : 'Học sinh';
    res.status(200).json({
      success: true,
      message: `Đã reset hạn mức Token AI cho toàn bộ tài khoản thuộc vai trò ${roleName}`,
      count: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/rag/backfill - Nạp RAG & Phụ đề hàng loạt cho bài học có video
 */
exports.backfillRag = async (req, res, next) => {
  try {
    const { targetLessonId } = req.body || {};
    const { triggerLessonRagIngestion } = require('../../lessons/services/lessonRagIngestion.service');

    let query = `
      SELECT l.lesson_id, l.title, l.content_url, l.content_type, s.title AS section_title, c.course_name
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE l.content_url IS NOT NULL AND l.content_url != ''
    `;
    let params = [];

    if (targetLessonId && Number(targetLessonId) > 0) {
      query += ' AND l.lesson_id = $1';
      params.push(Number(targetLessonId));
    }

    query += ' ORDER BY l.lesson_id ASC';

    const result = await db.query(query, params);
    const lessons = result.rows;

    // Chạy trigger non-blocking nền
    setImmediate(async () => {
      console.log(`[Admin RAG Backfill] 🚀 Bắt đầu backfill ${lessons.length} bài học...`);
      for (let i = 0; i < lessons.length; i++) {
        const l = lessons[i];
        try {
          await triggerLessonRagIngestion(l.lesson_id, l.content_url, 'admin-backfill');
        } catch (err) {
          console.warn(`[Admin RAG Backfill Error] Bài học ${l.lesson_id}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      console.log(`[Admin RAG Backfill] ✅ Đã hoàn tất kích hoạt nạp RAG cho ${lessons.length} bài học.`);
    });

    res.status(200).json({
      success: true,
      message: `Đã kích hoạt tiến trình nạp RAG nền cho ${lessons.length} bài học. Hệ thống đang tự động trích xuất phụ đề và nạp Vector DB.`,
      totalLessons: lessons.length,
      lessons: lessons.map(l => ({ id: l.lesson_id, title: l.title, course: l.course_name }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy trạng thái hiện tại của hệ thống Rate Limiting
 */
exports.getRateLimitStatus = async (req, res, next) => {
  try {
    const { isRateLimitEnabled } = require('../../../middleware/rateLimit.middleware');
    const enabled = isRateLimitEnabled();
    res.status(200).json({
      success: true,
      enabled,
      message: `Hệ thống Rate Limiting hiện đang ${enabled ? 'BẬT (Active)' : 'TẮT (Disabled)'}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bật/Tắt hệ thống Rate Limiting động
 */
exports.toggleRateLimit = async (req, res, next) => {
  try {
    const { isRateLimitEnabled, setRateLimitEnabled, toggleRateLimit } = require('../../../middleware/rateLimit.middleware');
    const { enabled } = req.body;
    let newState;
    if (typeof enabled === 'boolean') {
      newState = setRateLimitEnabled(enabled);
    } else {
      newState = toggleRateLimit();
    }

    res.status(200).json({
      success: true,
      enabled: newState,
      message: `Đã ${newState ? 'BẬT' : 'TẮT'} Hệ thống Rate Limiting thành công.`
    });
  } catch (error) {
    next(error);
  }
};

