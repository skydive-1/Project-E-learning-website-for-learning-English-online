const db = require('../../../config/database');

class QuizzesService {
  async getQuizzesByCourseId(courseId) {
    try {
      const queryText = `
        SELECT question_id, course_id, question_text, options, correct_answer
        FROM questions
        WHERE course_id = $1
      `;
      const result = await db.query(queryText, [courseId]);
      return result.rows;
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.getQuizzesByCourseId:", error);
      throw error;
    }
  }

  async submitQuiz(userId, courseId, answers) {
    try {
      // 1. Lấy danh sách câu hỏi của khoá học
      const questionsQuery = `
        SELECT question_id, correct_answer
        FROM questions
        WHERE course_id = $1
      `;
      const questionsResult = await db.query(questionsQuery, [courseId]);
      const questions = questionsResult.rows;

      if (questions.length === 0) {
        throw new Error("Không tìm thấy câu hỏi cho khóa học này.");
      }

      let correctCount = 0;
      const totalQuestions = questions.length;

      // 2. Chấm điểm
      const questionMap = {};
      questions.forEach(q => {
        questionMap[q.question_id] = q.correct_answer;
      });

      answers.forEach(ans => {
        if (questionMap[ans.question_id] && questionMap[ans.question_id] === ans.answer) {
          correctCount++;
        }
      });

      const score = (correctCount / totalQuestions) * 100;

      // 3. Lưu lịch sử
      const insertHistoryQuery = `
        INSERT INTO quiz_history (user_id, course_id, score, total_questions, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      const historyResult = await db.query(insertHistoryQuery, [userId, courseId, score, totalQuestions]);

      return {
        score,
        correct_count: correctCount,
        total_questions: totalQuestions,
        history: historyResult.rows[0]
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.submitQuiz:", error);
      throw error;
    }
  }
}

module.exports = new QuizzesService();
