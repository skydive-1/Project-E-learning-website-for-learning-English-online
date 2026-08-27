import React, { useState, useEffect } from 'react';
import { FiCpu, FiBookOpen, FiHelpCircle, FiZap } from 'react-icons/fi';
import { getSuggestedQuestions } from '../services/chatbot.service';

const CLIENT_LESSON_FALLBACKS = [
  'Bài này có những ý chính nào?',
  'Khái niệm nào cần ghi nhớ?',
  'Từ nào xuất hiện trong bài?',
  'Kiểm tra nhanh kiến thức bài này?'
];

const LEGACY_QUESTION_PATTERNS = [
  /Mục đích và nội dung chính/i,
  /Giải thích các điểm ngữ pháp và cấu trúc câu/i,
  /Trích xuất các từ vựng mới và ví dụ minh họa/i,
  /Tóm tắt những kiến thức cốt lõi/i
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
 * - Tự động nạp 4 câu hỏi gợi ý chuyên biệt theo từng bài học
 * - Hiển thị thành danh sách câu hỏi ngắn, phẳng và có thể gửi bằng một lần bấm
 * - Tự động ẩn đi sau khi cuộc hội thoại bắt đầu
 */
const EmptyState = ({ lessonId = 0, onSelectPrompt }) => {
  const isGlobal = Number(lessonId) === 0;
  const [suggestedQuestions, setSuggestedQuestions] = useState(() => (
    isGlobal ? [] : CLIENT_LESSON_FALLBACKS
  ));
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!isGlobal && Number(lessonId) > 0) {
      setSuggestedQuestions(CLIENT_LESSON_FALLBACKS);
      setIsLoadingQuestions(true);
      getSuggestedQuestions(lessonId)
        .then((questions) => {
          if (isMounted) {
            const normalizedQuestions = normalizeLessonQuestions(questions);
            setSuggestedQuestions(
              normalizedQuestions.length === 4 ? normalizedQuestions : CLIENT_LESSON_FALLBACKS
            );
          }
        })
        .catch(() => {
          if (isMounted) {
            setSuggestedQuestions(CLIENT_LESSON_FALLBACKS);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingQuestions(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [lessonId, isGlobal]);

  const globalPrompts = [
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
      <div className="w-full px-4 py-6 text-left animate-fade-in">
        <div className="mb-4">
          <h4 className="text-[14px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
            Bạn có câu hỏi về bài học này?
          </h4>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            Các gợi ý chỉ dựa trên nội dung xuất hiện trong bài.
          </p>
        </div>

        <div
          className="grid grid-cols-1 gap-2"
          aria-label="Câu hỏi gợi ý cho bài học"
          aria-busy={isLoadingQuestions}
        >
          {suggestedQuestions.map((questionText) => (
            <button
              key={questionText}
              type="button"
              onClick={() => onSelectPrompt(questionText, null)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-left text-[12px] font-medium leading-snug text-slate-800 transition-colors duration-150 hover:border-violet-500 hover:bg-violet-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:bg-violet-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:border-violet-400 dark:hover:bg-violet-950/20 dark:focus-visible:ring-offset-slate-900"
            >
              {questionText}
            </button>
          ))}
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
          Xin chào! Bạn muốn tìm hiểu gì hôm nay?
        </h4>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 max-w-[320px] leading-relaxed">
          Tôi là Trợ lý AI sẵn sàng giải đáp ngữ pháp, tra cứu nội dung bài học và gợi ý lộ trình học tập.
        </p>
      </div>

      {/* 3. Global Prompts (When outside lessons) */}
      <div className="w-full space-y-2 pt-1 text-left">
          <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
            Gợi ý câu hỏi nhanh:
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
