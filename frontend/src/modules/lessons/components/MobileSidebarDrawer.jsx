import React from 'react';
import { FiChevronUp, FiChevronDown, FiChevronRight, FiCheckSquare, FiSquare, FiX } from 'react-icons/fi';

/**
 * MobileSidebarDrawer - Collapsible sidebar drawer for mobile lesson navigation
 * Extracted from LessonDetailPage to avoid build issues with complex inline JSX
 */
const MobileSidebarDrawer = ({
  isOpen,
  onClose,
  course,
  expandedSections,
  setExpandedSections,
  targetLessonId,
  handleSelectLesson,
  handleToggleComplete
}) => {
  if (!isOpen || !course?.sections) return null;

  const isSubLessonType = (lesson) => lesson.type === 'quiz' || lesson.type === 'speaking';

  const getLessonStyle = (lesson, isActive) => {
    const isSub = isSubLessonType(lesson);
    if (isActive) {
      return {
        backgroundColor: 'rgba(29, 78, 216, 0.08)',
        borderColor: '#3b82f6',
      };
    }
    if (isSub) {
      return {
        backgroundColor: 'rgba(99, 102, 241, 0.03)',
        borderColor: 'rgba(99, 102, 241, 0.2)',
      };
    }
    return {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    };
  };

  const renderSection = (sec) => {
    const isExpanded = expandedSections[sec.id];
    if (!sec.lessons) return null;

    return (
      <div key={sec.id} className="mb-4">
        <button
          onClick={() => setExpandedSections(prev => ({ ...prev, [sec.id]: !isExpanded }))}
          className="w-full flex items-center justify-between p-3 text-left rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
          aria-expanded={isExpanded}
        >
          <h3 className="font-bold text-sm leading-snug pr-2" style={{ color: 'var(--text-color)' }}>
            {sec.title}
          </h3>
          <span className="text-slate-400 shrink-0">
            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </span>
        </button>

        {isExpanded && (
          <div className="divide-y mt-2" style={{ backgroundColor: 'var(--card-bg)', divideColor: 'var(--border-color)' }}>
            {sec.lessons.map((lesson) => {
              const isActive = String(targetLessonId) === String(lesson.id);
              const isSub = isSubLessonType(lesson);
              const lessonStyle = getLessonStyle(lesson, isActive);

              return (
                <div
                  key={lesson.id}
                  onClick={() => {
                    handleSelectLesson(lesson.id);
                    onClose();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectLesson(lesson.id);
                      onClose();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'step' : undefined}
                  style={{
                    ...lessonStyle,
                  }}
                  className={`lesson-drawer-item flex items-start px-3.5 py-3 transition-colors cursor-pointer rounded-lg border ${isSub ? 'ml-4 border-dashed' : 'border-transparent'} hover:opacity-90`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(e, lesson.id);
                    }}
                    className="mr-3 text-slate-400 hover:text-smart-indigo transition-colors flex-shrink-0 cursor-pointer pt-0.5"
                    title={lesson.completed ? "Đã hoàn thành (Bấm để hủy)" : "Chưa hoàn thành (Bấm để đánh dấu)"}
                  >
                    {lesson.completed ? (
                      <FiCheckSquare className="text-emerald-500 text-lg" />
                    ) : (
                      <FiSquare className="text-slate-400 hover:text-slate-600 text-lg" />
                    )}
                  </button>

                  <div className="flex-grow min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs font-semibold leading-tight line-clamp-2 ${isActive ? 'text-smart-indigo font-bold' : ''}`}
                        style={{ color: isActive ? '#3b82f6' : 'var(--text-color)' }}
                      >
                        {lesson.title}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="lesson-drawer fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="sidebar-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="lesson-drawer__panel absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-slide-in-right" style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <h2 id="sidebar-title" className="font-bold text-lg" style={{ color: 'var(--text-color)' }}>Danh sách bài học</h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Đóng danh sách bài học"
          >
            <FiX className="text-xl" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {course?.sections?.map(renderSection)}
        </div>
      </div>
    </div>
  );
};

export default MobileSidebarDrawer;
