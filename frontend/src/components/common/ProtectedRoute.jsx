import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute Component
 * - Kiểm tra sự tồn tại của 'user' trong AuthContext.
 * - Nếu đang tải profile (loading), hiển thị màn hình loading chờ.
 * - Nếu yêu cầu vai trò (allowedRoles), đối chiếu trực tiếp với roleId của user.
 * - Chuyển hướng học viên ra trang chủ nếu cố tình truy cập trang Instructor/Admin.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  // Chỉ hiển thị loading toàn màn hình khi lần đầu khởi động app chưa có user
  // Nếu user đã tồn tại trong state → render ngay, không block để tránh flash loading giữa các trang/bài học
  if (loading && !user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50" style={{ fontFamily: 'sans-serif' }}>
        <div className="w-12 h-12 border-4 border-slate-200 border-t-smart-indigo rounded-full animate-spin" style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#4f46e5',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: '600', color: '#64748b' }}>Đang kiểm tra quyền truy cập...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = parseInt(user.roleId || user.role_id, 10);
    // Nếu vai trò của user không khớp với allowedRoles, chuyển hướng về trang chủ
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
