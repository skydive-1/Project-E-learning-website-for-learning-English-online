import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlayCircle, FiArrowRight, FiBookOpen } from 'react-icons/fi';
import './LessonCard.css';

/**
 * LessonCard Component (Phase 7)
 * - Hiển thị thẻ bài học xác thực (Udemy-like UX)
 * - Hiển thị tiêu đề bài học, chương học, huy hiệu nguồn
 * - Nút "Mở bài học" điều hướng trực tiếp đến route /lessons/:lessonId
 */
const LessonCard = ({ source, action, onNavigate = null }) => {
  const navigate = useNavigate();

  if (!source) return null;

  const lessonId = source.lessonId || action?.lessonId;
  const lessonTitle = source.lessonTitle || action?.lessonTitle || 'Bài học tiếng Anh';
  const sectionTitle = source.sectionTitle || 'Chương trình học';
  const badgeText = source.badgeText || 'Bài học liên quan';
  const courseName = source.courseName;

  const handleCardClick = (e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(lessonId);
    } else if (lessonId) {
      navigate(`/lessons/${lessonId}`);
    }
  };

  return (
    <div className="ai-lesson-card animate-fade-in" onClick={handleCardClick}>
      <div className="ai-lesson-card-header">
        <span className="ai-lesson-card-badge">
          <FiBookOpen className="badge-icon" />
          {badgeText}
        </span>
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
          className="ai-lesson-card-btn"
          onClick={handleCardClick}
        >
          <span>Mở bài học</span>
          <FiArrowRight className="arrow-icon" />
        </button>
      </div>
    </div>
  );
};

export default LessonCard;
