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
      const prompt = `You are an expert English writing tutor evaluating a student's essay or open-ended written response.
Analyze the student's written response carefully for grammar, vocabulary choice, sentence structure, coherence, and relevance.

Format the response as a JSON object containing EXACTLY these keys:
1. "score": (number) An overall score from 0 to 100 based on quality.
2. "detailed_feedback": (string) Specific, constructive feedback in friendly Vietnamese explaining strengths and areas for improvement.
3. "improved_sentence": (string) A corrected, natural, native-like English polished version of their response.
4. "errors": (array of strings) List of specific grammar, spelling, or vocabulary mistakes detected in friendly Vietnamese.

Ensure the response contains ONLY valid JSON without markdown formatting or backticks.`;

      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { text: `Student's written response: "${writingText}"` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      let responseText = result.response.text();
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsed = JSON.parse(responseText);

      return {
        score: parsed.score !== undefined ? Number(parsed.score) : 80,
        detailed_feedback: parsed.detailed_feedback || "Bài viết của bạn diễn đạt khá tốt.",
        improved_sentence: parsed.improved_sentence || "",
        feedback: parsed.detailed_feedback || "Bài viết của bạn diễn đạt khá tốt.",
        suggestedText: parsed.improved_sentence || "",
        errors: parsed.errors && Array.isArray(parsed.errors) ? parsed.errors : []
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateWriting:", error);
      return {
        score: 75,
        detailed_feedback: "Bài làm tự luận của bạn đã được ghi nhận. Hãy tiếp tục trau dồi từ vựng và cấu trúc ngữ pháp nâng cao nhé!",
        improved_sentence: writingText,
        feedback: "Bài làm tự luận của bạn đã được ghi nhận. Hãy tiếp tục trau dồi từ vựng và cấu trúc ngữ pháp nâng cao nhé!",
        suggestedText: writingText,
        errors: []
      };
    }
  }

  async evaluateAudio(filePath, mimetype, expectedSentence) {
    try {
      const fs = require('fs');
      const audioData = fs.readFileSync(filePath);
      const audioBase64 = audioData.toString("base64");
      
      const prompt = `You are a professional English language and pronunciation tutor.
Analyze the user's spoken audio. Compare their pronunciation against the expected sentence: "${expectedSentence || ''}".
Evaluate the user's pronunciation, grammar, and fluency.

Format the response as a JSON object containing EXACTLY these keys:
1. "score": (number) An overall score from 0 to 100 based on their pronunciation, rhythm, and intonation. If the audio is silent or contains no speech, score should be 0.
2. "pronunciation_accuracy": (string) An accuracy percentage of their pronunciation (e.g., "85%"). If silent, it should be "0%".
3. "detailed_feedback": (string) Constructive, encouraging feedback in friendly Vietnamese pointing out any errors or areas of improvement.
4. "improved_sentence": (string) A corrected, natural, native-like English alternative or transcription of what they said.

Ensure the response contains ONLY the valid JSON object, without any markdown formatting or backticks.`;

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

      let responseText = result.response.text();
      // Clean up markdown block if present
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsed = JSON.parse(responseText);

      // Map to frontend compatibility keys
      return {
        // Required keys
        score: parsed.score !== undefined ? Number(parsed.score) : 0,
        pronunciation_accuracy: parsed.pronunciation_accuracy || "0%",
        detailed_feedback: parsed.detailed_feedback || "",
        improved_sentence: parsed.improved_sentence || "",
        
        // Mapped keys for frontend compatibility
        feedback: parsed.detailed_feedback || "",
        suggestedText: parsed.improved_sentence || "",
        errors: parsed.score < 70 ? [parsed.detailed_feedback] : []
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateAudio:", error);
      return {
        score: 0,
        pronunciation_accuracy: "0%",
        detailed_feedback: "Chưa ghi nhận được âm thanh giọng nói từ Micro. Vui lòng bấm Micro và nói lại!",
        improved_sentence: expectedSentence || '',
        
        feedback: "Chưa ghi nhận được âm thanh giọng nói từ Micro. Vui lòng bấm Micro và nói lại!",
        suggestedText: expectedSentence || '',
        errors: ["Chưa phát hiện giọng nói qua Micro."]
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

  async getAllQuizzesForManagement() {
    try {
      const quizzesQuery = `
        SELECT quiz_id, course_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
        FROM quizzes
        ORDER BY created_at DESC, quiz_id DESC
      `;
      const quizzesResult = await db.query(quizzesQuery);
      const quizzes = quizzesResult.rows;

      if (quizzes.length === 0) return [];

      const quizIds = quizzes.map(q => q.quiz_id);
      const questionsQuery = `
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type
        FROM questions
        WHERE quiz_id = ANY($1)
        ORDER BY question_id ASC
      `;
      const questionsResult = await db.query(questionsQuery, [quizIds]);
      
      const questionsMap = {};
      questionsResult.rows.forEach(q => {
        if (!questionsMap[q.quiz_id]) questionsMap[q.quiz_id] = [];
        questionsMap[q.quiz_id].push(q);
      });

      return quizzes.map(q => ({
        quiz_id: q.quiz_id,
        course_id: q.course_id,
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        time_limit: q.time_limit,
        is_private: Boolean(q.is_private),
        pin_code: q.pin_code || '',
        created_at: q.created_at,
        questions_count: (questionsMap[q.quiz_id] || []).length,
        questions: questionsMap[q.quiz_id] || []
      }));
    } catch (error) {
      console.error("Lỗi QuizzesService.getAllQuizzesForManagement:", error);
      throw error;
    }
  }

  async deleteQuiz(quizId) {
    try {
      await db.query('DELETE FROM quizzes WHERE quiz_id = $1', [parseInt(quizId, 10)]);
      return true;
    } catch (error) {
      console.error("Lỗi QuizzesService.deleteQuiz:", error);
      throw error;
    }
  }
}

module.exports = new QuizzesService();
