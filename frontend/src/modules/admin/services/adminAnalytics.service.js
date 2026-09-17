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

const getApiBaseUrl = () => String(
  apiClient.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');

const parseSseBlock = (block) => {
  let eventName = 'message';
  const dataLines = [];

  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) return null;
  return { eventName, data: JSON.parse(dataLines.join('\n')) };
};

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

export const connectGeminiRateLimitStream = ({
  onSnapshot,
  onStatus,
  onStreamError
} = {}) => {
  const controller = new AbortController();
  const token = localStorage.getItem('token');

  const done = (async () => {
    if (!token) throw new Error('Không có token xác thực Admin');

    const response = await fetch(`${getApiBaseUrl()}/admin/gemini-rate-limits/stream`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Kết nối telemetry bị từ chối (HTTP ${response.status})`);
    }
    if (!response.body) {
      throw new Error('Trình duyệt không hỗ trợ đọc telemetry thời gian thực');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done: streamEnded } = await reader.read();
      if (streamEnded) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');

      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        if (!block.trim()) continue;

        try {
          const event = parseSseBlock(block);
          if (!event) continue;
          if (event.eventName === 'connected') onStatus?.('live', event.data);
          if (event.eventName === 'rate-limits') onSnapshot?.(event.data);
          if (event.eventName === 'stream-error') onStreamError?.(event.data);
        } catch (error) {
          console.warn('Không thể đọc bản tin rate limit SSE:', error);
        }
      }
    }

    if (!controller.signal.aborted) {
      throw new Error('Luồng telemetry đã đóng ngoài dự kiến');
    }
  })();

  return {
    done,
    close: () => controller.abort()
  };
};

export const resetGeminiModelRouting = async (options = {}) => {
  const all = options?.all !== undefined ? options.all : true;
  const response = await apiClient.post('/admin/gemini-rate-limits/routing/reset', { all });
  if (!response.data?.success || !response.data?.data?.routing) {
    throw new Error('Phản hồi khôi phục model Gemini không hợp lệ');
  }
  return response.data.data.routing;
};

export const setPreferredGeminiModel = async (model) => {
  const response = await apiClient.post('/admin/gemini-rate-limits/routing/preferred', { model });
  if (!response.data?.success || !response.data?.data?.routing) {
    throw new Error('Phản hồi chọn model điều phối không hợp lệ');
  }
  return response.data.data.routing;
};

export const toggleAiModelLock = async ({ model, locked, reason } = {}) => {
  const response = await apiClient.post('/admin/gemini-rate-limits/routing/lock', {
    model,
    locked: Boolean(locked),
    reason
  });
  if (!response.data?.success || !response.data?.data?.routing) {
    throw new Error('Phản hồi thay đổi trạng thái khóa model không hợp lệ');
  }
  return response.data.data.routing;
};

export const simulateGeminiModelFallback = async ({ model, simulatedError = 503 } = {}) => {
  const response = await apiClient.post('/admin/gemini-rate-limits/routing/simulate-fallback', {
    model,
    simulatedError
  });
  if (!response.data?.success || !response.data?.data) {
    throw new Error('Phản hồi mô phỏng fallback không hợp lệ');
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
