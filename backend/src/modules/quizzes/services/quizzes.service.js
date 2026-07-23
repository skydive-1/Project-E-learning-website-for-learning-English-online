const db = require('../../../config/database');
const { geminiModel } = require("../../../utils/ai-clients");

class QuizzesService {
  async getQuizzesByCourseId(courseId) {
    try {
      let quizzesQuery;
      let params = [];

      if (courseId === 'free') {
        quizzesQuery = `
          SELECT quiz_id, course_id, title, description, difficulty, time_limit, created_at
          FROM quizzes
          WHERE course_id IS NULL
          ORDER BY quiz_id ASC
        `;
      } else {
        quizzesQuery = `
          SELECT quiz_id, course_id, title, description, difficulty, time_limit, created_at
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
        SELECT quiz_id, course_id, title, description, difficulty, time_limit, created_at
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

  async submitQuiz(userId, quizId, answers) {
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

      // 3. Lưu lịch sử làm bài vào quiz_attempts
      const insertAttemptQuery = `
        INSERT INTO quiz_attempts (user_id, quiz_id, score, completed_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
      const attemptResult = await db.query(insertAttemptQuery, [
        parseInt(userId, 10),
        parseInt(quizId, 10),
        score
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
      
      const expectedText = expectedSentence ? `\nCâu mẫu học viên cần đọc: "${expectedSentence}"\nHãy đối chiếu Transcript của bạn với câu mẫu trên để xem học viên đọc có đúng không.` : '';

      const prompt = `Bạn là một chuyên gia chấm điểm phát âm tiếng Anh.
Hãy nghe đoạn âm thanh thu âm của học viên và thực hiện:
1. Ghi ra bản Transcript chính xác những gì học viên đã nói.${expectedText}
2. Chấm điểm phát âm tổng quan theo thang 10.
3. Chỉ ra những lỗi phát âm sai so với từ chuẩn, nhận xét về trọng âm, ngữ điệu và hướng dẫn cách sửa chi tiết.
Trình bày thân thiện, tự nhiên bằng tiếng Việt.`;

      const result = await geminiModel.generateContent([
        prompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimetype || "audio/mp3"
          }
        }
      ]);

      return result.response.text();
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateAudio:", error);
      throw new Error("Lỗi hệ thống khi AI chấm điểm phát âm.");
    }
  }

  async createQuiz(title, description, difficulty, timeLimit, questions) {
    try {
      await db.query('BEGIN');
      const insertQuizQuery = `
        INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit)
        VALUES (NULL, NULL, $1, $2, $3, $4)
        RETURNING quiz_id
      `;
      const quizResult = await db.query(insertQuizQuery, [title, description, difficulty || 'Medium', parseInt(timeLimit, 10) || 10]);
      const quizId = quizResult.rows[0].quiz_id;

      if (questions && Array.isArray(questions) && questions.length > 0) {
        for (const q of questions) {
          const insertQuestionQuery = `
            INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, question_type)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6)
          `;
          const opts = Array.isArray(q.options) ? q.options : [];
          await db.query(insertQuestionQuery, [
            quizId,
            q.questionText,
            JSON.stringify(opts),
            q.correctAnswer || '',
            q.explanation || '',
            q.questionType || 'multiple_choice'
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
