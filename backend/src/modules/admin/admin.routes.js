/**
 * Admin Routes - Khai báo các endpoints quản trị hệ thống
 */

const express = require('express');
const router = express.Router();
const adminController = require('./controllers/admin.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Tất cả các endpoints trong module admin yêu cầu đăng nhập và có quyền Admin (roleId = 1)
router.use(authenticate);
router.use(authorize([1]));

// GET /api/admin/users - Lấy danh sách toàn bộ người dùng
router.get('/users', adminController.getAllUsers);

// PUT /api/admin/users/:userId/role - Thay đổi vai trò người dùng
router.put('/users/:userId/role', adminController.updateUserRole);

// DELETE /api/admin/users/:userId - Xóa tài khoản người dùng
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
