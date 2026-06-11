import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import loginIllustration from '../assets/login_illustration.png';
import '../styles/auth.scss';

const AuthLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="auth-wrapper">
      <div className="auth-split-card">
        {/* Left Pane - Branding & Illustration (Stays mounted, animation runs once) */}
        <div className="auth-left-pane">
          <div className="illustration-card">
            <img src={loginIllustration} alt="Master English Illustration" />
          </div>
          <h3>Master English with Guided Clarity</h3>
          <p>Join E-Learn today and accelerate your language journey with our supportive AI tools.</p>
        </div>

        {/* Right Pane - Dynamic Content (Login/Register Forms) */}
        <div className="auth-right-pane">
          <div className="auth-back-nav" onClick={() => navigate('/')}>
            <FiArrowRight style={{ transform: 'rotate(180deg)' }} /> <span>Quay lại trang chủ</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
