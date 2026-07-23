const quizzesService = require('../services/quizzes.service');

exports.getQuizzes = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    
    if (!courseId) {
      const err = new Error("Thiếu courseId");
      err.status = 400;
      throw err;
    }

    const data = await quizzesService.getQuizzesByCourseId(courseId);
    
    // Ẩn đáp án đúng và giải thích trước khi trả về cho Frontend làm bài
    const sanitizedData = data.map(quiz => ({
      quiz_id: quiz.quiz_id,
      course_id: quiz.course_id,
      title: quiz.title,
      description: quiz.description,
      difficulty: quiz.difficulty,
      time_limit: quiz.time_limit,
      questions: quiz.questions.map(q => ({
        question_id: q.question_id,
        question_text: q.question_text,
        options: q.options
      }))
    }));

    res.status(200).json({
      success: true,
      data: sanitizedData
    });
  } catch (error) {
    next(error);
  }
};

exports.submitQuiz = async (req, res, next) => {
  try {
    // Tiếp nhận userId, quizId/courseId và mảng đáp án answers
    const userId = req.body.userId || req.user?.id || req.user?.userId;
    const { quizId, courseId, answers } = req.body;
    
    if (!userId || (!quizId && !courseId) || !answers || !Array.isArray(answers)) {
      const err = new Error("Dữ liệu không hợp lệ. Yêu cầu có: userId, quizId hoặc courseId, answers (dạng mảng)");
      err.status = 400;
      throw err;
    }

    let finalQuizId = quizId;
    if (!finalQuizId && courseId) {
      // Nếu chỉ truyền courseId, tự động tìm quiz đầu tiên của khóa học đó
      const quizzes = await quizzesService.getQuizzesByCourseId(courseId);
      if (quizzes.length > 0) {
        finalQuizId = quizzes[0].quiz_id;
      } else {
        const err = new Error("Không tìm thấy đề thi trắc nghiệm cho khóa học này.");
        err.status = 404;
        throw err;
      }
    }

    const result = await quizzesService.submitQuiz(userId, finalQuizId, answers);
    res.status(201).json({
      success: true,
      message: "Nộp bài thi thành công",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.submitWriting = async (req, res, next) => {
  try {
    const { writing } = req.body;
    if (!writing) {
      const err = new Error("Vui lòng gửi nội dung bài luận (field: writing)");
      err.status = 400;
      throw err;
    }
    
    const evaluation = await quizzesService.evaluateWriting(writing);
    
    res.status(200).json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    next(error);
  }
};

exports.submitAudio = async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error("Vui lòng cung cấp file âm thanh (field: audio).");
      err.status = 400;
      throw err;
    }
    const expectedSentence = req.body.expectedSentence || "";

    const filePath = req.file.path;
    const mimetype = req.file.mimetype;

    const evaluation = await quizzesService.evaluateAudio(filePath, mimetype, expectedSentence);

    // Xóa file tạm sau khi đã xử lý xong
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    next(error);
  }
};
