import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../config/api.config';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import ProtectedVideo from './ProtectedVideo';
import './Footer.css';

const Footer = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isEn = language === 'ENG';
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');

  const handleSubscribe = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setSubscriptionError(isEn
        ? 'Please enter a valid email address.'
        : 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setSubscriptionError('');
    setIsSubmitting(true);

    try {
      await apiClient.post('/consultation/register', {
        fullname: isEn ? 'E-Learn learner' : 'Học viên E-Learn',
        email: normalizedEmail
      });
      setEmail('');
      setIsSubmitted(true);
    } catch (error) {
      setIsSubmitted(false);
      setSubscriptionError(
        error?.response?.data?.message || (isEn
          ? 'We could not complete your registration. Please try again.'
          : 'Chưa thể hoàn tất đăng ký. Vui lòng thử lại.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const productLinks = [
    { label: isEn ? 'Courses' : 'Chương trình học', to: '/courses' },
    { label: isEn ? 'Roadmap' : 'Lộ trình Academy', to: '/academy' },
    { label: isEn ? 'Quizzes' : 'Luyện tập Quiz', to: '/quizzes' },
    { label: isEn ? 'My Courses' : 'Khóa học của tôi', to: '/my-courses' }
  ];

  const companyLinks = [
    { label: isEn ? 'Development Team' : 'Đội ngũ phát triển', to: '/#team' },
    { label: isEn ? 'Analytics' : 'Phân tích học tập', to: '/analytics' },
    { label: isEn ? 'Contact & FAQ' : 'Hỗ trợ & Hỏi đáp', to: '/#faq' }
  ];

  return (
    <footer className="site-footer" data-theme={isDark ? 'dark' : 'light'}>
      <div className="site-footer__container">
        <div className="site-footer__grid">
          <div className="site-footer__brand-col">
            <span className="site-footer__brand-title">
              E-Learn Academy
            </span>

            <div className="site-footer__mascot-wrapper">
              <div className="site-footer__mascot-stage">
                <ProtectedVideo
                  assetId={isDark ? 'mascot-sleep-dark' : 'mascot-idle-light'}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  className="site-footer__mascot-video"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          <div className="site-footer__nav-col">
            <h3 className="site-footer__col-heading">
              {isEn ? 'Product' : 'Sản phẩm'}
            </h3>
            <ul className="site-footer__nav-list">
              {productLinks.map((item) => (
                <li key={item.label}>
                  {item.to.startsWith('/#') ? (
                    <a href={item.to} className="site-footer__nav-link">
                      {item.label}
                    </a>
                  ) : (
                    <Link to={item.to} className="site-footer__nav-link">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__nav-col">
            <h3 className="site-footer__col-heading">
              {isEn ? 'Company' : 'Dự án'}
            </h3>
            <ul className="site-footer__nav-list">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  {item.to.startsWith('/#') ? (
                    <a href={item.to} className="site-footer__nav-link">
                      {item.label}
                    </a>
                  ) : (
                    <Link to={item.to} className="site-footer__nav-link">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__newsletter-col">
            <h3 className="site-footer__col-heading">
              {isEn ? 'Stay in the loop' : 'Cập nhật tin tức'}
            </h3>
            <p className="site-footer__newsletter-desc">
              {isEn
                ? 'Receive learning updates and your personalized English roadmap by email.'
                : 'Nhận cập nhật học tập và lộ trình tiếng Anh cá nhân hóa qua email.'}
            </p>

            {isSubmitted ? (
              <p role="status" className="site-footer__success-msg">
                {isEn
                  ? 'Registration successful. Please check your inbox.'
                  : 'Đăng ký thành công. Vui lòng kiểm tra hộp thư.'}
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="site-footer__newsletter-form" noValidate>
                <label className="sr-only" htmlFor="footer-subscription-email">
                  {isEn ? 'Email address' : 'Địa chỉ email'}
                </label>
                <input
                  id="footer-subscription-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={isEn ? 'Your email address' : 'Nhập email của bạn...'}
                  className="site-footer__input"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(subscriptionError)}
                  aria-describedby={subscriptionError ? 'footer-subscription-error' : undefined}
                />
                <button type="submit" className="site-footer__submit-btn" disabled={isSubmitting}>
                  {isSubmitting
                    ? (isEn ? 'Sending...' : 'Đang gửi...')
                    : (isEn ? 'Subscribe' : 'Đăng ký')}
                </button>
              </form>
            )}

            {subscriptionError && (
              <p id="footer-subscription-error" role="alert" className="site-footer__error-msg">
                {subscriptionError}
              </p>
            )}
          </div>

        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copyright">
            © 2026 E-Learn Academy. {isEn ? 'All rights reserved.' : 'Tất cả quyền được bảo lưu.'}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
