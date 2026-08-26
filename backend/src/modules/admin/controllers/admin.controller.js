/**
 * Admin Controller - Tiếp nhận và xử lý yêu cầu quản trị từ client
 */

const adminService = require('../services/admin.service');
const db = require('../../../config/database');
const { isSuperAdminUser } = require('../../../utils/superAdmin.util');

const setForbiddenCode = (error, code) => {
  error.code = code;
  return error;
};

/**
 * Lấy danh sách tất cả người dùng
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers();
    res.status(200).json({
      success: true,
      users: users.map((user) => ({
        ...user,
        is_super_admin: isSuperAdminUser(user)
      }))
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
    const parsedRoleId = Number.parseInt(roleId, 10);
    
    if (roleId === undefined || roleId === null) {
      const err = new Error('Thiếu thông tin vai trò mới (roleId)');
      err.status = 400;
      throw err;
    }

    if (![1, 2, 3].includes(parsedRoleId)) {
      const err = new Error('Vai trò không hợp lệ');
      err.status = 400;
      err.code = 'INVALID_ROLE';
      throw err;
    }

    // 1. Kiểm tra email và role hiện tại của tài khoản mục tiêu
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }
    const targetUser = targetUserRes.rows[0];
    const targetRole = targetUser.role_id;

    // RÀNG BUỘC 1: Không ai được phép sửa đổi vai trò của Super Admin
    if (isSuperAdminUser(targetUser)) {
      const err = new Error('Tài khoản Super Admin là tối cao và không thể thay đổi vai trò.');
      err.status = 403;
      throw setForbiddenCode(err, 'SUPER_ADMIN_PROTECTED');
    }

    // RÀNG BUỘC 2: Tài khoản thường (không phải Super Admin) không được phép can thiệp vào vai trò Admin
    const isSuperAdmin = isSuperAdminUser(req.user);
    if (!isSuperAdmin) {
      // Nếu tài khoản mục tiêu đang là Admin hoặc muốn nâng mục tiêu lên Admin
      if (targetRole === 1 || parseInt(roleId, 10) === 1) {
        const err = new Error('Bạn không có quyền thay đổi vai trò sang Admin hoặc hạ quyền của một Admin khác. Chỉ Super Admin mới có quyền này.');
        err.status = 403;
        throw setForbiddenCode(err, 'SUPER_ADMIN_REQUIRED');
      }
    }
    
    const updatedUser = await adminService.updateUserRole(userId, parsedRoleId);
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

    // 1. Kiểm tra thông tin người dùng cần xóa
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }
    const targetUser = targetUserRes.rows[0];
    const targetRole = targetUser.role_id;

    // RÀNG BUỘC 1: Không ai được phép xóa tài khoản Super Admin
    if (isSuperAdminUser(targetUser)) {
      const err = new Error('Tài khoản Super Admin là tối cao và không thể bị xóa khỏi hệ thống.');
      err.status = 403;
      throw setForbiddenCode(err, 'SUPER_ADMIN_PROTECTED');
    }

    // RÀNG BUỘC 2: Tài khoản thường (không phải Super Admin) không được phép xóa tài khoản của Admin khác
    const isSuperAdmin = isSuperAdminUser(req.user);
    if (!isSuperAdmin && targetRole === 1) {
      const err = new Error('Bạn không có quyền xóa tài khoản của Admin khác. Chỉ Super Admin mới có quyền này.');
      err.status = 403;
      throw setForbiddenCode(err, 'SUPER_ADMIN_REQUIRED');
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

    // 1. Kiểm tra thông tin người dùng mục tiêu
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }
    const targetUser = targetUserRes.rows[0];

    // RÀNG BUỘC 1: Không thể reset token cho Super Admin
    if (isSuperAdminUser(targetUser)) {
      const err = new Error('Tài khoản Super Admin có hạn mức không giới hạn, không cần reset.');
      err.status = 403;
      throw setForbiddenCode(err, 'SUPER_ADMIN_PROTECTED');
    }

    // RÀNG BUỘC 2: Tài khoản thường (không phải Super Admin) không được phép reset token cho Admin khác
    const isSuperAdmin = isSuperAdminUser(req.user);
    if (!isSuperAdmin && targetUser.role_id === 1) {
      const err = new Error('Bạn không có quyền reset token cho Admin khác. Chỉ Super Admin mới có quyền này.');
      err.status = 403;
      throw setForbiddenCode(err, 'SUPER_ADMIN_REQUIRED');
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
    const isSuperAdmin = isSuperAdminUser(req.user);
    if (parseInt(roleId, 10) === 1 && !isSuperAdmin) {
      const err = new Error('Bạn không có quyền reset token cho nhóm Admin. Chỉ Super Admin mới có quyền này.');
      err.status = 403;
      throw setForbiddenCode(err, 'SUPER_ADMIN_REQUIRED');
    }
    
    const result = await adminService.resetTokensByRole(parseInt(roleId, 10));
    
    const roleName = parseInt(roleId, 10) === 1
      ? 'Admin'
      : (parseInt(roleId, 10) === 2 ? 'Giảng viên' : 'Học sinh');
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

