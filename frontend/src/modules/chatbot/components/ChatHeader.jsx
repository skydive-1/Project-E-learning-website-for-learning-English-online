import React from 'react';
import { FiCpu, FiTrash2, FiX } from 'react-icons/fi';

/**
 * ChatHeader Component (Udemy AI Assistant direction)
 * - Thiết kế gọn gàng, thanh lịch, hiện đại
 * - Tiêu đề rõ ràng kèm subtitle hướng dẫn ngắn gọn
 * - Đèn trạng thái AI trực quan (Online/Active)
 * - Nút xóa lịch sử và đóng panel tinh tế
 */
const ChatHeader = ({ 
  lessonId = 0, 
  onClearChat, 
  onClose,
  isLoading = false,
  t 
}) => {
  const isGlobal = Number(lessonId) === 0;

  return (
    <div className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-slate-800/95 border-b border-slate-200/80 dark:border-slate-700/80 backdrop-blur-sm shrink-0 transition-colors">
      {/* Title & Subtitle */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-smart-indigo dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50 shadow-2xs">
          <FiCpu className={`text-[15px] ${isLoading ? 'animate-spin' : ''}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-[13.5px] text-slate-800 dark:text-slate-100 tracking-tight">
              AI Assistant
            </h3>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
              {isLoading ? 'Đang soạn...' : 'Sẵn sàng'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
            {isGlobal 
              ? 'Hỏi đáp tiếng Anh tổng quát & thông tin khóa học' 
              : 'Hỏi đáp về bài học này hoặc tìm nội dung khóa học'}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-1 shrink-0 ml-2">
        <button
          type="button"
          onClick={onClearChat}
          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
          title="Xóa cuộc trò chuyện này"
          aria-label="Xóa cuộc trò chuyện"
        >
          <FiTrash2 className="text-[14px]" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            title="Đóng bảng AI"
            aria-label="Đóng bảng AI"
          >
            <FiX className="text-[15px]" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
