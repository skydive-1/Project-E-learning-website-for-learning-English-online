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

/**
 * Đăng nhập/Xác thực Google OAuth2 token
 */
export const loginWithGoogle = async (token, isAccessToken = false) => {
  const response = await apiClient.post('/auth/google', { token, isAccessToken });
  return response.data;
};

/**
 * Hoàn tất đăng ký tài khoản Google mới bằng cách chọn vai trò
 */
export const googleConfirmRole = async ({ tempToken, roleId }) => {
  const response = await apiClient.post('/auth/google/confirm-role', { tempToken, roleId });
  return response.data;
};

/**
 * Gửi yêu cầu khôi phục mật khẩu (Quên mật khẩu)
 */
export const forgotPasswordApi = async ({ email }) => {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data;
};

/**
 * Đặt lại mật khẩu mới
 */
export const resetPasswordApi = async ({ accessToken, newPassword }) => {
  const response = await apiClient.post('/auth/reset-password', { accessToken, newPassword });
  return response.data;
};
