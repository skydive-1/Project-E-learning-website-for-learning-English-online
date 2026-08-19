import React from 'react';

const COLOR_MAP = {
  yellow: {
    bg: 'rgba(250, 204, 21, 0.35)',
    border: '#ca8a04',
    areaBorder: 'rgba(202, 138, 4, 0.9)',
    selectedBg: 'rgba(250, 204, 21, 0.65)'
  },
  green: {
    bg: 'rgba(74, 222, 128, 0.35)',
    border: '#16a34a',
    areaBorder: 'rgba(22, 163, 74, 0.9)',
    selectedBg: 'rgba(74, 222, 128, 0.65)'
  },
  blue: {
    bg: 'rgba(96, 165, 250, 0.35)',
    border: '#2563eb',
    areaBorder: 'rgba(37, 99, 235, 0.9)',
    selectedBg: 'rgba(96, 165, 250, 0.65)'
  },
  pink: {
    bg: 'rgba(244, 114, 182, 0.35)',
    border: '#db2777',
    areaBorder: 'rgba(219, 39, 119, 0.9)',
    selectedBg: 'rgba(244, 114, 182, 0.65)'
  }
};

export default function PdfHighlightOverlay({
  pageNumber,
  notes = [],
  selectedNoteId,
  activeGlowNoteId,
  onSelectNote
}) {
  const pageNotes = notes.filter((n) => Number(n.pageNumber) === Number(pageNumber));

  if (pageNotes.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      {pageNotes.map((note) => {
        const isSelected = selectedNoteId && String(note.id || note.noteId) === String(selectedNoteId);
        const isGlowing = activeGlowNoteId && String(note.id || note.noteId) === String(activeGlowNoteId);
        const colorConfig = COLOR_MAP[note.color] || COLOR_MAP.yellow;
        const isArea = note.selectionType === 'area';

        const rectList = Array.isArray(note.rects)
          ? note.rects
          : typeof note.rects === 'string'
          ? JSON.parse(note.rects || '[]')
          : [];

        return rectList.map((rect, rIdx) => {
          const tooltipTitle = isArea
            ? `[Vùng - ${note.category}] ${note.noteText || ''}`
            : note.noteText
            ? `[${note.category}] ${note.noteText}`
            : note.selectedText;

          return (
            <div
              key={`${note.id || note.noteId}-${rIdx}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectNote) onSelectNote(note);
              }}
              title={tooltipTitle}
              style={{
                position: 'absolute',
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                backgroundColor: isSelected || isGlowing ? colorConfig.selectedBg : colorConfig.bg,
                border: isArea ? `2px dashed ${colorConfig.areaBorder}` : 'none',
                borderBottom: isArea ? `2px dashed ${colorConfig.areaBorder}` : `2px solid ${colorConfig.border}`,
                borderRadius: isArea ? '6px' : '2px',
                pointerEvents: 'auto',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isGlowing
                  ? `0 0 12px 3px ${colorConfig.border}, inset 0 0 8px ${colorConfig.border}`
                  : isSelected
                  ? `0 0 0 2px ${colorConfig.border}`
                  : 'none',
                transform: isGlowing ? 'scale(1.02)' : 'none'
              }}
              className={`pdf-highlight-box ${isGlowing ? 'animate-pulse' : ''}`}
            />
          );
        });
      })}
    </div>
  );
}
