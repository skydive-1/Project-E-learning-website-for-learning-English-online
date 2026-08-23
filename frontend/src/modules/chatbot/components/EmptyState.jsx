import React, { useState, useEffect } from 'react';
import { FiCpu, FiMessageSquare, FiBookOpen, FiHelpCircle, FiZap, FiChevronRight } from 'react-icons/fi';
import { getSuggestedQuestions } from '../services/chatbot.service';

/**
 * EmptyState & SuggestedQuestions Component (Udemy-like AI Assistant Feature)
 * - Tự động nạp 4 câu hỏi gợi ý chuyên biệt theo từng bài học
 * - Hiển thị dưới dạng các thẻ Chip/Pill trực quan, bấm 1 chạm để gửi ngay câu hỏi
 * - Tự động ẩn đi sau khi cuộc hội thoại bắt đầu
 */
const EmptyState = ({ lessonId = 0, lessonTitle = '', onSelectPrompt }) => {
  const isGlobal = Number(lessonId) === 0;
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Template fallback nhanh tại Client (0ms)
  const getClientFallbackQuestions = (title) => {
    const cleanTitle = (title || '').trim() || 'bài học này';
    return [
      `Mục đích và nội dung chính của bài "${cleanTitle}" là gì?`,
      `Giải thích các điểm ngữ pháp và cấu trúc câu quan trọng trong "${cleanTitle}".`,
      `Trích xuất các từ vựng mới và ví dụ minh họa xuất hiện trong bài này.`,
      `Tóm tắt những kiến thức cốt lõi tôi cần ghi nhớ sau khi học xong "${cleanTitle}".`
    ];
  };

  useEffect(() => {
    let isMounted = true;

    if (!isGlobal && Number(lessonId) > 0) {
      setIsLoadingQuestions(true);
      getSuggestedQuestions(lessonId)
        .then((questions) => {
          if (isMounted) {
            if (Array.isArray(questions) && questions.length > 0) {
              setSuggestedQuestions(questions);
            } else {
              setSuggestedQuestions(getClientFallbackQuestions(lessonTitle));
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            setSuggestedQuestions(getClientFallbackQuestions(lessonTitle));
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingQuestions(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [lessonId, lessonTitle, isGlobal]);

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

  const quickActionPrompts = [
    {
      icon: <FiZap className="text-amber-500" />,
      title: "Từ vựng trọng tâm",
      promptText: "Từ vựng trọng tâm của bài học này là gì?",
      action: "LESSON_KEY_VOCAB"
    },
    {
      icon: <FiMessageSquare className="text-emerald-500" />,
      title: "Tạo bài tập ôn nhanh",
      promptText: "Tạo bài tập ôn nhanh cho bài học này.",
      action: "LESSON_QUICK_QUIZ"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-4 px-3 space-y-4 animate-fade-in">
      {/* 1. Header Welcome Badge */}
      <div className="flex flex-col items-center space-y-1.5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-slate-800 border border-indigo-100/80 dark:border-indigo-900/40 flex items-center justify-center text-smart-indigo dark:text-indigo-400 shadow-xs">
          <FiCpu className="text-xl" />
        </div>
        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13.5px] leading-tight">
          {isGlobal
            ? "Xin chào! Bạn muốn tìm hiểu gì hôm nay?"
            : (lessonTitle ? `Hỏi đáp về: "${lessonTitle}"` : "Bạn có thắc mắc gì về bài học này?")}
        </h4>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 max-w-[320px] leading-relaxed">
          {isGlobal
            ? "Tôi là Trợ lý AI sẵn sàng giải đáp ngữ pháp, tra cứu nội dung bài học và gợi ý lộ trình học tập."
            : "Hỏi đáp nội dung bài giảng, giải thích ngữ pháp, từ vựng hoặc tạo bài tập ôn luyện nhanh."}
        </p>
      </div>

      {/* 2. Suggested Questions Chips / Pills (Udemy-like) */}
      {!isGlobal && (
        <div className="w-full space-y-2 text-left pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-smart-indigo animate-pulse"></span>
              Gợi ý câu hỏi bài học:
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {isLoadingQuestions && suggestedQuestions.length === 0 ? (
              // Loading Skeleton
              [1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200/50 dark:border-slate-700/50"
                />
              ))
            ) : (
              // 4 Suggested Question Chips
              (suggestedQuestions.length > 0 ? suggestedQuestions : getClientFallbackQuestions(lessonTitle)).map((questionText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectPrompt(questionText, null)}
                  className="w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 hover:border-smart-indigo dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 hover:shadow-xs transition-all duration-150 group text-left cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1 rounded-md bg-white dark:bg-slate-700/60 text-slate-400 group-hover:text-smart-indigo dark:group-hover:text-indigo-400 shrink-0 transition-colors shadow-xs">
                      <FiHelpCircle className="text-[13px]" />
                    </div>
                    <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200 group-hover:text-smart-indigo dark:group-hover:text-indigo-300 transition-colors leading-snug line-clamp-2">
                      {questionText}
                    </span>
                  </div>
                  <FiChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-smart-indigo group-hover:translate-x-0.5 transition-all text-xs shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* Quick Action Pills (Quiz & Vocab) */}
          <div className="pt-2">
            <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 mb-1.5">
              Hành động nhanh:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {quickActionPrompts.map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectPrompt(act.promptText, act.action)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 hover:border-smart-indigo dark:hover:border-indigo-500 hover:shadow-xs transition-all duration-150 group text-left cursor-pointer"
                >
                  <span className="p-1 rounded-md bg-slate-50 dark:bg-slate-700/50 shrink-0">
                    {act.icon}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 group-hover:text-smart-indigo dark:group-hover:text-indigo-300 truncate">
                    {act.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Global Prompts (When outside lessons) */}
      {isGlobal && (
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
      )}
    </div>
  );
};

export default EmptyState;
