import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';
import { resetPasswordApi } from '../services/auth.service';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [accessToken, setAccessToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // Trích xuất access_token từ URL hash (ví dụ: #access_token=...) hoặc query parameters
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    const queryParams = new URLSearchParams(window.location.search);
    
    const token = hashParams.get('access_token') || queryParams.get('access_token');
    
    if (token) {
      setAccessToken(token);
    } else {
      setMessage({
        type: 'error',
        text: 'Không tìm thấy mã xác thực khôi phục mật khẩu. Liên kết này có thể đã hết hạn hoặc không hợp lệ.'
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accessToken) {
      setMessage({ type: 'error', text: 'Mã xác thực không hợp lệ. Vui lòng thử lại bằng cách click lại link trong email.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }

    setMessage({ type: '', text: '' });
    setIsLoading(true);

    try {
      await resetPasswordApi({ accessToken, newPassword: password });
      setMessage({
        type: 'success',
        text: 'Cập nhật mật khẩu mới thành công! Đang chuyển hướng về trang đăng nhập...'
      });
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Lỗi khi đặt lại mật khẩu:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h2 className="welcome-title">Đặt lại mật khẩu</h2>
      <p className="welcome-subtitle">Nhập mật khẩu mới cho tài khoản của bạn.</p>

      {message.text && (
        <div className={`auth-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {accessToken && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="input-wrapper">
              <FiLock className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
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
                placeholder="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : 'Cập nhật mật khẩu'}
          </button>
        </form>
      )}

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

export default ResetPasswordPage;
