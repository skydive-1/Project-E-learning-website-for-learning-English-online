import React, { useState } from 'react';
import { FiStar } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const TESTIMONIALS = [
  {
    id: 1,
    rating: 5,
    quote: 'Luyện phát âm với trợ lý AI giúp mình sửa ngay các lỗi nuốt âm và trọng âm sai. Sau 1 tháng học tập đã tự tin trò chuyện trôi chảy hơn rất nhiều.',
    name: 'Erika Austin',
    role: 'Software Engineer',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 2,
    rating: 5,
    quote: 'Phương pháp học cực kỳ trực quan và thực chiến, không hề lý thuyết suông. Mình đã tự tin vượt qua vòng phỏng vấn công ty đa quốc gia thành công rực rỡ.',
    name: 'Daisy Boylan',
    role: 'Product Designer',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 3,
    rating: 5,
    quote: 'Mình từng loay hoay tự học cả năm mà không tiến bộ. Nhờ lộ trình cá nhân hóa và bài tập phản xạ của hệ thống, mọi thứ trở nên rõ ràng và dễ tiếp thu hơn hẳn.',
    name: 'Annalee Jackson',
    role: 'Marketing Lead',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
  }
];

const DarkTestimonialsSection = () => {
  const { t } = useLanguage();
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <section className="dark-testimonials-section">
      {/* Massive Background Watermark Text */}
      <div className="watermark-bg-text" aria-hidden="true">
        Reviews
      </div>

      <div className="container relative-content">
        <div className="section-header-dark scroll-animate">
          <span className="badge-pill-dark">HỌC VIÊN NÓI GÌ VỀ CHÚNG TÔI</span>
          <h2 className="dark-section-title">
            {t('Don’t just take our word for it — see what our learners have to say about their experience.')}
          </h2>
        </div>

        {/* Testimonials Grid (Desktop: 3 in row, Mobile: Carousel) */}
        <div className="testimonials-cards-grid scroll-animate">
          {TESTIMONIALS.map((item, idx) => (
            <div 
              key={item.id} 
              className={`testimonial-white-card ${idx === activeSlide ? 'active-mobile-slide' : ''}`}
            >
              {/* Star Rating */}
              <div className="stars-row">
                {[...Array(item.rating)].map((_, i) => (
                  <FiStar key={i} className="star-icon filled" />
                ))}
              </div>

              {/* Quote Body */}
              <p className="testimonial-quote-text">
                "{t(item.quote)}"
              </p>

              {/* Author Footer */}
              <div className="testimonial-author-row">
                <img 
                  src={item.avatar} 
                  alt={item.name} 
                  className="author-avatar-img"
                  loading="lazy"
                />
                <div className="author-info-col">
                  <strong className="author-name">{item.name}</strong>
                  <span className="author-role">{item.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Pagination Dots for Tablet/Mobile */}
        <div className="carousel-dots-row">
          {TESTIMONIALS.map((_, idx) => (
            <button 
              key={idx} 
              type="button"
              className={`carousel-dot-btn ${idx === activeSlide ? 'active' : ''}`}
              onClick={() => setActiveSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default DarkTestimonialsSection;
