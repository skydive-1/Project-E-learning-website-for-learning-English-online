const express = require('express');
const router = express.Router();
const quizzesController = require('./controllers/quizzes.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Route: GET /api/quizzes/:courseId
router.get('/:courseId', quizzesController.getQuizzes);

// Route: POST /api/quizzes/submit
router.post('/submit', quizzesController.submitQuiz);

// Route: POST /api/quizzes - Tạo đề thi tự luyện mới (Chỉ dành cho Giảng viên / Admin)
router.post('/', authenticate, authorize([1, 2]), quizzesController.createQuiz);

// Route: POST /api/quizzes/generate-ai - Sinh câu hỏi bằng AI (Chỉ dành riêng cho Admin)
router.post('/generate-ai', authenticate, authorize([1]), quizzesController.generateQuizAi);

/**
 * @swagger
 * tags:
 *   name: Quizzes
 *   description: API bài tập trắc nghiệm
 * 
 * /api/quizzes/{courseId}:
 *   get:
 *     summary: Lấy danh sách quiz của khóa học
 *     tags: [Quizzes]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 * 
 * /api/quizzes/submit:
 *   post:
 *     summary: Nộp bài quiz
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Nộp bài thành công
 */
module.exports = router;
