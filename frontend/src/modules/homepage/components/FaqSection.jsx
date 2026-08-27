import React, { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const FAQS = [
  {
    id: 1,
    question: 'Chương trình học có phù hợp cho người mất gốc hoàn toàn không?',
    answer: 'Hoàn toàn phù hợp! Lộ trình được thiết kế cá nhân hóa từ mức độ A1 (Beginner), chuẩn hóa từng âm IPA và từ vựng cốt lõi trước khi bước vào luyện phản xạ giao tiếp nâng cao.'
  },
  {
    id: 2,
    question: 'Trợ lý AI chấm phát âm và bài viết hoạt động như thế nào?',
    answer: 'Công nghệ AI phân tích giọng nói đối chiếu với chuẩn âm vị của người bản xứ, chỉ ra lỗi nuốt âm hay sai trọng âm tức thì. Với bài viết luận, AI kiểm tra ngữ pháp và đề xuất cách hành văn mượt mà hơn.'
  },
  {
    id: 3,
    question: 'Tôi có thể học linh hoạt trên điện thoại hay máy tính bảng không?',
    answer: 'Chắc chắn rồi! Hệ thống tối ưu hóa hoàn hảo cho máy tính, iPad và điện thoại thông minh, đồng bộ tiến độ học tập liên tục để bạn có thể học mọi lúc mọi nơi.'
  },
  {
    id: 4,
    question: 'Chính sách hỗ trợ và cam kết đầu ra như thế nào?',
    answer: 'Học viên được hỗ trợ giải đáp 24/7. Nếu hoàn thành đầy đủ bài tập và lộ trình học tập mà chưa đạt điểm số hoặc phản xạ mong muốn, bạn sẽ được hỗ trợ học lại hoàn toàn miễn phí.'
  }
];

const FaqSection = () => {
  const { t } = useLanguage();
  const [openFaqId, setOpenFaqId] = useState(1);

  const toggleFaq = (id) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  return (
    <section className="faq-section">
      <div className="container">
        {/* Section Header with Handwritten Annotation */}
        <div className="section-header-annotated scroll-animate">
          <div className="annotation-wrapper">
            <span className="handwritten-annotation green">Any question left?</span>
            <svg className="curved-arrow green" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6C18 6 38 10 40 26M40 26L34 22M40 26L44 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="section-main-heading">
            {t('Get every single answer from here!')}
          </h2>
          <p className="section-sub-desc">
            {t('Tổng hợp các câu hỏi thường gặp về phương pháp, lộ trình và trải nghiệm học tập cùng E-Learn Academy.')}
          </p>
        </div>

        {/* Centered Narrow FAQ Shell */}
        <div className="bento-outer-shell faq-narrow-shell scroll-animate">
          <div className="faq-accordion-stack">
            {FAQS.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div 
                  key={faq.id} 
                  className={`faq-accordion-card ${isOpen ? 'expanded' : 'collapsed'}`}
                >
                  <div 
                    className="faq-card-header"
                    onClick={() => toggleFaq(faq.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleFaq(faq.id); }}
                  >
                    <h4 className="faq-question-title">{t(faq.question)}</h4>
                    <button 
                      type="button" 
                      className={`btn-faq-toggle ${isOpen ? 'is-open' : ''}`}
                      aria-label={isOpen ? 'Collapse answer' : 'Expand answer'}
                    >
                      <FiPlus className="toggle-icon-plus" />
                    </button>
                  </div>

                  <div className={`faq-card-body-collapse ${isOpen ? 'show' : ''}`}>
                    <div className="faq-card-body-inner">
                      <div className="faq-card-body">
                        <p className="faq-answer-text">{t(faq.answer)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
