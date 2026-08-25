import apiClient from '../../../config/api.config';

export const getAdminAnalytics = async (range = 30) => {
  const response = await apiClient.get('/admin/analytics', {
    params: { range }
  });

  if (!response.data?.success || !response.data?.data) {
    throw new Error('Dữ liệu Analytics trả về không hợp lệ');
  }

  return response.data.data;
};
