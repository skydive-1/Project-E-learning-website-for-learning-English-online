import React, { useEffect, useRef } from 'react';
import { FiTrash2, FiAlertTriangle, FiX } from 'react-icons/fi';

/**
 * DeleteConfirmModal Component
 * - Custom modal confirmation nằm hoàn toàn bên trong AI Assistant panel (absolute inset-0)
 * - Không sử dụng window.confirm / window.alert
 * - Hỗ trợ phím Esc để hủy, quản lý trạng thái xóa đang diễn ra (isDeleting)
 */
const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  errorMessage = null
}) => {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Focus vào nút Hủy khi mở modal để tránh vô tình nhấn Enter xóa
      setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !isDeleting) {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chat-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[320px] bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-2xl p-5 text-center space-y-4 animate-scale-in">
        {/* Warning Icon */}
        <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/50 text-red-500 dark:text-red-400 flex items-center justify-center shadow-2xs">
          <FiTrash2 className="text-xl" />
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h4 id="delete-chat-title" className="font-bold text-slate-800 dark:text-slate-100 text-[14.5px]">
            Xóa cuộc trò chuyện?
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-1">
            Toàn bộ lịch sử trò chuyện hiện tại sẽ bị xóa. Hành động này không thể hoàn tác.
          </p>
        </div>

        {/* Error message if API fails */}
        {errorMessage && (
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-[11px] font-medium text-left">
            <FiAlertTriangle className="text-xs shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex-1 py-2.5 px-3 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold text-xs shadow-sm hover:shadow-red-500/20 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                <span>Đang xóa...</span>
              </>
            ) : (
              <span>Xóa cuộc trò chuyện</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
