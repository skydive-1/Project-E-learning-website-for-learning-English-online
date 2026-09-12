import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiArrowRight } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const MODULES = [
  {
    id: 1,
    week: 'Week 01 : Module 01',
    title: 'Nền tảng phát âm chuẩn IPA & Ngữ điệu tự nhiên',
    lessons: [
      { step: '01', title: 'Identify', desc: 'Nhận diện và chuẩn hóa 44 âm IPA cơ bản và nâng cao' },
      { step: '02', title: 'Intonation', desc: 'Quy tắc nối âm, nuốt âm và trọng âm câu tự nhiên' },
      { step: '03', title: 'Vocabulary', desc: 'Nạp 200 từ vựng cốt lõi theo ngữ cảnh đời sống thực tế' },
      { step: '04', title: 'Practice', desc: 'Thực hành phản xạ trực tiếp cùng trợ lý AI 1-on-1' }
    ],
    summary: 'Xây dựng nền móng phát âm chuẩn xác, làm chủ ngữ điệu và xóa bỏ tâm lý ngại ngùng khi nói tiếng Anh.'
  },
  {
    id: 2,
    week: 'Week 02 : Module 02',
    title: 'Phản xạ giao tiếp & Tư duy tiếng Anh trực diện',
    lessons: [
      { step: '01', title: 'Thinking', desc: 'Loại bỏ thói quen dịch nhẩm từ tiếng Việt sang tiếng Anh' },
      { step: '02', title: 'Dialogues', desc: '30 tình huống hội thoại thực tế tại sân bay, công sở, khách sạn' },
      { step: '03', title: 'Listening', desc: 'Luyện nghe bắt từ khóa (Keywords) trong môi trường tạp âm' },
      { step: '04', title: 'Speaking', desc: 'Tập nói liên tục 2 phút không vấp với gợi ý câu từ AI' }
    ],
    summary: 'Rèn luyện phản xạ đối đáp tức thì, tự tin mở rộng cuộc trò chuyện với người bản xứ.'
  },
  {
    id: 3,
    week: 'Week 03 : Module 03',
    title: 'Ngữ pháp ứng dụng & Viết luận chuyên nghiệp',
    lessons: [
      { step: '01', title: 'Structure', desc: 'Nắm vững 12 thì và các cấu trúc câu ghép, câu phức tinh tế' },
      { step: '02', title: 'Writing', desc: 'Kỹ năng viết Email công việc chuẩn mực và bài luận sắc bén' },
      { step: '03', title: 'AI Scoring', desc: 'AI tự động sửa lỗi ngữ pháp, cải thiện văn phong mượt mà' },
      { step: '04', title: 'Vocabulary', desc: 'Bộ từ vựng Academic và Business nâng cao band điểm' }
    ],
    summary: 'Nâng cao độ chính xác ngữ pháp và kỹ năng diễn đạt văn bản thuyết phục, chuyên nghiệp.'
  },
  {
    id: 4,
    week: 'Week 04 : Module 04',
    title: 'Thuyết trình, Đàm phán & Làm chủ môi trường quốc tế',
    lessons: [
      { step: '01', title: 'Pitching', desc: 'Nghệ thuật mở đầu và dẫn dắt bài thuyết trình lôi cuốn' },
      { step: '02', title: 'Debate', desc: 'Kỹ thuật bảo vệ quan điểm và tranh biện tiếng Anh văn minh' },
      { step: '03', title: 'Negotiation', desc: 'Chiến thuật đàm phán hợp đồng và xử lý tình huống khó' },
      { step: '04', title: 'Capstone', desc: 'Dự án thực tế tốt nghiệp nhận chứng chỉ năng lực chuẩn' }
    ],
    summary: 'Tự tin làm việc trong môi trường toàn cầu, chinh phục các chứng chỉ quốc tế và mở rộng cơ hội nghề nghiệp.'
  }
];

const CurriculumSection = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [openModuleId, setOpenModuleId] = useState(1);

  const toggleModule = (id) => {
    setOpenModuleId(openModuleId === id ? null : id);
  };

  return (
    <section id="curriculum" className="curriculum-overview-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-header-annotated left-aligned scroll-animate">
          <div className="annotation-wrapper">
            <span className="handwritten-annotation blue">Curriculum overview</span>
            <svg className="curved-arrow blue" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6C18 6 38 10 40 26M40 26L34 22M40 26L44 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="section-main-heading">
            {t('Crack the code to elite English mastery.')}
          </h2>
          <p className="section-sub-desc">
            {t('Lộ trình học tập khoa học, tinh gọn 4 tuần từ củng cố nền tảng đến làm chủ phản xạ tự nhiên.')}
          </p>
        </div>

        {/* Split Layout: Left Media + Right Accordion */}
        <div className="curriculum-split-layout">
          {/* Left Column: Visual Media with Floating Prop */}
          <div className="curriculum-media-column scroll-animate">
            <div className="curriculum-photo-frame">
              <img 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800" 
                alt="Learner practicing English"
                className="curriculum-photo-img"
              />
              <div className="media-floating-badge">
                <div className="badge-avatar-group">
                  <span className="mini-avatar">🎓</span>
                  <span className="badge-text-primary">100% Practical</span>
                </div>
                <p className="badge-text-sub">Actionable lessons every single day</p>
              </div>
            </div>
          </div>

          {/* Right Column: Pale-Gray Accordion Container */}
          <div className="curriculum-accordion-column scroll-animate">
            <div className="bento-outer-shell accordion-shell">
              {MODULES.map((m) => {
                const isOpen = openModuleId === m.id;
                return (
                  <div 
                    key={m.id} 
                    className={`module-accordion-card ${isOpen ? 'expanded' : 'collapsed'}`}
                  >
                    <div 
                      className="module-card-header"
                      onClick={() => toggleModule(m.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleModule(m.id); }}
                    >
                      <div className="module-header-text">
                        <span className="module-eyebrow">{m.week}</span>
                        <h4 className="module-title">{t(m.title)}</h4>
                      </div>
                      <button 
                        type="button" 
                        className={`btn-module-toggle ${isOpen ? 'is-open' : ''}`}
                        aria-label={isOpen ? 'Collapse module' : 'Expand module'}
                      >
                        <FiPlus className="toggle-icon-plus" />
                      </button>
                    </div>

                    <div className={`module-card-body-collapse ${isOpen ? 'show' : ''}`}>
                      <div className="module-card-body-inner">
                        <div className="module-card-body">
                          <div className="lessons-sequence-list">
                            {m.lessons.map((lesson, idx) => (
                              <div key={idx} className="lesson-sequence-item">
                                <span className="step-number-tag">{lesson.step}</span>
                                <div className="lesson-info">
                                  <strong className="lesson-name">{lesson.title}:</strong>
                                  <span className="lesson-desc"> {t(lesson.desc)}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="module-summary-footer">
                            <p className="module-summary-text">{t(m.summary)}</p>
                            <button 
                              type="button"
                              className="btn-module-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/academy');
                              }}
                            >
                              <span>{t('Khám phá lộ trình chi tiết')}</span>
                              <FiArrowRight className="arrow-icon" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CurriculumSection;
