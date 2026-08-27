import React from 'react';
import { 
  FiEyeOff, 
  FiTrendingUp, 
  FiSearch, 
  FiZap, 
  FiHeadphones, 
  FiUserCheck 
} from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const PROBLEM_CARDS = [
  {
    id: 1,
    icon: <FiEyeOff className="problem-icon" />,
    title: 'Phát âm chưa tự nhiên, còn sợ nói sai?',
    desc: 'Nâng cấp phát âm chuẩn IPA và ngữ điệu tự nhiên, tự tin giao tiếp không ngại ngùng.',
    category: 'PHÁT ÂM & PHẢN XẠ'
  },
  {
    id: 2,
    icon: <FiTrendingUp className="problem-icon" />,
    title: 'Học nhiều từ vựng nhưng không phản xạ được?',
    desc: 'Chuyển hóa vốn từ thụ động thành phản xạ tức thì cùng trợ lý AI luyện nói thông minh.',
    category: 'GIAO TIẾP THỰC CHIẾN'
  },
  {
    id: 3,
    icon: <FiSearch className="problem-icon" />,
    title: 'Bối rối khi chọn tài liệu & giáo trình chuẩn?',
    desc: 'Mở khóa hệ thống bài học chuẩn khung CEFR (A1 - C2), bám sát mục tiêu IELTS/TOEIC/Giao tiếp.',
    category: 'GIÁO TRÌNH QUỐC TẾ'
  },
  {
    id: 4,
    icon: <FiZap className="problem-icon" />,
    title: 'Mất gốc và bế tắc ngay từ vạch xuất phát?',
    desc: 'Nhận lộ trình tinh gọn, từng bước chắc chắn giúp bạn làm chủ tiếng Anh từ con số 0.',
    category: 'LỘ TRÌNH TINH GỌN'
  },
  {
    id: 5,
    icon: <FiHeadphones className="problem-icon" />,
    title: 'Không có môi trường luyện nghe nói thường xuyên?',
    desc: 'Phòng học tương tác 24/7, thực hành giao tiếp mọi lúc mọi nơi không giới hạn thời gian.',
    category: 'MÔI TRƯỜNG 24/7'
  },
  {
    id: 6,
    icon: <FiUserCheck className="problem-icon" />,
    title: 'Cần sửa lỗi ngữ pháp & phát âm chi tiết?',
    desc: 'Chấm điểm tức thì, chỉ ra từng lỗi sai ngữ pháp, phát âm và gợi ý cách nói tự nhiên nhất.',
    category: 'SỬA LỖI 1-ON-1'
  }
];

const TRUSTED_BRANDS = [
  { name: 'Cambridge English', label: 'CAMBRIDGE' },
  { name: 'Oxford University', label: 'OXFORD' },
  { name: 'British Council', label: 'BRITISH COUNCIL' },
  { name: 'IELTS Academic', label: 'IELTS OFFICIAL' },
  { name: 'ETS TOEIC', label: 'ETS TOEIC' }
];

const PainPointsSection = () => {
  const { t } = useLanguage();

  return (
    <section className="pain-points-section">
      <div className="container">
        {/* Annotation & Main Header */}
        <div className="section-header-annotated scroll-animate">
          <div className="annotation-wrapper">
            <span className="handwritten-annotation blue">Is this you?</span>
            <svg className="curved-arrow blue" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6C18 6 38 10 40 26M40 26L34 22M40 26L44 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="section-main-heading">
            {t('Struggling to understand where to start or how to grow?')}
          </h2>
          <p className="section-sub-desc">
            {t('Đừng để nỗi sợ tiếng Anh cản bước bạn. Chúng tôi mang đến giải pháp học tập cá nhân hóa giúp bạn bứt phá.')}
          </p>
        </div>

        {/* Bento Outer Shell */}
        <div className="bento-outer-shell scroll-animate">
          <div className="problem-cards-grid">
            {PROBLEM_CARDS.map((card) => (
              <div key={card.id} className="problem-card-item">
                <div className="card-top-row">
                  <div className="problem-icon-box">
                    {card.icon}
                  </div>
                  <span className="problem-category-badge">{card.category}</span>
                </div>
                <h4 className="problem-card-title">{t(card.title)}</h4>
                <p className="problem-card-desc">{t(card.desc)}</p>
              </div>
            ))}
          </div>

          {/* Trusted by Logo Strip */}
          <div className="trusted-logo-strip">
            <div className="strip-grid-bg" aria-hidden="true" />
            <div className="strip-content">
              <span className="handwritten-note">Trusted by educators & learners:</span>
              <div className="brand-logos-row">
                {TRUSTED_BRANDS.map((b, idx) => (
                  <div key={idx} className="brand-logo-pill">
                    <span className="brand-dot" />
                    <span className="brand-name">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainPointsSection;
