import apiClient from '../../../config/api.config';

const getApiBaseUrl = () => String(
  apiClient.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');

const assertSnapshot = (payload) => {
  const snapshot = payload?.data;
  if (!payload?.success || !snapshot || !Array.isArray(snapshot.alerts)) {
    throw new Error('Dữ liệu cảnh báo từ backend không hợp lệ');
  }
  return snapshot;
};

export const getAdminAlerts = async ({ fresh = false } = {}) => {
  const response = await apiClient.get('/admin/alerts', {
    timeout: 15_000,
    params: fresh ? { fresh: 1, _refresh: Date.now() } : undefined,
    headers: fresh ? {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache'
    } : undefined
  });

  return assertSnapshot(response.data);
};

const parseSseBlock = (block) => {
  let eventName = 'message';
  const dataLines = [];

  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) return null;
  return {
    eventName,
    data: JSON.parse(dataLines.join('\n'))
  };
};

export const connectAdminAlertsStream = ({
  onSnapshot,
  onStatus,
  onStreamError
} = {}) => {
  const controller = new AbortController();
  const token = localStorage.getItem('token');

  const done = (async () => {
    if (!token) throw new Error('Không có token xác thực Admin');

    const response = await fetch(`${getApiBaseUrl()}/admin/alerts/stream`, {
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
      throw new Error(`Kết nối cảnh báo bị từ chối (HTTP ${response.status})`);
    }
    if (!response.body) {
      throw new Error('Trình duyệt không hỗ trợ đọc luồng cảnh báo');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done: streamEnded } = await reader.read();
      if (streamEnded) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        if (!block.trim()) continue;

        let event;
        try {
          event = parseSseBlock(block);
        } catch (error) {
          console.warn('Không thể đọc bản tin cảnh báo SSE:', error);
          continue;
        }

        if (!event) continue;
        if (event.eventName === 'connected') onStatus?.('live', event.data);
        if (event.eventName === 'alerts') onSnapshot?.(event.data);
        if (event.eventName === 'stream-error') onStreamError?.(event.data);
      }
    }

    if (!controller.signal.aborted) {
      throw new Error('Luồng cảnh báo đã đóng ngoài dự kiến');
    }
  })();

  return {
    done,
    close: () => controller.abort()
  };
};
