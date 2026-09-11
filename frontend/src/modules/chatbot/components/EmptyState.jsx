import React, { useCallback, useState, useEffect } from 'react';
import { FiAlertCircle, FiCpu, FiBookOpen, FiHelpCircle, FiRefreshCw, FiZap, FiArrowRight } from 'react-icons/fi';
import { getSuggestedQuestions } from '../services/chatbot.service';
import { useLanguage } from '../../../context/LanguageContext';
import { translateSuggestedQuestion } from '../utils/suggestedQuestionsTranslator';

const LEGACY_QUESTION_PATTERNS = [
  /Mục đích và nội dung chính/i,
  /Giải thích các điểm ngữ pháp và cấu trúc câu/i,
  /Trích xuất các từ vựng mới và ví dụ minh họa/i,
  /Tóm tắt những kiến thức cốt lõi/i,
  /Bài này có những ý chính nào/i,
  /Khái niệm nào cần ghi nhớ/i,
  /Từ nào xuất hiện trong bài/i,
  /Kiểm tra nhanh kiến thức bài này/i,
  /Giáo viên giải thích gì về/i,
  /Bài giảng nêu điểm nào liên quan đến/i,
  /Nội dung về .* được trình bày như thế nào/i,
  /Bài giảng nhấn mạnh điều gì khi nói về/i,
  /Nội dung cốt lõi của/i,
  /Định nghĩa và nguyên lý của/i,
  /Ví dụ minh họa tiêu biểu cho/i,
  /Cách áp dụng .* trong giao tiếp thực tế/i,
  /“(con|thì|chúng|người|mình|nhà|câu|tôi|bạn|hai|phân|thư|phát|sinh|nguy|vựng|sound)”/i
];

const normalizeLessonQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];

  const uniqueQuestions = [];
  const seen = new Set();

  questions.forEach((rawQuestion) => {
    if (uniqueQuestions.length >= 4 || typeof rawQuestion !== 'string') return;
    const question = rawQuestion.replace(/\s+/g, ' ').trim();
    const normalized = question.toLocaleLowerCase('vi');
    if (
      !question ||
      question.length > 92 ||
      seen.has(normalized) ||
      LEGACY_QUESTION_PATTERNS.some(pattern => pattern.test(question))
    ) return;

    seen.add(normalized);
    uniqueQuestions.push(question);
  });

  return uniqueQuestions.length === 4 ? uniqueQuestions : [];
};

/**
 * EmptyState & SuggestedQuestions Component (Udemy-like AI Assistant Feature)
 * - Tự động nạp 4 câu hỏi gợi ý chuyên biệt theo từng bài học bám sát nội dung như Udemy
 * - Thiết kế giao diện card bo viền tinh tế, hover tím đặc trưng Udemy
 * - Hỗ trợ tự động chuyển ngữ câu hỏi và nhãn sang tiếng Anh khi chọn ENG trên Header
 */
