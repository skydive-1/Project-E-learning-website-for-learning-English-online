const express = require('express');
const router = express.Router();
const lessonsController = require('./controllers/lessons.controller');
const subtitlesController = require('./controllers/subtitles.controller');
const { authenticate, authorize, authenticateVideoToken } = require('../../middleware/auth.middleware');

// GET /api/lessons/video/ticket/:lessonId - Lấy Video Ticket thời hạn ngắn 60s (Chống tải lậu)
router.get('/video/ticket/:lessonId', authenticate, lessonsController.getVideoTicket);

// GET /api/lessons/video/stream/:lessonId - Stream video bảo mật
router.get('/video/stream/:lessonId', authenticateVideoToken, lessonsController.streamLessonVideo);

// Phụ đề thông minh & Kịch bản tương tác (Smart AI Subtitles & Interactive Transcript)
router.get('/:lessonId/subtitles', subtitlesController.getSubtitles);
router.post('/:lessonId/generate-subtitles', authenticate, authorize([1, 2]), subtitlesController.generateSubtitles);
router.put('/:lessonId/subtitles', authenticate, authorize([1, 2]), subtitlesController.updateSubtitles);

// GET /api/lessons - Lấy danh sách bài giảng (query: ?courseId=X hoặc ?sectionId=Y)
router.get('/', authenticate, lessonsController.getLessonsByQuery);

// POST /api/lessons - Tạo mới bài giảng (Chỉ Admin / Instructor)
router.post('/', authenticate, authorize([1, 2]), lessonsController.createLesson);

// PUT /api/lessons/:lessonId - Cập nhật bài giảng (Chỉ Admin / Instructor)
router.put('/:lessonId', authenticate, authorize([1, 2]), lessonsController.updateLesson);

// DELETE /api/lessons/:lessonId - Xóa bài giảng (Chỉ Admin / Instructor)
router.delete('/:lessonId', authenticate, authorize([1, 2]), lessonsController.deleteLesson);

/**
 * @swagger
 * tags:
 *   name: Lessons
 *   description: API bài giảng
 * 
 * /api/lessons:
 *   get:
 *     summary: Lấy danh sách bài giảng
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *   post:
 *     summary: Tạo bài giảng mới
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Thành công
 * 
 * /api/lessons/{lessonId}:
 *   put:
 *     summary: Cập nhật bài giảng
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Thành công
 *   delete:
 *     summary: Xóa bài giảng
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 * 
 * /api/lessons/video/stream/{lessonId}:
 *   get:
 *     summary: Stream video bài giảng
 *     tags: [Lessons]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
module.exports = router;
