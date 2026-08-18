import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlayCircle, FiArrowRight, FiBookOpen, FiClock } from 'react-icons/fi';
import './LessonCard.css';

/**
 * LessonCard Component (Phase 8 - Timestamp Awareness & Click-to-Seek)
 * - Hiển thị thẻ bài học xác thực (Udemy-like UX)
 * - Hiển thị mốc thời gian phụ đề (startTime / endTime)
 * - Click-to-Seek: Tua trực tiếp video nếu đang ở cùng bài học, hoặc điều hướng kèm query ?seek= nếu ở bài khác
 */
const LessonCard = ({ 
  source, 
  action, 
  currentLessonId = null, 
  onSeekVideo = null, 
  onNavigate = null 
}) => {
  const navigate = useNavigate();

  if (!source) return null;

  const lessonId = source.lessonId || action?.lessonId;
  const lessonTitle = source.lessonTitle || action?.lessonTitle || 'Bài học tiếng Anh';
  const sectionTitle = source.sectionTitle || 'Chương trình học';
  const badgeText = source.badgeText || 'Bài học liên quan';
  const courseName = source.courseName;

  const startTime = source.startTime !== undefined && source.startTime !== null 
    ? Number(source.startTime) 
    : (action?.startTime !== undefined && action?.startTime !== null ? Number(action.startTime) : null);

  const formattedTime = source.formattedTime || action?.formattedTime || (startTime !== null ? formatSecondsToMMSS(startTime) : null);

  const isCurrentLesson = currentLessonId && Number(currentLessonId) === Number(lessonId);

  function formatSecondsToMMSS(secs) {
    if (isNaN(secs) || secs < 0) return null;
    const total = Math.floor(secs);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const handleCardClick = (e) => {
    e.preventDefault();
    if (isCurrentLesson && startTime !== null && onSeekVideo) {
      // Đang ở đúng bài học -> Tua trực tiếp video đến mốc thời gian
      onSeekVideo(startTime);
    } else if (onNavigate) {
      onNavigate(lessonId, startTime);
    } else if (lessonId) {
      const targetUrl = startTime !== null 
        ? `/lessons/${lessonId}?seek=${startTime}` 
        : `/lessons/${lessonId}`;
      navigate(targetUrl);
    }
  };

  return (
    <div className="ai-lesson-card animate-fade-in" onClick={handleCardClick}>
      <div className="ai-lesson-card-header">
        <span className="ai-lesson-card-badge">
          <FiBookOpen className="badge-icon" />
          {badgeText}
        </span>
        {formattedTime && (
          <span className="ai-lesson-card-time-badge" title={`Thời điểm bắt đầu: ${formattedTime}`}>
            <FiClock className="time-icon" />
            {formattedTime}
          </span>
        )}
        {courseName && (
          <span className="ai-lesson-card-course">{courseName}</span>
        )}
      </div>

      <div className="ai-lesson-card-body">
        <div className="ai-lesson-card-icon-wrapper">
          <FiPlayCircle className="play-icon" />
        </div>
        <div className="ai-lesson-card-info">
          <h4 className="ai-lesson-card-title">{lessonTitle}</h4>
          <p className="ai-lesson-card-section">{sectionTitle}</p>
        </div>
      </div>

      <div className="ai-lesson-card-footer">
        <button 
          type="button" 
          className={`ai-lesson-card-btn ${isCurrentLesson && startTime !== null ? 'seek-btn' : ''}`}
          onClick={handleCardClick}
        >
          <span>
            {isCurrentLesson && startTime !== null 
              ? `Tua đến ${formattedTime}` 
              : (startTime !== null ? `Mở bài học (từ ${formattedTime})` : 'Mở bài học')}
          </span>
          <FiArrowRight className="arrow-icon" />
        </button>
      </div>
    </div>
  );
};

export default LessonCard;
