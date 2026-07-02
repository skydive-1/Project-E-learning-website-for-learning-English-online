import apiClient from '../../../config/api.config';

// Cache cục bộ để lưu trữ câu hỏi trắc nghiệm của khóa học sau khi tải
let courseQuizzesCache = {};

// Helper chuyển đổi schema của Database sang camelCase mà React component mong đợi
const mapQuizToFrontend = (quiz) => {
  if (!quiz) return null;
  return {
    id: String(quiz.quiz_id),
    title: quiz.title,
    description: quiz.description,
    difficulty: quiz.difficulty,
    timeLimit: quiz.time_limit,
    courseId: quiz.course_id,
    lessonId: quiz.lesson_id,
    questions: (quiz.questions || []).map(q => ({
      id: String(q.question_id),
      question: q.question_text,
      options: q.options,
      correctAnswer: q.correct_answer,
      explanation: q.explanation
    }))
  };
};

/**
 * Tải danh sách tất cả các bài trắc nghiệm của khóa học và lưu vào cache.
 * Hàm này được gọi bất đồng bộ trong getCourseDetails() để đồng bộ luồng hiển thị syllabus.
 */
export const fetchAndCacheQuizzes = async (courseId) => {
  try {
    const response = await apiClient.get(`/quizzes/${courseId}`);
    const quizzes = response.data?.data || [];
    
    // Reset cache cũ
    courseQuizzesCache = {};
    
    quizzes.forEach(quiz => {
      if (quiz.lesson_id) {
        courseQuizzesCache[String(quiz.lesson_id)] = mapQuizToFrontend(quiz);
      }
    });
    
    return quizzes.map(mapQuizToFrontend);
  } catch (error) {
    console.error("⚠️ Lỗi tải và cache quizzes:", error.message);
    return [];
  }
};

export const getCourseQuizQuestions = (lessonId) => {
  const quiz = courseQuizzesCache[String(lessonId)];
  return quiz ? quiz.questions : [];
};

/**
 * Lấy toàn bộ đối tượng đề thi trắc nghiệm của một bài học từ cache
 */
export const getCourseQuizByLessonId = (lessonId) => {
  return courseQuizzesCache[String(lessonId)] || null;
};

/**
 * Lấy danh sách toàn bộ quizz tự do giải trí từ Backend
 */
export const getFreeQuizzesList = async () => {
  try {
    const response = await apiClient.get('/quizzes/free');
    const quizzes = response.data?.data || [];
    return quizzes.map(mapQuizToFrontend);
  } catch (error) {
    console.error("⚠️ Lỗi tải danh sách trắc nghiệm tự do:", error.message);
    return [];
  }
};

/**
 * Lấy chi tiết một bài quizz tự do từ Backend
 */
export const getFreeQuizById = async (quizId) => {
  try {
    const response = await apiClient.get(`/quizzes/free`);
    const quizzes = response.data?.data || [];
    const target = quizzes.find(q => String(q.quiz_id) === String(quizId));
    return target ? mapQuizToFrontend(target) : null;
  } catch (error) {
    console.error(`⚠️ Lỗi tải chi tiết trắc nghiệm ${quizId}:`, error.message);
    return null;
  }
};

/**
 * Gửi nộp kết quả thi trắc nghiệm lên Backend
 */
export const submitQuizAttempt = async (quizId, selectedAnswers) => {
  try {
    // Chuyển đổi object selectedAnswers { questionId: selectedOption } sang định dạng mảng API mong muốn
    const answers = Object.entries(selectedAnswers).map(([qId, ans]) => ({
      question_id: Number(qId),
      answer: ans
    }));

    const response = await apiClient.post('/quizzes/submit', {
      quizId: Number(quizId),
      answers
    });
    
    return response.data;
  } catch (error) {
    console.error("⚠️ Lỗi nộp bài thi trắc nghiệm lên backend:", error.message);
    throw error;
  }
};

// Duy trì các mock function cũ để tránh lỗi biên dịch của các file liên quan chưa cập nhật
export const saveCourseQuizQuestions = () => true;
export const saveFreeQuiz = () => true;
export const deleteFreeQuiz = () => true;
export const resetToDefaultQuizzes = () => true;
