import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { loginUser } from '../services/auth.service';

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
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
    setIsLoading(true);

    try {
      const result = await loginUser({
        email: formData.email,
        password: formData.password,
      });

      if (result.data?.token) {
        localStorage.setItem('token', result.data.token);
      }

      setMessage({ type: 'success', text: 'Đăng nhập thành công! Đang chuyển hướng...' });
      
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Email hoặc mật khẩu không chính xác';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    alert('Đăng nhập bằng Google đang được phát triển (OAuth2)!');
  };

  return (
    <>
      <h2 className="welcome-title">Welcome</h2>
      <p className="welcome-subtitle">Please log in or create an account to continue.</p>

      {/* Navigation Tabs */}
      <div className="auth-tabs">
        <div className="auth-tab-item active">Đăng nhập</div>
        <div className="auth-tab-item" onClick={() => navigate('/register')}>Đăng ký</div>
      </div>

      {message.text && (
        <div className={`auth-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
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

        <div className="forgot-link-wrapper">
          <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); alert('Chức năng lấy lại mật khẩu qua Email đang phát triển!'); }}>
            Quên mật khẩu?
          </a>
        </div>

        <button type="submit" className="submit-btn" disabled={isLoading}>
          {isLoading ? (
            <span className="spinner"></span>
          ) : (
            'Đăng nhập'
          )}
        </button>
      </form>

      <div className="divider">
        <span>hoặc</span>
      </div>

      <button type="button" className="google-btn" onClick={handleGoogleLogin}>
        <span className="google-logo">
          <FcGoogle />
        </span>
        Đăng nhập với Google
      </button>
    </>
  );
};

export default LoginPage;
