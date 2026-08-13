const express = require('express');
const router = express.Router();
const quizzesController = require('./controllers/quizzes.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');

// Route: GET /api/quizzes/detail/:quizId
router.get('/detail/:quizId', quizzesController.getQuizById);

// Route: GET /api/quizzes/join-by-pin/:pinCode
router.get('/join-by-pin/:pinCode', quizzesController.getQuizByPin);

// Route: GET /api/quizzes/:quizId/leaderboard
router.get('/:quizId/leaderboard', quizzesController.getLeaderboard);

// Route: GET /api/quizzes/:courseId
router.get('/:courseId', quizzesController.getQuizzes);

// Route: POST /api/quizzes/submit (Yêu cầu đăng nhập)
router.post('/submit', authenticate, quizzesController.submitQuiz);

// Route: POST /api/quizzes/submit-writing
router.post('/submit-writing', authenticate, quizzesController.submitWriting);

// Route: POST /api/quizzes/submit-audio
router.post('/submit-audio', authenticate, upload.memory.single('audio'), quizzesController.submitAudio);

// Route: GET /api/quizzes/manage/all - Quản lý tất cả đề thi & PIN Code (Chỉ dành cho Giảng viên / Admin)
router.get('/manage/all', authenticate, authorize([1, 2]), quizzesController.getAllQuizzesForManagement);

// Route: DELETE /api/quizzes/manage/:quizId - Xóa đề thi (Chỉ dành cho Giảng viên / Admin)
router.delete('/manage/:quizId', authenticate, authorize([1, 2]), quizzesController.deleteQuiz);

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
 * 
 * /api/quizzes/submit-writing:
 *   post:
 *     summary: Nộp bài luận tự luận chấm bằng AI
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               writing:
 *                 type: string
 *     responses:
 *       200:
 *         description: Trả về kết quả đánh giá bài viết
 * 
 * /api/quizzes/submit-audio:
 *   post:
 *     summary: Nộp file ghi âm để chấm điểm phát âm bằng AI
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *               expectedSentence:
 *                 type: string
 *                 description: Câu mẫu ban đầu để đối chiếu
 *     responses:
 *       200:
 *         description: Trả về kết quả đánh giá phát âm
 */
module.exports = router;
