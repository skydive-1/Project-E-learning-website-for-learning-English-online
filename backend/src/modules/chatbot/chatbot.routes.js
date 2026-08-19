const express = require('express');
const router = express.Router();
const chatbotController = require('./controllers/chatbot.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validation.middleware');
const upload = require('../../middleware/upload.middleware');
const { checkTokenLimit } = require('../../middleware/tokenLimit.middleware');

// Schema Validation
const askSchema = {
  body: {
    question: { required: true },
    lessonId: { required: false },
    scope: { required: false }
  }
};

// Route: POST /api/chatbot/ask (Yêu cầu đăng nhập để tránh lạm dụng hạn mức dịch vụ AI)
router.post('/ask', authenticate, checkTokenLimit, validate(askSchema), chatbotController.ask);
router.post('/ask-stream', authenticate, checkTokenLimit, validate(askSchema), chatbotController.askStream);
router.post('/generate-quiz', authenticate, checkTokenLimit, chatbotController.generateQuiz);

// API Kiểm tra ví Token AI còn lại
router.get('/token-balance/:userId', authenticate, chatbotController.getTokenBalance);

// API Lịch sử Chat (Độc lập, nhận trực tiếp userId/lessonId từ Frontend)
router.post('/history', chatbotController.saveHistory);
router.get('/history/:userId/:lessonId', chatbotController.getHistory);
router.delete('/history/:lessonId', authenticate, chatbotController.clearHistory);
router.delete('/history', authenticate, chatbotController.clearHistory);

// API xử lý phát âm (Audio)
router.post('/audio', authenticate, upload.audioMemory.single('audio'), chatbotController.processAudio);

/**
 * @swagger
 * tags:
 *   name: Chatbot
 *   description: AI Chatbot API
 * 
 * /api/chatbot/ask:
 *   post:
 *     summary: Đặt câu hỏi cho chatbot
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 * 
 * /api/chatbot/history:
 *   post:
 *     summary: Lưu lịch sử chat
 *     tags: [Chatbot]
 * 
 * /api/chatbot/history/{userId}/{lessonId}:
 *   get:
 *     summary: Lấy lịch sử chat
 *     tags: [Chatbot]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 * 
 * /api/chatbot/audio:
 *   post:
 *     summary: Gửi file âm thanh để AI nhận diện và đánh giá phát âm
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: File âm thanh (MP3, WAV, WEBM...)
 *     responses:
 *       200:
 *         description: Trả về kết quả đánh giá phát âm
 */
module.exports = router;

