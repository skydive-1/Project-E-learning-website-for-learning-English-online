const db = require('../../../config/database');
const { geminiModel } = require("../../../utils/ai-clients");
const {
  scoreOpenClozeAnswers,
  validateOpenClozeQuestion
} = require('../utils/openCloze.util');

function isAnswerMatching(correctAnswer, studentAnswer, options = []) {
  if (!correctAnswer || studentAnswer === undefined || studentAnswer === null) return false;

  let rawStudent = studentAnswer;
  if (typeof rawStudent === 'object') {
    rawStudent = rawStudent.answer ?? rawStudent.selected ?? rawStudent.value ?? '';
  }

  const corr = String(correctAnswer).trim();
  const stud = String(rawStudent).trim();
  if (!corr || !stud) return false;

  // 1. So sánh trực tiếp không phân biệt hoa thường
  if (corr.toUpperCase() === stud.toUpperCase()) return true;

  // 2. So sánh tiền tố chữ cái đáp án: A, B, C, D (ví dụ: "A" so với "A. London" hoặc "A) London")
  const corrLetterMatch = corr.match(/^([A-D])(?:[.):\-\s]|$)/i);
  const studLetterMatch = stud.match(/^([A-D])(?:[.):\-\s]|$)/i);

  if (corrLetterMatch && studLetterMatch) {
    if (corrLetterMatch[1].toUpperCase() === studLetterMatch[1].toUpperCase()) {
      return true;
    }
  }

  // 3. Nếu đáp án đúng là "A" mà học viên chọn nội dung text của option đó (hoặc ngược lại)
  if (corrLetterMatch && !studLetterMatch && Array.isArray(options)) {
    const letterIdx = corrLetterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (options[letterIdx]) {
      const optText = String(options[letterIdx]).replace(/^[A-D](?:[.):\-]\s*|\s+)/i, '').trim();
      if (optText.toUpperCase() === stud.toUpperCase()) return true;
    }
  }

  if (!corrLetterMatch && studLetterMatch && Array.isArray(options)) {
    const letterIdx = studLetterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (options[letterIdx]) {
      const optText = String(options[letterIdx]).replace(/^[A-D](?:[.):\-]\s*|\s+)/i, '').trim();
      if (optText.toUpperCase() === corr.toUpperCase()) return true;
    }
  }

  return false;
}

