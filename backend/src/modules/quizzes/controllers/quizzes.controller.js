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
    
    // Ẩn đáp án đúng trước khi trả về cho Frontend
    const sanitizedData = data.map(q => ({
      question_id: q.question_id,
      course_id: q.course_id,
      question_text: q.question_text,
      options: q.options
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
    // Tiếp nhận userId, courseId và mảng đáp án answers
    const userId = req.body.userId || req.user?.id;
    const { courseId, answers } = req.body;
    
    if (!userId || !courseId || !answers || !Array.isArray(answers)) {
      const err = new Error("Dữ liệu không hợp lệ. Yêu cầu có: userId, courseId, answers (dạng mảng)");
      err.status = 400;
      throw err;
    }

    const result = await quizzesService.submitQuiz(userId, courseId, answers);
    res.status(201).json({
      success: true,
      message: "Nộp bài thi thành công",
      data: result
    });
  } catch (error) {
    next(error);
  }
};
