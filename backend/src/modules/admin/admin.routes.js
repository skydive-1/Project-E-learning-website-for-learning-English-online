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

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: API dành cho Admin
 * 
 * /api/admin/users:
 *   get:
 *     summary: Lấy danh sách người dùng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * 
 * /api/admin/users/{userId}/role:
 *   put:
 *     summary: Cập nhật role người dùng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 * 
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Xóa người dùng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 */
module.exports = router;
