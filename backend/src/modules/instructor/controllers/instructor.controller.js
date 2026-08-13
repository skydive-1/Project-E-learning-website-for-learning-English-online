/**
 * Instructor Controller - Tiếp nhận và phản hồi các request quản lý của giảng viên
 */

const instructorService = require('../services/instructor.service');

exports.getStudents = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const students = await instructorService.getStudents(instructorId);
    
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách học viên thành công',
      data: students
    });
  } catch (error) {
    next(error);
  }
};

exports.getPerformance = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const performanceData = await instructorService.getPerformance(instructorId);
    
    res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu hiệu suất thành công',
      data: performanceData
    });
  } catch (error) {
    next(error);
  }
};

const { geminiModel } = require('../../../utils/ai-clients');

exports.generateQuiz = async (req, res, next) => {
  try {
    const { topic, count } = req.body;
    
    if (!topic || !topic.trim()) {
      const err = new Error('Vui lòng nhập chủ đề câu hỏi (topic)');
      err.status = 400;
      throw err;
    }
    
    const numQuestions = parseInt(count) || 5;
    
    const prompt = `You are a professional English language test creator.
Generate a quiz with ${numQuestions} multiple choice questions about the topic: "${topic}".
Each question must be a multiple choice question with exactly 4 options labeled starting with "A. ", "B. ", "C. ", "D. ".
For each question, specify the question text, the options, the correct answer letter (only "A", "B", "C", or "D"), and a clear explanation in Vietnamese explaining why it is correct.

You must return a JSON array of objects with the following schema:
[
  {
    "question": "The question text",
    "options": [
      "A. Option text",
      "B. Option text",
      "C. Option text",
      "D. Option text"
    ],
    "correctAnswer": "B",
    "explanation": "Detailed explanation in Vietnamese"
  }
]`;

    console.log(`[Gemini Quiz Generator] Generating quiz for topic: ${topic}`);
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
      message: `Đã tạo thành công ${questions.length} câu hỏi bằng AI`,
      questions
    });
  } catch (error) {
    console.error('Lỗi sinh Quiz từ Gemini:', error);
    next(error);
  }
};

exports.acceptPolicy = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const { signature } = req.body;
    
    // Lấy IP thật của giảng viên
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!signature || !signature.trim()) {
      const err = new Error('Chữ ký số đồng ý điều khoản bản quyền (signature) là bắt buộc');
      err.status = 400;
      throw err;
    }

    const result = await instructorService.acceptPolicy(instructorId, ipAddress, signature.trim());

    res.status(200).json({
      success: true,
      message: 'Xác nhận thỏa thuận bản quyền và gắn watermark tài liệu thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