function resolveFullCorrectAnswer(correctAnswer, options = []) {
  if (!correctAnswer) return '';
  const corr = String(correctAnswer).trim();
  if (!Array.isArray(options) || options.length === 0) return corr;

  const letterMatch = corr.match(/^([A-D])(?:[.):\-\s]|$)/i);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    const idx = letter.charCodeAt(0) - 65;
    const found = options.find(opt => {
      if (typeof opt !== 'string') return false;
      const t = opt.trim().toUpperCase();
      return t.startsWith(letter + '.') || t.startsWith(letter + ')') || t.startsWith(letter + ' ') || t === letter;
    });
    if (found) return found;
    if (options[idx]) return `${letter}. ${String(options[idx]).replace(/^[A-D](?:[.):\-]\s*|\s+)/i, '').trim()}`;
  }

  const exactMatch = options.find(opt => String(opt).trim().toUpperCase() === corr.toUpperCase());
  if (exactMatch) return exactMatch;

  return corr;
}

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
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type, audio_url, passage_text
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
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type, audio_url, passage_text
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
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type, audio_url, passage_text
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

      const totalQuestions = questions.length;

      // 2. Tính điểm và lập bảng chi tiết từng câu
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

      const results = questions.map(question => {
        const qId = question.question_id;
        const ans = uniqueAnswers.get(qId);
        const studentAns = ans ? ans.answer : null;
        const qType = String(question.question_type || 'multiple_choice').toLowerCase();

        let isCorrect = false;
        let earnedScore = 0;

        if (qType === 'open_cloze') {
          const clozeAnswers = studentAns?.answers || studentAns || {};
          const clozeResult = scoreOpenClozeAnswers(question.options, clozeAnswers);
          earnedScore = Number(clozeResult.score) || 0;
          isCorrect = earnedScore >= 50;
        } else if (qType === 'writing' || qType === 'pronunciation') {
          earnedScore = typeof studentAns === 'object' && studentAns?.score !== undefined
            ? (Number(studentAns.score) || 0)
            : (studentAns ? 50 : 0);
          isCorrect = earnedScore >= 50;
        } else {
          isCorrect = isAnswerMatching(question.correct_answer, studentAns, question.options);
          earnedScore = isCorrect ? 100 : 0;
        }

        const fullCorrectAnswerText = resolveFullCorrectAnswer(question.correct_answer, question.options);

        return {
          question_id: qId,
          question_type: qType,
          is_correct: isCorrect,
          score: earnedScore,
          student_answer: studentAns,
          correct_answer: question.correct_answer || '',
          full_correct_answer_text: fullCorrectAnswerText,
          explanation: question.explanation || ''
        };
      });

      let totalEarnedScore = 0;
      results.forEach(r => {
        totalEarnedScore += (r.score / 100);
      });
      const correctCount = Number(totalEarnedScore.toFixed(2));
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
        correct_count: correctCount,
        total_questions: totalQuestions,
        attempt: attemptResult.rows[0],
        results
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.submitQuiz:", error);
      throw error;
    }
  }

  async checkAnswer(quizId, questionId, studentAnswer) {
    const questionResult = await db.query(`
      SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type
      FROM questions
      WHERE question_id = $1 AND quiz_id = $2
      LIMIT 1
    `, [parseInt(questionId, 10), parseInt(quizId, 10)]);

    if (questionResult.rows.length === 0) {
      const error = new Error('Không tìm thấy câu hỏi trong đề thi này.');
      error.status = 404;
      throw error;
    }

    const question = questionResult.rows[0];
    const qType = String(question.question_type || 'multiple_choice').toLowerCase();
    
    let isCorrect = false;
    let earnedScore = 0;

    if (qType === 'open_cloze') {
      const clozeAnswers = typeof studentAnswer === 'object' ? (studentAnswer?.answers || studentAnswer) : {};
      const clozeResult = scoreOpenClozeAnswers(question.options, clozeAnswers);
      earnedScore = clozeResult.score;
      isCorrect = earnedScore >= 50;
    } else {
      isCorrect = isAnswerMatching(question.correct_answer, studentAnswer, question.options);
      earnedScore = isCorrect ? 100 : 0;
    }

    const fullCorrectAnswerText = resolveFullCorrectAnswer(question.correct_answer, question.options);

    return {
      questionId: question.question_id,
      questionType: qType,
      isCorrect,
      score: earnedScore,
      correctAnswer: question.correct_answer || '',
      fullCorrectAnswerText,
      explanation: question.explanation || ''
    };
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

  async getGlobalLeaderboard({ timeframe = 'all', limit = 20 } = {}) {
    try {
      const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
      let timeCondition = '';
      const params = [parsedLimit];

      if (timeframe === 'week') {
        timeCondition = "WHERE qa.completed_at >= NOW() - INTERVAL '7 days'";
      } else if (timeframe === 'month') {
        timeCondition = "WHERE qa.completed_at >= NOW() - INTERVAL '30 days'";
      }

      const query = `
        WITH user_best_quiz AS (
          SELECT 
            qa.user_id,
            COALESCE(u.full_name, u.username, qa.nickname, 'Học viên') AS user_name,
            u.profile_picture_url AS avatar,
            COALESCE(u.role_id, 3) AS role_id,
            qa.quiz_id,
            MAX(qa.score) AS best_score,
            MAX(qa.completed_at) AS last_completed_at
          FROM quiz_attempts qa
          LEFT JOIN users u ON qa.user_id = u.user_id
          ${timeCondition}
          GROUP BY qa.user_id, u.full_name, u.username, qa.nickname, u.profile_picture_url, u.role_id, qa.quiz_id
        )
        SELECT 
          ROW_NUMBER() OVER(ORDER BY SUM(best_score) DESC, ROUND(AVG(best_score), 1) DESC, MAX(last_completed_at) ASC)::int AS rank,
          user_id,
          user_name,
          avatar,
          role_id,
          COUNT(quiz_id)::int AS total_quizzes_taken,
          SUM(best_score)::int AS total_score,
          ROUND(AVG(best_score), 1)::float AS average_score,
          COUNT(CASE WHEN best_score = 100 THEN 1 END)::int AS perfect_scores,
          MAX(last_completed_at) AS last_activity_at
        FROM user_best_quiz
        GROUP BY user_id, user_name, avatar, role_id
        ORDER BY total_score DESC, average_score DESC, last_activity_at ASC
        LIMIT $1
      `;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.getGlobalLeaderboard:", error);
      throw error;
    }
  }

  async evaluateWriting(writingText) {
    /**
     * Chấm điểm Writing theo IELTS Writing Band Descriptors
     * Nguồn: IELTS Official Public Band Descriptors — ielts.org
     * 4 tiêu chí bằng nhau (25% mỗi cái):
     *   Task Achievement (TA)         — Trả lời đúng yêu cầu đề, lập luận đủ ý
     *   Coherence & Cohesion (CC)     — Mạch lạc, liên kết câu/đoạn, dùng connectors
     *   Lexical Resource (LR)         — Từ vựng đa dạng, chính xác, tránh lặp
     *   Grammatical Range & Acc. (GRA)— Cấu trúc câu đa dạng, ít lỗi ngữ pháp
     * overallScore = round((TA + CC + LR + GRA) / 4)
     */
    try {
      const prompt = `You are a strict, professional English writing assessor following the IELTS Writing Band Descriptors (British Council / IDP / Cambridge — ielts.org).
Evaluate the student's written response below.

SCORING STANDARD — IELTS Writing Band Descriptors (ielts.org):
Score each of the FOUR criteria independently on an integer from 0 to 100:
  1. "taskAchievement"    — Task Achievement (TA): Does the response address the prompt fully? Are ideas developed with supporting details? Is the position clear?
  2. "coherenceCohesion"  — Coherence & Cohesion (CC): Is the text logically organized? Are cohesive devices (first, however, therefore, etc.) used effectively without repetition?
  3. "lexicalResource"    — Lexical Resource (LR): Is vocabulary range wide? Are less common words used accurately? Is there effective paraphrasing and avoidance of repetition?
  4. "grammaticalRange"   — Grammatical Range & Accuracy (GRA): Is there a variety of sentence structures (complex, compound, conditional, passive)? Are grammatical errors rare?

DO NOT compute an overall score — the system will calculate: overallScore = round((TA + CC + LR + GRA) / 4)

Also return:
  5. "detailed_feedback": (string) Specific, actionable feedback in friendly Vietnamese for each criterion.
  6. "improved_sentence": (string) A corrected, native-like English polished version of their response.
  7. "errors": (array of strings) Specific grammar, vocabulary, or coherence mistakes in friendly Vietnamese.

Format as strict JSON with EXACTLY these keys:
"taskAchievement", "coherenceCohesion", "lexicalResource", "grammaticalRange", "detailed_feedback", "improved_sentence", "errors"
No markdown, no backticks, no extra keys.`;

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
        generationConfig: { responseMimeType: "application/json" }
      });

      let responseText = result.response.text();
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsed = JSON.parse(responseText);

      // Validate & clamp mỗi sub-score
      const clamp = (v) => Math.max(0, Math.min(100, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0));
      const ta  = clamp(parsed.taskAchievement);
      const cc  = clamp(parsed.coherenceCohesion);
      const lr  = clamp(parsed.lexicalResource);
      const gra = clamp(parsed.grammaticalRange);

      // IELTS formula: 4 tiêu chí × 25% — tính tại backend, không tin AI tự tính
      const overallScore = Math.round((ta + cc + lr + gra) / 4);

      return {
        // Trường chính
        score: overallScore,
        // IELTS sub-score breakdown
        components: {
          taskAchievement: ta,
          coherenceCohesion: cc,
          lexicalResource: lr,
          grammaticalRange: gra
        },
        scoringStandard: 'IELTS Writing Band Descriptors (ielts.org)',
        detailed_feedback: typeof parsed.detailed_feedback === 'string' ? parsed.detailed_feedback : "Bài viết của bạn đã được ghi nhận.",
        improved_sentence: typeof parsed.improved_sentence === 'string' ? parsed.improved_sentence : writingText,
        // Backward-compat aliases
        feedback: typeof parsed.detailed_feedback === 'string' ? parsed.detailed_feedback : "Bài viết của bạn đã được ghi nhận.",
        suggestedText: typeof parsed.improved_sentence === 'string' ? parsed.improved_sentence : writingText,
        errors: Array.isArray(parsed.errors) ? parsed.errors : []
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateWriting:", error);
      return {
        score: 0,
        components: { taskAchievement: 0, coherenceCohesion: 0, lexicalResource: 0, grammaticalRange: 0 },
        scoringStandard: 'IELTS Writing Band Descriptors (ielts.org)',
        detailed_feedback: "Không thể chấm điểm bài viết. Vui lòng thử lại.",
        improved_sentence: writingText,
        feedback: "Không thể chấm điểm bài viết. Vui lòng thử lại.",
        suggestedText: writingText,
        errors: []
      };
    }
  }

  async evaluateAudio(filePathOrBuffer, mimetype, expectedSentence) {
    /**
     * Chấm điểm Audio Quiz theo PTE Academic (Pearson — pearsonpte.com)
     * Áp dụng cho dạng: Repeat Sentence / Re-tell / Read Aloud trong Quiz
     * 3 tiêu chí bằng nhau (~1/3 mỗi cái):
     *   Content Accuracy (CA) — Nội dung nói có đúng với câu mẫu không (WER-style)
     *   Oral Fluency (OF)    — Tốc độ, nhịp điệu, không ngắt quãng bất thường
     *   Pronunciation (PR)   — Phát âm chính xác âm vị, trọng âm từ/câu
     * overallScore = round((CA + OF + PR) / 3)
     */
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

      // Tiền kiểm tra: buffer < 1500 bytes → không có giọng nói → 0 điểm ngay
      if (!audioBuffer || audioBuffer.length < 1500) {
        return {
          score: 0,
          components: { contentAccuracy: 0, oralFluency: 0, pronunciation: 0 },
          scoringStandard: 'PTE Academic (Pearson — pearsonpte.com)',
          pronunciation_accuracy: "0%",
          detailed_feedback: "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng kiểm tra micro, nói to và rõ ràng hơn.",
          improved_sentence: expectedSentence || '',
          feedback: "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng kiểm tra micro, nói to và rõ ràng hơn.",
          suggestedText: expectedSentence || '',
          errors: ["Chưa phát hiện giọng nói qua micro."]
        };
      }

      const audioBase64 = audioBuffer.toString("base64");

      const prompt = `You are a strict, professional English pronunciation assessor following the PTE Academic (Pearson) scoring standard.
Listen to the user's spoken audio carefully.
Expected sentence the student should have said: "${expectedSentence || ''}".

SCORING STANDARD — PTE Academic (Pearson) Audio Response:
Score each of the THREE criteria independently on an integer from 0 to 100:
  1. "contentAccuracy" — Content Accuracy (CA): How closely does what the student ACTUALLY said match the expected sentence? Use word-error-rate style comparison. Severe penalty if the student said something completely different or said nothing.
  2. "oralFluency"     — Oral Fluency (OF): Natural pace and rhythm, absence of unnatural pauses, hesitations, or repetitions. Smooth connected speech.
  3. "pronunciation"   — Pronunciation (PR): Phoneme accuracy, word/sentence stress, vowel-consonant clarity from audio waveform.

SILENCE / ANTI-CHEAT RULES:
- If audio is silent, noise-only, or no human speech: set ALL three scores to 0.
- DO NOT hallucinate speech or award points for silence.

DO NOT compute an overall score — the system calculates: overallScore = round((CA + OF + PR) / 3)

Also return:
  4. "detailed_feedback": (string) Actionable feedback in friendly Vietnamese for each PTE criterion.
  5. "improved_sentence": (string) The correct native English version.

Format as strict JSON with EXACTLY these keys:
"contentAccuracy", "oralFluency", "pronunciation", "detailed_feedback", "improved_sentence"
No markdown, no backticks, no extra keys.`;

      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: audioBase64, mimeType: mimetype || "audio/webm" } }
            ]
          }
        ],
        generationConfig: { responseMimeType: "application/json" }
      });

      let responseText = result.response.text();
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsed = JSON.parse(responseText);

      // Validate & clamp mỗi sub-score
      const clamp = (v) => Math.max(0, Math.min(100, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0));
      const ca = clamp(parsed.contentAccuracy);
      const of_ = clamp(parsed.oralFluency);
      const pr = clamp(parsed.pronunciation);

      // PTE formula: 3 tiêu chí × 1/3 — tính tại backend, không tin AI tự tính
      const overallScore = Math.round((ca + of_ + pr) / 3);

      const isNoSpeech = overallScore === 0 && ca === 0 && of_ === 0 && pr === 0;
      const feedbackText = isNoSpeech
        ? "Không nhận diện được giọng nói trong bản ghi âm. Vui lòng bấm micro, nói to và rõ ràng hơn."
        : (typeof parsed.detailed_feedback === 'string' ? parsed.detailed_feedback : "Bạn đã hoàn thành phần phát âm!");

      return {
        // Trường chính
        score: overallScore,
        // PTE sub-score breakdown
        components: { contentAccuracy: ca, oralFluency: of_, pronunciation: pr },
        scoringStandard: 'PTE Academic (Pearson — pearsonpte.com)',
        pronunciation_accuracy: `${overallScore}%`,
        detailed_feedback: feedbackText,
        improved_sentence: typeof parsed.improved_sentence === 'string' ? parsed.improved_sentence : (expectedSentence || ''),
        // Backward-compat aliases
        feedback: feedbackText,
        suggestedText: typeof parsed.improved_sentence === 'string' ? parsed.improved_sentence : (expectedSentence || ''),
        errors: overallScore < 70 ? [isNoSpeech ? "Chưa phát hiện giọng nói qua micro." : feedbackText] : []
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại QuizzesService.evaluateAudio:", error);
      return {
        score: 0,
        components: { contentAccuracy: 0, oralFluency: 0, pronunciation: 0 },
        scoringStandard: 'PTE Academic (Pearson — pearsonpte.com)',
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
            INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, question_type, audio_url, passage_text)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
          `;
          const qText = q.question_text || q.questionText || q.question || '';
          const qExpl = q.explanation || '';
          const qType = String(q.question_type || q.questionType || 'multiple_choice').toLowerCase();
          let rawCorr = q.correct_answer ?? q.correctAnswer ?? q.answer;
          let qCorr = rawCorr !== undefined && rawCorr !== null ? String(rawCorr).trim() : '';

          if (['multiple_choice', 'listening', 'reading'].includes(qType)) {
            if (!qCorr) {
              const previewText = qText.trim()
                ? (qText.trim().length > 50 ? `${qText.trim().slice(0, 50)}...` : qText.trim())
                : 'Không có tiêu đề';
              const error = new Error(`Câu hỏi "${previewText}" (loại ${qType}) chưa có đáp án đúng. Vui lòng chọn đáp án trước khi lưu.`);
              error.status = 400;
              error.statusCode = 400;
              throw error;
            }
          }
          let opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? [q.options] : []);
          const audioUrl = q.audio_url || q.audioUrl || null;
          const passageText = q.passage_text || q.passageText || null;

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
            qType,
            audioUrl,
            passageText
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
      // Chỉ lấy các đề thi tự do (standalone / practice quizzes ở trang Courses & Quizzes),
      // KHÔNG lấy các đề thi thuộc bài học trong khóa học (course_id IS NOT NULL hoặc lesson_id IS NOT NULL)
      const quizzesQuery = `
        SELECT quiz_id, course_id, lesson_id, title, description, difficulty, time_limit, is_private, pin_code, created_at
        FROM quizzes
        WHERE course_id IS NULL AND lesson_id IS NULL
        ORDER BY created_at DESC, quiz_id DESC
      `;
      const quizzesResult = await db.query(quizzesQuery);
      const quizzes = quizzesResult.rows;

      if (quizzes.length === 0) return [];

      const quizIds = quizzes.map(q => q.quiz_id);
      const questionsQuery = `
        SELECT question_id, quiz_id, question_text, options, correct_answer, explanation, question_type, audio_url, passage_text
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
        lesson_id: q.lesson_id,
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
      const parsedId = parseInt(quizId, 10);
      const checkRes = await db.query(
        'SELECT course_id, lesson_id FROM quizzes WHERE quiz_id = $1',
        [parsedId]
      );
      if (checkRes.rows.length === 0) {
        throw new Error('Đề thi không tồn tại');
      }
      if (checkRes.rows[0].course_id !== null || checkRes.rows[0].lesson_id !== null) {
        const error = new Error('Không thể xóa đề thi thuộc bài học khóa học từ mục này');
        error.statusCode = 400;
        throw error;
      }
      await db.query('DELETE FROM quizzes WHERE quiz_id = $1', [parsedId]);
      return true;
    } catch (error) {
      console.error("Lỗi QuizzesService.deleteQuiz:", error);
      throw error;
    }
  }
}

module.exports = new QuizzesService();
