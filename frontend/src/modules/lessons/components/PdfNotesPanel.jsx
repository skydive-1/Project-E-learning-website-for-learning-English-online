import React, { useState, useMemo } from 'react';
import {
  FiSearch,
  FiFilter,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiX,
  FiBookOpen,
  FiTag,
  FiClock,
  FiCornerDownRight,
  FiPlusCircle
} from 'react-icons/fi';

const CATEGORY_META = {
  important: { label: 'Quan trọng', badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300' },
  not_understood: { label: 'Chưa hiểu', badge: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300' },
  review: { label: 'Cần xem lại', badge: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300' },
  vocabulary: { label: 'Từ vựng', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300' }
};

const COLOR_DOTS = {
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-400',
  blue: 'bg-blue-400',
  pink: 'bg-pink-400'
};

export default function PdfNotesPanel({
  notes = [],
  isLoading = false,
  selectedNoteId,
  onNavigateToNote,
  onUpdateNote,
  onDeleteNote
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedPageFilter, setSelectedPageFilter] = useState('all');

  // Edit Note State
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editCategory, setEditCategory] = useState('important');
  const [editColor, setEditColor] = useState('yellow');
  const [isSaving, setIsSaving] = useState(false);

  // Danh sách các trang có ghi chú để làm bộ lọc
  const availablePages = useMemo(() => {
    const pages = Array.from(new Set(notes.map((n) => Number(n.pageNumber)).filter(Boolean)));
    return pages.sort((a, b) => a - b);
  }, [notes]);

  // Lọc ghi chú theo Search, Category, Color, Page
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // 1. Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inSelected = (n.selectedText || '').toLowerCase().includes(q);
        const inNote = (n.noteText || '').toLowerCase().includes(q);
        if (!inSelected && !inNote) return false;
      }

      // 2. Category
      if (selectedCategory !== 'all' && n.category !== selectedCategory) {
        return false;
      }

      // 3. Color
      if (selectedColor !== 'all' && n.color !== selectedColor) {
        return false;
      }

      // 4. Page
      if (selectedPageFilter !== 'all' && Number(n.pageNumber) !== Number(selectedPageFilter)) {
        return false;
      }

      return true;
    });
  }, [notes, searchQuery, selectedCategory, selectedColor, selectedPageFilter]);

  // Nhóm ghi chú theo số trang
  const groupedNotes = useMemo(() => {
    const groups = {};
    filteredNotes.forEach((n) => {
      const page = n.pageNumber || 1;
      if (!groups[page]) groups[page] = [];
      groups[page].push(n);
    });
    return groups;
  }, [filteredNotes]);

  const startEdit = (note, e) => {
    e.stopPropagation();
    setEditingNoteId(note.id || note.noteId);
    setEditNoteText(note.noteText || '');
    setEditCategory(note.category || 'important');
    setEditColor(note.color || 'yellow');
  };

  const cancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingNoteId(null);
  };

  const handleSaveEdit = async (noteId, e) => {
    e.stopPropagation();
    if (isSaving || !onUpdateNote) return;

    try {
      setIsSaving(true);
      await onUpdateNote(noteId, {
        noteText: editNoteText.trim(),
        category: editCategory,
        color: editColor
      });
      setEditingNoteId(null);
    } catch (err) {
      console.error('Lỗi cập nhật note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId, e) => {
    e.stopPropagation();
    if (!onDeleteNote) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) {
      await onDeleteNote(noteId);
    }
  };

  return (
    <div className="pdf-notes-panel h-full flex flex-col font-sans select-none text-slate-800 dark:text-slate-100" style={{ backgroundColor: 'var(--card-bg)' }}>
      {/* 1. Header & Quick Instructions */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs tracking-wider uppercase text-smart-indigo dark:text-indigo-400">
            Ghi chú cá nhân
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-smart-indigo/10 text-smart-indigo dark:bg-indigo-900/40 dark:text-indigo-300">
            {filteredNotes.length}
          </span>
        </div>

        <div className="text-[11px] text-slate-400 italic flex items-center gap-1">
          <FiPlusCircle className="text-smart-indigo" />
          <span>Bôi đen chữ trên PDF để tạo</span>
        </div>
      </div>

      {/* 2. Search & Filters Bar */}
      <div className="p-3 border-b space-y-2 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
        {/* Search Input */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nội dung ghi chú..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:ring-smart-indigo"
            style={{ borderColor: 'var(--border-color)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <FiX className="text-xs" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px]">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg font-medium text-slate-600 dark:text-slate-300 focus:outline-none"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <option value="all">Tất cả loại</option>
            <option value="important">⭐ Quan trọng</option>
            <option value="not_understood">❓ Chưa hiểu</option>
            <option value="review">🔄 Cần xem lại</option>
            <option value="vocabulary">📖 Từ vựng</option>
          </select>

          {/* Color Filter */}
          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg font-medium text-slate-600 dark:text-slate-300 focus:outline-none"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <option value="all">Tất cả màu</option>
            <option value="yellow">🟡 Vàng</option>
            <option value="green">🟢 Xanh lá</option>
            <option value="blue">🔵 Xanh dương</option>
            <option value="pink">🌸 Hồng</option>
          </select>

          {/* Page Filter */}
          {availablePages.length > 0 && (
            <select
              value={selectedPageFilter}
              onChange={(e) => setSelectedPageFilter(e.target.value)}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg font-medium text-slate-600 dark:text-slate-300 focus:outline-none"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <option value="all">Mọi trang</option>
              {availablePages.map((p) => (
                <option key={p} value={p}>
                  Trang {p}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 3. Notes List grouped by Page */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-3">
            <div className="w-8 h-8 border-3 border-smart-indigo border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400 font-medium">Đang tải ghi chú...</span>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-smart-indigo/10 border border-smart-indigo/20 flex items-center justify-center text-smart-indigo text-2xl mx-auto">
              <FiBookOpen />
            </div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {searchQuery || selectedCategory !== 'all' || selectedColor !== 'all'
                ? 'Không tìm thấy ghi chú phù hợp'
                : 'Chưa có ghi chú nào'}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              {searchQuery || selectedCategory !== 'all' || selectedColor !== 'all'
                ? 'Hãy thử xóa bộ lọc hoặc tìm kiếm bằng từ khóa khác.'
                : 'Bôi đen bất kỳ đoạn văn bản nào trên tài liệu PDF để đánh dấu highlight và lưu ghi chú cá nhân của bạn.'}
            </p>
          </div>
        ) : (
          Object.keys(groupedNotes)
            .sort((a, b) => Number(a) - Number(b))
            .map((pageNum) => (
              <div key={`page_group_${pageNum}`} className="space-y-2.5">
                {/* Page Group Badge */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    Trang {pageNum}
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                </div>

                {/* Notes in Page */}
                <div className="space-y-2">
                  {groupedNotes[pageNum].map((note) => {
                    const noteId = note.id || note.noteId;
                    const isSelected = selectedNoteId && String(noteId) === String(selectedNoteId);
                    const isEditing = editingNoteId === noteId;
                    const catMeta = CATEGORY_META[note.category] || CATEGORY_META.important;
                    const dotClass = COLOR_DOTS[note.color] || COLOR_DOTS.yellow;

                    return (
                      <div
                        key={noteId}
                        onClick={() => onNavigateToNote && onNavigateToNote(note)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer shadow-sm relative group ${
                          isSelected
                            ? 'border-smart-indigo ring-2 ring-smart-indigo/20 bg-smart-indigo/5'
                            : 'hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-850'
                        }`}
                        style={{ borderColor: isSelected ? '#3b82f6' : 'var(--border-color)' }}
                      >
                        {isEditing ? (
                          /* Edit Mode */
                          <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-smart-indigo">Chỉnh sửa ghi chú:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => handleSaveEdit(noteId, e)}
                                  disabled={isSaving}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md"
                                  title="Lưu"
                                >
                                  <FiCheck />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded-md"
                                  title="Hủy"
                                >
                                  <FiX />
                                </button>
                              </div>
                            </div>

                            <textarea
                              rows={2}
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none resize-none"
                              autoFocus
                            />

                            <div className="flex items-center gap-2">
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="text-[10px] p-1 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                              >
                                <option value="important">Quan trọng</option>
                                <option value="not_understood">Chưa hiểu</option>
                                <option value="review">Cần xem lại</option>
                                <option value="vocabulary">Từ vựng</option>
                              </select>

                              <select
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="text-[10px] p-1 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                              >
                                <option value="yellow">Vàng</option>
                                <option value="green">Xanh lá</option>
                                <option value="blue">Xanh dương</option>
                                <option value="pink">Hồng</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div>
                            {/* Card Header: Category Badge & Actions */}
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${dotClass} shadow-xs`}></span>
                                <span className={`px-2 py-0.5 rounded-md border text-[9.5px] font-bold ${catMeta.badge}`}>
                                  {catMeta.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => startEdit(note, e)}
                                  className="p-1 text-slate-400 hover:text-smart-indigo hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Chỉnh sửa"
                                >
                                  <FiEdit2 className="text-xs" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(noteId, e)}
                                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                  title="Xóa ghi chú"
                                >
                                  <FiTrash2 className="text-xs" />
                                </button>
                              </div>
                            </div>

                            {/* Highlighted Quote */}
                            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] italic text-slate-700 dark:text-slate-300 line-clamp-3 mb-2">
                              "{note.selectedText}"
                            </div>

                            {/* Personal Explanation Note */}
                            {note.noteText && (
                              <div className="flex items-start gap-1.5 text-xs text-slate-800 dark:text-slate-200 mt-1 font-medium">
                                <FiCornerDownRight className="text-slate-400 shrink-0 mt-0.5 text-xs" />
                                <p className="leading-snug">{note.noteText}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
