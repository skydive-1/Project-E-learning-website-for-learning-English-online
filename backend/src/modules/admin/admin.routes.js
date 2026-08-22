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

// POST /api/admin/users/:userId/reset-token - Reset token cho một tài khoản cụ thể
router.post('/users/:userId/reset-token', adminController.resetUserToken);

// POST /api/admin/users/reset-tokens - Reset token hàng loạt theo Role
router.post('/users/reset-tokens', adminController.resetTokensByRole);

// POST /api/admin/rag/backfill - Kích hoạt nạp RAG Pinecone và Phụ đề PostgreSQL cho toàn bộ bài học
router.post('/rag/backfill', adminController.backfillRag);

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
 *     responses:
 *       200:
 *         description: Trả về danh sách người dùng
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleId:
 *                 type: integer
 *                 description: ID vai trò mới (1=Admin, 2=Instructor, 3=Student)
 *     responses:
 *       200:
 *         description: Cập nhật thành công
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
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
module.exports = router;
