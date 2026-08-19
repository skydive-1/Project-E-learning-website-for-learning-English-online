import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:5000/api';
};

// Khởi tạo instance Axios với baseURL của API backend
const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Single-flight guard: đảm bảo nhiều request 401 đồng thời hoặc đến trễ chỉ phát 1 sự kiện logout duy nhất
let isLoggingOut = false;

export const resetAuthLogoutGuard = () => {
  isLoggingOut = false;
};

// Danh sách các mã lỗi xác thực nghiêm trọng (chỉ các mã này mới kích hoạt xóa JWT và logout)
const CRITICAL_AUTH_CODES = [
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'USER_DELETED',
  'TokenExpiredError',
  'TokenInvalidError',
  'UserDeleted'
];

// Interceptor tự động chèn JWT token vào Request Headers
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor xử lý lỗi chung (Response Interceptor)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const url = error?.config?.url || '';
    const hasAuthHeader = Boolean(error?.config?.headers?.Authorization);

    // Không xử lý logout nếu là các endpoint auth công khai (login, register, forgot-password, reset-password, google)
    const isPublicAuthRoute = url.includes('/auth/login') ||
                              url.includes('/auth/register') ||
                              url.includes('/auth/forgot-password') ||
                              url.includes('/auth/reset-password') ||
                              url.includes('/auth/google');

    if (status === 401 && hasAuthHeader && !isPublicAuthRoute) {
      const errorCode = data?.code || data?.error;
      const isCriticalAuthError = Boolean(errorCode && CRITICAL_AUTH_CODES.includes(errorCode));

      if (isCriticalAuthError && !isLoggingOut) {
        isLoggingOut = true;
        localStorage.removeItem('token');

        // Phát sự kiện đăng xuất mềm nếu chưa ở trang login
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.dispatchEvent(new CustomEvent('auth-logout', {
            detail: { code: errorCode, message: data?.message || 'Phiên đăng nhập đã hết hạn.' }
          }));
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
