import { useState, useEffect, useCallback } from 'react';
import apiClient from '../config/api.config';

/**
 * Real-time SSE Service for Instructor Dashboard
 * Provides Server-Sent Events connection for real-time updates
 */

class RealtimeService {
  constructor() {
    this.eventSource = null;
    this.reconnectTimer = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.userId = null;
    this.connectionVersion = 0;
    this.shouldReconnect = false;
  }

  /**
   * Connect to SSE endpoint
   * @param {number} userId - Current user ID
   */
  async connect(userId) {
    const normalizedUserId = Number(userId);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error('Không xác định được người dùng cho kết nối realtime.');
    }

    if (
      this.eventSource
      && this.userId === normalizedUserId
      && this.eventSource.readyState !== EventSource.CLOSED
    ) {
      return true;
    }

    this.stopTransport();
    this.userId = normalizedUserId;
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;
    this.connectionVersion += 1;
    return this.openConnection(normalizedUserId, this.connectionVersion);
  }

  async openConnection(userId, version) {
    try {
      // Lấy ticket qua Axios để session token chỉ đi trong Authorization header.
      const ticketResponse = await apiClient.post('/instructor/realtime/ticket');
      const ticket = ticketResponse.data?.data?.ticket;
      if (!ticket) {
        const error = new Error('Máy chủ không trả về vé kết nối realtime hợp lệ.');
        error.code = 'REALTIME_TICKET_INVALID';
        throw error;
      }
      if (!this.shouldReconnect || version !== this.connectionVersion || this.userId !== userId) {
        return false;
      }

      const baseUrl = String(apiClient.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
        .replace(/\/+$/, '');
      const sseUrl = `${baseUrl}/instructor/realtime/stream?ticket=${encodeURIComponent(ticket)}`;
      const eventSource = new EventSource(sseUrl);
      this.eventSource = eventSource;

      eventSource.onopen = () => {
        if (version !== this.connectionVersion) return;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', {});
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.warn('Failed to parse SSE message:', err);
        }
      };

      eventSource.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('notification', data);
        } catch (err) {
          console.warn('Failed to parse notification:', err);
        }
      });

      eventSource.addEventListener('course_update', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('course_update', data);
        } catch (err) {
          console.warn('Failed to parse course_update:', err);
        }
      });

      eventSource.addEventListener('student_enrollment', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('student_enrollment', data);
        } catch (err) {
          console.warn('Failed to parse student_enrollment:', err);
        }
      });

      eventSource.addEventListener('discussion_update', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('discussion_update', data);
        } catch (err) {
          console.warn('Failed to parse discussion_update:', err);
        }
      });

      eventSource.addEventListener('quiz_submission', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('quiz_submission', data);
        } catch (err) {
          console.warn('Failed to parse quiz_submission:', err);
        }
      });

      eventSource.addEventListener('heartbeat', () => {
        this.emit('heartbeat', {});
      });

      eventSource.onerror = (err) => {
        if (version !== this.connectionVersion || eventSource !== this.eventSource) return;
        console.error('SSE connection error:', err);
        this.isConnected = false;
        this.emit('error', err);
        this.stopEventSource();
        this.scheduleReconnect(userId, version);
      };

      return true;
    } catch (error) {
      // Bỏ qua kết quả của request cũ sau khi component đã unmount hoặc có
      // một kết nối mới hơn. Điều này thường xảy ra trong React Strict Mode.
      if (
        version !== this.connectionVersion
        || this.userId !== userId
        || !this.shouldReconnect
      ) {
        return false;
      }
      this.isConnected = false;
      if (this.isAuthFailure(error)) {
        this.shouldReconnect = false;
        this.emit('auth_error', error);
        throw error;
      }
      this.emit('error', error);
      this.scheduleReconnect(userId, version);
      throw error;
    }
  }

  isAuthFailure(error) {
    const status = Number(error?.response?.status || error?.status || 0);
    const code = String(error?.response?.data?.code || error?.code || '');
    return status === 401 || status === 403 || /AUTH|TOKEN|FORBIDDEN/.test(code);
  }

  scheduleReconnect(userId, version) {
    if (!this.shouldReconnect || version !== this.connectionVersion || this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.shouldReconnect = false;
      this.emit('max_retries_reached', {});
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(30000, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));
    console.log(`Attempting SSE reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection(userId, version).catch(() => {});
    }, delay);
  }

  stopEventSource() {
    if (!this.eventSource) return;
    this.eventSource.onerror = null;
    this.eventSource.close();
    this.eventSource = null;
  }

  stopTransport() {
    this.stopEventSource();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnected = false;
  }

  handleMessage(data) {
    if (data.type && this.listeners.has(data.type)) {
      this.emit(data.type, data.payload);
    }
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);

    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  emit(eventType, data) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in SSE listener for ${eventType}:`, err);
        }
      });
    }
  }

  close() {
    this.shouldReconnect = false;
    this.connectionVersion += 1;
    this.stopTransport();
    this.listeners.clear();
    this.userId = null;
    this.reconnectAttempts = 0;
  }

  getStatus() {
    return this.isConnected;
  }
}

export const realtimeService = new RealtimeService();

function getUserIdFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const rawPayload = token.split('.')[1];
    if (!rawPayload) return null;
    const payloadBase64 = rawPayload.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(rawPayload.length / 4) * 4, '=');
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    return parseInt(payload.id || payload.userId, 10);
  } catch (e) {
    return null;
  }
}

export const useInstructorRealtime = () => {
  const token = localStorage.getItem('token');
  const userId = getUserIdFromToken();

  const [notifications, setNotifications] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !userId) return;

    const unsubNotifications = realtimeService.subscribe('notification', (data) => {
      setNotifications(prev => [data, ...prev.slice(0, 49)]);
      if (data.type === 'discussion_pending') {
        setPendingCount(prev => prev + 1);
      }
    });

    const unsubDiscussion = realtimeService.subscribe('discussion_update', (data) => {
      setNotifications(prev => [{ type: 'discussion_update', ...data }, ...prev.slice(0, 49)]);
      setPendingCount(prev => prev + 1);
    });

    const unsubEnrollment = realtimeService.subscribe('student_enrollment', (data) => {
      setNotifications(prev => [{ type: 'student_enrollment', ...data }, ...prev.slice(0, 49)]);
    });

    const unsubQuiz = realtimeService.subscribe('quiz_submission', (data) => {
      setNotifications(prev => [{ type: 'quiz_submission', ...data }, ...prev.slice(0, 49)]);
    });

    const unsubCourse = realtimeService.subscribe('course_update', (data) => {
      setNotifications(prev => [{ type: 'course_update', ...data }, ...prev.slice(0, 49)]);
    });

    const unsubConnected = realtimeService.subscribe('connected', () => setIsConnected(true));
    const unsubError = realtimeService.subscribe('error', () => setIsConnected(false));
    const unsubMaxRetries = realtimeService.subscribe('max_retries_reached', () => setIsConnected(false));
    const unsubAuthError = realtimeService.subscribe('auth_error', () => setIsConnected(false));

    realtimeService.connect(userId).catch(err => {
      console.error('Failed to connect instructor realtime:', err);
    });

    return () => {
      unsubNotifications();
      unsubDiscussion();
      unsubEnrollment();
      unsubQuiz();
      unsubCourse();
      unsubConnected();
      unsubError();
      unsubMaxRetries();
      unsubAuthError();
      realtimeService.close();
    };
  }, [token, userId]);

  const markNotificationRead = useCallback((index) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    pendingCount,
    isConnected,
    markNotificationRead,
    clearNotifications
  };
};

export { getUserIdFromToken };
export { RealtimeService };
