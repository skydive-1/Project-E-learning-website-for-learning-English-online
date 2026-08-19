import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../modules/auth/services/auth.service';
import { resetAuthLogoutGuard } from '../config/api.config';

const AuthContext = createContext(null);

const CRITICAL_AUTH_CODES = [
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'USER_DELETED',
  'TokenExpiredError',
  'TokenInvalidError',
  'UserDeleted'
];

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
      resetAuthLogoutGuard();
    } catch (error) {
      console.warn(`[AuthContext] Kiểm tra phiên đăng nhập (lần ${retryCount + 1}):`, error.message);

      const status = error?.response?.status;
      const data = error?.response?.data;
      const errorCode = data?.code || data?.error;

      // 1. Chỉ xóa token khi Backend xác nhận chính xác Token hết hạn / sai / User bị xóa
      const isCriticalAuthError = status === 401 && Boolean(errorCode && CRITICAL_AUTH_CODES.includes(errorCode));

      if (isCriticalAuthError) {
        console.warn('❌ Token không hợp lệ hoặc đã hết hạn. Đăng xuất local.');
        localStorage.removeItem('token');
        setUser(null);
        setAuthStatus('unauthenticated');
        setAuthError(null);
        setLoading(false);
        return;
      }

      // 2. Phân loại lỗi có thể retry: Mất mạng, timeout, hoặc HTTP 500/502/503/504
      const isNetworkOrTimeout = !error.response ||
        error.code === 'ERR_NETWORK' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        (error.message && error.message.includes('Network Error'));

      const isServerError = [500, 502, 503, 504].includes(status);
      const isRetryable = isNetworkOrTimeout || isServerError;

      // Chỉ retry tối đa 2 lần cho các lỗi tạm thời
      if (isRetryable && retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchUserProfile(retryCount + 1);
      }

      // Với tất cả các lỗi không critical (kể cả 400, 403, 404, 401 không có mã critical, hoặc lỗi mạng sau khi retry hết):
      // KHÔNG xóa JWT trong localStorage, chuyển sang trạng thái temporarily_unavailable
      console.error('⚠️ Không thể xác thực phiên đăng nhập (Giữ nguyên JWT):', error.message);
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