const EmptyState = ({ lessonId = 0, lessonTitle = '', onSelectPrompt }) => {
  const isGlobal = Number(lessonId) === 0;
  const { language } = useLanguage();
  const isEng = language === 'ENG';

  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState('');
  const [questionsUnavailable, setQuestionsUnavailable] = useState(false);

  const loadSuggestedQuestions = useCallback(async (forceRefresh = false) => {
    if (isGlobal || Number(lessonId) <= 0) return;

    setQuestionsError('');
    setQuestionsUnavailable(false);
    setIsLoadingQuestions(true);
    try {
      const questions = await getSuggestedQuestions(lessonId, forceRefresh);
      const normalizedQuestions = normalizeLessonQuestions(questions);
      if (normalizedQuestions.length === 0 && questions.contentAvailable === false) {
        setQuestionsUnavailable(true);
        setQuestionsError(isEng
          ? 'This lesson does not have a transcript yet, so grounded suggestions are unavailable.'
          : 'Bài học chưa có transcript nên chưa thể tạo câu hỏi gợi ý có căn cứ.');
        return;
      }
      if (normalizedQuestions.length !== 4) {
        if (!forceRefresh) {
          return loadSuggestedQuestions(true);
        }
        throw new Error('Máy chủ không trả về đủ bốn câu hỏi bám theo nội dung bài học.');
      }
      setSuggestedQuestions(normalizedQuestions);
    } catch (error) {
      console.error('[Suggested Questions] Không thể tải câu hỏi gợi ý:', error);
      setQuestionsError(isEng
        ? 'Unable to load suggested questions from lesson content.'
        : 'Không thể tải câu hỏi gợi ý từ nội dung bài học.');
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [isGlobal, lessonId, isEng]);

  useEffect(() => {
    if (!isGlobal && Number(lessonId) > 0) {
      setSuggestedQuestions([]);
      loadSuggestedQuestions(false);
    }
  }, [lessonId, isGlobal, loadSuggestedQuestions]);

  const globalPrompts = isEng ? [
    {
      icon: <FiBookOpen className="text-smart-indigo" />,
      title: "Recommended Courses",
      desc: "Course roadmap consulting for beginners",
      promptText: "Give me a summary of available English courses on the website.",
      action: null
    },
    {
      icon: <FiHelpCircle className="text-emerald-500" />,
      title: "Key Features",
      desc: "Overview of learning functions on the platform",
      promptText: "What key learning features does E-Learn Academy provide?",
      action: null
    },
    {
      icon: <FiZap className="text-amber-500" />,
      title: "Quick Study Tips",
      desc: "Effective listening and vocabulary memorization tips",
      promptText: "Share tips for effective English listening practice and vocabulary memorization.",
      action: null
    }
  ] : [
    {
      icon: <FiBookOpen className="text-smart-indigo" />,
      title: "Khóa học phù hợp",
      desc: "Tư vấn lộ trình học cho người mới bắt đầu",
      promptText: "Cho tôi tóm tắt về các khóa học tiếng Anh hiện có trên website.",
      action: null
    },
    {
      icon: <FiHelpCircle className="text-emerald-500" />,
      title: "Tính năng nổi bật",
      desc: "Giới thiệu các chức năng học tiếng Anh trên trang",
      promptText: "Trang web E-Learn Academy có những tính năng học tập nổi bật nào?",
      action: null
    },
    {
      icon: <FiZap className="text-amber-500" />,
      title: "Mẹo học nhanh",
      desc: "Cách luyện nghe và ghi nhớ từ vựng hiệu quả",
      promptText: "Gợi ý cho tôi mẹo luyện nghe và ghi nhớ từ vựng tiếng Anh hiệu quả.",
      action: null
    }
  ];

  if (!isGlobal) {
    return (
      <div className="w-full px-2 py-4 text-left animate-fade-in flex flex-col justify-end">
        {/* Header Section - Clean Style */}
        <div className="mb-4">
          <h4 className="text-[17px] font-bold leading-snug text-slate-900 dark:text-slate-100 tracking-tight">
            {isEng ? "Have a question about this lesson?" : "Bạn có câu hỏi về bài học này?"}
          </h4>
          <button
            type="button"
            onClick={() => loadSuggestedQuestions(true)}
            disabled={isLoadingQuestions}
            className="sr-only"
            title={isEng ? "Refresh suggested questions from AI" : "Làm mới câu hỏi gợi ý từ AI"}
          >
            {isEng ? "Refresh" : "Làm mới"}
          </button>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            {isEng ? "Suggestions are based solely on the content that appears in the article." : "Các gợi ý chỉ dựa trên nội dung xuất hiện trong bài."}
          </p>
        </div>

        {/* Suggested Questions Grid / List - Clean Dark Card Style */}
        <div
          className="grid grid-cols-1 gap-2.5"
          aria-label="Câu hỏi gợi ý cho bài học"
          aria-busy={isLoadingQuestions}
        >
          {isLoadingQuestions && suggestedQuestions.length === 0 && (
            <p className="px-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400" aria-live="polite">
              {isEng
                ? "You can ask right away below. Lesson suggestions will appear automatically."
                : "Bạn có thể nhập câu hỏi ngay bên dưới; gợi ý theo bài sẽ tự xuất hiện."}
            </p>
          )}

          {questionsError && !isLoadingQuestions && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100">
              <div className="flex items-start gap-2.5">
                <FiAlertCircle className="mt-0.5 shrink-0 text-base text-rose-600" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-snug">
                    {questionsError}
                  </p>
                  {!questionsUnavailable && <button
                    type="button"
                    onClick={() => loadSuggestedQuestions(true)}
                    className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-[12px] font-semibold text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-900/50 cursor-pointer"
                  >
                    <FiRefreshCw aria-hidden="true" />
                    {isEng ? "Try again" : "Thử tải lại"}
                  </button>}
                </div>
              </div>
            </div>
          )}

          {suggestedQuestions.map((questionText) => {
            const displayedQuestion = isEng ? translateSuggestedQuestion(questionText, 'ENG') : questionText;
            return (
              <button
                key={questionText}
                type="button"
                onClick={() => onSelectPrompt(displayedQuestion, 'SUGGESTED_QUESTION')}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1322] hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smart-indigo cursor-pointer shadow-2xs"
              >
                <span className="block font-bold text-[13px] sm:text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100 tracking-tight">
                  {displayedQuestion}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-4 px-3 space-y-4 animate-fade-in">
      {/* 1. Header Welcome Badge */}
      <div className="flex flex-col items-center space-y-1.5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-slate-800 border border-indigo-100/80 dark:border-indigo-900/40 flex items-center justify-center text-smart-indigo dark:text-indigo-400 shadow-xs">
          <FiCpu className="text-xl" />
        </div>
        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13.5px] leading-tight">
          {isEng ? "Hello! What would you like to explore today?" : "Xin chào! Bạn muốn tìm hiểu gì hôm nay?"}
        </h4>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 max-w-[320px] leading-relaxed">
          {isEng
            ? "I'm your AI Assistant ready to explain grammar, look up lesson content, and suggest study roadmaps."
            : "Tôi là Trợ lý AI sẵn sàng giải đáp ngữ pháp, tra cứu nội dung bài học và gợi ý lộ trình học tập."}
        </p>
      </div>

      {/* 3. Global Prompts (When outside lessons) */}
      <div className="w-full space-y-2 pt-1 text-left">
        <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
          {isEng ? "Quick question suggestions:" : "Gợi ý câu hỏi nhanh:"}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {globalPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(item.promptText, item.action)}
              className="w-full flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-smart-indigo dark:hover:border-indigo-500 hover:shadow-sm transition-all duration-200 group text-left cursor-pointer"
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 group-hover:scale-110 transition-transform shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-smart-indigo dark:group-hover:text-indigo-400 transition-colors">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
