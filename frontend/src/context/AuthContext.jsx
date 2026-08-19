import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../modules/auth/services/auth.service';
import { resetAuthLogoutGuard } from '../config/api.config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'authenticated' | 'unauthenticated' | 'temporarily_unavailable'
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();

  const fetchUserProfile = useCallback(async (retryCount = 0) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setAuthStatus('unauthenticated');
      setLoading(false);
      setAuthError(null);
      return;
    }

    try {
      setLoading(true);
      setAuthStatus('checking');
      const res = await getProfile();
      const userData = res.data || res.user || res;
      setUser(userData);
      setAuthStatus('authenticated');
      setAuthError(null);
    } catch (error) {
      console.warn(`[AuthContext] Kiểm tra phiên đăng nhập (lần ${retryCount + 1}):`, error.message);

      const status = error?.response?.status;
      const data = error?.response?.data;
      const errorCode = data?.code || data?.error;

      // 1. Chỉ xóa token khi Backend xác nhận Token hết hạn/sai/User bị xóa
      const criticalAuthCodes = ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'USER_DELETED', 'TokenExpiredError', 'TokenInvalidError', 'UserDeleted'];
      const isCriticalAuthError = status === 401 && (criticalAuthCodes.includes(errorCode) || !errorCode);

      if (isCriticalAuthError) {
        console.warn('❌ Token không hợp lệ hoặc đã hết hạn. Đăng xuất local.');
        localStorage.removeItem('token');
        setUser(null);
        setAuthStatus('unauthenticated');
        setAuthError(null);
        setLoading(false);
        return;
      }

      // 2. Với các lỗi mạng (Network Error / Timeout / 5xx Server / Cold Start):
      // Retry tối đa 2 lần với delay ngắn (1000ms)
      if (retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchUserProfile(retryCount + 1);
      }

      // Sau khi retry hết: KHÔNG xóa JWT trong localStorage, chuyển sang trạng thái temporarily_unavailable
      console.error('⚠️ Không thể kết nối tới máy chủ để xác thực phiên (Giữ nguyên JWT):', error.message);
      setAuthStatus('temporarily_unavailable');
      setAuthError(error.message || 'Không thể kết nối tới máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();

    // Lắng nghe sự kiện đăng xuất mềm từ API Interceptor khi có 401 nghiêm trọng
    const handleAuthLogout = (e) => {
      console.warn('⚡ Nhận sự kiện auth-logout:', e?.detail?.code || '401');
      localStorage.removeItem('token');
      setUser(null);
      setAuthStatus('unauthenticated');
      setLoading(false);
      navigate('/login');
    };

    window.addEventListener('auth-logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, [fetchUserProfile, navigate]);

  // Phương thức đăng nhập
  const login = async (token) => {
    resetAuthLogoutGuard();
    localStorage.setItem('token', token);
    await fetchUserProfile();
    navigate('/');
  };

  // Phương thức đăng xuất chủ động của người dùng
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAuthStatus('unauthenticated');
    setLoading(false);
    navigate('/login');
  };

  // Phương thức làm mới thông tin cá nhân
  const refreshProfile = async () => {
    try {
      const res = await getProfile();
      const userData = res.data || res.user || res;
      setUser(userData);
      setAuthStatus('authenticated');
    } catch (error) {
      console.error('Lỗi làm mới thông tin profile:', error);
    }
  };

  // Thử lại xác thực khi gặp sự cố tạm thời
  const retryAuth = () => {
    fetchUserProfile(0);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading: loading || authStatus === 'checking',
      authStatus,
      authError,
      login,
      logout,
      refreshProfile,
      retryAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng trong một AuthProvider');
  }
  return context;
};
