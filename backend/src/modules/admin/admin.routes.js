/**
 * Admin Routes - Khai báo các endpoints quản trị hệ thống
 */

const express = require('express');
const router = express.Router();
const adminController = require('./controllers/admin.controller');
const adminAlertsController = require('./controllers/adminAlerts.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { aiLimiter } = require('../../middleware/rateLimit.middleware');

// Tất cả các endpoints trong module admin yêu cầu đăng nhập và có quyền Admin (roleId = 1)
router.use(authenticate);
router.use(authorize([1]));

// GET /api/admin/users - Lấy danh sách toàn bộ người dùng
router.get('/users', adminController.getAllUsers);

// GET /api/admin/analytics - Tiến trình toàn bộ học viên và sức khỏe hệ thống
router.get('/analytics', adminController.getAnalyticsDashboard);

// Sức khỏe transcript theo khóa học và thao tác khôi phục hàng đợi tức thời.
router.get('/course-transcripts', adminController.getCourseTranscriptHealth);
router.post('/course-transcripts/recover', aiLimiter, adminController.recoverPendingTranscripts);

// Cảnh báo vận hành lấy từ PostgreSQL/backend telemetry, cập nhật qua SSE.
router.get('/alerts', adminAlertsController.getAlerts);
router.get('/alerts/stream', adminAlertsController.streamAlerts);
router.post('/alerts/cleanup', adminAlertsController.cleanupAlerts);

// GET /api/admin/ai-quota - Bảng Quản trị Toàn diện Hạn mức và Tiêu thụ Token AI
router.get('/ai-quota', adminController.getAiQuotaDashboard);

// Dữ liệu biểu đồ Gemini gần thời gian thực: Google Cloud Monitoring + fallback telemetry backend
router.get('/gemini-usage/trends', adminController.getGeminiUsageTrend);

// Hạn mức thật của Gemini theo model (tách biệt với middleware rate-limit nội bộ)
router.get('/gemini-rate-limits/status', adminController.getAiRateLimitStatus);
router.post('/gemini-rate-limits/routing/reset', adminController.resetAiModelRouting);
router.get('/gemini-rate-limits/caps', adminController.getAiRateLimitCaps);
router.put('/gemini-rate-limits/caps', adminController.updateAiRateLimitCaps);

// PUT /api/admin/users/:userId/quota - Cập nhật hạn mức Token (max_tokens) cho người dùng
router.put('/users/:userId/quota', adminController.updateUserQuotaLimit);

// PUT /api/admin/users/:userId/role - Thay đổi vai trò người dùng
router.put('/users/:userId/role', adminController.updateUserRole);

// DELETE /api/admin/users/:userId - Xóa tài khoản người dùng
router.delete('/users/:userId', adminController.deleteUser);

// POST /api/admin/users/:userId/reset-token - Reset token cho một tài khoản cụ thể
router.post('/users/:userId/reset-token', adminController.resetUserToken);

// POST /api/admin/users/reset-tokens - Reset token hàng loạt theo Role
router.post('/users/reset-tokens', adminController.resetTokensByRole);

// POST /api/admin/rag/backfill - Kích hoạt nạp RAG Pinecone và Phụ đề PostgreSQL cho toàn bộ bài học
router.post('/rag/backfill', aiLimiter, adminController.backfillRag);

// GET /api/admin/rate-limit - Lấy trạng thái hệ thống Rate Limiting
router.get('/rate-limit', adminController.getRateLimitStatus);

// POST /api/admin/rate-limit/toggle - Bật/Tắt hệ thống Rate Limiting động
router.post('/rate-limit/toggle', adminController.toggleRateLimit);

// POST /api/admin/courses/:courseId/migrate-media - Migrate media khóa học cũ lên Cloudflare R2
// Query: ?dryRun=true (chỉ xem kế hoạch) | ?deleteSource=false (giữ lại file Supabase)
router.post('/courses/:courseId/migrate-media', adminController.migrateCourseMedia);

// Publishing Gate & Transcript Automation endpoints cho Admin
const coursesController = require('../courses/controllers/courses.controller');
router.post('/courses/:courseId/approve', coursesController.approveCourse);
router.post('/courses/:courseId/reject', coursesController.rejectCourse);
router.get('/courses/:courseId/transcript-pipeline', coursesController.getCourseTranscriptPipeline);

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
