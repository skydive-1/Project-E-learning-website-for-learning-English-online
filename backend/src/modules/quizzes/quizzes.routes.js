const express = require('express');
const router = express.Router();
const quizzesController = require('./controllers/quizzes.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');
const { aiLimiter, quizLimiter, uploadLimiter } = require('../../middleware/rateLimit.middleware');

// Route: GET /api/quizzes/detail/:quizId
router.get('/detail/:quizId', quizzesController.getQuizById);

// Route: GET /api/quizzes/join-by-pin/:pinCode
router.get('/join-by-pin/:pinCode', quizzesController.getQuizByPin);

// Route: GET /api/quizzes/:quizId/leaderboard
router.get('/:quizId/leaderboard', quizzesController.getLeaderboard);

// Route: GET /api/quizzes/manage/course/:courseId - Lấy đề thi kèm đáp án đầy đủ để chỉnh sửa
// (Chỉ dành cho Giảng viên / Admin — đặt TRƯỚC route /:courseId công khai bên dưới)
router.get('/manage/course/:courseId', authenticate, authorize([1, 2]), quizzesController.getQuizzesForManagement);

// Route: GET /api/quizzes/audio-stream - Stream/redirect file âm thanh bài nghe Cloudflare R2
router.get('/audio-stream', quizzesController.streamAudio);

// Route: GET /api/quizzes/:courseId (Công khai — KHÔNG trả đáp án đúng / gợi ý điền khuyết)
router.get('/:courseId', quizzesController.getQuizzes);

// Route: POST /api/quizzes/submit (Yêu cầu đăng nhập)
router.post('/submit', authenticate, quizLimiter, quizzesController.submitQuiz);

// Route: POST /api/quizzes/submit-writing
router.post('/submit-writing', authenticate, quizLimiter, aiLimiter, quizzesController.submitWriting);

// Route: POST /api/quizzes/submit-cloze
router.post('/submit-cloze', authenticate, quizLimiter, quizzesController.submitOpenCloze);

// Route: POST /api/quizzes/submit-audio
router.post('/submit-audio', authenticate, quizLimiter, aiLimiter, uploadLimiter, upload.memory.single('audio'), quizzesController.submitAudio);

// Route: GET /api/quizzes/manage/all - Quản lý tất cả đề thi & PIN Code (Chỉ dành cho Giảng viên / Admin)
router.get('/manage/all', authenticate, authorize([1, 2]), quizzesController.getAllQuizzesForManagement);

// Route: DELETE /api/quizzes/manage/:quizId - Xóa đề thi (Chỉ dành cho Giảng viên / Admin)
router.delete('/manage/:quizId', authenticate, authorize([1, 2]), quizzesController.deleteQuiz);

// Route: POST /api/quizzes - Tạo đề thi tự luyện mới (Chỉ dành cho Giảng viên / Admin)
router.post('/', authenticate, authorize([1, 2]), quizLimiter, quizzesController.createQuiz);

// Route: POST /api/quizzes/generate-ai - Sinh câu hỏi bằng AI (Dành cho Admin & Giảng viên)
router.post('/generate-ai', authenticate, authorize([1, 2]), quizLimiter, aiLimiter, quizzesController.generateQuizAi);

// Route: POST /api/quizzes/generate-ai-from-pdf - Thu nạp 1 hoặc nhiều đề thi PDF và sinh câu hỏi bằng AI theo Level
router.post(
  '/generate-ai-from-pdf',
  authenticate,
  authorize([1, 2]),
  upload.materialPdf.fields([
    { name: 'pdfs', maxCount: 10 },
    { name: 'pdf', maxCount: 10 }
  ]),
  quizLimiter,
  aiLimiter,
  quizzesController.generateQuizAiFromPdf
);

/**
 * @swagger
 * /api/quizzes/submit:
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
