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

exports.askStream = async (req, res, next) => {
  try {
    const { question, lessonId } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    await chatbotService.askStream(question, lessonId, req.user?.id, (chunkText) => {
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    });

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
      res.end();
    }
  }
};

exports.saveHistory = async (req, res, next) => {
  try {
    // Tiếp nhận các trường dữ liệu theo API Contract
    const { user_id, lesson_id, question, answer } = req.body;

    if (!user_id || !question || !answer) {
      const err = new Error("Dữ liệu không đầy đủ. Yêu cầu các trường: user_id, question, answer");
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

exports.clearHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa xác thực' });
    }

    const result = await chatbotService.clearHistory(userId);
    res.status(200).json({
      success: true,
      message: result.message
    });
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

    const audioSource = req.file.buffer || req.file.path;
    const mimetype = req.file.mimetype;
    const targetText = req.body.targetText || null;
    const isQA = req.body.isQA === 'true';

    const evaluation = await chatbotService.evaluateAudio(audioSource, mimetype, targetText, isQA);

    // Xóa file tạm sau khi đã đánh giá xong bằng AI nếu là disk storage
    if (req.file.path) {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
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

exports.getTokenBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Đảm bảo user chỉ có thể xem số dư của chính mình, trừ phi là Admin (role 1)
    if (parseInt(req.user.id) !== parseInt(userId) && req.user.roleId !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thông tin ví của người dùng khác'
      });
    }

    const balance = await chatbotService.getTokenBalance(userId);
    res.status(200).json(balance);
  } catch (error) {
    next(error);
  }
};

