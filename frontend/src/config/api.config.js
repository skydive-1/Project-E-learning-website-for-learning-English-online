import axios from 'axios';

// Khởi tạo instance Axios với baseURL của API backend
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    // Nếu API trả về 401 (Unauthorized) do token hết hạn, tự động logout mềm và chuyển về trang login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Tránh lặp lại nếu đang ở trang login
      if (!window.location.pathname.includes('/login')) {
        window.dispatchEvent(new CustomEvent('auth-logout'));
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
