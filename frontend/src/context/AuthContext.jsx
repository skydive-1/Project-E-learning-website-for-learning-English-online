import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../modules/auth/services/auth.service';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const res = await getProfile();
      // API có thể trả về res.data hoặc res.user hoặc res trực tiếp
      const userData = res.data || res.user || res;
      setUser(userData);
    } catch (error) {
      console.error("Lỗi khi tải thông tin người dùng:", error);
      // Nếu lỗi tải profile (hết hạn token hoặc token không hợp lệ), xóa token
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }

    // Lắng nghe sự kiện đăng xuất mềm từ API Interceptor
    const handleAuthLogout = () => {
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
      navigate('/login');
    };

    window.addEventListener('auth-logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, [navigate]);

  // Phương thức đăng nhập
  const login = async (token) => {
    localStorage.setItem('token', token);
    await fetchUserProfile();
    navigate('/');
  };

  // Phương thức đăng xuất
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  // Phương thức làm mới thông tin cá nhân
  const refreshProfile = async () => {
    try {
      const res = await getProfile();
      const userData = res.data || res.user || res;
      setUser(userData);
    } catch (error) {
      console.error("Lỗi làm mới thông tin profile:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
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
