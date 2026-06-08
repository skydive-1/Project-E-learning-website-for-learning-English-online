/**
 * Chatbot Routes - Định nghĩa endpoints cho Module Chatbot
 */

const express = require('express');
const router = express.Router();
const chatbotController = require('./controllers/chatbot.controller');
const validate = require('../../middleware/validation.middleware');

// Schema Validation
const askSchema = {
  body: {
    question: { required: true }
  }
};

// Route: POST /api/chatbot/ask
router.post('/ask', validate(askSchema), chatbotController.ask);

module.exports = router;
