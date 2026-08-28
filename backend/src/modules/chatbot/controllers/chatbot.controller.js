/**
 * Chatbot Controller - Tiếp nhận và phản hồi câu hỏi AI RAG
 */

const chatbotService = require('../services/chatbot.service');
const { releaseQuestionLimit } = require('../../../middleware/tokenLimit.middleware');

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
    await releaseQuestionLimit(req);
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
    await releaseQuestionLimit(req);
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        code: error.code || 'AI_STREAM_ERROR',
        error: error.message || 'Stream error'
      })}\n\n`);
      res.end();
    }
  }
};

exports.saveHistory = async (req, res, next) => {
  try {
    // Tiếp nhận các trường dữ liệu theo API Contract
    const { user_id, userId, lesson_id, question, answer, sources, actions } = req.body;
    const targetUserId = user_id || userId;

    if (!targetUserId || !question || !answer) {
      const err = new Error("Dữ liệu không đầy đủ. Yêu cầu các trường: user_id, question, answer");
      err.status = 400;
      throw err;
    }

    const currentUserId = req.user?.id || req.user?.userId;
    const isOwner = currentUserId && String(currentUserId) === String(targetUserId);
    const isAdmin = req.user?.roleId === 1 || req.user?.role_id === 1;

    if (!isOwner && !isAdmin) {
      const err = new Error("Bạn không có quyền lưu lịch sử chat của người dùng khác");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const result = await chatbotService.saveHistory(targetUserId, lesson_id, question, answer, sources, actions);
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

    const currentUserId = req.user?.id || req.user?.userId;
    const isOwner = currentUserId && String(currentUserId) === String(userId);
    const isAdmin = req.user?.roleId === 1 || req.user?.role_id === 1;

    if (!isOwner && !isAdmin) {
      const err = new Error("Bạn không có quyền truy cập lịch sử chat của người dùng khác");
      err.status = 403;
      err.code = "FORBIDDEN";
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
    const currentUserId = req.user?.id || req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa xác thực' });
    }

    // DELETE requests normally have no request body. Optional chaining prevents
    // a body-less request from throwing before the authenticated owner is used.
    const targetUserId = req.params.userId || req.body?.userId || req.query.userId || currentUserId;
    const isOwner = String(currentUserId) === String(targetUserId);
    const isAdmin = req.user?.roleId === 1 || req.user?.role_id === 1;

    if (!isOwner && !isAdmin) {
      const err = new Error("Bạn không có quyền xóa lịch sử chat của người dùng khác");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const lessonId = req.params.lessonId !== undefined
      ? req.params.lessonId
      : (req.query.lessonId !== undefined ? req.query.lessonId : req.body?.lessonId);
    const result = await chatbotService.clearHistory(targetUserId, lessonId);
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
    await releaseQuestionLimit(req);
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
    let effectiveTargetText = targetText || null;
    let effectiveQuestionText = questionText || null;

    if (req.body.mode) {
      const validModes = ['chat', 'read_aloud', 'qa'];
      if (!validModes.includes(req.body.mode)) {
        const err = new Error("Chế độ đánh giá mode không hợp lệ. Cho phép: chat, read_aloud, qa");
        err.status = 400;
        throw err;
      }
      mode = req.body.mode;
      if (mode === 'read_aloud' && (!effectiveTargetText || !effectiveTargetText.trim())) {
        const err = new Error("Thiếu targetText cho bài tập Read Aloud");
        err.status = 400;
        throw err;
      }
      if (mode === 'qa' && (!effectiveQuestionText || !effectiveQuestionText.trim())) {
        const err = new Error("Thiếu questionText cho bài tập Q&A");
        err.status = 400;
        throw err;
      }
    } else {
      // Legacy mapping: Ưu tiên isQA trước targetText
      if (isQA) {
        mode = 'qa';
        if (!effectiveQuestionText || !effectiveQuestionText.trim()) {
          if (effectiveTargetText && effectiveTargetText.trim()) {
            effectiveQuestionText = effectiveTargetText;
          } else {
            const err = new Error("Thiếu questionText cho bài tập Q&A");
            err.status = 400;
            throw err;
          }
        }
      } else if (effectiveTargetText && effectiveTargetText.trim()) {
        mode = 'read_aloud';
      } else {
        // Request từ ChatBox không gửi targetText, không gửi isQA, không gửi mode
        mode = 'chat';
      }
    }

    const result = await chatbotService.processAudio(audioSource, mimetype, {
      mode,
      targetText: effectiveTargetText,
      questionText: effectiveQuestionText,
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

/**
 * Lấy danh sách 4 câu hỏi gợi ý cho bài học (Udemy-like AI Assistant Feature)
 * GET /api/chatbot/suggested-questions/:lessonId
 */
exports.getSuggestedQuestions = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const suggestedQuestionsService = require('../../lessons/services/suggestedQuestions.service');
    const questions = await suggestedQuestionsService.getSuggestedQuestionsByLessonId(lessonId);

    res.status(200).json({
      success: true,
      lessonId: parseInt(lessonId, 10) || 0,
      questions
    });
  } catch (error) {
    next(error);
  }
};


