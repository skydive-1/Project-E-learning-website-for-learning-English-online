const express = require('express');
const router = express.Router();
const lessonsController = require('./controllers/lessons.controller');
const { authenticate, authorize, authenticateVideoToken } = require('../../middleware/auth.middleware');

// GET /api/lessons/video/stream/:lessonId - Stream video bảo mật
router.get('/video/stream/:lessonId', authenticateVideoToken, lessonsController.streamLessonVideo);

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
 *   post:
 *     summary: Tạo bài giảng mới
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
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
 */
module.exports = router;
