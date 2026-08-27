import React, { useState } from 'react';
import { FiPlay, FiStar, FiCheckCircle } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const VIDEO_ITEMS = [
  {
    id: 1,
    duration: '0:50',
    name: 'Nguyễn Minh Quân',
    role: 'IELTS 7.5 Overall',
    topic: 'Cách mình tăng band Speaking từ 5.5 lên 7.5 sau 2 tháng',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 2,
    duration: '0:11',
    name: 'Trần Thảo Linh',
    role: 'TOEIC 850+',
    topic: 'Phản xạ nghe nói công sở tự nhiên không cần dịch nhẩm',
    thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 3,
    duration: '0:19',
    name: 'Lê Hoàng Nam',
    role: 'Software Engineer',
    topic: 'Tự tin phỏng vấn việc làm từ xa cho công ty nước ngoài',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600'
  }
];

const VideoReviewsSection = () => {
  const { t } = useLanguage();
  const [activeVideoId, setActiveVideoId] = useState(null);

  return (
    <section className="video-reviews-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-header-annotated scroll-animate">
          <span className="badge-pill-light">VIDEO THỰC TẾ TỪ HỌC VIÊN</span>
          <h2 className="section-main-heading">
            {t('Câu chuyện bứt phá từ học viên E-Learn Academy')}
          </h2>
          <p className="section-sub-desc">
            {t('Xem cảm nhận thực tế từ những người đã thành công nâng cao phản xạ và đạt chứng chỉ mơ ước.')}
          </p>
        </div>

        {/* 3 Video Cards Grid */}
        <div className="video-cards-grid scroll-animate">
          {VIDEO_ITEMS.map((v) => (
            <div key={v.id} className="video-review-card">
              <div className="video-thumb-container">
                <img 
                  src={v.thumbnail} 
                  alt={v.name} 
                  className="video-thumb-img"
                  loading="lazy"
                />
                <span className="video-duration-tag">{v.duration}</span>
                <button 
                  type="button" 
                  className="btn-play-video-overlay"
                  onClick={() => setActiveVideoId(v.id)}
                  aria-label={`Play review from ${v.name}`}
                >
                  <FiPlay className="play-icon-triangle" />
                </button>
              </div>
              <div className="video-card-body">
                <h4 className="video-topic-title">{t(v.topic)}</h4>
                <div className="video-author-meta">
                  <strong className="video-author-name">{v.name}</strong>
                  <span className="video-author-badge">{v.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Centered Trust Badge */}
        <div className="video-trust-badge scroll-animate">
          <div className="trust-badge-inner">
            <span className="trust-star-box">
              <FiStar className="star-icon-small filled" />
            </span>
            <span className="trust-brand-text">E-Learn Verified</span>
            <span className="trust-divider">•</span>
            <span className="trust-score-text">Xuất sắc: <strong>4.9 / 5.0</strong> (từ 2,169+ học viên)</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoReviewsSection;
