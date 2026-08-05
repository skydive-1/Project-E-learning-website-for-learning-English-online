import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiHeadphones, FiDollarSign, FiClock, FiTrendingUp, FiUsers, FiShield,
  FiFileText, FiSliders, FiPlayCircle, FiMic, FiEdit3, FiMessageSquare,
  FiMail, FiUser, FiArrowRight, FiCheck, FiAward
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import apiClient from '../../../config/api.config';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    };

    const handleIntersect = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target); // Trigger once
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    const animElements = document.querySelectorAll('.scroll-animate');
    animElements.forEach(el => observer.observe(el));

    return () => {
      animElements.forEach(el => observer.unobserve(el));
    };
  }, []);

  const handleConsultationSubmit = async (e) => {
    e.preventDefault();
    if (!fullname.trim() || !email.trim()) {
      setFormError('Vui lòng nhập đầy đủ Họ tên và địa chỉ Gmail.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Địa chỉ Gmail không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      await apiClient.post('/consultation/register', {
        fullname: fullname.trim(),
        email: email.trim()
      });
      
      setFormSubmitted(true);
    } catch (err) {
      console.error('Lỗi khi gửi đăng ký tư vấn:', err);
      setSubmitting(false);
      setFormError(err.response?.data?.message || 'Không thể gửi đăng ký lúc này. Vui lòng thử lại sau!');
    }
  };

  return (
    <div className="homepage-wrapper">
      <Header />

      <main className="homepage-main">
        {/* HERO SECTION */}
        <section id="hero" className="hero-section">
          <div className="container hero-container">
            <div className="hero-content scroll-animate">
              <span className="badge-ai">{t('heroBadge')}</span>
              <h1 className="hero-title">
                {t('heroTitlePrefix')} <br />
                <span>{t('heroTitleSuffix')}</span>
              </h1>
              <p className="hero-subtitle">
                {t('heroSubtitle')}
              </p>
              <div className="hero-actions">
                <button className="btn-primary-orange" onClick={() => navigate('/courses')}>
                  {t('btnStartLearning')}
                </button>
                <button className="btn-secondary-outline" onClick={() => navigate('/academy')} style={{ marginLeft: '12px' }}>
                  {t('btnViewRoadmap')}
                </button>
              </div>
              
              <div className="hero-trust">
                <div className="trust-badge">
                  <FiAward className="trust-icon" />
                  <span>{t('aiTutorSubtitle')}</span>
                </div>
              </div>
            </div>

            <div className="hero-visual scroll-animate">
              <div className="visual-wrapper">
                <img 
                  src="/images/hero_illustration.png" 
                  alt="Học tiếng Anh thông minh cùng AI" 
                  className="hero-image"
                  onError={(e) => {
                    // Fallback to high quality SVG pattern if image fails to load
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="svg-fallback" style={{ display: 'none' }}>
                  <div className="abstract-shape"></div>
                  <div className="float-pill-ai">
                    <FiMessageSquare /> <span>AI Tutor Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* FEATURES SECTION (Nói nhiều hơn - Học nhanh hơn) */}
        <section id="features" className="features-intro-section">
          <div className="container features-intro-container">
            <div className="features-intro-content scroll-animate">
              <h2>{t('Nói nhiều hơn — Học nhanh hơn')}</h2>
              <p className="features-desc">
                {t('Trải nghiệm môi trường thực hành tương tác chuyên sâu với trợ lý ảo giao tiếp thông minh. Bạn có cơ hội phản xạ liên tục 24/7, xóa tan nỗi sợ nói sai, tự tin làm chủ ngôn ngữ trong thời gian ngắn nhất.')}
              </p>
              
              <ul className="features-check-list">
                <li>
                  <span className="check-icon"><FiCheck /></span>
                  <div>
                    <strong>{t('Phản xạ tiếng Anh tự nhiên')}</strong>
                    <p>{t('Nâng cao khả năng nghe hiểu và phản hồi tự nhiên không cần dịch nhẩm.')}</p>
                  </div>
                </li>
                <li>
                  <span className="check-icon"><FiCheck /></span>
                  <div>
                    <strong>{t('Luyện nói trực tiếp, sửa lỗi tức thì')}</strong>
                    <p>{t('Trợ lý AI giúp chỉnh âm chuẩn IPA và hướng dẫn cách diễn đạt hay hơn.')}</p>
                  </div>
                </li>
                <li>
                  <span className="check-icon"><FiCheck /></span>
                  <div>
                    <strong>{t('Tiết kiệm thời gian & chi phí tối đa')}</strong>
                    <p>{t('Học tại nhà linh động, chi phí chỉ bằng 1/10 so với học trung tâm truyền thống.')}</p>
                  </div>
                </li>
              </ul>

              <button className="btn-explore" onClick={() => navigate(user ? '/courses' : '/register')}>
                {t('Khám phá khóa học ngay')}
              </button>
            </div>

            <div className="features-intro-visual scroll-animate">
              <div className="image-card-group">
                <div className="img-card main-card">
                  <img 
                    src="/images/teacher_virtual.png" 
                    alt="Giảng dạy tiếng Anh online" 
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600';
                    }}
                  />
                </div>
                <div className="img-card sub-card">
                  <img 
                    src="/images/meeting_group.png" 
                    alt="Luyện nói theo nhóm" 
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=600';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY CHOOSE US */}
        <section className="why-choose-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>{t('Vì sao chọn E-Learn Academy?')}</h2>
              <p>{t('Học tập đột phá với sự hỗ trợ của công nghệ hàng đầu và lộ trình thông minh.')}</p>
            </div>

            <div className="why-grid">
              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper blue-icon">
                  <FiHeadphones />
                </div>
                <h4>{t('Hỗ Trợ 24/7')}</h4>
                <p>{t('Hệ thống chatbot AI luôn sẵn sàng hỗ trợ giải đáp mọi thắc mắc của bạn bất cứ thời điểm nào trong ngày.')}</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper orange-icon">
                  <FiDollarSign />
                </div>
                <h4>{t('Học Phí Hợp Lý')}</h4>
                <p>{t('Mức đầu tư vô cùng tiết kiệm, mở ra cơ hội tiếp cận tri thức ngôn ngữ chất lượng cao cho mọi người.')}</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper purple-icon">
                  <FiClock />
                </div>
                <h4>{t('Lịch Học Linh Hoạt')}</h4>
                <p>{t('Tự do thiết kế thời gian học phù hợp với nhịp sống và công việc cá nhân của bạn mà không lo bị lỡ bài.')}</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper red-icon">
                  <FiTrendingUp />
                </div>
                <h4>{t('Phản Hồi Tiến Bộ')}</h4>
                <p>{t('Hệ thống phân tích và báo cáo định kỳ chi tiết giúp bạn theo dõi sát sao lộ trình tiến bộ của bản thân.')}</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper teal-icon">
                  <FiUsers />
                </div>
                <h4>{t('Cộng Đồng Năng Động')}</h4>
                <p>{t('Giao lưu, kết nối và thực hành tiếng Anh cùng hàng ngàn học viên năng động trên khắp cả nước.')}</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper gold-icon">
                  <FiShield />
                </div>
                <h4>{t('Cam Kết Đầu Ra')}</h4>
                <p>{t('Chương trình chuẩn đầu ra, cam kết hỗ trợ học lại miễn phí nếu học viên chưa đạt kết quả mục tiêu.')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* SIMPLE ROADMAP (Lộ trình học tập rõ ràng) */}
        <section id="roadmap-sec" className="roadmap-simple-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>{t('Lộ trình học tập rõ ràng')}</h2>
              <p>{t('3 bước đơn giản giúp bạn bắt đầu hành trình chinh phục tiếng Anh hiệu quả')}</p>
            </div>

            <div className="roadmap-steps-grid">
              <div className="step-item scroll-animate">
                <div className="step-number">1</div>
                <div className="step-icon">
                  <FiFileText />
                </div>
                <h4>{t('Kiểm tra đầu vào')}</h4>
                <p>{t('Thực hiện bài test nhanh miễn phí để xác định chính xác trình độ tiếng Anh hiện tại.')}</p>
              </div>

              <div className="step-item scroll-animate">
                <div className="step-number">2</div>
                <div className="step-icon">
                  <FiSliders />
                </div>
                <h4>{t('Lộ trình cá nhân hóa')}</h4>
                <p>{t('Thuật toán AI tự động thiết kế giáo trình riêng dựa trên điểm mạnh và điểm yếu của bạn.')}</p>
              </div>

              <div className="step-item scroll-animate">
                <div className="step-number">3</div>
                <div className="step-icon">
                  <FiPlayCircle />
                </div>
                <h4>{t('Thực hành tương tác')}</h4>
                <p>{t('Tham gia các bài học video sống động kết hợp luyện tập nói phản xạ trực tiếp với AI.')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* VIDEO COURSES */}
        <section id="courses-sec" className="courses-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>{t('Khóa học Video')}</h2>
              <p>{t('Học mọi lúc mọi nơi với kho video bài giảng chất lượng cao được biên soạn kỹ lưỡng')}</p>
            </div>

            <div className="courses-grid">
              <div className="course-card scroll-animate">
                <div className="course-thumb">
                  <img 
                    src="/images/course_communication.png" 
                    alt="Tiếng Anh Giao Tiếp Online" 
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=600';
                    }}
                  />
                  <span className="course-duration">15 {t('giờ học')}</span>
                </div>
                <div className="course-info">
                  <span className="course-tag grammar">GIAO TIẾP</span>
                  <h4>{t('Tiếng Anh Giao Tiếp Online')}</h4>
                  <p>{t('Luyện phản xạ nghe nói cơ bản, phát âm chuẩn tự nhiên trong các tình huống thực tế đời sống.')}</p>
                  <div className="course-footer">
                    <span className="lessons-count">48 {t('lessonsCount')}</span>
                    <span className="students-count">1.2k {t('student')}</span>
                  </div>
                </div>
              </div>

              <div className="course-card scroll-animate">
                <div className="course-thumb">
                  <img 
                    src="/images/course_ielts.png" 
                    alt="Luyện Thi IELTS v6.5 - Toàn Diện" 
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=600';
                    }}
                  />
                  <span className="course-duration">30 {t('giờ học')}</span>
                </div>
                <div className="course-info">
                  <span className="course-tag academic">ACADEMIC</span>
                  <h4>{t('Luyện Thi IELTS v6.5 - Toàn Diện')}</h4>
                  <p>{t('Bí quyết làm bài thi hiệu quả cho cả 4 kỹ năng Nghe, Nói, Đọc, Viết chuẩn cấu trúc đề mới nhất.')}</p>
                  <div className="course-footer">
                    <span className="lessons-count">82 {t('lessonsCount')}</span>
                    <span className="students-count">950 {t('student')}</span>
                  </div>
                </div>
              </div>

              <div className="course-card scroll-animate">
                <div className="course-thumb">
                  <img 
                    src="/images/course_business.png" 
                    alt="Tiếng Anh Thương Mại & Công Sở" 
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=600';
                    }}
                  />
                  <span className="course-duration">20 {t('giờ học')}</span>
                </div>
                <div className="course-info">
                  <span className="course-tag business">BUSINESS</span>
                  <h4>{t('Tiếng Anh Thương Mại & Công Sở')}</h4>
                  <p>{t('Viết email, thuyết trình và đàm phán bằng tiếng Anh chuyên nghiệp tự tin nơi công sở.')}</p>
                  <div className="course-footer">
                    <span className="lessons-count">56 {t('lessonsCount')}</span>
                    <span className="students-count">780 {t('student')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FUN QUIZZES SECTION */}
        <section id="fun-quizzes-sec" className="courses-section" style={{ backgroundColor: '#f8fafc', paddingTop: '64px', paddingBottom: '64px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>{t('Luyện trắc nghiệm vui giải trí')}</h2>
              <p>{t('Thử thách phản xạ tiếng Anh nhanh với các đề trắc nghiệm chủ đề Tiếng lóng, Idioms, Từ vựng đời sống')}</p>
            </div>

            <div className="courses-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '32px' }}>
              <div className="course-card scroll-animate" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span className="course-tag grammar" style={{ backgroundColor: '#e0e7ff', color: '#4338ca', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '750' }}>IDIOMS</span>
                    <h4 style={{ marginTop: '12px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>English Slangs & Idioms Quiz</h4>
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', lineHeight: '1.5' }}>{t('Thử thách hiểu biết của bạn về tiếng lóng và các thành ngữ tiếng Anh giao tiếp thông dụng hàng ngày của người bản xứ.')}</p>
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>5 câu hỏi • 5 phút</span>
                    <button 
                      onClick={() => navigate('/quizzes/play/fun-1')}
                      style={{ padding: '8px 16px', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#1e40af'}
                      onMouseOut={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                    >
                      {t('Bắt đầu thi')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="course-card scroll-animate" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span className="course-tag grammar" style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '750' }}>TRAVEL</span>
                    <h4 style={{ marginTop: '12px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Travel English Essentials</h4>
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', lineHeight: '1.5' }}>Trang bị các mẫu câu giao tiếp tiếng Anh thiết thực tại sân bay, khách sạn, nhà hàng khi đi du lịch nước ngoài.</p>
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>5 câu hỏi • 8 phút</span>
                    <button 
                      onClick={() => navigate('/quizzes/play/fun-2')}
                      style={{ padding: '8px 16px', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#1e40af'}
                      onMouseOut={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                    >
                      {t('Bắt đầu thi')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI LEARNING TOOLS */}
        <section className="ai-tools-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>{t('Công cụ học tập AI')}</h2>
              <p>{t('Tối ưu hóa thời gian học tập nhờ các tính năng trợ lý công nghệ AI tiên tiến')}</p>
            </div>

            <div className="tools-grid">
              <div className="tool-card scroll-animate">
                <div className="tool-icon-wrapper">
                  <FiMic />
                </div>
                <h4>{t('Luyện phát âm AI')}</h4>
                <p>{t('Nói trực tiếp qua micro, công nghệ AI tự động chấm điểm và chỉ ra lỗi phát âm IPA chuẩn xác.')}</p>
              </div>

              <div className="tool-card scroll-animate">
                <div className="tool-icon-wrapper orange-icon">
                  <FiEdit3 />
                </div>
                <h4>{t('Chấm điểm bài viết tự động')}</h4>
                <p>{t('Gửi bài luận của bạn, AI sẽ phát hiện lỗi ngữ pháp, từ vựng và gợi ý viết lại trôi chảy hơn.')}</p>
              </div>

              <div className="tool-card scroll-animate">
                <div className="tool-icon-wrapper purple-icon">
                  <FiMessageSquare />
                </div>
                <h4>{t('Trò chuyện cùng AI 24/7')}</h4>
                <p>{t('Trải nghiệm người bạn bản xứ AI luôn sẵn sàng trò chuyện, trả lời ngữ pháp bất cứ khi nào bạn hỏi.')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* DETAILED ROADMAP (Redesigned) */}
        <section className="detailed-roadmap-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>{t('Lộ trình học bài bản')}</h2>
              <p>{t('Hành trình cá nhân hóa giúp bạn làm chủ tiếng Anh từ con số 0')}</p>
            </div>

            <div className="roadmap-grid-modern">
              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">{t('GIAI ĐOẠN 1')}</span>
                  <div className="stage-icon-box blue"><FiFileText /></div>
                </div>
                <h3>{t('Khởi động')}</h3>
                <span className="level-tag">Beginner (A1)</span>
                <ul className="stage-features">
                  <li><FiCheck /> {t('Chuẩn hóa phát âm IPA')}</li>
                  <li><FiCheck /> {t('Ngữ pháp nền tảng')}</li>
                  <li><FiCheck /> {t('Giao tiếp cơ bản')}</li>
                </ul>
              </div>

              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">{t('GIAI ĐOẠN 2')}</span>
                  <div className="stage-icon-box orange"><FiMic /></div>
                </div>
                <h3>{t('Sức bền')}</h3>
                <span className="level-tag">Intermediate (A2-B1)</span>
                <ul className="stage-features">
                  <li><FiCheck /> {t('Phản xạ nghe nói')}</li>
                  <li><FiCheck /> {t('Từ vựng đa chủ đề')}</li>
                  <li><FiCheck /> {t('Tư duy tiếng Anh')}</li>
                </ul>
              </div>

              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">{t('GIAI ĐOẠN 3')}</span>
                  <div className="stage-icon-box purple"><FiTrendingUp /></div>
                </div>
                <h3>{t('Bứt phá')}</h3>
                <span className="level-tag">Advanced (B2-C1)</span>
                <ul className="stage-features">
                  <li><FiCheck /> {t('Thuyết trình chuyên sâu')}</li>
                  <li><FiCheck /> {t('Viết luận sắc bén')}</li>
                  <li><FiCheck /> {t('Tranh biện tiếng Anh')}</li>
                </ul>
              </div>

              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">{t('GIAI ĐOẠN 4')}</span>
                  <div className="stage-icon-box teal"><FiAward /></div>
                </div>
                <h3>{t('Về đích')}</h3>
                <span className="level-tag">Master (C2)</span>
                <ul className="stage-features">
                  <li><FiCheck /> {t('Làm chủ ngôn ngữ')}</li>
                  <li><FiCheck /> {t('Nghiên cứu khoa học')}</li>
                  <li><FiCheck /> {t('Môi trường toàn cầu')}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK CONTACT / CONSULTATION FORM WITH PARALLAX */}
        <section className="consultation-section parallax-container">
          <div className="parallax-shape shape-1"></div>
          <div className="parallax-shape shape-2"></div>
          <div className="container parallax-fg-layer">
            <div className="consultation-card scroll-animate">
              <div className="form-header">
                <h3>{t('Đăng ký tư vấn miễn phí')}</h3>
                <p>{t('Nhận ngay lộ trình cá nhân hóa và học thử miễn phí cùng AI')}</p>
              </div>
              
              <form onSubmit={handleConsultationSubmit} className="consultation-form">
                <div className="input-group">
                  <FiUser className="input-icon" />
                  <input 
                    type="text" 
                    placeholder={t('Họ và tên')} 
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                  />
                </div>
                
                <div className="input-group">
                  <FiMail className="input-icon" />
                  <input 
                    type="email" 
                    placeholder={t('Địa chỉ Gmail của bạn')} 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                
                <button type="submit" className="btn-submit-orange" disabled={submitting}>
                  {submitting ? t('Đang gửi...') : t('Đăng ký ngay')}
                </button>
              </form>
              
              {formError && <p className="form-error-msg">{formError}</p>}
              
              {formSubmitted && (
                <div className="form-success-popup">
                  <div className="success-content">
                    <div className="success-icon-wrapper">
                      <FiCheck />
                    </div>
                    <h4>{t('Đăng ký thành công!')}</h4>
                    <p>{t('Hệ thống đã tự động gửi')} <strong>{t('Lộ trình học cá nhân hóa')}</strong> {t('vào Gmail của bạn. Vui lòng kiểm tra hộp thư!')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
