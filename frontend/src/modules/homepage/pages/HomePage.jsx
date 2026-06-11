import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiHeadphones, FiDollarSign, FiClock, FiTrendingUp, FiUsers, FiShield,
  FiFileText, FiSliders, FiPlayCircle, FiMic, FiEdit3, FiMessageSquare,
  FiPhone, FiUser, FiArrowRight, FiCheck, FiAward
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';

const HomePage = () => {
  const navigate = useNavigate();
  const [fullname, setFullname] = useState('');
  const [phone, setPhone] = useState('');
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

  const handleConsultationSubmit = (e) => {
    e.preventDefault();
    if (!fullname.trim() || !phone.trim()) {
      setFormError('Vui lòng nhập đầy đủ Họ tên và Số điện thoại.');
      return;
    }
    // Simple phone regex
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/g;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      setFormError('Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    setFormError('');
    setFormSubmitted(true);
    // Auto-close success modal after 4 seconds
    setTimeout(() => {
      setFormSubmitted(false);
      setFullname('');
      setPhone('');
    }, 4000);
  };

  return (
    <div className="homepage-wrapper">
      <Header />

      <main className="homepage-main">
        {/* HERO SECTION */}
        <section id="hero" className="hero-section">
          <div className="container hero-container">
            <div className="hero-content scroll-animate">
              <span className="badge-ai">VỚI SỨC MẠNH AI</span>
              <h1 className="hero-title">
                Chinh phục tiếng Anh <br />
                <span>cùng AI</span>
              </h1>
              <p className="hero-subtitle">
                Trải nghiệm học ngôn ngữ thế hệ mới. Trải nghiệm phương pháp học toàn diện tích hợp trợ lý ảo thông minh hỗ trợ 24/7 giúp bạn tự tin giao tiếp ngoại ngữ nhanh chóng, hiệu quả vượt trội.
              </p>
              <div className="hero-actions">
                <button className="btn-primary-orange" onClick={() => navigate('/register')}>
                  Đăng ký học thử ngay!
                </button>
              </div>
              
              <div className="hero-trust">
                <div className="trust-badge">
                  <FiAward className="trust-icon" />
                  <span>Được tin dùng bởi 100% học viên</span>
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
              <h2>Nói nhiều hơn — Học nhanh hơn</h2>
              <p className="features-desc">
                Trải nghiệm môi trường thực hành tương tác chuyên sâu với trợ lý ảo giao tiếp thông minh. Bạn có cơ hội phản xạ liên tục 24/7, xóa tan nỗi sợ nói sai, tự tin làm chủ ngôn ngữ trong thời gian ngắn nhất.
              </p>
              
              <ul className="features-check-list">
                <li>
                  <span className="check-icon"><FiCheck /></span>
                  <div>
                    <strong>Phản xạ tiếng Anh tự nhiên</strong>
                    <p>Nâng cao khả năng nghe hiểu và phản hồi tự nhiên không cần dịch nhẩm.</p>
                  </div>
                </li>
                <li>
                  <span className="check-icon"><FiCheck /></span>
                  <div>
                    <strong>Luyện nói trực tiếp, sửa lỗi tức thì</strong>
                    <p>Trợ lý AI giúp chỉnh âm chuẩn IPA và hướng dẫn cách diễn đạt hay hơn.</p>
                  </div>
                </li>
                <li>
                  <span className="check-icon"><FiCheck /></span>
                  <div>
                    <strong>Tiết kiệm thời gian & chi phí tối đa</strong>
                    <p>Học tại nhà linh động, chi phí chỉ bằng 1/10 so với học trung tâm truyền thống.</p>
                  </div>
                </li>
              </ul>

              <button className="btn-explore" onClick={() => navigate('/register')}>
                Khám phá khóa học ngay
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
              <h2>Vì sao chọn E-Learn Academy?</h2>
              <p>Học tập đột phá với sự hỗ trợ của công nghệ hàng đầu và lộ trình thông minh.</p>
            </div>

            <div className="why-grid">
              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper blue-icon">
                  <FiHeadphones />
                </div>
                <h4>Hỗ Trợ 24/7</h4>
                <p>Hệ thống chatbot AI luôn sẵn sàng hỗ trợ giải đáp mọi thắc mắc của bạn bất cứ thời điểm nào trong ngày.</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper orange-icon">
                  <FiDollarSign />
                </div>
                <h4>Học Phí Hợp Lý</h4>
                <p>Mức đầu tư vô cùng tiết kiệm, mở ra cơ hội tiếp cận tri thức ngôn ngữ chất lượng cao cho mọi người.</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper purple-icon">
                  <FiClock />
                </div>
                <h4>Lịch Học Linh Hoạt</h4>
                <p>Tự do thiết kế thời gian học phù hợp với nhịp sống và công việc cá nhân của bạn mà không lo bị lỡ bài.</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper red-icon">
                  <FiTrendingUp />
                </div>
                <h4>Phản Hồi Tiến Bộ</h4>
                <p>Hệ thống phân tích và báo cáo định kỳ chi tiết giúp bạn theo dõi sát sao lộ trình tiến bộ của bản thân.</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper teal-icon">
                  <FiUsers />
                </div>
                <h4>Cộng Đồng Năng Động</h4>
                <p>Giao lưu, kết nối và thực hành tiếng Anh cùng hàng ngàn học viên năng động trên khắp cả nước.</p>
              </div>

              <div className="why-card scroll-animate">
                <div className="why-icon-wrapper gold-icon">
                  <FiShield />
                </div>
                <h4>Cam Kết Đầu Ra</h4>
                <p>Chương trình chuẩn đầu ra, cam kết hỗ trợ học lại miễn phí nếu học viên chưa đạt kết quả mục tiêu.</p>
              </div>
            </div>
          </div>
        </section>

        {/* SIMPLE ROADMAP (Lộ trình học tập rõ ràng) */}
        <section id="roadmap-sec" className="roadmap-simple-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>Lộ trình học tập rõ ràng</h2>
              <p>3 bước đơn giản giúp bạn bắt đầu hành trình chinh phục tiếng Anh hiệu quả</p>
            </div>

            <div className="roadmap-steps-grid">
              <div className="step-item scroll-animate">
                <div className="step-number">1</div>
                <div className="step-icon">
                  <FiFileText />
                </div>
                <h4>Kiểm tra đầu vào</h4>
                <p>Thực hiện bài test nhanh miễn phí để xác định chính xác trình độ tiếng Anh hiện tại.</p>
              </div>

              <div className="step-item scroll-animate">
                <div className="step-number">2</div>
                <div className="step-icon">
                  <FiSliders />
                </div>
                <h4>Lộ trình cá nhân hóa</h4>
                <p>Thuật toán AI tự động thiết kế giáo trình riêng dựa trên điểm mạnh và điểm yếu của bạn.</p>
              </div>

              <div className="step-item scroll-animate">
                <div className="step-number">3</div>
                <div className="step-icon">
                  <FiPlayCircle />
                </div>
                <h4>Thực hành tương tác</h4>
                <p>Tham gia các bài học video sống động kết hợp luyện tập nói phản xạ trực tiếp với AI.</p>
              </div>
            </div>
          </div>
        </section>

        {/* VIDEO COURSES */}
        <section id="courses-sec" className="courses-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>Khóa học Video</h2>
              <p>Học mọi lúc mọi nơi với kho video bài giảng chất lượng cao được biên soạn kỹ lưỡng</p>
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
                  <span className="course-duration">15 giờ học</span>
                </div>
                <div className="course-info">
                  <span className="course-tag grammar">GIAO TIẾP</span>
                  <h4>Tiếng Anh Giao Tiếp Online</h4>
                  <p>Luyện phản xạ nghe nói cơ bản, phát âm chuẩn tự nhiên trong các tình huống thực tế đời sống.</p>
                  <div className="course-footer">
                    <span className="lessons-count">48 bài học</span>
                    <span className="students-count">1.2k học viên</span>
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
                  <span className="course-duration">30 giờ học</span>
                </div>
                <div className="course-info">
                  <span className="course-tag academic">ACADEMIC</span>
                  <h4>Luyện Thi IELTS v6.5 - Toàn Diện</h4>
                  <p>Bí quyết làm bài thi hiệu quả cho cả 4 kỹ năng Nghe, Nói, Đọc, Viết chuẩn cấu trúc đề mới nhất.</p>
                  <div className="course-footer">
                    <span className="lessons-count">82 bài học</span>
                    <span className="students-count">950 học viên</span>
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
                  <span className="course-duration">20 giờ học</span>
                </div>
                <div className="course-info">
                  <span className="course-tag business">BUSINESS</span>
                  <h4>Tiếng Anh Thương Mại & Công Sở</h4>
                  <p>Viết email, thuyết trình và đàm phán bằng tiếng Anh chuyên nghiệp tự tin nơi công sở.</p>
                  <div className="course-footer">
                    <span className="lessons-count">56 bài học</span>
                    <span className="students-count">780 học viên</span>
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
              <h2>Công cụ học tập AI</h2>
              <p>Tối ưu hóa thời gian học tập nhờ các tính năng trợ lý công nghệ AI tiên tiến</p>
            </div>

            <div className="tools-grid">
              <div className="tool-card scroll-animate">
                <div className="tool-icon-wrapper">
                  <FiMic />
                </div>
                <h4>Luyện phát âm AI</h4>
                <p>Nói trực tiếp qua micro, công nghệ AI tự động chấm điểm và chỉ ra lỗi phát âm IPA chuẩn xác.</p>
              </div>

              <div className="tool-card scroll-animate">
                <div className="tool-icon-wrapper orange-icon">
                  <FiEdit3 />
                </div>
                <h4>Chấm điểm bài viết tự động</h4>
                <p>Gửi bài luận của bạn, AI sẽ phát hiện lỗi ngữ pháp, từ vựng và gợi ý viết lại trôi chảy hơn.</p>
              </div>

              <div className="tool-card scroll-animate">
                <div className="tool-icon-wrapper purple-icon">
                  <FiMessageSquare />
                </div>
                <h4>Trò chuyện cùng AI 24/7</h4>
                <p>Trải nghiệm người bạn bản xứ AI luôn sẵn sàng trò chuyện, trả lời ngữ pháp bất cứ khi nào bạn hỏi.</p>
              </div>
            </div>
          </div>
        </section>

        {/* DETAILED ROADMAP (Redesigned) */}
        <section className="detailed-roadmap-section">
          <div className="container">
            <div className="section-title scroll-animate">
              <h2>Lộ trình học bài bản</h2>
              <p>Hành trình cá nhân hóa giúp bạn làm chủ tiếng Anh từ con số 0</p>
            </div>

            <div className="roadmap-grid-modern">
              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">GIAI ĐOẠN 1</span>
                  <div className="stage-icon-box blue"><FiFileText /></div>
                </div>
                <h3>Khởi động</h3>
                <span className="level-tag">Beginner (A1)</span>
                <ul className="stage-features">
                  <li><FiCheck /> Chuẩn hóa phát âm IPA</li>
                  <li><FiCheck /> Ngữ pháp nền tảng</li>
                  <li><FiCheck /> Giao tiếp cơ bản</li>
                </ul>
              </div>

              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">GIAI ĐOẠN 2</span>
                  <div className="stage-icon-box orange"><FiMic /></div>
                </div>
                <h3>Sức bền</h3>
                <span className="level-tag">Intermediate (A2-B1)</span>
                <ul className="stage-features">
                  <li><FiCheck /> Phản xạ nghe nói</li>
                  <li><FiCheck /> Từ vựng đa chủ đề</li>
                  <li><FiCheck /> Tư duy tiếng Anh</li>
                </ul>
              </div>

              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">GIAI ĐOẠN 3</span>
                  <div className="stage-icon-box purple"><FiTrendingUp /></div>
                </div>
                <h3>Bứt phá</h3>
                <span className="level-tag">Advanced (B2-C1)</span>
                <ul className="stage-features">
                  <li><FiCheck /> Thuyết trình chuyên sâu</li>
                  <li><FiCheck /> Viết luận sắc bén</li>
                  <li><FiCheck /> Tranh biện tiếng Anh</li>
                </ul>
              </div>

              <div className="roadmap-card-new scroll-animate">
                <div className="card-header">
                  <span className="stage-label">GIAI ĐOẠN 4</span>
                  <div className="stage-icon-box teal"><FiAward /></div>
                </div>
                <h3>Về đích</h3>
                <span className="level-tag">Master (C2)</span>
                <ul className="stage-features">
                  <li><FiCheck /> Làm chủ ngôn ngữ</li>
                  <li><FiCheck /> Nghiên cứu khoa học</li>
                  <li><FiCheck /> Môi trường toàn cầu</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK CONTACT / CONSULTATION FORM */}
        <section className="consultation-section">
          <div className="container">
            <div className="consultation-card scroll-animate">
              <div className="form-header">
                <h3>Đăng ký tư vấn miễn phí</h3>
                <p>Nhận ngay lộ trình cá nhân hóa và học thử miễn phí cùng AI</p>
              </div>
              
              <form onSubmit={handleConsultationSubmit} className="consultation-form">
                <div className="input-group">
                  <FiUser className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="Họ và tên" 
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                  />
                </div>
                
                <div className="input-group">
                  <FiPhone className="input-icon" />
                  <input 
                    type="tel" 
                    placeholder="Số điện thoại" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                
                <button type="submit" className="btn-submit-orange">
                  Đăng ký ngay
                </button>
              </form>
              
              {formError && <p className="form-error-msg">{formError}</p>}
              
              {formSubmitted && (
                <div className="form-success-popup">
                  <div className="success-content">
                    <div className="success-icon-wrapper">
                      <FiCheck />
                    </div>
                    <h4>Đăng ký thành công!</h4>
                    <p>Chúng tôi sẽ liên hệ tư vấn lộ trình học cho bạn sớm nhất.</p>
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
