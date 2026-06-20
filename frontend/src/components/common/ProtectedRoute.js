import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute Component
 * - Kiểm tra sự tồn tại của 'token' trong localStorage.
 * - Nếu yêu cầu vai trò (allowedRoles), giải mã JWT token để đối chiếu.
 * - Chuyển hướng học viên ra trang chủ nếu cố tình truy cập trang Instructor/Admin.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    try {
      const payload = token.split('.')[1];
      // Giải mã Base64 an toàn bằng atob
      const decoded = JSON.parse(atob(payload));
      const userRole = parseInt(decoded.roleId || decoded.role, 10);

      // Nếu vai trò của user không khớp với allowedRoles, chuyển hướng về trang chủ
      if (!allowedRoles.includes(userRole)) {
        return <Navigate to="/" replace />;
      }
    } catch (error) {
      console.error('Lỗi kiểm tra quyền truy cập route:', error);
      localStorage.removeItem('token');
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
