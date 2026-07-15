import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { forgotPasswordApi } from '../services/auth.service';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setMessage({ type: '', text: '' });
    setIsLoading(true);

    try {
      await forgotPasswordApi({ email });
      setMessage({
        type: 'success',
        text: 'Email khôi phục mật khẩu đã được gửi! Vui lòng kiểm tra hòm thư của bạn.'
      });
      setEmail('');
    } catch (error) {
      console.error('Lỗi khi gửi yêu cầu quên mật khẩu:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Không thể gửi email khôi phục. Vui lòng thử lại.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h2 className="welcome-title">Quên mật khẩu</h2>
      <p className="welcome-subtitle">Nhập email của bạn để nhận link khôi phục mật khẩu từ Supabase.</p>

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
              placeholder="Nhập Email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={isLoading}>
          {isLoading ? <span className="spinner"></span> : 'Gửi link khôi phục'}
        </button>
      </form>

      <div className="forgot-link-wrapper" style={{ marginTop: '20px', textAlign: 'center' }}>
        <a 
          href="#" 
          className="forgot-link" 
          onClick={(e) => { e.preventDefault(); navigate('/login'); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <FiArrowLeft /> Quay lại đăng nhập
        </a>
      </div>
    </>
  );
};

export default ForgotPasswordPage;
