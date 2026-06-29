const express = require('express');
const router = express.Router();
const chatbotController = require('./controllers/chatbot.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validation.middleware');

// Schema Validation
const askSchema = {
  body: {
    question: { required: true },
    lessonId: { required: true }
  }
};

// Route: POST /api/chatbot/ask (Yêu cầu đăng nhập để tránh lạm dụng hạn mức dịch vụ AI)
router.post('/ask', authenticate, validate(askSchema), chatbotController.ask);

// API Lịch sử Chat (Độc lập, nhận trực tiếp userId/lessonId từ Frontend)
router.post('/history', chatbotController.saveHistory);
router.get('/history/:userId/:lessonId', chatbotController.getHistory);

module.exports = router;

