const express = require('express');
const router = express.Router();
const chatbotController = require('./controllers/chatbot.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validation.middleware');

// Schema Validation
const askSchema = {
  body: {
    question: { required: true }
  }
};

// Route: POST /api/chatbot/ask (Yêu cầu đăng nhập để tránh lạm dụng hạn mức dịch vụ AI)
router.post('/ask', authenticate, validate(askSchema), chatbotController.ask);

module.exports = router;
