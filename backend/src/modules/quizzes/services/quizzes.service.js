const db = require('../../../config/database');
const { geminiModel } = require("../../../utils/ai-clients");
const {
  scoreOpenClozeAnswers,
  validateOpenClozeQuestion
} = require('../utils/openCloze.util');

class QuizzesService {
  async getQuizzesByCourseId(courseId) {
    try {
      let quizzesQuery;
      let params = [];

      if (courseId === 'free') {
        quizzesQuery = `
          SELECT quiz_id, course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
          FROM quizzes
          WHERE course_id IS NULL AND (is_private IS FALSE OR is_private IS NULL)
          ORDER BY quiz_id ASC
        `;
      } else {
        quizzesQuery = `
          SELECT quiz_id, course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
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
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type
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
        SELECT quiz_id, course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
        FROM quizzes
        WHERE quiz_id = $1
      `;
      const quizResult = await db.query(quizQuery, [parseInt(quizId, 10)]);
      if (quizResult.rows.length === 0) return null;
      
      const quiz = quizResult.rows[0];

      const questionsQuery = `
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type
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
        SELECT quiz_id, course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
        FROM quizzes
        WHERE UPPER(pin_code) = UPPER($1)
      `;
      const quizResult = await db.query(quizQuery, [pinCode.trim()]);
      if (quizResult.rows.length === 0) return null;

      const quiz = quizResult.rows[0];

      const questionsQuery = `
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type
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
        SELECT question_id, correct_answer, question_type, options
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
        questionMap[q.question_id] = q;
      });

      const uniqueAnswers = new Map();
      answers.forEach(ans => {
        const questionId = parseInt(ans?.question_id, 10);
        if (!Number.isFinite(questionId) || !questionMap[questionId]) return;
        uniqueAnswers.set(questionId, ans);
      });

      uniqueAnswers.forEach((ans, questionId) => {
        const question = questionMap[questionId];
        if (!question) return;

        if (String(question.question_type || '').toLowerCase() === 'open_cloze') {
          const clozeAnswers = ans.answer?.answers || ans.answer || {};
          const result = scoreOpenClozeAnswers(question.options, clozeAnswers);
          correctCount += result.score / 100;
        } else if (question.correct_answer && question.correct_answer === ans.answer) {
          correctCount += 1;
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

      // Cập nhật phiên học hiện tại nếu có khi hoàn thành Quiz
      if (validUserId) {
        try {
          await db.query(`
            UPDATE learning_ss
            SET end_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
              AND lesson_id = (SELECT lesson_id FROM quizzes WHERE quiz_id = $2)
              AND end_at >= (CURRENT_TIMESTAMP - INTERVAL '15 minutes');
          `, [validUserId, parseInt(quizId, 10)]);
        } catch (sessionErr) {
          console.warn('Lỗi đồng bộ phiên học cho quiz:', sessionErr.message);
        }
      }

      return {
        score,
        correct_count: Number(correctCount.toFixed(2)),
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

  async evaluateAudio(filePathOrBuffer, mimetype, expectedSentence) {
    try {
      let audioBuffer;
      if (Buffer.isBuffer(filePathOrBuffer)) {
        audioBuffer = filePathOrBuffer;
      } else if (typeof filePathOrBuffer === 'string') {
        const fs = require('fs');
        audioBuffer = fs.readFileSync(filePathOrBuffer);
      } else {
        throw new Error("Dữ liệu âm thanh không hợp lệ.");
      }

      // Tiền kiểm tra: Nếu buffer < 1500 bytes (file rỗng hoặc không có giọng nói) -> trả về 0 điểm ngay
      if (!audioBuffer || audioBuffer.length < 1500) {
        return {
          score: 0,
          pronunciation_accuracy: "0%",
          detailed_feedback: "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng kiểm tra micro, nói to và rõ ràng hơn.",
          improved_sentence: expectedSentence || '',
          feedback: "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng kiểm tra micro, nói to và rõ ràng hơn.",
          suggestedText: expectedSentence || '',
          errors: ["Chưa phát hiện giọng nói qua micro."]
        };
      }
      
      const audioBase64 = audioBuffer.toString("base64");

      const prompt = `You are a professional, strict English language and pronunciation tutor.
Listen to the user's spoken audio waveform carefully.
Compare what they ACTUALLY said against the expected sentence: "${expectedSentence || ''}".

CRITICAL ANTI-CHEAT & SILENCE DETECTION RULES:
1. If the audio is silent, contains NO human speech, contains only background noise/hiss, breathing, or empty silence:
   - "score": 0
   - "pronunciation_accuracy": "0%"
   - "detailed_feedback": "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng bấm micro, nói to và phát âm rõ ràng hơn."
   - "improved_sentence": "${expectedSentence || ''}"
   DO NOT hallucinate words or award any points for silence!

2. If the user spoke:
   - "score": (number from 1 to 100 based on their actual pronunciation, rhythm, and intonation)
   - "pronunciation_accuracy": (string percentage, e.g. "85%")
   - "detailed_feedback": (constructive feedback in friendly Vietnamese pointing out accuracy and errors)
   - "improved_sentence": (the correct native English pronunciation or sentence)

Format the response as a JSON object containing EXACTLY these keys:
- "score": (number from 0 to 100)
- "pronunciation_accuracy": (string percentage)
- "detailed_feedback": (string in Vietnamese)
- "improved_sentence": (string)

Ensure the response contains ONLY valid JSON without markdown formatting.`;

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

      const isNoSpeech = !parsed.detailed_feedback || 
        parsed.detailed_feedback.toLowerCase().includes("không nhận diện") ||
        parsed.detailed_feedback.toLowerCase().includes("no discernible speech") ||
        Number(parsed.score) === 0;

      const finalScore = isNoSpeech ? 0 : Math.max(0, Math.min(100, parsed.score !== undefined ? Number(parsed.score) : 0));

      return {
        score: finalScore,
        pronunciation_accuracy: `${finalScore}%`,
        detailed_feedback: (isNoSpeech || finalScore === 0)
          ? "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng bấm micro, nói to và rõ ràng hơn."
          : (parsed.detailed_feedback || "Bạn đã hoàn thành phần phát âm!"),
        improved_sentence: parsed.improved_sentence || expectedSentence || "",
        
        feedback: (isNoSpeech || finalScore === 0)
          ? "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng bấm micro, nói to và rõ ràng hơn."
          : (parsed.detailed_feedback || "Bạn đã hoàn thành phần phát âm!"),
        suggestedText: parsed.improved_sentence || expectedSentence || "",
        errors: finalScore < 70 ? [(isNoSpeech ? "Chưa phát hiện giọng nói qua micro." : (parsed.detailed_feedback || "Cần phát âm rõ ràng hơn."))] : []
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateAudio:", error);
      return {
        score: 0,
        pronunciation_accuracy: "0%",
        detailed_feedback: "Chưa ghi nhận được âm thanh giọng nói từ micro. Vui lòng bấm micro và nói lại!",
        improved_sentence: expectedSentence || '',
        feedback: "Chưa ghi nhận được âm thanh giọng nói từ micro. Vui lòng bấm micro và nói lại!",
        suggestedText: expectedSentence || '',
        errors: ["Chưa phát hiện giọng nói qua micro."]
      };
    }
  }

  async evaluateOpenCloze(quizId, questionId, answers) {
    const questionResult = await db.query(`
      SELECT question_id, quiz_id, question_text, options, explanation, question_type
      FROM questions
      WHERE question_id = $1 AND quiz_id = $2
      LIMIT 1
    `, [parseInt(questionId, 10), parseInt(quizId, 10)]);

    if (questionResult.rows.length === 0) {
      const error = new Error('Không tìm thấy câu hỏi điền từ trong đề thi này.');
      error.status = 404;
      error.code = 'CLOZE_QUESTION_NOT_FOUND';
      throw error;
    }

    const question = questionResult.rows[0];
    if (String(question.question_type || '').toLowerCase() !== 'open_cloze') {
      const error = new Error('Câu hỏi được gửi không phải dạng điền từ Open Cloze.');
      error.status = 400;
      error.code = 'QUESTION_TYPE_MISMATCH';
      throw error;
    }

    const { gaps } = validateOpenClozeQuestion({
      questionText: question.question_text,
      gaps: question.options
    });

    return {
      ...scoreOpenClozeAnswers(gaps, answers),
      explanation: question.explanation || ''
    };
  }

  async createQuiz(title, description, difficulty, timeLimit, questions, isPrivate = false, pinCode = null, courseId = null, lessonId = null) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const parsedCourseId = courseId ? parseInt(courseId, 10) : null;
      const parsedLessonId = lessonId ? parseInt(lessonId, 10) : null;
      let quizId;

      if (parsedLessonId) {
        const lessonResult = await client.query(
          `SELECT l.lesson_id, s.course_id
           FROM lessons l JOIN sections s ON s.section_id = l.section_id
           WHERE l.lesson_id = $1 FOR UPDATE`,
          [parsedLessonId]
        );
        if (lessonResult.rows.length === 0 || (parsedCourseId && Number(lessonResult.rows[0].course_id) !== parsedCourseId)) {
          const error = new Error('Bài học không tồn tại trong khóa học đã chọn.');
          error.status = 400;
          error.code = 'QUIZ_LESSON_COURSE_MISMATCH';
          throw error;
        }

        const existingResult = await client.query(
          'SELECT quiz_id FROM quizzes WHERE lesson_id = $1 ORDER BY quiz_id DESC LIMIT 1 FOR UPDATE',
          [parsedLessonId]
        );
        if (existingResult.rows.length > 0) {
          quizId = existingResult.rows[0].quiz_id;
          await client.query(
            `UPDATE quizzes
             SET course_id = $1, lesson_id = $2, title = $3, description = $4,
                 difficulty = $5, time_limit = $6, is_private = $7, pin_code = $8
             WHERE quiz_id = $9`,
            [parsedCourseId || lessonResult.rows[0].course_id, parsedLessonId, title, description,
              difficulty || 'Medium', parseInt(timeLimit, 10) || 10, Boolean(isPrivate),
              pinCode ? String(pinCode).trim() : null, quizId]
          );
          await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);
        }
      }

      if (!quizId) {
        const insertQuizQuery = `
          INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code)
          VALUES ($7, $8, $1, $2, $3, $4, $5, $6)
          RETURNING quiz_id
        `;
        const quizResult = await client.query(insertQuizQuery, [
          title,
          description,
          difficulty || 'Medium',
          parseInt(timeLimit, 10) || 10,
          Boolean(isPrivate),
          pinCode ? String(pinCode).trim() : null,
          parsedCourseId,
          parsedLessonId
        ]);
        quizId = quizResult.rows[0].quiz_id;
      }

      if (questions && Array.isArray(questions) && questions.length > 0) {
        for (const q of questions) {
          const insertQuestionQuery = `
            INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, question_type)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6)
          `;
          const qText = q.question_text || q.questionText || q.question || '';
          const qExpl = q.explanation || '';
          const qType = String(q.question_type || q.questionType || 'multiple_choice').toLowerCase();
          let qCorr = q.correct_answer ?? q.correctAnswer ?? q.answer ?? (qType === 'multiple_choice' ? 'A' : '');
          let opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? [q.options] : []);

          if (qType === 'open_cloze') {
            const validated = validateOpenClozeQuestion({ questionText: qText, gaps: opts });
            opts = validated.gaps;
            qCorr = '';
          }

          await client.query(insertQuestionQuery, [
            quizId,
            qText,
            JSON.stringify(opts),
            qCorr,
            qExpl,
            qType
          ]);
        }
      }
      await client.query('COMMIT');
      return { quizId, title, description };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Lỗi xảy ra tại QuizzesService.createQuiz:", error);
      throw error;
    } finally {
      client.release();
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
