const quizzesService = require('../services/quizzes.service');
const { geminiModel } = require('../../../utils/ai-clients');

exports.getQuizzes = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    
    if (!courseId) {
      const err = new Error("Thiếu courseId");
      err.status = 400;
      throw err;
    }

    const data = await quizzesService.getQuizzesByCourseId(courseId);
    
    // Trả về dữ liệu câu hỏi đầy đủ bao gồm đáp án và giải thích cho Frontend hiển thị kết quả
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
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type || 'multiple_choice'
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
    // Tiếp nhận userId từ middleware authenticate
    const userId = req.user?.id || req.user?.userId;
    const { quizId, courseId, answers, nickname } = req.body;
    
    if (!userId) {
      const err = new Error("Bạn cần đăng nhập tài khoản để thực hiện nộp bài thi.");
      err.status = 401;
      throw err;
    }

    if ((!quizId && !courseId) || !answers || !Array.isArray(answers)) {
      const err = new Error("Dữ liệu không hợp lệ. Yêu cầu có: quizId hoặc courseId, answers (dạng mảng)");
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

    const result = await quizzesService.submitQuiz(userId, finalQuizId, answers, nickname);
    res.status(201).json({
      success: true,
      message: "Nộp bài thi thành công",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const limit = req.query.limit || 5;
    if (!quizId) {
      const err = new Error("Thiếu quizId");
      err.status = 400;
      throw err;
    }
    const leaderboard = await quizzesService.getQuizLeaderboard(quizId, limit);
    res.status(200).json({
      success: true,
      data: leaderboard
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

exports.createQuiz = async (req, res, next) => {
  try {
    const { title, description, difficulty, timeLimit, questions } = req.body;
    if (!title) {
      const err = new Error("Tiêu đề đề thi không được trống.");
      err.status = 400;
      throw err;
    }
    const result = await quizzesService.createQuiz(title, description, difficulty, timeLimit, questions);
    res.status(201).json({
      success: true,
      message: "Tạo đề thi tự luyện mới thành công",
      data: result
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

exports.generateQuizAi = async (req, res, next) => {
  try {
    const { topic, count, questionTypes } = req.body;
    
    if (!topic || !topic.trim()) {
      const err = new Error('Vui lòng nhập chủ đề sinh câu hỏi.');
      err.status = 400;
      throw err;
    }

    const numQuestions = parseInt(count, 10) || 5;
    const types = Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ['multiple_choice'];

    const prompt = `You are a professional English language test creator.
Generate a list of exactly ${numQuestions} questions about the topic: "${topic}".
The types of questions to generate can include: ${types.join(', ')}.

For each question:
- If type is "multiple_choice":
  It must be a multiple choice question with exactly 4 options labeled starting with "A. ", "B. ", "C. ", "D. ".
  Specify the correctAnswer letter (only "A", "B", "C", or "D").
  Specify a detailed explanation in Vietnamese.
- If type is "writing":
  The correctAnswer must be left empty ("").
  Specify a detailed questionText prompt asking the user to write 2-3 sentences.
  Specify an explanation in Vietnamese of what grammar/vocab they should focus on.
- If type is "pronunciation":
  The correctAnswer must be the exact English sentence that the user needs to read aloud (for example: "English has become a global language for communication.").
  Specify a detailed explanation/guide in Vietnamese on how to pronounce it with correct stress/intonation.

Return a JSON array of objects with the following schema:
[
  {
    "questionType": "multiple_choice / writing / pronunciation",
    "questionText": "The question text or prompt",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"], // Empty array [] for writing and pronunciation
    "correctAnswer": "A / or the pronunciation text string", // Empty string "" for writing
    "explanation": "Detailed guide/explanation in Vietnamese"
  }
]`;

    console.log(`[Gemini Admin Quiz Generator] Generating quiz for topic: ${topic}`);
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    const questions = JSON.parse(responseText);

    res.status(200).json({
      success: true,
      message: `Đã tự động tạo thành công ${questions.length} câu hỏi bằng AI`,
      questions
    });
  } catch (error) {
    console.error('Lỗi sinh Quiz từ Gemini cho Admin:', error);
    next(error);
  }
};
