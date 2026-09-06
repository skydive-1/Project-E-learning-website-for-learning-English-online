const quizzesService = require('../services/quizzes.service');
const { geminiModel } = require('../../../utils/ai-clients');
const { sanitizeOpenClozeGaps } = require('../utils/openCloze.util');

const sanitizeQuestionForPlayer = (question) => {
  const questionType = question.question_type || null;
  const isOpenCloze = String(questionType || '').toLowerCase() === 'open_cloze';

  return {
    question_id: question.question_id,
    question_text: question.question_text,
    options: isOpenCloze ? sanitizeOpenClozeGaps(question.options) : question.options,
    correct_answer: '',
    explanation: question.explanation,
    question_type: questionType,
    audio_url: question.audio_url || null,
    passage_text: question.passage_text || null
  };
};

exports.getQuizzes = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    
    if (!courseId) {
      const err = new Error("Thiếu courseId");
      err.status = 400;
      throw err;
    }

    const data = await quizzesService.getQuizzesByCourseId(courseId);
    
    // Route công khai (không yêu cầu đăng nhập) — PHẢI ẩn đáp án đúng / gợi ý điền khuyết
    // để tránh lộ đề cho học sinh trước khi làm bài. Dùng cho trang học & danh sách bài học.
    const sanitizedData = data.map(quiz => ({
      quiz_id: quiz.quiz_id,
      course_id: quiz.course_id,
      lesson_id: quiz.lesson_id,
      title: quiz.title,
      description: quiz.description,
      difficulty: quiz.difficulty,
      time_limit: quiz.time_limit,
      questions: quiz.questions.map(sanitizeQuestionForPlayer)
    }));

    res.status(200).json({
      success: true,
      data: sanitizedData
    });
  } catch (error) {
    next(error);
  }
};

exports.getQuizzesForManagement = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      const err = new Error("Thiếu courseId");
      err.status = 400;
      throw err;
    }

    const data = await quizzesService.getQuizzesByCourseId(courseId);

    // Route riêng cho Giảng viên/Admin (yêu cầu authenticate + authorize ở route),
    // trả về dữ liệu câu hỏi đầy đủ bao gồm đáp án và giải thích để phục vụ chỉnh sửa khóa học.
    const fullData = data.map(quiz => ({
      quiz_id: quiz.quiz_id,
      course_id: quiz.course_id,
      lesson_id: quiz.lesson_id,
      title: quiz.title,
      description: quiz.description,
      difficulty: quiz.difficulty,
      time_limit: quiz.time_limit,
      questions: quiz.questions.map(q => {
        let parsedOptions = q.options;
        if (typeof parsedOptions === 'string') {
          try { parsedOptions = JSON.parse(parsedOptions); } catch (_) {}
        }
        return {
          question_id: q.question_id,
          question_text: q.question_text,
          options: parsedOptions,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          question_type: q.question_type,
          audio_url: q.audio_url || null,
          passage_text: q.passage_text || null
        };
      })
    }));

    res.status(200).json({
      success: true,
      data: fullData
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
    const writingText = req.body.writing || req.body.text;
    if (!writingText) {
      const err = new Error("Vui lòng gửi nội dung bài luận (field: writing hoặc text)");
      err.status = 400;
      throw err;
    }
    
    const evaluation = await quizzesService.evaluateWriting(writingText);
    
    res.status(200).json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    next(error);
  }
};

exports.submitOpenCloze = async (req, res, next) => {
  try {
    const { quizId, questionId, answers } = req.body;
    if (!quizId || !questionId || !answers || typeof answers !== 'object') {
      const error = new Error('Dữ liệu Open Cloze không hợp lệ. Yêu cầu quizId, questionId và answers.');
      error.status = 400;
      error.code = 'INVALID_OPEN_CLOZE_SUBMISSION';
      throw error;
    }

    const evaluation = await quizzesService.evaluateOpenCloze(quizId, questionId, answers);
    res.status(200).json({ success: true, data: evaluation });
  } catch (error) {
    next(error);
  }
};

