import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import '../styles/auth.scss';

const AuthLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="auth-wrapper">
      <div className="auth-split-card">
        {/* Left Pane - Branding & Illustration (Stays mounted, animation runs once) */}
        <div className="auth-left-pane">
          <div className="illustration-card">
            <img 
              src="/images/login_illustration.png" 
              alt="Master English Illustration" 
              onError={(e) => {
                // Fallback to a professional placeholder if image is missing
                e.target.src = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=600';
              }}
            />
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
