import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { registerUser } from '../services/auth.service';
import loginIllustration from '../assets/login_illustration.png';
import '../styles/auth.scss';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
      return;
    }

    setIsLoading(true);

    try {
      await registerUser({
        email: formData.email,
        username: formData.username,
        password: formData.password,
      });

      setMessage({ 
        type: 'success', 
        text: 'Đăng ký tài khoản thành công! Đang chuyển hướng về trang đăng nhập...' 
      });
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    alert('Đăng ký bằng Google đang được phát triển (OAuth2)!');
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-split-card">
        {/* Left Pane - Branding & Illustration */}
        <div className="auth-left-pane">
          <div className="illustration-card">
            <img src={loginIllustration} alt="Master English Illustration" />
          </div>
          <h3>Master English with Guided Clarity</h3>
          <p>Join E-Learn today and accelerate your language journey with our supportive AI tools.</p>
        </div>

        {/* Right Pane - Form Controls */}
        <div className="auth-right-pane">
          <h2 className="welcome-title">Welcome</h2>
          <p className="welcome-subtitle">Please log in or create an account to continue.</p>

          {/* Navigation Tabs */}
          <div className="auth-tabs">
            <div className="auth-tab-item" onClick={() => navigate('/login')}>Đăng nhập</div>
            <div className="auth-tab-item active">Đăng ký</div>
          </div>

          {message.text && (
            <div className={`auth-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="input-wrapper">
                <FiUser className="input-icon" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Tên người dùng"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="input-wrapper">
                <FiMail className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Mật khẩu"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Xác nhận mật khẩu"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? (
                <span className="spinner"></span>
              ) : (
                'Đăng ký'
              )}
            </button>
          </form>

          <div className="divider">
            <span>hoặc</span>
          </div>

          <button type="button" className="google-btn" onClick={handleGoogleSignup}>
            <span className="google-logo">
              <FcGoogle />
            </span>
            Đăng ký với Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
