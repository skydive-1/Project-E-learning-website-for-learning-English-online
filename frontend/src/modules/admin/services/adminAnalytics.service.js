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

export const getAiQuotaAnalytics = async (range = 30) => {
  const response = await apiClient.get('/admin/ai-quota', {
    params: { range }
  });

  if (!response.data?.success || !response.data?.data) {
    throw new Error('Dữ liệu AI Quota trả về không hợp lệ');
  }

  return response.data.data;
};

export const getGeminiUsageTrends = async ({
  range = '30d',
  metric = 'tokens',
  source = 'backend',
  model = 'all',
  fresh = false
} = {}) => {
  const response = await apiClient.get('/admin/gemini-usage/trends', {
    params: {
      range,
      metric,
      source,
      model,
      ...(fresh ? { fresh: 1, _refresh: Date.now() } : {})
    },
    ...(fresh ? {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    } : {})
  });

  if (!response.data?.success || !response.data?.data) {
    throw new Error('Invalid Gemini usage trend response');
  }

  return response.data.data;
};

const makeLiveRefreshConfig = (fresh) => fresh ? {
  params: { _refresh: Date.now() },
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  }
} : undefined;

export const getGeminiRateLimitStatus = async ({ fresh = false } = {}) => {
  const response = await apiClient.get(
    '/admin/gemini-rate-limits/status',
    makeLiveRefreshConfig(fresh)
  );
  if (!response.data?.success || !response.data?.data) {
    throw new Error('Dữ liệu Rate Limits trả về không hợp lệ');
  }
  return response.data.data;
};

export const getGeminiRateLimitCaps = async ({ fresh = false } = {}) => {
  const response = await apiClient.get(
    '/admin/gemini-rate-limits/caps',
    makeLiveRefreshConfig(fresh)
  );
  if (!response.data?.success || !response.data?.data) {
    throw new Error('Dữ liệu cấu hình Rate Limits trả về không hợp lệ');
  }
  return response.data.data.models || [];
};

export const updateGeminiRateLimitCaps = async (settings) => {
  const response = await apiClient.put('/admin/gemini-rate-limits/caps', settings);
  return response.data;
};

export const updateUserQuota = async (userId, maxTokens) => {
  const response = await apiClient.put(`/admin/users/${userId}/quota`, { maxTokens });
  return response.data;
};

export const resetUserAiToken = async (userId) => {
  const response = await apiClient.post(`/admin/users/${userId}/reset-token`);
  return response.data;
};

export const resetBulkAiTokens = async (roleId) => {
  const response = await apiClient.post('/admin/users/reset-tokens', { roleId });
  return response.data;
};