exports.getQuizByPin = async (req, res, next) => {
  try {
    const { pinCode } = req.params;
    if (!pinCode) {
      const err = new Error("Thiếu mã PIN");
      err.status = 400;
      throw err;
    }
    const quiz = await quizzesService.getQuizByPin(pinCode);
    if (!quiz) {
      const err = new Error("Mã PIN không tồn tại hoặc đề thi không khả dụng!");
      err.status = 404;
      throw err;
    }
    
    const sanitizedQuiz = {
      quiz_id: quiz.quiz_id,
      course_id: quiz.course_id,
      lesson_id: quiz.lesson_id,
      title: quiz.title,
      description: quiz.description,
      difficulty: quiz.difficulty,
      time_limit: quiz.time_limit,
      is_private: quiz.is_private,
      pin_code: quiz.pin_code,
      questions: quiz.questions.map(sanitizeQuestionForPlayer)
    };

    res.status(200).json({
      success: true,
      data: sanitizedQuiz
    });
  } catch (error) {
    next(error);
  }
};

exports.getQuizById = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    if (!quizId) {
      const err = new Error("Thiếu quizId");
      err.status = 400;
      throw err;
    }
    const quiz = await quizzesService.getQuizById(quizId);
    if (!quiz) {
      const err = new Error("Không tìm thấy bài thi!");
      err.status = 404;
      throw err;
    }

    const sanitizedQuiz = {
      quiz_id: quiz.quiz_id,
      course_id: quiz.course_id,
      lesson_id: quiz.lesson_id,
      title: quiz.title,
      description: quiz.description,
      difficulty: quiz.difficulty,
      time_limit: quiz.time_limit,
      is_private: quiz.is_private,
      pin_code: quiz.pin_code,
      questions: quiz.questions.map(sanitizeQuestionForPlayer)
    };

    res.status(200).json({
      success: true,
      data: sanitizedQuiz
    });
  } catch (error) {
    next(error);
  }
};

