import React from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiAlertCircle, FiRefreshCw, FiShieldOff, FiHome } from 'react-icons/fi';

/**
 * ProtectedRoute Component
 * - Kiểm tra phiên đăng nhập qua AuthContext với đầy đủ các trạng thái:
 *   'checking' | 'authenticated' | 'unauthenticated' | 'expired' | 'temporarily_unavailable'
 * - Bảo vệ đường dẫn riêng tư, lưu đường dẫn đích `?next=...` khi chuyển hướng đến /login.
 * - Kiểm tra phân quyền đa vai trò (Student / Instructor / Admin) linh hoạt cả mã số và chuỗi.
 * - Hiển thị giao diện 403 chuyên nghiệp khi người dùng không đủ quyền hạn.
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, authStatus, authError, retryAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Khi app khởi động hoặc đang kiểm tra phiên đăng nhập (chưa có user trong cache/state)
  if ((authStatus === 'checking' || loading) && !user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 px-4">
        <div 
          className="size-10 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin" 
          aria-hidden="true" 
        />
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Đang kiểm tra phiên đăng nhập...
        </p>
        <span className="sr-only">Đang kiểm tra đăng nhập</span>
      </div>
    );
  }

  // 2. Khi máy chủ tạm thời không phản hồi hoặc mất mạng (KHÔNG xóa token, KHÔNG redirect về /login)
  if (authStatus === 'temporarily_unavailable' && !user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 text-center border border-slate-100 dark:border-slate-700">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <FiAlertCircle aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Không thể xác thực phiên đăng nhập
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            {authError || 'Không thể kết nối đến máy chủ xác thực. Phiên đăng nhập nếu có vẫn được lưu an toàn trên thiết bị này.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={retryAuth}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <FiRefreshCw className="animate-spin-hover" aria-hidden="true" />
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-sm transition-colors cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Khi chưa đăng nhập hoặc phiên đã hết hạn: chuyển hướng đến /login kèm URL đích `?next=...`
  if (!user || authStatus === 'unauthenticated' || authStatus === 'expired') {
    const currentDestination = location.pathname + location.search;
    const redirectUrl = currentDestination && currentDestination !== '/'
      ? `/login?next=${encodeURIComponent(currentDestination)}`
      : '/login';

    return <Navigate to={redirectUrl} replace />;
  }

  // 4. Kiểm tra phân quyền vai trò (Role-based access control)
  // Hỗ trợ cả mảng mã số [1, 2, 3] và chuỗi ['admin', 'instructor', 'student']
  if (allowedRoles && allowedRoles.length > 0) {
    const numericRole = Number(user.roleId ?? user.role_id);
    const stringRole = typeof user.role === 'string' ? user.role.toLowerCase() : null;

    const hasPermission = allowedRoles.some((allowed) => {
      if (typeof allowed === 'number') {
        return allowed === numericRole;
      }
      if (typeof allowed === 'string') {
        return (
          allowed.toLowerCase() === stringRole ||
          (allowed.toLowerCase() === 'admin' && numericRole === 1) ||
          (allowed.toLowerCase() === 'instructor' && numericRole === 2) ||
          (allowed.toLowerCase() === 'student' && numericRole === 3)
        );
      }
      return false;
    });

    if (!hasPermission) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center border border-slate-100 dark:border-slate-700">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              <FiShieldOff aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              403 — Không có quyền truy cập
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Tài khoản của bạn không có đủ đặc quyền để truy cập vào phân hệ này. Vui lòng quay về trang chủ hoặc liên hệ Quản trị viên.
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <FiHome aria-hidden="true" />
              Về trang chủ
            </button>
          </div>
        </div>
      );
    }
  }

  // Người dùng đã xác thực hợp lệ và thỏa mãn phân quyền
  return children;
};

export default ProtectedRoute;
