import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../modules/auth/services/auth.service';
import { resetAuthLogoutGuard } from '../config/api.config';

const AuthContext = createContext(null);
const AUTH_USER_CACHE_KEY = 'auth_user_cache';

const decodeJwtUser = (token) => {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;

    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '='
    );
    const binaryPayload = window.atob(paddedPayload);
    const payloadJson = decodeURIComponent(
      Array.from(binaryPayload, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    );
    const payload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp * 1000 <= Date.now()) return null;

    const userId = payload.userId ?? payload.user_id ?? payload.id;
    const roleId = payload.roleId ?? payload.role_id;
    if (!userId && !payload.email) return null;

    return {
      userId,
      user_id: userId,
      email: payload.email,
      username: payload.username || payload.email?.split('@')[0] || 'User',
      roleId,
      role_id: roleId,
      is_super_admin: Number(roleId) === 1
    };
  } catch {
    return null;
  }
};

const readCachedUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const cachedUser = JSON.parse(localStorage.getItem(AUTH_USER_CACHE_KEY));
    if (cachedUser && typeof cachedUser === 'object') return cachedUser;
  } catch {
    localStorage.removeItem(AUTH_USER_CACHE_KEY);
  }

  // First load after this release: JWT claims prevent a guest-state flash before cache exists.
  return decodeJwtUser(token);
};

const cacheUser = (userData) => {
  if (userData && typeof userData === 'object') {
    localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(userData));
  }
};

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem(AUTH_USER_CACHE_KEY);
};

const CRITICAL_AUTH_CODES = [
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'USER_DELETED',
  'TokenExpiredError',
  'TokenInvalidError',
  'UserDeleted'
];

export const AuthProvider = ({ children }) => {
  // Render the last verified profile immediately while the backend revalidates the JWT.
  const [user, setUser] = useState(readCachedUser);
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'authenticated' | 'unauthenticated' | 'temporarily_unavailable'
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();

  const fetchUserProfile = useCallback(async (retryCount = 0) => {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem(AUTH_USER_CACHE_KEY);
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
      cacheUser(userData);
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
        clearStoredAuth();
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
      clearStoredAuth();
      setUser(null);
      setAuthStatus('unauthenticated');
      setLoading(false);
      navigate('/login');
    };

    window.addEventListener('auth-logout', handleAuthLogout);

    // Heartbeat định kỳ (3 phút) khi tab đang mở và có token để cập nhật mốc hoạt động realtime
    const heartbeatInterval = setInterval(() => {
      const token = localStorage.getItem('token');
      if (token && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        getProfile().catch(() => {});
      }
    }, 3 * 60 * 1000);

    return () => {
      window.removeEventListener('auth-logout', handleAuthLogout);
      clearInterval(heartbeatInterval);
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
    clearStoredAuth();
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
      cacheUser(userData);
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
