import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { loginUser, loginWithGoogle, googleConfirmRole } from '../services/auth.service';
import { useAuth } from '../../../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
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
        setMessage({ type: 'success', text: 'Đăng nhập thành công! Đang tải thông tin...' });
        await login(result.data.token);
      } else {
        throw new Error("Token không hợp lệ từ API");
      }
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Email hoặc mật khẩu không chính xác';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [tempUser, setTempUser] = useState(null);

  const handleGoogleLogin = () => {
    if (window.google) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '437812037145-j45d1tptl3h2c0409t5o6q1fph3v783j.apps.googleusercontent.com',
        scope: 'email profile openid',
        callback: async (response) => {
          if (response.access_token) {
            setIsLoading(true);
            setMessage({ type: '', text: '' });
            try {
              const result = await loginWithGoogle(response.access_token, true);

              if (result.isNewUser) {
                setTempToken(result.tempToken);
                setTempUser({
                  email: result.email,
                  fullName: result.fullName,
                  profilePicture: result.profilePictureUrl
                });
                setShowRoleModal(true);
              } else if (result.token) {
                setMessage({ type: 'success', text: 'Đăng nhập thành công! Đang chuyển hướng...' });
                await login(result.token);
              }
            } catch (error) {
              console.error('Lỗi đăng nhập Google:', error);
              setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Không thể xác thực tài khoản Google. Vui lòng thử lại.'
              });
            } finally {
              setIsLoading(false);
            }
          }
        }
      });
      client.requestAccessToken();
    } else {
      alert('Đang tải thư viện đăng nhập của Google, vui lòng thử lại sau vài giây!');
    }
  };

  const handleSelectRole = async (roleId) => {
    setIsLoading(true);
    try {
      const result = await googleConfirmRole({
        tempToken,
        roleId
      });

      if (result.data?.token) {
        setShowRoleModal(false);
        setMessage({ type: 'success', text: 'Thiết lập vai trò thành công! Đang đăng nhập...' });
        await login(result.data.token);
      }
    } catch (error) {
      console.error('Lỗi xác nhận vai trò Google:', error);
      alert(error.response?.data?.message || 'Lỗi thiết lập vai trò người dùng.');
    } finally {
      setIsLoading(false);
    }
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
          <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>
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

      <button 
        type="button" 
        className="google-btn" 
        onClick={handleGoogleLogin}
        disabled={isLoading}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          borderRadius: '20px',
          backgroundColor: 'var(--card-bg, #ffffff)',
          color: 'var(--text-color, #0f172a)',
          fontSize: '14.5px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: "'Outfit', sans-serif",
          marginTop: '12px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--dropdown-hover, #f8fafc)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--card-bg, #ffffff)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.02)'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', fontSize: '20px' }}>
          <FcGoogle />
        </span>
        Đăng nhập bằng Google
      </button>

      {showRoleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg, #ffffff)',
            borderRadius: '24px',
            border: '1px solid var(--border-color, #e2e8f0)',
            width: '100%',
            maxWidth: '480px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            textAlign: 'center',
            color: 'var(--text-color, #0f172a)'
          }}>
            {tempUser?.profilePicture && (
              <img 
                src={tempUser.profilePicture} 
                alt="Avatar" 
                style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '16px', border: '3px solid #3b82f6' }} 
              />
            )}
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
              Chào mừng, {tempUser?.fullName || 'bạn'}!
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-light, #64748b)', marginBottom: '28px', lineHeight: '1.5' }}>
              Tài khoản Google của bạn đã được xác thực. Vui lòng chọn vai trò học tập để hoàn tất đăng ký:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div 
                onClick={() => handleSelectRole(3)}
                style={{
                  border: '2px solid #3b82f6',
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  backgroundColor: 'rgba(59, 130, 246, 0.02)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.06)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.02)'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>
                  🎓
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6', marginBottom: '4px' }}>Tôi là Học sinh</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-light, #64748b)', margin: 0 }}>Tham gia khóa học, luyện bài kiểm tra và trò chuyện với trợ lý AI.</p>
                </div>
              </div>

              <div 
                onClick={() => handleSelectRole(2)}
                style={{
                  border: '2px solid #10b981',
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  backgroundColor: 'rgba(16, 185, 129, 0.02)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.06)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.02)'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>
                  🧑‍🏫
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '4px' }}>Tôi là Giảng viên</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-light, #64748b)', margin: 0 }}>Tự thiết lập khóa học, biên soạn bộ đề thi trắc nghiệm và quản lý tiến độ.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowRoleModal(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-light, #64748b)',
                fontSize: '13px',
                fontWeight: '500',
                marginTop: '24px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Hủy bỏ đăng ký
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginPage;
