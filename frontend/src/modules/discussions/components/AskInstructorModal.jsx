import React, { useState, useEffect } from 'react';
import { FiUserCheck, FiX, FiSend, FiCpu, FiFileText } from 'react-icons/fi';

/**
 * AskInstructorModal Component
 * - Modal nhỏ gọn kết nối trực tiếp từ câu trả lời của AI Chat sang Giảng viên
 * - Đồng bộ visual 100% với AI Chat (backdrop mờ, rounded-2xl, viền slate mảnh)
 * - Cho phép học viên tinh chỉnh nội dung câu hỏi trước khi gửi
 * - Checkbox rõ ràng cho phép đính kèm câu trả lời của AI
 */
const AskInstructorModal = ({
  isOpen = false,
  onClose = () => {},
  initialQuestion = '',
  aiResponse = '',
  onSubmit = () => {},
  lessonTitle = ''
}) => {
  const [questionText, setQuestionText] = useState('');
  const [attachAi, setAttachAi] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuestionText(initialQuestion || '');
      setAttachAi(true);
      setSubmitError('');
    }
  }, [isOpen, initialQuestion]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!questionText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        title: questionText.length > 60 ? `${questionText.slice(0, 60)}...` : questionText,
        content: questionText.trim(),
        attachAiResponse: attachAi ? aiResponse : null
      });
      onClose();
    } catch (error) {
      setSubmitError(error?.response?.data?.message || error?.message || 'Không thể gửi câu hỏi lúc này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-instructor-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-smart-indigo dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shadow-2xs">
              <FiUserCheck className="text-sm" />
            </div>
            <div>
              <h3 id="ask-instructor-title" className="font-bold text-[13.5px] text-slate-800 dark:text-slate-100 tracking-tight">
                Chuyển câu hỏi đến Giảng viên
              </h3>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                {lessonTitle ? `Bài học: ${lessonTitle}` : 'Trao đổi thắc mắc bài giảng'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Đóng modal"
            aria-label="Đóng modal"
          >
            <FiX className="text-base" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Nội dung câu hỏi gửi Giảng viên:
            </label>
            <textarea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Nhập thắc mắc bạn cần thầy cô giải thích thêm..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-[13px] bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-smart-indigo focus:ring-2 focus:ring-smart-indigo/10 resize-none"
              required
            />
          </div>

          {/* Tuỳ chọn đính kèm câu trả lời AI */}
          {aiResponse && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attachAi}
                  onChange={(e) => setAttachAi(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-smart-indigo focus:ring-smart-indigo text-xs"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Đính kèm phản hồi của AI làm tài liệu tham khảo
                  </span>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Giúp giảng viên nắm được ngữ cảnh giải thích ban đầu mà không gửi toàn bộ lịch sử trò chuyện.
                  </p>
                </div>
              </label>

              {attachAi && (
                <div className="pl-6 pt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 italic border-l-2 border-slate-300 dark:border-slate-600 ml-1">
                  "{aiResponse}"
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          {submitError && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">{submitError}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!questionText.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-smart-indigo hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <FiSend className="text-xs" />
              <span>{isSubmitting ? 'Đang gửi...' : 'Gửi cho giảng viên'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskInstructorModal;
