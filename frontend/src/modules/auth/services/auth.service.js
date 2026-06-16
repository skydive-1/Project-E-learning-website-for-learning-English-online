import apiClient from '../../../config/api.config';

/**
 * Đăng ký tài khoản mới
 */
export const registerUser = async ({ email, username, password, roleId }) => {
  const response = await apiClient.post('/auth/register', { email, username, password, roleId });
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

/**
 * Đổi mật khẩu
 */
export const changePasswordApi = async ({ oldPassword, newPassword }) => {
  const response = await apiClient.put('/auth/change-password', { oldPassword, newPassword });
  return response.data;
};

/**
 * Cập nhật thông tin cá nhân
 */
export const updateProfileApi = async ({ username, fullName, profilePictureUrl }) => {
  const response = await apiClient.put('/auth/profile', { username, fullName, profilePictureUrl });
  return response.data;
};
