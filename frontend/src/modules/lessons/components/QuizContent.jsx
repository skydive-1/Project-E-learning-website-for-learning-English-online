import React, { useState, useEffect, useRef } from 'react';
import { FiClock, FiAlertCircle, FiCheckCircle, FiChevronLeft, FiChevronRight, FiRefreshCw, FiAward } from 'react-icons/fi';
import { 
  getCourseQuizQuestions, 
  getFreeQuizById,
  getCourseQuizByLessonId,
  submitQuizAttempt
} from '../../quizzes/services/quizzes.service';
import { useGamification } from '../../../context/GamificationContext';

const QuizContent = ({ lessonId, quizId, isFreeQuiz = false, onComplete }) => {
  const { triggerBadgeUnlock } = useGamification() || {};
  const [questions, setQuestions] = useState([]);
  const [quizTitle, setQuizTitle] = useState("Bài tập Trắc nghiệm");
  const [timeLimit, setTimeLimit] = useState(10); // minutes
  const [actualQuizId, setActualQuizId] = useState(null);

  // Quiz states
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600); // seconds
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const timerRef = useRef(null);

  // Load questions
  useEffect(() => {
    let isCurrent = true;
    const loadQuizData = async () => {
      try {
        if (isFreeQuiz && quizId) {
          const quiz = await getFreeQuizById(quizId);
          if (quiz && isCurrent) {
            setQuestions(quiz.questions || []);
            setQuizTitle(quiz.title);
            setTimeLimit(quiz.timeLimit || 10);
            setTimeLeft((quiz.timeLimit || 10) * 60);
            setActualQuizId(quiz.id);
          }
        } else if (lessonId) {
          const quiz = getCourseQuizByLessonId(lessonId);
          if (quiz && isCurrent) {
            setQuestions(quiz.questions || []);
            setQuizTitle(quiz.title || "Bài kiểm tra phản xạ kiến thức");
            setTimeLimit(quiz.timeLimit || 10);
            setTimeLeft((quiz.timeLimit || 10) * 60);
            setActualQuizId(quiz.id);
          }
        }
      } catch (err) {
        console.error("Lỗi load câu hỏi trắc nghiệm:", err);
      }
    };

    loadQuizData();

    // Reset quiz state when switching quiz/lesson
    setSelectedAnswers({});
    setActiveQuestionIdx(0);
    setIsSubmitted(false);
    setScore(0);
    setShowConfirmModal(false);

    return () => {
      isCurrent = false;
    };
  }, [lessonId, quizId, isFreeQuiz]);

  // Countdown timer logic
  useEffect(() => {
    if (isSubmitted || questions.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSubmitted, questions.length]);

  const handleSelectOption = (questionId, optionKey) => {
    if (isSubmitted) return; // Khóa đáp án khi đã nộp
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleAutoSubmit = () => {
    alert("Hết giờ làm bài! Hệ thống tự động nộp bài của bạn.");
    calculateAndSubmit();
  };

  const calculateAndSubmit = async () => {
    let correctCount = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    setScore(correctCount);
    setIsSubmitted(true);
    setShowConfirmModal(false);

    if (correctCount > 0 && correctCount === questions.length && triggerBadgeUnlock) {
      triggerBadgeUnlock('badge-quiz-100');
    }

    if (actualQuizId) {
      try {
        await submitQuizAttempt(actualQuizId, selectedAnswers);
      } catch (err) {
        console.warn("⚠️ Không thể lưu kết quả thi lên máy chủ:", err.message);
      }
    }

    if (onComplete) {
      onComplete(correctCount, questions.length);
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setActiveQuestionIdx(0);
    setIsSubmitted(false);
    setScore(0);
    setTimeLeft(timeLimit * 60);
  };

  // Format time (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200/60 rounded-2xl min-h-[300px] text-slate-400">
        <FiAlertCircle className="text-4xl mb-3 text-slate-300" />
        <p className="font-semibold text-sm">Chưa có câu hỏi trắc nghiệm cho bài học này.</p>
        <p className="text-xs text-slate-400 mt-1">Giảng viên đang biên soạn bộ đề, vui lòng quay lại sau.</p>
      </div>
    );
  }

  const currentQuestion = questions[activeQuestionIdx];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const isTimeCritical = timeLeft < 60; // Dưới 1 phút

  return (
    <div className="flex flex-col space-y-6 w-full animate-fade">
      {/* Quiz Top bar: Title and Timer */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-white border border-slate-200/60 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-wide">{quizTitle}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tiến độ: <span className="font-bold text-slate-700">{answeredCount}/{totalQuestions} câu</span> đã trả lời
          </p>
        </div>

        {/* Timer Card */}
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl border text-sm font-bold tracking-wider transition-all ${
            isSubmitted
              ? 'bg-slate-50 text-slate-400 border-slate-200'
              : isTimeCritical
                ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                : 'bg-indigo-50/50 text-smart-indigo border-indigo-100'
          }`}>
            <FiClock className={isTimeCritical && !isSubmitted ? 'animate-spin' : ''} />
            <span>{isSubmitted ? 'Đã hoàn thành' : formatTime(timeLeft)}</span>
          </div>

          {!isSubmitted && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl tracking-wider uppercase shadow-md transition-all active:scale-95 cursor-pointer"
            >
              Nộp bài
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left is Question Card, Right is Jump Grid */}
      <div className="grid grid-cols-10 gap-6 items-start">
        {/* Left Card: Question Area */}
        <div className="col-span-10 lg:col-span-7 bg-white border border-slate-200/60 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col space-y-6 relative overflow-hidden">
          {/* Submission Banner */}
          {isSubmitted && (
            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-2 text-emerald-800">
              <div className="flex items-center space-x-3">
                <FiAward className="text-2xl text-emerald-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Xem kết quả bài làm</h4>
                  <p className="text-xs text-emerald-600">Độ chính xác: {score}/{totalQuestions} câu đúng ({Math.round((score / totalQuestions) * 100)}%)</p>
                </div>
              </div>
              <button
                onClick={handleRetake}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <FiRefreshCw className="text-xs" />
                <span>Làm lại</span>
              </button>
            </div>
          )}

          {/* Question Text */}
          <div className="flex flex-col space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-smart-indigo bg-indigo-50 px-2 py-0.5 rounded w-max">
              Câu hỏi {activeQuestionIdx + 1}
            </span>
            <p className="text-[14.5px] font-semibold text-slate-800 leading-relaxed mt-2">
              {currentQuestion.question}
            </p>
          </div>

          {/* Options List */}
          <div className="flex flex-col space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const optionKey = String.fromCharCode(65 + idx); // A, B, C, D
              const isSelected = selectedAnswers[currentQuestion.id] === optionKey;
              const isCorrect = currentQuestion.correctAnswer === optionKey;

              // Xác định style màu sắc của option
              let cardStyle = "border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/50 text-slate-700";
              let labelBadge = "bg-slate-100 text-slate-500 border border-slate-200";

              if (isSubmitted) {
                if (isCorrect) {
                  cardStyle = "border-emerald-300 bg-emerald-50/40 text-emerald-800 font-medium";
                  labelBadge = "bg-emerald-500 text-white";
                } else if (isSelected) {
                  cardStyle = "border-red-300 bg-red-50/40 text-red-800 font-medium";
                  labelBadge = "bg-red-500 text-white";
                } else {
                  cardStyle = "border-slate-100 bg-white opacity-60 text-slate-400";
                  labelBadge = "bg-slate-50 text-slate-300 border border-slate-100";
                }
              } else if (isSelected) {
                cardStyle = "border-smart-indigo bg-indigo-50/20 text-smart-indigo font-medium shadow-sm ring-1 ring-smart-indigo/20";
                labelBadge = "bg-smart-indigo text-white border border-smart-indigo";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(currentQuestion.id, optionKey)}
                  className={`flex items-center text-left p-4 rounded-xl border text-[13.5px] leading-relaxed transition-all cursor-pointer ${cardStyle}`}
                  disabled={isSubmitted}
                >
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold mr-3.5 shrink-0 transition-colors ${labelBadge}`}>
                    {optionKey}
                  </span>
                  <span className="flex-1">{option.replace(/^[A-D]\.\s*/, '')}</span>
                </button>
              );
            })}
          </div>

          {/* Explanation in review mode */}
          {isSubmitted && currentQuestion.explanation && (
            <div className="p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-xl text-xs leading-relaxed text-slate-600">
              <span className="font-bold text-smart-indigo block mb-1">Giải thích chi tiết:</span>
              {currentQuestion.explanation}
            </div>
          )}

          {/* Bottom Navigation controls */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-150 mt-4">
            <button
              onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
              disabled={activeQuestionIdx === 0}
              className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${
                activeQuestionIdx === 0
                  ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95'
              }`}
            >
              <FiChevronLeft />
              <span>Trước</span>
            </button>

            <span className="text-xs text-slate-500 font-medium">
              Câu {activeQuestionIdx + 1} / {totalQuestions}
            </span>

            <button
              onClick={() => setActiveQuestionIdx(prev => Math.min(totalQuestions - 1, prev + 1))}
              disabled={activeQuestionIdx === totalQuestions - 1}
              className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${
                activeQuestionIdx === totalQuestions - 1
                  ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95'
              }`}
            >
              <span>Sau</span>
              <FiChevronRight />
            </button>
          </div>
        </div>

        {/* Right Card: Jump Status Grid */}
        <div className="col-span-10 lg:col-span-3 bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4">Danh sách câu hỏi</h3>
          
          <div className="grid grid-cols-5 gap-2.5">
            {questions.map((q, idx) => {
              const isCurrent = idx === activeQuestionIdx;
              const isAnswered = selectedAnswers[q.id] !== undefined;
              const isCorrect = isSubmitted && (selectedAnswers[q.id] === q.correctAnswer);

              let buttonStyle = "border-slate-200 text-slate-600 hover:border-indigo-400 bg-white";
              if (isSubmitted) {
                buttonStyle = isCorrect
                  ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
                  : "bg-red-500 text-white border-red-500 hover:bg-red-600";
              } else if (isCurrent) {
                buttonStyle = "bg-smart-indigo text-white border-smart-indigo ring-2 ring-indigo-100";
              } else if (isAnswered) {
                buttonStyle = "bg-indigo-50 text-smart-indigo border-indigo-200 font-semibold";
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={`w-full aspect-square rounded-xl border flex items-center justify-center text-xs font-bold transition-all duration-200 cursor-pointer active:scale-90 ${buttonStyle}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
              <span className="w-3 h-3 rounded-md bg-indigo-50 border border-indigo-200 block"></span>
              <span>Đã chọn đáp án</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
              <span className="w-3 h-3 rounded-md bg-white border border-slate-200 block"></span>
              <span>Chưa làm</span>
            </div>
            {isSubmitted && (
              <>
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 block"></span>
                  <span>Đáp án đúng</span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
                  <span className="w-3 h-3 rounded-md bg-red-500 block"></span>
                  <span>Đáp án sai</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in">
            <h3 className="font-bold text-slate-800 text-base mb-2">Xác nhận nộp bài</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Bạn mới trả lời được {answeredCount}/{totalQuestions} câu hỏi. Bạn có chắc chắn muốn nộp bài trắc nghiệm ngay bây giờ để xem điểm số không?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={calculateAndSubmit}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Xác nhận nộp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizContent;
