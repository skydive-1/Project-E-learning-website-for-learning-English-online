/**
 * Chatbot Module - Xử lý câu hỏi tích hợp RAG AI
 */

const express = require('express');
const router = express.Router();
const { askChatbot } = require('./services/chatbot.service');

// Route: POST /api/chatbot/ask
router.post('/ask', async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Câu hỏi không được để trống'
      });
    }

    const result = await askChatbot(question);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