exports.createQuiz = async (req, res, next) => {
  try {
    const { title, description, difficulty, timeLimit, questions, isPrivate, pinCode, courseId, lessonId } = req.body;
    if (!title) {
      const err = new Error("Tiêu đề đề thi không được trống.");
      err.status = 400;
      throw err;
    }
    if (isPrivate && (!pinCode || String(pinCode).trim().length < 4)) {
      const err = new Error("Đề thi riêng tư yêu cầu Mã PIN từ 4 đến 20 ký tự.");
      err.status = 400;
      throw err;
    }
    const result = await quizzesService.createQuiz(title, description, difficulty, timeLimit, questions, isPrivate, pinCode, courseId, lessonId);
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

    const audioSource = req.file.buffer || req.file.path;
    const mimetype = req.file.mimetype;

    const evaluation = await quizzesService.evaluateAudio(audioSource, mimetype, expectedSentence);

    // Xóa file tạm sau khi đã xử lý xong nếu là disk storage
    if (req.file.path) {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
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
- If type is "open_cloze":
  Write one coherent English passage of 2-4 sentences and replace 3-6 target words with unique markers {{1}}, {{2}}, {{3}} in questionText.
  Set options to an array of gap objects: [{ "id": "1", "answer": "changes", "acceptedAnswers": [], "hint": "verb" }].
  Every marker must have exactly one matching gap object and every gap must have a non-empty answer.
  Leave correctAnswer empty ("") and explain the grammar or vocabulary tested in Vietnamese.

Return a JSON array of objects with the following schema:
[
  {
    "questionType": "multiple_choice / writing / pronunciation / open_cloze",
    "questionText": "The question text or prompt",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"], // Gap objects for open_cloze; empty for writing/pronunciation
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

exports.generateQuizAiFromPdf = async (req, res, next) => {
  try {
    // Thu thập tất cả các file PDF được gửi lên (hỗ trợ cả mảng req.files và req.file đơn lẻ)
    let files = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        files = req.files;
      } else {
        files = [
          ...(req.files.pdfs || []),
          ...(req.files.pdf || [])
        ];
      }
    } else if (req.file) {
      files = [req.file];
    }

    if (!files || files.length === 0) {
      const err = new Error('Vui lòng chọn ít nhất một tệp đề thi định dạng PDF (.pdf) để tải lên.');
      err.status = 400;
      throw err;
    }

    const { PDFParse } = require('pdf-parse');
    const extractedDocs = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.buffer) continue;
      try {
        const parser = new PDFParse({ data: f.buffer });
        await parser.load();
        const textResult = await parser.getText();
        const text = (textResult?.text || '').trim();
        if (text.length >= 20) {
          extractedDocs.push({
            name: f.originalname || `Đề thi ${i + 1}`,
            text,
            length: text.length
          });
        } else {
          console.warn(`[generateQuizAiFromPdf] File ${f.originalname} có quá ít ký tự văn bản (${text.length}).`);
        }
      } catch (parseErr) {
        console.error(`[generateQuizAiFromPdf] Lỗi đọc PDF file "${f.originalname}":`, parseErr);
      }
    }

    if (extractedDocs.length === 0) {
      const err = new Error('Không thể đọc nội dung văn bản từ các tệp PDF đã chọn (có thể là tệp scan ảnh hoặc file trống). Vui lòng chọn tệp PDF đề thi có chứa văn bản số.');
      err.status = 400;
      throw err;
    }

    const { targetLevel, count, questionTypes, additionalNotes } = req.body;
    const numQuestions = Math.min(Math.max(parseInt(count, 10) || 5, 1), 30);
    
    // Parse questionTypes
    let types = ['multiple_choice'];
    if (Array.isArray(questionTypes)) {
      types = questionTypes;
    } else if (typeof questionTypes === 'string') {
      try {
        const parsed = JSON.parse(questionTypes);
        if (Array.isArray(parsed)) types = parsed;
        else types = questionTypes.split(',').map(s => s.trim()).filter(Boolean);
      } catch {
        types = questionTypes.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (types.length === 0) types = ['multiple_choice', 'writing', 'pronunciation', 'open_cloze'];

    const levelMap = {
      'auto': 'Tự động bám sát và kế thừa độ khó của các đề thi PDF gốc',
      'grade_6_7': 'Cấp độ Cơ bản: Dành cho học sinh THCS Lớp 6 - Lớp 7 (Khung A1 - A2)',
      'grade_8_9': 'Cấp độ Trung cấp: Dành cho học sinh THCS Lớp 8 - Lớp 9 (Khung B1)',
      'grade_10_12': 'Cấp độ Nâng cao: Dành cho học sinh THPT Lớp 10 - Lớp 12 (Khung B2 - C1)',
      'easy': 'Cấp độ Dễ (Easy / Basic)',
      'medium': 'Cấp độ Trung bình (Medium / Intermediate)',
      'hard': 'Cấp độ Nâng cao (Hard / Advanced)'
    };
    const levelDescription = levelMap[targetLevel] || levelMap['auto'];

    // Tổng hợp nội dung từ tất cả các file PDF (phân bổ tối đa 35000 ký tự cho toàn bộ các đề)
    const perDocLimit = Math.max(Math.floor(35000 / extractedDocs.length), 3000);
    const combinedExamText = extractedDocs.map((doc, idx) => {
      const snippet = doc.text.length > perDocLimit 
        ? doc.text.substring(0, perDocLimit) + `\n[... Trích xuất ${perDocLimit}/${doc.text.length} ký tự từ file ${doc.name} ...]`
        : doc.text;
      return `=== [TÀI LIỆU ĐỀ THI #${idx + 1}: ${doc.name}] ===\n${snippet}`;
    }).join('\n\n');

    const fileNamesList = extractedDocs.map(d => `"${d.name}"`).join(', ');

    const prompt = `You are a distinguished English curriculum and assessment expert.
A teacher has provided ${extractedDocs.length} authentic school examination papers in PDF format (Files: ${fileNamesList}).
Here is the synthesized content extracted from all uploaded exam papers:
=== BEGIN INGESTED EXAM PAPERS CONTENT ===
${combinedExamText}
=== END INGESTED EXAM PAPERS CONTENT ===

MISSION:
Deeply absorb, ingest, cross-synthesize, and comprehend the knowledge, topics, grammar points, idioms, question patterns, and reading passages across ALL ${extractedDocs.length} exam papers above.
Then, generate a completely fresh, randomized, high-quality quiz tailored specifically for:
- Target Learner Level: "${levelDescription}".
- Total Questions: Exactly ${numQuestions} questions.
- Allowed Question Types: ${types.join(', ')}.
${additionalNotes && additionalNotes.trim() ? `- Teacher Instructions / Specific Focus: "${additionalNotes.trim()}"` : ''}

CRITICAL RULES:
1. CROSS-SYNTHESIS & INGESTION: Draw and integrate vocabulary, grammar structures, sentence patterns, and themes from ALL the provided exam papers (${fileNamesList}). Mix ideas across the files so the resulting quiz is a comprehensive test.
2. RANDOMIZATION & MIXING: Randomly shuffle and interleave the question types throughout the test. DO NOT group all questions of the same type together into isolated blocks.
3. LEVEL ACCURACY: Adapt the grammar and vocabulary strictly to match the requested Target Learner Level: "${levelDescription}".
4. REALISTIC CONTEXT: Faithfully borrow authentic sentence structures, phrasal verbs, idioms, and reading contexts from the provided exam texts.

QUESTION FORMAT SPECIFICATIONS:
- "multiple_choice":
  Must have exactly 4 options labeled "A. ...", "B. ...", "C. ...", "D. ...".
  correctAnswer must be only the capital letter ("A", "B", "C", or "D").
  explanation must be in Vietnamese explaining the correct grammar/vocab rationale.
- "writing":
  Sentence transformation/rewriting (e.g. "Finish the second sentence so that it means the same as the first: ... => ...") or sentence combining with relative clause/reported speech.
  correctAnswer must be empty string ("").
  explanation in Vietnamese with the model answer and grammar guidance for AI grading.
- "pronunciation":
  Either a phonetics question (underlined letter/sound differing from others) or a read-aloud sentence prompt ("Please read the following sentence aloud clearly and naturally: '...'").
  If read-aloud, correctAnswer is the exact English sentence to be read; explanation provides IPA phonetic notes and intonation guidance in Vietnamese.
- "open_cloze":
  Write a coherent passage of 2-4 sentences with 2 to 4 unique markers {{1}}, {{2}}, etc. replacing target words.
  options must be an array of gap objects: [{ "id": "1", "answer": "target", "acceptedAnswers": ["alt1"], "hint": "hint" }].
  correctAnswer is empty string ("").
  explanation in Vietnamese explaining the word choice and grammar context.

Return ONLY a valid JSON array of objects with the following schema (no markdown fences, no conversational prose):
[
  {
    "questionType": "multiple_choice / writing / pronunciation / open_cloze",
    "questionText": "Question text or prompt",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A",
    "explanation": "Detailed explanation in Vietnamese"
  }
]`;

    console.log(`[Gemini Multi-PDF Quiz Generator] Ingesting ${extractedDocs.length} exam PDFs (${fileNamesList}), Total chars: ${combinedExamText.length}, Target Level: ${levelDescription}`);
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    let questions = [];
    try {
      questions = JSON.parse(responseText);
    } catch (jsonErr) {
      console.error('[Gemini Multi-PDF Quiz Generator] JSON parse error:', jsonErr, responseText);
      const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      questions = JSON.parse(cleanJson);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('AI không thể tạo danh sách câu hỏi từ các tệp PDF này. Vui lòng thử lại.');
    }

    res.status(200).json({
      success: true,
      message: `Trợ lý AI đã thu nạp thành công ${extractedDocs.length} đề thi PDF (${fileNamesList}) và tạo ${questions.length} câu hỏi ngẫu nhiên!`,
      sourceFileNames: extractedDocs.map(d => d.name),
      filesCount: extractedDocs.length,
      targetLevel: targetLevel || 'auto',
      questions
    });
  } catch (error) {
    console.error('Lỗi sinh Quiz từ nhiều PDF bằng Gemini:', error);
    next(error);
  }
};

exports.getAllQuizzesForManagement = async (req, res, next) => {
  try {
    const data = await quizzesService.getAllQuizzesForManagement();
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    if (!quizId) {
      const err = new Error("Thiếu quizId");
      err.status = 400;
      throw err;
    }
    await quizzesService.deleteQuiz(quizId);
    res.status(200).json({
      success: true,
      message: "Đã xóa đề thi thành công!"
    });
  } catch (error) {
    next(error);
  }
};

exports.streamAudio = async (req, res, next) => {
  try {
    const key = req.query.key || req.query.url;
    if (!key) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin audio' });
    }
    if (/^https?:\/\//i.test(key)) {
      return res.redirect(key);
    }
    const r2Storage = require('../../../utils/r2Storage');
    const signedUrl = await r2Storage.generateSignedUrl(key, 'audio', 3600);
    if (signedUrl) {
      return res.redirect(signedUrl);
    }
    return res.status(404).json({ success: false, message: 'Không tìm thấy file âm thanh bài nghe' });
  } catch (error) {
    next(error);
  }
};

