import React from 'react';
import { FiCpu, FiMessageSquare, FiBookOpen, FiHelpCircle, FiZap } from 'react-icons/fi';

/**
 * EmptyState & QuickSuggestions Component
 * - Hiển thị trạng thái khởi đầu sạch sẽ, tạo cảm hứng tương tác
 * - Cung cấp các thẻ câu hỏi gợi ý nhanh theo ngữ cảnh bài học
 */
const EmptyState = ({ lessonId = 0, lessonTitle = '', onSelectPrompt }) => {
  const isGlobal = Number(lessonId) === 0;

  const quickPrompts = isGlobal
    ? [
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
      ]
    : [
        {
          icon: <FiBookOpen className="text-smart-indigo" />,
          title: "Giải thích ngữ pháp chính",
          desc: lessonTitle ? `Tóm tắt các cấu trúc trong "${lessonTitle}"` : "Tóm tắt các cấu trúc và lưu ý quan trọng trong bài này",
          promptText: "Giải thích ngắn gọn những điểm ngữ pháp và cấu trúc câu chính trong bài học này.",
          action: null
        },
        {
          icon: <FiZap className="text-amber-500" />,
          title: "Từ vựng trọng tâm",
          desc: lessonTitle ? `Trích xuất từ vựng & thuật ngữ trong "${lessonTitle}"` : "Trích xuất 5-8 từ vựng và thuật ngữ xuất hiện trong bài",
          promptText: "Từ vựng trọng tâm của bài học này là gì?",
          action: "LESSON_KEY_VOCAB"
        },
        {
          icon: <FiMessageSquare className="text-emerald-500" />,
          title: "Tạo bài tập ôn nhanh",
          desc: lessonTitle ? `Luyện tập 3-4 câu trắc nghiệm cho "${lessonTitle}"` : "Tạo 3-4 câu trắc nghiệm kiểm tra kiến thức bài học",
          promptText: "Tạo bài tập ôn nhanh cho bài học này.",
          action: "LESSON_QUICK_QUIZ"
        }
      ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-6 px-4 space-y-5 animate-fade-in">
      {/* AI Welcome Icon & Intro */}
      <div className="flex flex-col items-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-slate-800 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-smart-indigo dark:text-indigo-400 shadow-sm">
          <FiCpu className="text-2xl" />
        </div>
        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[14px]">
          {isGlobal ? "Xin chào! Bạn muốn tìm hiểu gì hôm nay?" : (lessonTitle ? `Hỏi đáp về: "${lessonTitle}"` : "Bạn có thắc mắc gì về bài học này?")}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[320px] leading-relaxed">
          {isGlobal
            ? "Tôi là Trợ lý AI sẵn sàng giải đáp ngữ pháp, tra cứu nội dung bài học và gợi ý lộ trình học tập cho bạn."
            : "Tôi có thể giải thích ngữ pháp, từ vựng, trích xuất đoạn video liên quan hoặc tạo bài tập ôn luyện."}
        </p>
      </div>

      {/* Quick Suggestions Cards */}
      <div className="w-full space-y-2 pt-2 text-left">
        <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
          Gợi ý câu hỏi nhanh:
        </p>
        <div className="grid grid-cols-1 gap-2">
          {quickPrompts.map((item, idx) => (
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
