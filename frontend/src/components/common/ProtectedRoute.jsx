import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

/**
 * ProtectedRoute Component
 * - Kiểm tra phiên đăng nhập qua AuthContext.
 * - 'checking': Hiển thị màn hình chờ.
 * - 'temporarily_unavailable': Hiển thị thông báo mất kết nối kèm nút Thử lại (KHÔNG tự chuyển về /login).
 * - 'unauthenticated': Chuyển hướng về trang /login.
 * - 'authenticated': Kiểm tra vai trò allowedRoles và hiển thị nội dung được bảo vệ.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, authStatus, authError, retryAuth } = useAuth();

  // 1. Khi đang kiểm tra phiên đăng nhập lần đầu
  if (loading || authStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900" style={{ fontFamily: 'sans-serif' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#4f46e5',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: '600', color: '#64748b' }}>
          Đang kiểm tra quyền truy cập...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 2. Khi máy chủ tạm thời không phản hồi hoặc mất mạng (KHÔNG xóa token, KHÔNG redirect về /login)
  if (authStatus === 'temporarily_unavailable') {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 text-center border border-slate-100 dark:border-slate-700">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <FiAlertCircle />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Không thể kiểm tra phiên đăng nhập
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            {authError || 'Không thể kết nối đến máy chủ xác thực. Phiên đăng nhập của bạn vẫn được lưu an toàn trên thiết bị này.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={retryAuth}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-all shadow-md active:scale-95"
            >
              <FiRefreshCw className="animate-spin-hover" />
              Thử lại kết nối
            </button>
            <a
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-sm font-medium transition-colors"
            >
              Đăng nhập bằng tài khoản khác
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 3. Khi xác định chắc chắn người dùng chưa đăng nhập hoặc token đã bị thu hồi
  if (!user || authStatus === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  // 4. Kiểm tra phân quyền vai trò (Role-based access control)
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = parseInt(user.roleId || user.role_id, 10);
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
