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

exports.saveHistory = async (req, res, next) => {
  try {
    // Tiếp nhận 4 trường dữ liệu từ Quốc Anh
    const { userId, lessonId, title, sender_type } = req.body;

    if (!userId || !lessonId || !title || !sender_type) {
      const err = new Error("Dữ liệu không đầy đủ. Yêu cầu 4 trường: userId, lessonId, title, sender_type");
      err.status = 400;
      throw err;
    }

    const result = await chatbotService.saveHistory(userId, lessonId, title, sender_type);
    res.status(201).json({
      success: true,
      message: "Lưu lịch sử tin nhắn thành công",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { userId, lessonId } = req.params;

    if (!userId || !lessonId) {
      const err = new Error("Thiếu userId hoặc lessonId");
      err.status = 400;
      throw err;
    }

    const data = await chatbotService.getHistory(userId, lessonId);
    // Trả về trực tiếp mảng JSON theo quy chuẩn API Contract
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

