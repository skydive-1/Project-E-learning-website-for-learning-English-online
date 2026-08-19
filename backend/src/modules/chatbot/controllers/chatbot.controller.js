/**
 * Chatbot Controller - Tiếp nhận và phản hồi câu hỏi AI RAG
 */

const chatbotService = require('../services/chatbot.service');

exports.ask = async (req, res, next) => {
  try {
    const { question, lessonId, scope, currentTime, quickAction } = req.body;
    const answer = await chatbotService.ask(question, lessonId, req.user?.id, scope || 'lesson', currentTime, quickAction);

    res.status(200).json({
      success: true,
      data: answer.reply !== undefined ? answer.reply : answer,
      intent: answer.intent || 'CURRENT_LESSON_QA',
      sources: answer.sources || [],
      actions: answer.actions || []
    });
  } catch (error) {
    next(error);
  }
};

exports.askStream = async (req, res, next) => {
  try {
    const { question, lessonId, scope, currentTime, quickAction } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    await chatbotService.askStream(question, lessonId, req.user?.id, (eventData) => {
      if (typeof eventData === 'string') {
        res.write(`data: ${JSON.stringify({ type: 'token', text: eventData })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      }
    }, scope || 'lesson', currentTime, quickAction);

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Stream error' })}\n\n`);
      res.end();
    }
  }
};

exports.saveHistory = async (req, res, next) => {
  try {
    // Tiếp nhận các trường dữ liệu theo API Contract
    const { user_id, lesson_id, question, answer, sources, actions } = req.body;

    if (!user_id || !question || !answer) {
      const err = new Error("Dữ liệu không đầy đủ. Yêu cầu các trường: user_id, question, answer");
      err.status = 400;
      throw err;
    }

    const result = await chatbotService.saveHistory(user_id, lesson_id, question, answer, sources, actions);
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

    const lessonId = req.params.lessonId !== undefined ? req.params.lessonId : (req.query.lessonId !== undefined ? req.query.lessonId : req.body.lessonId);
    const result = await chatbotService.clearHistory(userId, lessonId);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

exports.generateQuiz = async (req, res, next) => {
  try {
    const { lessonId } = req.body;
    const quiz = await chatbotService.generateQuiz(lessonId, req.user?.id);
    res.status(200).json({
      success: true,
      data: quiz.questions || quiz.quizData || quiz
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
    const { targetText, questionText, questionId, lessonId } = req.body;
    const isQA = req.body.isQA === 'true';

    // Phân giải mode theo ma trận tương thích
    let mode;
    if (req.body.mode) {
      const validModes = ['chat', 'read_aloud', 'qa'];
      if (!validModes.includes(req.body.mode)) {
        const err = new Error("Chế độ đánh giá mode không hợp lệ. Cho phép: chat, read_aloud, qa");
        err.status = 400;
        throw err;
      }
      mode = req.body.mode;
      if (mode === 'read_aloud' && (!targetText || !targetText.trim())) {
        const err = new Error("Thiếu targetText cho bài tập Read Aloud");
        err.status = 400;
        throw err;
      }
      if (mode === 'qa' && (!questionText || !questionText.trim())) {
        const err = new Error("Thiếu questionText cho bài tập Q&A");
        err.status = 400;
        throw err;
      }
    } else {
      // Legacy mapping
      if (targetText && targetText.trim()) {
        mode = 'read_aloud';
      } else if (isQA) {
        if (!questionText || !questionText.trim()) {
          const err = new Error("Thiếu questionText cho bài tập Q&A");
          err.status = 400;
          throw err;
        }
        mode = 'qa';
      } else {
        // Request từ ChatBox không gửi targetText, không gửi isQA, không gửi mode
        mode = 'chat';
      }
    }

    const result = await chatbotService.processAudio(audioSource, mimetype, {
      mode,
      targetText: targetText || null,
      questionText: questionText || null,
      questionId: questionId || null,
      lessonId: lessonId || null,
      userId: req.user?.id || req.user?.userId || null
    });

    // Xóa file tạm sau khi đã xử lý xong nếu là disk storage
    if (req.file.path) {
      const fs = require('fs');
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) { /* ignore cleanup error */ }
    }

    res.status(200).json({
      success: true,
      message: mode === 'chat' ? "Nhận diện giọng nói thành công" : "Đánh giá phát âm thành công",
      data: result
    });
  } catch (error) {
    if (req.file && req.file.path) {
      const fs = require('fs');
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) { /* ignore cleanup error */ }
    }
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

