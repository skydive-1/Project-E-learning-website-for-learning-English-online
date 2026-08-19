import React, { useState, useEffect, useRef } from 'react';
import { FiCheck, FiX, FiTag, FiEdit3 } from 'react-icons/fi';

const CATEGORIES = [
  { id: 'important', label: 'Quan trọng', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300' },
  { id: 'not_understood', label: 'Chưa hiểu', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300' },
  { id: 'review', label: 'Cần xem lại', badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300' },
  { id: 'vocabulary', label: 'Từ vựng', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300' }
];

const COLORS = [
  { id: 'yellow', name: 'Vàng', hex: '#fef08a', border: '#eab308', dot: 'bg-yellow-400' },
  { id: 'green', name: 'Xanh lá', hex: '#bbf7d0', border: '#22c55e', dot: 'bg-emerald-400' },
  { id: 'blue', name: 'Xanh dương', hex: '#bfdbfe', border: '#3b82f6', dot: 'bg-blue-400' },
  { id: 'pink', name: 'Hồng', hex: '#fbcfe8', border: '#ec4899', dot: 'bg-pink-400' }
];

export default function PdfSelectionPopover({
  position, // { top, left, width, height } in px relative to container
  selectedText,
  initialDraft = '',
  onSave,
  onCancel
}) {
  const [category, setCategory] = useState('important');
  const [color, setColor] = useState('yellow');
  const [noteText, setNoteText] = useState(initialDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const popoverRef = useRef(null);

  // Đóng khi ấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Click outside to cancel
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onCancel();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSave({
        category,
        color,
        noteText: noteText.trim()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tính toán vị trí thông minh để không tràn màn hình
  const calculateStyle = () => {
    if (!position) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    let top = position.top + position.height + 12;
    let left = position.left + (position.width / 2) - 160; // 320px width / 2

    // Chống tràn mép trái/phải
    if (left < 10) left = 10;
    if (left + 320 > window.innerWidth) left = window.innerWidth - 330;

    return {
      top: `${Math.max(10, top)}px`,
      left: `${left}px`
    };
  };

  return (
    <div
      ref={popoverRef}
      style={calculateStyle()}
      className="absolute z-50 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 text-xs font-sans animate-fade text-slate-800 dark:text-slate-100 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 font-bold text-smart-indigo dark:text-indigo-400">
          <FiEdit3 className="text-sm" />
          <span>Tạo ghi chú PDF</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
          title="Hủy bỏ (Esc)"
        >
          <FiX />
        </button>
      </div>

      {/* Selected Text Preview */}
      <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 max-h-16 overflow-y-auto text-[11px] italic text-slate-600 dark:text-slate-300">
        "{selectedText}"
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Color Picker */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Màu Highlight:
          </label>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  c.dot
                } ${
                  color === c.id
                    ? 'ring-2 ring-offset-2 ring-smart-indigo dark:ring-offset-slate-900 scale-110 shadow-md'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title={c.name}
              >
                {color === c.id && <FiCheck className="text-slate-900 text-xs font-black" />}
              </button>
            ))}
          </div>
        </div>

        {/* Category Picker */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
            <FiTag />
            <span>Phân loại:</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-2 py-1.5 rounded-xl border text-[10.5px] font-semibold transition-all cursor-pointer text-left truncate ${
                  category === cat.id
                    ? `${cat.badgeColor} ring-1 ring-smart-indigo shadow-sm`
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note Textarea */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Ý kiến / Ghi chú của bạn:
          </label>
          <textarea
            rows={2}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Nhập giải thích, câu hỏi hoặc từ mới..."
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-smart-indigo/40 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
            maxLength={2000}
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-smart-indigo hover:bg-indigo-600 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FiCheck />
            )}
            <span>Lưu ghi chú</span>
          </button>
        </div>
      </form>
    </div>
  );
}
