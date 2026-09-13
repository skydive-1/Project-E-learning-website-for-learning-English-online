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
    if (!error.status && error.statusCode) error.status = error.statusCode;
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

const ALL_SUPPORTED_TYPES = [
  'multiple_choice',
  'writing',
  'pronunciation',
  'open_cloze',
  'listening',
  'reading'
];

/**
 * Tính toán phân bổ số lượng câu hỏi công bằng (Fair Distribution):
 * - Luôn giữ đúng số câu N mà người dùng chọn, kể cả khi N < số dạng K.
 * - Chia đều theo N = K * floor(N/K) + remainder; phần dư ưu tiên theo thứ tự chọn.
 * - Trả về distribution: { [type]: count }, totalQuestions, types.
 */
function calculateQuestionDistribution(totalCount, questionTypes) {
  let rawTypes = [];
  if (Array.isArray(questionTypes)) {
    rawTypes = questionTypes;
  } else if (typeof questionTypes === 'string') {
    try {
      const parsed = JSON.parse(questionTypes);
      if (Array.isArray(parsed)) rawTypes = parsed;
      else rawTypes = questionTypes.split(',').map(s => s.trim()).filter(Boolean);
    } catch {
      rawTypes = questionTypes.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  const types = [...new Set(
    rawTypes
      .map(t => String(t || '').toLowerCase().trim())
      .filter(type => ALL_SUPPORTED_TYPES.includes(type))
  )];
  if (types.length === 0) types.push('multiple_choice');

  const K = types.length;
  const requestedN = parseInt(totalCount, 10) || 5;
  const N = Math.max(requestedN, 1);

  const b = Math.floor(N / K);
  const R = N % K;

  const distribution = {};
  types.forEach((type, idx) => {
    distribution[type] = b + (idx < R ? 1 : 0);
  });

  return {
    distribution,
    totalQuestions: N,
    types,
    typeCount: K
  };
}

const TYPE_SPECIFICATIONS = {
  multiple_choice: `- "multiple_choice":
  A standard multiple-choice question testing vocabulary or grammar.
  options: exactly 4 items starting with "A. ", "B. ", "C. ", "D. ".
  correctAnswer: only the capital letter ("A", "B", "C", or "D").
  explanation: in Vietnamese explaining the grammatical/lexical reason.`,

  writing: `- "writing":
  Sentence transformation/rewriting prompt (e.g. "Finish the second sentence so that it means the same as the first...") or short essay prompt (2-3 sentences).
  options: empty array ([]).
  correctAnswer: empty string ("").
  explanation: in Vietnamese providing the model answer and scoring criteria for AI grading.`,

  pronunciation: `- "pronunciation":
  A direct read-aloud sentence prompt or phonetics exercise (stress/vowel difference).
  NEVER include Speaker A, Speaker B, a dialogue, role labels, or an [Audio Script] block.
  options: empty array ([]).
  If read-aloud, questionText instructs the user to read clearly; correctAnswer is the exact English sentence to be read aloud (e.g. "English proficiency opens doors to global opportunities.").
  explanation: in Vietnamese with IPA phonetic transcription, word stress, and intonation guide.`,

  open_cloze: `- "open_cloze":
  A coherent passage of 2-4 sentences with 2 to 4 unique gap markers {{1}}, {{2}}, etc. replacing target words.
  options: array of gap objects: [{ "id": "1", "answer": "target_word", "acceptedAnswers": ["alt1"], "hint": "part of speech" }].
  correctAnswer: empty string ("").
  explanation: in Vietnamese explaining each gap's vocabulary, grammar rule, and collocation.`,

  listening: `- "listening":
  A single, self-contained English question intended to be heard aloud through an uploaded audio file or browser TTS.
  questionText MUST contain ONLY the direct question (for example: "Which statement best describes the main cause of the Industrial Revolution?").
  NEVER include Speaker A, Speaker B, a dialogue, role labels, [Question], [Audio Script], or transcript scaffolding.
  options: exactly 4 items starting with "A. ", "B. ", "C. ", "D. ".
  correctAnswer: only the capital letter ("A", "B", "C", or "D").
  explanation: in Vietnamese explaining why the answer is correct without referring to any speaker or dialogue.`,

  reading: `- "reading":
  A reading comprehension passage and question.
  passageText: a coherent English passage of 1-3 paragraphs.
  questionText: comprehension question testing main idea, detail, inference, or vocabulary in context.
  options: exactly 4 items starting with "A. ", "B. ", "C. ", "D. ".
  correctAnswer: only the capital letter ("A", "B", "C", or "D").
  explanation: in Vietnamese citing supporting sentences from the passage.`
};

function buildTypeSpecsPrompt(types) {
  const allowedSpecs = types
    .map(t => TYPE_SPECIFICATIONS[t])
    .filter(Boolean)
    .join('\n\n');

  const forbiddenTypes = ALL_SUPPORTED_TYPES.filter(t => !types.includes(t));
  let forbiddenClause = '';
  if (forbiddenTypes.length > 0) {
    forbiddenClause = `\n\nSTRICT NEGATIVE CONSTRAINT (NEVER VIOLATE):
DO NOT generate any question belonging to the following unrequested question types: [${forbiddenTypes.join(', ')}].
Under NO circumstances should you output questions of these forbidden types. Only generate questions of types [${types.join(', ')}].`;
  }

  return {
    specsText: allowedSpecs,
    forbiddenClause,
    schemaTypes: types.join(' | ')
  };
}

function stripSpeakerAndTranscriptScaffolding(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  const cleanRoleReferences = (input) => {
    const cleaned = String(input || '')
      .replace(/\bAccording to Speaker\s+[A-Z0-9]+\s*,?\s*/gi, '')
      .replace(/\bSpeaker\s+[A-Z0-9]+\b/gi, 'the audio')
      .trim();
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
  };

  const taggedQuestion = text.match(/\[Question\]\s*:?\s*([\s\S]+)$/i);
  if (taggedQuestion?.[1]) {
    return cleanRoleReferences(taggedQuestion[1]
      .replace(/^\s*Speaker\s+[A-Z0-9]+\s*:\s*/gim, '')
      .trim());
  }

  const withoutTags = text
    .replace(/\[(?:Audio Script(?:\s*\/\s*Dialogue)?|Dialogue|Listening|Transcript)\]\s*:?/gi, '')
    .trim();

  if (!/\bSpeaker\s+[A-Z0-9]+\s*:/i.test(withoutTags)) return cleanRoleReferences(withoutTags);

  const lines = withoutTags
    .split('\n')
    .map(line => line.replace(/^\s*Speaker\s+[A-Z0-9]+\s*:\s*/i, '').trim())
    .filter(Boolean);
  const directQuestion = [...lines].reverse().find(line => /\?\s*$/.test(line));

  return cleanRoleReferences(directQuestion || lines[lines.length - 1] || '');
}

function createFallbackQuestion(type, topic, index = 1) {
  const cleanTopic = topic ? String(topic).trim() : 'English';
  if (type === 'listening') {
    const question = `What is one key benefit of studying ${cleanTopic} regularly?`;
    return {
      questionType: 'listening',
      question_type: 'listening',
      questionText: question,
      question_text: question,
      passageText: null,
      passage_text: null,
      options: [
        `A. Enhances lexical accuracy and spoken confidence`,
        `B. Completely eliminates the need for grammar review`,
        `C. Replaces reading and listening practice entirely`,
        `D. Only benefits written examination performance`
      ],
      correctAnswer: 'A',
      correct_answer: 'A',
      explanation: `Học tập thường xuyên giúp cải thiện độ chính xác khi dùng từ và sự tự tin khi giao tiếp. Đáp án đúng là A.`
    };
  }

  if (type === 'open_cloze') {
    const passage = `Acquiring in-depth knowledge of ${cleanTopic} {{1}} students to communicate more effectively and builds strong {{2}} in academic settings.`;
    return {
      questionType: 'open_cloze',
      question_type: 'open_cloze',
      questionText: passage,
      question_text: passage,
      passageText: null,
      passage_text: null,
      options: [
        { id: '1', answer: 'enables', acceptedAnswers: ['allows', 'helps'], hint: 'verb' },
        { id: '2', answer: 'confidence', acceptedAnswers: ['foundation'], hint: 'noun' }
      ],
      correctAnswer: '',
      correct_answer: '',
      explanation: `Vị trí {{1}} cần một động từ chia số ít (enables/helps) đi với tân ngữ students. Vị trí {{2}} cần một danh từ (confidence) sau tính từ strong.`
    };
  }

  if (type === 'writing') {
    return {
      questionType: 'writing',
      question_type: 'writing',
      questionText: `Write 2-3 sentences expressing your perspective on why understanding ${cleanTopic} is essential for language learners today.`,
      question_text: `Write 2-3 sentences expressing your perspective on why understanding ${cleanTopic} is essential for language learners today.`,
      passageText: null,
      passage_text: null,
      options: [],
      correctAnswer: '',
      correct_answer: '',
      explanation: `Học viên cần viết câu mạch lạc, nêu rõ lý do và sử dụng từ vựng liên quan đến chủ đề ${cleanTopic}.`
    };
  }

  if (type === 'pronunciation') {
    const sentence = `Consistent study of ${cleanTopic} broadens students' linguistic horizons and international perspectives.`;
    return {
      questionType: 'pronunciation',
      question_type: 'pronunciation',
      questionText: `Read the following sentence aloud with clear pronunciation and natural intonation:\n"${sentence}"`,
      question_text: `Read the following sentence aloud with clear pronunciation and natural intonation:\n"${sentence}"`,
      passageText: null,
      passage_text: null,
      options: [],
      correctAnswer: sentence,
      correct_answer: sentence,
      explanation: `Hướng dẫn phát âm: Chú ý trọng âm từ "con'sistent", "lin'guistic", "ho'rizons", "per'spectives". Giữ ngữ điệu tự nhiên.`
    };
  }

  if (type === 'reading') {
    const passage = `The study of ${cleanTopic} has long been recognized as a cornerstone of comprehensive education. By examining fundamental concepts and real-world applications, learners cultivate analytical reasoning and critical thinking skills. Recent research shows that students who actively engage with ${cleanTopic} achieve better academic outcomes and exhibit greater adaptability across various domains.`;
    return {
      questionType: 'reading',
      question_type: 'reading',
      passageText: passage,
      passage_text: passage,
      questionText: `What is the primary benefit of studying ${cleanTopic} described in the passage?`,
      question_text: `What is the primary benefit of studying ${cleanTopic} described in the passage?`,
      options: [
        `A. Cultivating analytical reasoning and critical thinking skills`,
        `B. Avoiding all practical communication in favor of passive listening`,
        `C. Limiting study strictly to rote memorization`,
        `D. Replacing all interpersonal interaction entirely`
      ],
      correctAnswer: 'A',
      correct_answer: 'A',
      explanation: `Đoạn văn nêu rõ: "learners cultivate analytical reasoning and critical thinking skills". Đáp án đúng là A.`
    };
  }

  // Fallback multiple_choice
  return {
    questionType: 'multiple_choice',
    question_type: 'multiple_choice',
    questionText: `Which of the following best describes the core concept of ${cleanTopic}?`,
    question_text: `Which of the following best describes the core concept of ${cleanTopic}?`,
    passageText: null,
    passage_text: null,
    options: [
      `A. It provides fundamental principles and practical applications`,
      `B. It is entirely unrelated to language proficiency`,
      `C. It should only be studied without any practical context`,
      `D. It has no relevance to academic learning`
    ],
    correctAnswer: 'A',
    correct_answer: 'A',
    explanation: `Đáp án A phản ánh chính xác nhất bản chất và giá trị ứng dụng của ${cleanTopic}.`
  };
}

function adaptQuestionToType(q, targetType, topic) {
  const cleanTopic = topic ? String(topic).trim() : 'English';
  const originalText = String(q.questionText || q.question_text || q.question || '').trim();

  if (targetType === 'listening') {
    const directQuestion = stripSpeakerAndTranscriptScaffolding(originalText)
      || `What is the most important idea about ${cleanTopic}?`;

    let options = Array.isArray(q.options) && q.options.length >= 4 ? q.options : [
      `A. ${originalText.slice(0, 55) || 'Key principles and regular practical application'}`,
      `B. Ignoring the context and practical usage entirely`,
      `C. Only focusing on memorization without deep comprehension`,
      `D. Postponing preparation until immediately before the exam`
    ];

    let ans = ['A', 'B', 'C', 'D'].includes(String(q.correctAnswer || q.correct_answer).toUpperCase())
      ? String(q.correctAnswer || q.correct_answer).toUpperCase()
      : 'A';

    return {
      questionType: 'listening',
      question_type: 'listening',
      questionText: directQuestion,
      question_text: directQuestion,
      passageText: null,
      passage_text: null,
      options,
      correctAnswer: ans,
      correct_answer: ans,
      explanation: /\bSpeaker\s+[A-Z0-9]+|audio script|dialogue|lời thoại/i.test(String(q.explanation || ''))
        ? `Đáp án đúng là ${ans}.`
        : (q.explanation || `Đáp án đúng là ${ans}.`)
    };
  }

  if (targetType === 'open_cloze') {
    let passage = originalText;
    let gaps = Array.isArray(q.options) && q.options.length > 0 && q.options[0]?.id ? q.options : null;

    if (!passage.includes('{{1}}')) {
      passage = `Understanding ${cleanTopic} thoroughly {{1}} students to express complex ideas and achieve higher {{2}} in communication.`;
      gaps = [
        { id: '1', answer: 'enables', acceptedAnswers: ['allows', 'helps'], hint: 'verb' },
        { id: '2', answer: 'fluency', acceptedAnswers: ['accuracy', 'confidence'], hint: 'noun' }
      ];
    }

    return {
      questionType: 'open_cloze',
      question_type: 'open_cloze',
      questionText: passage,
      question_text: passage,
      passageText: null,
      passage_text: null,
      options: gaps || [],
      correctAnswer: '',
      correct_answer: '',
      explanation: q.explanation || `Điền từ thích hợp vào chỗ trống để tạo thành câu hoàn chỉnh và chính xác về mặt ngữ pháp.`
    };
  }

  if (targetType === 'multiple_choice') {
    let options = Array.isArray(q.options) && q.options.length >= 4 ? q.options : [
      `A. Option A`,
      `B. Option B`,
      `C. Option C`,
      `D. Option D`
    ];
    let ans = ['A', 'B', 'C', 'D'].includes(String(q.correctAnswer || q.correct_answer).toUpperCase())
      ? String(q.correctAnswer || q.correct_answer).toUpperCase()
      : 'A';

    return {
      questionType: 'multiple_choice',
      question_type: 'multiple_choice',
      questionText: originalText || `Question related to ${cleanTopic}:`,
      question_text: originalText || `Question related to ${cleanTopic}:`,
      passageText: null,
      passage_text: null,
      options,
      correctAnswer: ans,
      correct_answer: ans,
      explanation: q.explanation || `Giải thích ngữ pháp và từ vựng tương ứng.`
    };
  }

  if (targetType === 'writing') {
    return {
      questionType: 'writing',
      question_type: 'writing',
      questionText: originalText.includes('Write') ? originalText : `Write 2-3 sentences explaining your view on ${cleanTopic}.`,
      question_text: originalText.includes('Write') ? originalText : `Write 2-3 sentences explaining your view on ${cleanTopic}.`,
      passageText: null,
      passage_text: null,
      options: [],
      correctAnswer: '',
      correct_answer: '',
      explanation: q.explanation || `Hướng dẫn làm bài và tiêu chí chấm điểm tự luận.`
    };
  }

  if (targetType === 'pronunciation') {
    const directPrompt = stripSpeakerAndTranscriptScaffolding(originalText);
    const sourceAnswer = q.correctAnswer || q.correct_answer || directPrompt;
    const rawAnswer = stripSpeakerAndTranscriptScaffolding(sourceAnswer)
      .replace(/^Read the following sentence.*?:\s*/i, '')
      .replace(/^Pronounce (?:this|the following).*?:\s*/i, '')
      .replace(/^['"]|['"]$/g, '')
      .trim();
    const finalAnswer = rawAnswer || `Learning about ${cleanTopic} builds confidence.`;
    const questionText = /^(?:Read|Pronounce|Say|Repeat)\b/i.test(directPrompt)
      ? directPrompt
      : `Read the following sentence aloud:\n"${finalAnswer}"`;
    return {
      questionType: 'pronunciation',
      question_type: 'pronunciation',
      questionText,
      question_text: questionText,
      passageText: null,
      passage_text: null,
      options: [],
      correctAnswer: finalAnswer,
      correct_answer: finalAnswer,
      explanation: q.explanation || `Hướng dẫn phát âm chuẩn phiên âm quốc tế IPA.`
    };
  }

  if (targetType === 'reading') {
    return {
      questionType: 'reading',
      question_type: 'reading',
      passageText: q.passageText || q.passage_text || `Passage discussing ${cleanTopic}...`,
      passage_text: q.passageText || q.passage_text || `Passage discussing ${cleanTopic}...`,
      questionText: originalText || `Comprehension question about ${cleanTopic}`,
      question_text: originalText || `Comprehension question about ${cleanTopic}`,
      options: Array.isArray(q.options) && q.options.length >= 4 ? q.options : ['A. Option A', 'B. Option B', 'C. Option C', 'D. Option D'],
      correctAnswer: 'A',
      correct_answer: 'A',
      explanation: q.explanation || `Dẫn chứng từ đoạn văn.`
    };
  }

  return q;
}

function enforceAndNormalizeQuestions(rawQuestions, distribution = {}, requestedTypes = [], totalQuestions = 5, topic = '') {
  const allowedTypes = [...new Set(
    (Array.isArray(requestedTypes) ? requestedTypes : [])
      .map(type => String(type || '').toLowerCase().trim())
      .filter(type => ALL_SUPPORTED_TYPES.includes(type))
  )];
  if (allowedTypes.length === 0) allowedTypes.push('multiple_choice');

  // 1. Initial normalization of raw questions
  const normalized = (Array.isArray(rawQuestions) ? rawQuestions : []).map(q => {
    const rawType = String(q.questionType || q.question_type || 'multiple_choice').toLowerCase().trim();
    let type = 'multiple_choice';
    if (['pronunciation', 'speaking', 'speech', 'voice'].includes(rawType)) type = 'pronunciation';
    else if (['writing', 'essay', 'paragraph', 'text'].includes(rawType)) type = 'writing';
    else if (['open_cloze', 'cloze', 'fill_in_the_blank', 'fill_blank'].includes(rawType)) type = 'open_cloze';
    else if (['listening', 'listen', 'audio_choice'].includes(rawType)) type = 'listening';
    else if (['reading', 'read', 'passage', 'comprehension'].includes(rawType)) type = 'reading';

    const text = String(q.questionText || q.question_text || q.question || '').trim();
    const passage = q.passageText || q.passage_text || null;
    const answer = q.correctAnswer ?? q.correct_answer ?? '';
    const explanation = String(q.explanation || '').trim();
    const options = Array.isArray(q.options) ? q.options : [];

    return {
      questionType: type,
      question_type: type,
      questionText: text,
      question_text: text,
      passageText: passage,
      passage_text: passage,
      options,
      correctAnswer: answer,
      correct_answer: answer,
      explanation
    };
  });

  // Gemini output is source material only. The server owns the final count and type mix.
  const targetTotal = Math.max(Number.parseInt(totalQuestions, 10) || 5, 1);
  const calculatedDistribution = calculateQuestionDistribution(targetTotal, allowedTypes).distribution;
  const requestedDistributionIsValid = allowedTypes.every(type => (
    Number.isInteger(Number(distribution[type])) && Number(distribution[type]) >= 0
  )) && allowedTypes.reduce((sum, type) => sum + Number(distribution[type]), 0) === targetTotal;
  const exactDistribution = requestedDistributionIsValid
    ? Object.fromEntries(allowedTypes.map(type => [type, Number(distribution[type])]))
    : calculatedDistribution;

  const desiredSlots = [];
  const maxPerType = Math.max(...allowedTypes.map(type => exactDistribution[type] || 0));
  for (let round = 0; round < maxPerType; round += 1) {
    allowedTypes.forEach(type => {
      if (round < (exactDistribution[type] || 0)) desiredSlots.push(type);
    });
  }

  const sourcePool = [...normalized];
  const finalQuestions = desiredSlots.map((targetType, index) => {
    let sourceIndex = sourcePool.findIndex(question => question.questionType === targetType);
    if (sourceIndex < 0 && sourcePool.length > 0) sourceIndex = 0;

    if (sourceIndex >= 0) {
      const [sourceQuestion] = sourcePool.splice(sourceIndex, 1);
      return adaptQuestionToType(sourceQuestion, targetType, topic);
    }

    // No second Gemini call: deterministic fallback preserves free-tier quota.
    return createFallbackQuestion(targetType, topic, index + 1);
  });

  // Final defense: expose both naming styles used by the existing frontend.
  return finalQuestions
    .map(q => ({
      questionType: q.questionType,
      question_type: q.questionType,
      questionText: q.questionText || q.question_text || '',
      question_text: q.questionText || q.question_text || '',
      passageText: q.passageText || q.passage_text || null,
      passage_text: q.passageText || q.passage_text || null,
      options: q.options || [],
      correctAnswer: q.correctAnswer ?? q.correct_answer ?? '',
      correct_answer: q.correctAnswer ?? q.correct_answer ?? '',
      explanation: q.explanation || ''
    }));
}

const normalizeAiGeneratedQuestions = (questions) => {
  return enforceAndNormalizeQuestions(questions, {}, ALL_SUPPORTED_TYPES, questions.length || 5);
};

exports.calculateQuestionDistribution = calculateQuestionDistribution;
exports.enforceAndNormalizeQuestions = enforceAndNormalizeQuestions;

exports.generateQuizAi = async (req, res, next) => {
  try {
    const { topic, count, questionTypes } = req.body;
    
    if (!topic || !topic.trim()) {
      const err = new Error('Vui lòng nhập chủ đề sinh câu hỏi.');
      err.status = 400;
      throw err;
    }

    const { distribution, totalQuestions, types } = calculateQuestionDistribution(count, questionTypes);
    const distLines = Object.entries(distribution)
      .map(([t, cnt]) => `  - "${t}": EXACTLY ${cnt} question${cnt > 1 ? 's' : ''}`)
      .join('\n');

    const { specsText, forbiddenClause, schemaTypes } = buildTypeSpecsPrompt(types);

    const prompt = `You are a distinguished English curriculum and assessment expert.
Generate a comprehensive, high-quality quiz about the topic: "${topic.trim()}".

MANDATORY QUESTION DISTRIBUTION (STRICT REQUIREMENT):
You MUST generate EXACTLY ${totalQuestions} questions with this precise distribution:
${distLines}
TOTAL: EXACTLY ${totalQuestions} questions.
CRITICAL: Every question type listed above MUST be generated with its exact assigned count. DO NOT skip, omit, or replace any requested type.${forbiddenClause}

QUESTION FORMAT SPECIFICATIONS:
${specsText}

JSON OUTPUT SCHEMA:
Return ONLY a valid JSON array of objects conforming to:
[
  {
    "questionType": "${schemaTypes}",
    "questionText": "The direct question or prompt; never include Speaker A/B or dialogue scaffolding",
    "passageText": "The reading passage if type is reading (omit or null for other types)",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A",
    "explanation": "Detailed explanation in Vietnamese"
  }
]`;

    console.log(`[Gemini Admin Quiz Generator] Generating ${totalQuestions} questions for topic: ${topic} (Distribution: ${JSON.stringify(distribution)})`);
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
      console.error('[Gemini Admin Quiz Generator] JSON parse error:', jsonErr, responseText);
      const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      questions = JSON.parse(cleanJson);
    }

    const normalizedQuestions = enforceAndNormalizeQuestions(questions, distribution, types, totalQuestions, topic);

    res.status(200).json({
      success: true,
      message: `Đã tự động tạo thành công ${normalizedQuestions.length} câu hỏi bằng AI`,
      distribution,
      questions: normalizedQuestions
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

    const { extractTextFromPdf } = require('../../../utils/pdfExtractor.util');
    const extractedDocs = [];

    for (const f of files) {
      try {
        const rawText = await extractTextFromPdf(f.buffer);
        const text = (rawText || '').replace(/\r\n/g, '\n').trim();
        if (text.length > 50) {
          extractedDocs.push({
            name: f.originalname || 'De_thi.pdf',
            text
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
    const { distribution, totalQuestions, types } = calculateQuestionDistribution(count, questionTypes);
    const distLines = Object.entries(distribution)
      .map(([t, cnt]) => `  - "${t}": EXACTLY ${cnt} question${cnt > 1 ? 's' : ''}`)
      .join('\n');

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

    const { specsText, forbiddenClause, schemaTypes } = buildTypeSpecsPrompt(types);

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
- Total Questions: Exactly ${totalQuestions} questions.

MANDATORY QUESTION DISTRIBUTION (STRICT REQUIREMENT):
You MUST generate EXACTLY ${totalQuestions} questions adhering strictly to this distribution:
${distLines}
TOTAL: EXACTLY ${totalQuestions} questions.
CRITICAL: Every question type listed above MUST be included with its exact assigned count. DO NOT skip or replace any requested type.${forbiddenClause}
${additionalNotes && additionalNotes.trim() ? `- Teacher Instructions / Specific Focus: "${additionalNotes.trim()}"` : ''}

CRITICAL RULES:
1. CROSS-SYNTHESIS & INGESTION: Draw and integrate vocabulary, grammar structures, sentence patterns, and themes from ALL the provided exam papers (${fileNamesList}). Mix ideas across the files so the resulting quiz is a comprehensive test.
2. RANDOMIZATION & MIXING: Randomly shuffle and interleave the question types throughout the test. DO NOT group all questions of the same type together into isolated blocks.
3. LEVEL ACCURACY: Adapt the grammar and vocabulary strictly to match the requested Target Learner Level: "${levelDescription}".
4. REALISTIC CONTEXT: Faithfully borrow authentic sentence structures, phrasal verbs, idioms, and reading contexts from the provided exam texts.

QUESTION FORMAT SPECIFICATIONS:
${specsText}

Return ONLY a valid JSON array of objects with the following schema (no markdown fences, no conversational prose):
[
  {
    "questionType": "${schemaTypes}",
    "questionText": "The direct question or prompt; never include Speaker A/B or dialogue scaffolding",
    "passageText": "The reading passage if type is reading (omit or null for other types)",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A",
    "explanation": "Detailed explanation in Vietnamese"
  }
]`;

    console.log(`[Gemini Multi-PDF Quiz Generator] Ingesting ${extractedDocs.length} exam PDFs (${fileNamesList}), Total chars: ${combinedExamText.length}, Target Level: ${levelDescription}, Distribution: ${JSON.stringify(distribution)}`);
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

    const normalizedQuestions = enforceAndNormalizeQuestions(questions, distribution, types, totalQuestions, 'PDF Exam Review');

    res.status(200).json({
      success: true,
      message: `Trợ lý AI đã thu nạp thành công ${extractedDocs.length} đề thi PDF (${fileNamesList}) và tạo ${normalizedQuestions.length} câu hỏi ngẫu nhiên!`,
      distribution,
      sourceFileNames: extractedDocs.map(d => d.name),
      filesCount: extractedDocs.length,
      targetLevel: targetLevel || 'auto',
      questions: normalizedQuestions
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

