import React, { useRef, useEffect } from 'react';
import { FiSend, FiMic, FiSquare, FiX } from 'react-icons/fi';

/**
 * Composer Component (Udemy-like UX)
 * - Khung nhập câu hỏi thông minh, tinh gọn và rộng rãi
 * - Hỗ trợ ghi âm giọng nói với trực quan sóng âm
 * - Tự động mở rộng hoặc phím tắt Enter để gửi
 */
const Composer = ({
  inputText,
  setInputText,
  onSubmit,
  isLoading,
  isRecording,
  recordingTime,
  onStartRecord,
  onStopRecord,
  onCancelRecord,
  placeholder = "Hỏi trợ lý AI về bài học này..."
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isLoading && !isRecording && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isRecording]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  return (
    <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200/80 dark:border-slate-700/80 shrink-0">
      {isRecording ? (
        /* Voice Recording Status Bar */
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Đang ghi âm ({recordingTime}s)
            </span>
          </div>

          {/* Audio Wave Visualizer */}
          <div className="flex items-center gap-1">
            <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></span>
            <span className="w-1 h-5 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
            <span className="w-1 h-2 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></span>
            <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onStopRecord}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Gửi
            </button>
            <button
              type="button"
              onClick={onCancelRecord}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              title="Hủy"
            >
              <FiX className="text-sm" />
            </button>
          </div>
        </div>
      ) : (
        /* Regular Clean Input Field */
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputText.trim() && !isLoading) onSubmit();
          }}
          className="flex items-center gap-2"
        >
          {/* Mic voice input */}
          <button
            type="button"
            onClick={onStartRecord}
            disabled={isLoading}
            className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              isLoading
                ? 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:text-smart-indigo dark:hover:text-indigo-400 shadow-2xs'
            }`}
            title="Nhập bằng giọng nói"
          >
            <FiMic className="text-[15px]" />
          </button>

          {/* Input text box */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={placeholder}
              className="w-full pl-3.5 pr-4 py-2.5 text-xs sm:text-[13px] bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-smart-indigo dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-smart-indigo/10 transition-all"
            />
          </div>

          {/* Send Action Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              inputText.trim() && !isLoading
                ? 'bg-smart-indigo hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-500/20 active:scale-95'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700/60 cursor-not-allowed'
            }`}
            title="Gửi câu hỏi"
          >
            <FiSend className="text-[14px]" />
          </button>
        </form>
      )}
    </div>
  );
};

export default Composer;
