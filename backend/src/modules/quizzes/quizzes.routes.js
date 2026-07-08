const express = require('express');
const router = express.Router();
const quizzesController = require('./controllers/quizzes.controller');

// Route: GET /api/quizzes/:courseId
router.get('/:courseId', quizzesController.getQuizzes);

// Route: POST /api/quizzes/submit
router.post('/submit', quizzesController.submitQuiz);

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
 * 
 * /api/quizzes/submit:
 *   post:
 *     summary: Nộp bài quiz
 *     tags: [Quizzes]
 */
module.exports = router;
