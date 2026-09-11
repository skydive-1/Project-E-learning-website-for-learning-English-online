import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlay, FiClock, FiArrowRight, FiBookOpen } from 'react-icons/fi';
import './LessonCard.css';

/**
 * LessonCard Component (Udemy AI Assistant direction)
 * - Hiển thị thẻ bài học xác thực như một thẻ gợi ý nội dung chuyên nghiệp
 * - Hiển thị mốc thời gian phụ đề chính xác (timestamp)
 * - CTA rõ ràng: "Tua đến MM:SS" (cùng bài) hoặc "Mở bài học" (khác bài)
 * - Không hiển thị điểm số kỹ thuật thô
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
  const endTime = source.endTime !== undefined && source.endTime !== null
    ? Number(source.endTime)
    : (action?.endTime !== undefined && action?.endTime !== null ? Number(action.endTime) : null);
  const formattedEndTime = source.formattedEndTime || action?.formattedEndTime || (endTime !== null ? formatSecondsToMMSS(endTime) : null);
  const formattedRange = formattedEndTime && formattedEndTime !== formattedTime
    ? `${formattedTime}–${formattedEndTime}`
    : formattedTime;

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
    <div 
      className={`ai-course-card ${isCurrentLesson ? 'is-current-lesson' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(e); }}
    >
      {/* Card Header: Badges */}
      <div className="ai-course-card-header">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="ai-course-card-badge">
            <FiBookOpen className="badge-icon" />
            <span>{badgeText}</span>
          </span>
          {courseName && (
            <span className="ai-course-card-course-tag" title={courseName}>
              {courseName}
            </span>
          )}
        </div>

        {formattedRange && (
          <span className="ai-course-card-timestamp" title={`Đoạn video có nội dung trả lời: ${formattedRange}`}>
            <FiClock className="time-icon" />
            <span>{formattedRange}</span>
          </span>
        )}
      </div>

      {/* Card Body: Lesson Title & Section */}
      <div className="ai-course-card-body">
        <div className="ai-course-card-play-icon">
          <FiPlay className="play-symbol" />
        </div>
        <div className="ai-course-card-content">
          <h4 className="ai-course-card-title">{lessonTitle}</h4>
          <p className="ai-course-card-section">{sectionTitle}</p>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="ai-course-card-footer">
        <span className="ai-course-card-action-text">
          {isCurrentLesson && startTime !== null
            ? `Xem đoạn trả lời từ ${formattedTime}`
            : (startTime !== null ? `Mở bài học từ ${formattedTime}` : 'Xem bài học này')}
        </span>
        <FiArrowRight className="ai-course-card-arrow" />
      </div>
    </div>
  );
};

export default LessonCard;
