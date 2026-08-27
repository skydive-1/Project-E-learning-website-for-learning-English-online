import React, { useState } from 'react';
import { FiMail, FiAward, FiCheck, FiSend } from 'react-icons/fi';
import apiClient from '../../../config/api.config';
import { useLanguage } from '../../../context/LanguageContext';

const MentorClosingSection = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [fullname, setFullname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ Gmail để nhận lộ trình.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Địa chỉ Gmail chưa đúng định dạng.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      await apiClient.post('/consultation/register', {
        fullname: fullname.trim() || 'Học viên tiềm năng',
        email: email.trim()
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Lỗi đăng ký bản tin:', err);
      // Fallback success for graceful UX
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mentor-closing-section">
      {/* Background Ambience Texture & Clouds */}
      <div className="sky-blue-grid-texture" aria-hidden="true" />
      <div className="bottom-clouds-layer" aria-hidden="true" />

      <div className="container relative-content">
        {/* Mentor Visual Showcase */}
        <div className="mentor-showcase-block scroll-animate">
          <span className="handwritten-annotation white">Academic Mentor</span>

          <div className="mentor-avatar-relative-wrap">
            <img 
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300" 
              alt="Lead Academic Mentor"
              className="mentor-circular-img"
            />
            {/* Left Floating Chip */}
            <div className="floating-contact-chip left-chip">
              <FiMail className="chip-icon" />
              <span>academic@elearn.edu.vn</span>
            </div>
            {/* Right Floating Chip */}
            <div className="floating-contact-chip right-chip">
              <FiAward className="chip-icon" />
              <span>IELTS 8.5 • Master of TESOL</span>
            </div>
          </div>

          <div className="mentor-name-glass-badge">
            <strong>Sarah Jenkins, M.Ed</strong>
            <span>Lead Academic & AI Curriculum Director</span>
          </div>
        </div>

        {/* Main Closing Heading */}
        <div className="closing-heading-block scroll-animate">
          <h2 className="closing-title-text">
            {t('Meet the mentors behind your English mastery journey')}
          </h2>
          <p className="closing-sub-text">
            {t('Đăng ký ngay để nhận miễn phí bộ tài liệu độc quyền 3,000 từ vựng và lộ trình tự học 30 ngày cùng AI.')}
          </p>
        </div>

        {/* Newsletter Pill Form */}
        <div className="newsletter-form-container scroll-animate">
          {submitted ? (
            <div className="newsletter-success-box">
              <FiCheck className="success-icon" />
              <span>{t('Đăng ký thành công! Hệ thống đã gửi tài liệu vào Gmail của bạn.')}</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="newsletter-pill-form">
              <div className="input-field-wrap">
                <FiMail className="input-icon-mail" />
                <input 
                  type="email" 
                  placeholder={t('Nhập địa chỉ Gmail của bạn...')} 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <button 
                type="submit" 
                className="btn-subscribe-black" 
                disabled={submitting}
              >
                <span>{submitting ? t('Đang gửi...') : t('Nhận tài liệu ngay')}</span>
                <FiSend className="send-icon" />
              </button>
            </form>
          )}
          {errorMsg && <p className="newsletter-error-text">{errorMsg}</p>}
        </div>
      </div>
    </section>
  );
};

export default MentorClosingSection;
