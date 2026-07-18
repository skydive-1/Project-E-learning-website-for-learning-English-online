/**
 * Admin Controller - Tiếp nhận và xử lý yêu cầu quản trị từ client
 */

const adminService = require('../services/admin.service');
const db = require('../../../config/database');
const crypto = require('crypto');

/**
 * Kiểm tra xem email có phải là Super Admin hay không sử dụng SHA-256 Hash
 * Dự phòng cấu hình qua biến môi trường để đảm bảo tính động
 */
const isSuperAdminEmail = (email) => {
  if (!email) return false;
  
  const cleanEmail = email.toLowerCase().trim();
  if (process.env.SUPER_ADMIN_EMAIL && cleanEmail === process.env.SUPER_ADMIN_EMAIL.toLowerCase().trim()) {
    return true;
  }
  
  const hash = crypto.createHash('sha256').update(cleanEmail).digest('hex');
  return hash === '0ae2daf0d62e17971f256dbba9b09f5fcf5163f826dc155e6cd4e4dc202cda16';
};

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

    // 1. Kiểm tra email và role hiện tại của tài khoản mục tiêu
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }
    const targetUser = targetUserRes.rows[0];
    const targetEmail = targetUser.email;
    const targetRole = targetUser.role_id;

    // RÀNG BUỘC 1: Không ai được phép sửa đổi vai trò của Super Admin
    if (isSuperAdminEmail(targetEmail)) {
      const err = new Error('Tài khoản Super Admin là tối cao và không thể thay đổi vai trò.');
      err.status = 403;
      throw err;
    }

    // RÀNG BUỘC 2: Tài khoản thường (không phải Super Admin) không được phép can thiệp vào vai trò Admin
    const isSuperAdmin = isSuperAdminEmail(req.user?.email);
    if (!isSuperAdmin) {
      // Nếu tài khoản mục tiêu đang là Admin hoặc muốn nâng mục tiêu lên Admin
      if (targetRole === 1 || parseInt(roleId, 10) === 1) {
        const err = new Error('Bạn không có quyền thay đổi vai trò sang Admin hoặc hạ quyền của một Admin khác. Chỉ Super Admin mới có quyền này.');
        err.status = 403;
        throw err;
      }
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

    // 1. Kiểm tra thông tin người dùng cần xóa
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }
    const targetUser = targetUserRes.rows[0];
    const targetEmail = targetUser.email;
    const targetRole = targetUser.role_id;

    // RÀNG BUỘC 1: Không ai được phép xóa tài khoản Super Admin
    if (isSuperAdminEmail(targetEmail)) {
      const err = new Error('Tài khoản Super Admin là tối cao và không thể bị xóa khỏi hệ thống.');
      err.status = 403;
      throw err;
    }

    // RÀNG BUỘC 2: Tài khoản thường (không phải Super Admin) không được phép xóa tài khoản của Admin khác
    const isSuperAdmin = isSuperAdminEmail(req.user?.email);
    if (!isSuperAdmin && targetRole === 1) {
      const err = new Error('Bạn không có quyền xóa tài khoản của Admin khác. Chỉ Super Admin mới có quyền này.');
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

    // 1. Kiểm tra thông tin người dùng mục tiêu
    const targetUserRes = await db.query('SELECT email, role_id FROM users WHERE user_id = $1', [userId]);
    if (targetUserRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng');
      err.status = 404;
      throw err;
    }
    const targetUser = targetUserRes.rows[0];
    const targetEmail = targetUser.email;

    // RÀNG BUỘC 1: Không thể reset token cho Super Admin
    if (isSuperAdminEmail(targetEmail)) {
      const err = new Error('Tài khoản Super Admin có hạn mức không giới hạn, không cần reset.');
      err.status = 403;
      throw err;
    }

    // RÀNG BUỘC 2: Tài khoản thường (không phải Super Admin) không được phép reset token cho Admin khác
    const isSuperAdmin = isSuperAdminEmail(req.user?.email);
    if (!isSuperAdmin && targetUser.role_id === 1) {
      const err = new Error('Bạn không có quyền reset token cho Admin khác. Chỉ Super Admin mới có quyền này.');
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
