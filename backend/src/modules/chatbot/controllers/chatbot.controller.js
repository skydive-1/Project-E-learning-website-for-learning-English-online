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
    // Tiếp nhận các trường dữ liệu theo API Contract
    const { user_id, lesson_id, question, answer } = req.body;

    if (!user_id || !lesson_id || !question || !answer) {
      const err = new Error("Dữ liệu không đầy đủ. Yêu cầu 4 trường: user_id, lesson_id, question, answer");
      err.status = 400;
      throw err;
    }

    const result = await chatbotService.saveHistory(user_id, lesson_id, question, answer);
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

exports.processAudio = async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error("Vui lòng cung cấp file âm thanh (field: audio).");
      err.status = 400;
      throw err;
    }

    const filePath = req.file.path;
    const mimetype = req.file.mimetype;
    const targetText = req.body.targetText || null;
    const isQA = req.body.isQA === 'true';

    const evaluation = await chatbotService.evaluateAudio(filePath, mimetype, targetText, isQA);

    // Xóa file tạm sau khi đã đánh giá xong bằng AI
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      message: "Đánh giá phát âm thành công",
      data: evaluation
    });
  } catch (error) {
    next(error);
  }
};

