const db = require('../../../config/database');
const { geminiModel } = require("../../../utils/ai-clients");

class QuizzesService {
  async getQuizzesByCourseId(courseId) {
    try {
      let quizzesQuery;
      let params = [];

      if (courseId === 'free') {
        quizzesQuery = `
          SELECT quiz_id, course_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
          FROM quizzes
          WHERE course_id IS NULL AND (is_private IS FALSE OR is_private IS NULL)
          ORDER BY quiz_id ASC
        `;
      } else {
        quizzesQuery = `
          SELECT quiz_id, course_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
          FROM quizzes
          WHERE course_id = $1
          ORDER BY quiz_id ASC
        `;
        params.push(parseInt(courseId, 10));
      }

      const quizzesResult = await db.query(quizzesQuery, params);
      const quizzes = quizzesResult.rows;

      if (quizzes.length === 0) {
        return [];
      }

      // Lấy tất cả questions thuộc về danh sách quizzes trên
      const quizIds = quizzes.map(q => q.quiz_id);
      const questionsQuery = `
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation
        FROM questions
        WHERE quiz_id = ANY($1)
        ORDER BY question_id ASC
      `;
      const questionsResult = await db.query(questionsQuery, [quizIds]);
      const questions = questionsResult.rows;

      // Group questions by quiz_id
      const questionsMap = {};
      questions.forEach(q => {
        if (!questionsMap[q.quiz_id]) {
          questionsMap[q.quiz_id] = [];
        }
        questionsMap[q.quiz_id].push(q);
      });

      // Trả về quizzes kèm questions tương ứng
      return quizzes.map(q => ({
        ...q,
        questions: questionsMap[q.quiz_id] || []
      }));
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.getQuizzesByCourseId:", error);
      throw error;
    }
  }

