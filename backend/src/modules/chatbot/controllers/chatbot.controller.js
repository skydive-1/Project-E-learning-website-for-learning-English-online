/**
 * Chatbot Controller - Tiếp nhận và phản hồi câu hỏi AI RAG
 */

const chatbotService = require('../services/chatbot.service');

exports.ask = async (req, res, next) => {
  try {
    const { question, lessonId } = req.body;
    const answer = await chatbotService.ask(question, lessonId, req.user?.id);
    
    res.status(200).json({
      success: true,
      data: answer
    });
  } catch (error) {
    next(error);
  }
};
