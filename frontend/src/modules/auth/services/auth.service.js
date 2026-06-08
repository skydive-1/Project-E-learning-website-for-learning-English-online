import apiClient from '../../../config/api.config';

/**
 * Đăng ký tài khoản mới
 */
export const registerUser = async ({ email, username, password }) => {
  const response = await apiClient.post('/auth/register', { email, username, password });
  return response.data;
};

/**
 * Đăng nhập
 */
export const loginUser = async ({ email, password }) => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
};

/**
 * Lấy thông tin cá nhân của người dùng hiện tại (dùng token trong header)
 */
export const getProfile = async () => {
  const response = await apiClient.get('/auth/profile');
  return response.data;
};