  async getQuizById(quizId) {
    try {
      const quizQuery = `
        SELECT quiz_id, course_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
        FROM quizzes
        WHERE quiz_id = $1
      `;
      const quizResult = await db.query(quizQuery, [parseInt(quizId, 10)]);
      if (quizResult.rows.length === 0) return null;
      
      const quiz = quizResult.rows[0];

      const questionsQuery = `
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation
        FROM questions
        WHERE quiz_id = $1
        ORDER BY question_id ASC
      `;
      const questionsResult = await db.query(questionsQuery, [quiz.quiz_id]);
      
      return {
        ...quiz,
        questions: questionsResult.rows
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.getQuizById:", error);
      throw error;
    }
  }

  async getQuizByPin(pinCode) {
    try {
      if (!pinCode) return null;
      const quizQuery = `
        SELECT quiz_id, course_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
        FROM quizzes
        WHERE UPPER(pin_code) = UPPER($1)
      `;
      const quizResult = await db.query(quizQuery, [pinCode.trim()]);
      if (quizResult.rows.length === 0) return null;

      const quiz = quizResult.rows[0];

      const questionsQuery = `
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation
        FROM questions
        WHERE quiz_id = $1
        ORDER BY question_id ASC
      `;
      const questionsResult = await db.query(questionsQuery, [quiz.quiz_id]);

      return {
        ...quiz,
        questions: questionsResult.rows
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.getQuizByPin:", error);
      throw error;
    }
  }

  async submitQuiz(userId, quizId, answers, nickname = '') {
    try {
      // 1. Lấy danh sách câu hỏi của đề thi
      const questionsQuery = `
        SELECT question_id, correct_answer
        FROM questions
        WHERE quiz_id = $1
      `;
      const questionsResult = await db.query(questionsQuery, [parseInt(quizId, 10)]);
      const questions = questionsResult.rows;

      if (questions.length === 0) {
        throw new Error("Không tìm thấy câu hỏi cho đề thi trắc nghiệm này.");
      }

      let correctCount = 0;
      const totalQuestions = questions.length;

      // 2. Tính điểm
      const questionMap = {};
      questions.forEach(q => {
        questionMap[q.question_id] = q.correct_answer;
      });

      answers.forEach(ans => {
        if (questionMap[ans.question_id] && questionMap[ans.question_id] === ans.answer) {
          correctCount++;
        }
      });

      const score = Math.round((correctCount / totalQuestions) * 100);
      const validUserId = (userId && !isNaN(parseInt(userId, 10))) ? parseInt(userId, 10) : null;

      // 3. Lưu lịch sử làm bài vào quiz_attempts
      const insertAttemptQuery = `
        INSERT INTO quiz_attempts (user_id, quiz_id, score, nickname, completed_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      const attemptResult = await db.query(insertAttemptQuery, [
        validUserId,
        parseInt(quizId, 10),
        score,
        nickname || null
      ]);

      return {
        score,
        correct_count: correctCount,
        total_questions: totalQuestions,
        attempt: attemptResult.rows[0]
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.submitQuiz:", error);
      throw error;
    }
  }

  async getQuizLeaderboard(quizId, limit = 5) {
    try {
      const query = `
        SELECT 
          qa.attempt_id,
          qa.score,
          qa.completed_at,
          COALESCE(u.full_name, u.username, qa.nickname, 'Học viên') AS user_name,
          qa.nickname
        FROM quiz_attempts qa
        LEFT JOIN users u ON qa.user_id = u.user_id
        WHERE qa.quiz_id = $1
        ORDER BY qa.score DESC, qa.completed_at ASC
        LIMIT $2
      `;
      const result = await db.query(query, [parseInt(quizId, 10), parseInt(limit, 10)]);
      return result.rows;
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.getQuizLeaderboard:", error);
      throw error;
    }
  }

  async evaluateWriting(writingText) {
    try {
      const prompt = `Bạn là một giáo viên tiếng Anh chuyên chấm thi. Hãy đọc bài luận sau của học viên và thực hiện các bước sau:
1. Chấm điểm bài luận theo thang 10.
2. Tìm và chỉ ra các lỗi sai về ngữ pháp, từ vựng hoặc cấu trúc câu.
3. Gợi ý cách sửa và viết lại sao cho tự nhiên, chuẩn bản ngữ hơn.
Trình bày thân thiện, dễ hiểu bằng tiếng Việt.

Đoạn văn của học viên:
"${writingText}"`;

      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateWriting:", error);
      throw new Error("Lỗi hệ thống khi AI chấm điểm bài luận.");
    }
  }

  async evaluateAudio(filePath, mimetype, expectedSentence) {
    try {
      const fs = require('fs');
      const audioData = fs.readFileSync(filePath);
      const audioBase64 = audioData.toString("base64");
      
      const prompt = `Bạn là một chuyên gia chấm điểm bài nói và phát âm tiếng Anh.
Hãy nghe file âm thanh thu âm của học viên và thực hiện phân tích:
1. Nếu file âm thanh im lặng, rỗng, không có tiếng nói hoặc học viên chưa nói gì:
   Trả về JSON:
   {
     "score": 0,
     "feedback": "Hệ thống không ghi nhận được giọng nói từ Micro của bạn. Bạn chưa phát âm hoặc Micro chưa thu được tiếng.",
     "errors": ["Học viên chưa phát âm hoặc chưa trả lời qua Micro."],
     "suggestedText": "${expectedSentence || ''}"
   }
2. Ngược lại, nếu học viên có trả lời bằng giọng nói:
   - Chấm điểm tổng quan từ 0 đến 100 dựa trên độ chính xác phát âm, ngữ điệu và trôi chảy.
   - Nhận xét chi tiết bằng tiếng Việt trong trường "feedback".
   - Liệt kê các lỗi phát âm / ngữ pháp (nếu có) trong mảng "errors".
   - Đề xuất câu nói chuẩn trong "suggestedText".

Định dạng trả về duy nhất là JSON theo cấu trúc:
{
  "score": number,
  "feedback": string,
  "errors": Array<string>,
  "suggestedText": string
}`;

      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: audioBase64,
                  mimeType: mimetype || "audio/webm"
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const responseText = result.response.text();
      try {
        return JSON.parse(responseText);
      } catch (e) {
        return {
          score: 50,
          feedback: responseText,
          errors: [],
          suggestedText: expectedSentence || ''
        };
      }
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateAudio:", error);
      return {
        score: 0,
        feedback: "Chưa ghi nhận được âm thanh giọng nói từ Micro. Vui lòng bấm Micro và nói lại!",
        errors: ["Chưa phát hiện giọng nói qua Micro."],
        suggestedText: expectedSentence || ''
      };
    }
  }

  async createQuiz(title, description, difficulty, timeLimit, questions, isPrivate = false, pinCode = null) {
    try {
      await db.query('BEGIN');
      const insertQuizQuery = `
        INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code)
        VALUES (NULL, NULL, $1, $2, $3, $4, $5, $6)
        RETURNING quiz_id
      `;
      const quizResult = await db.query(insertQuizQuery, [
        title,
        description,
        difficulty || 'Medium',
        parseInt(timeLimit, 10) || 10,
        Boolean(isPrivate),
        pinCode ? String(pinCode).trim() : null
      ]);
      const quizId = quizResult.rows[0].quiz_id;

      if (questions && Array.isArray(questions) && questions.length > 0) {
        for (const q of questions) {
          const insertQuestionQuery = `
            INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, question_type)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6)
          `;
          const qText = q.question_text || q.questionText || q.question || '';
          const qCorr = q.correct_answer || q.correctAnswer || q.answer || 'A';
          const qExpl = q.explanation || '';
          const qType = q.question_type || q.questionType || 'multiple_choice';
          const opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? [q.options] : []);

          await db.query(insertQuestionQuery, [
            quizId,
            qText,
            JSON.stringify(opts),
            qCorr,
            qExpl,
            qType
          ]);
        }
      }
      await db.query('COMMIT');
      return { quizId, title, description };
    } catch (error) {
      await db.query('ROLLBACK');
      console.error("Lỗi xảy ra tại QuizzesService.createQuiz:", error);
      throw error;
    }
  }
}

module.exports = new QuizzesService();
