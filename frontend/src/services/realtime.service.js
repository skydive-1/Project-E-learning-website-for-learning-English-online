import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Real-time SSE Service for Instructor Dashboard
 * Provides Server-Sent Events connection for real-time updates
 */

class RealtimeService {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.userId = null;
  }

  /**
   * Connect to SSE endpoint
   * @param {number} userId - Current user ID
   * @param {string} token - Auth token
   */
  connect(userId, token) {
    if (this.eventSource && this.userId === userId) {
      return Promise.resolve();
    }

    this.userId = userId;
    this.close();

    return new Promise((resolve, reject) => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const sseUrl = `${baseUrl}/instructor/realtime/stream?token=${encodeURIComponent(token)}`;
        
        this.eventSource = new EventSource(sseUrl);

        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', {});
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.warn('Failed to parse SSE message:', err);
          }
        };

        this.eventSource.addEventListener('notification', (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('notification', data);
          } catch (err) {
            console.warn('Failed to parse notification:', err);
          }
        });

        this.eventSource.addEventListener('course_update', (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('course_update', data);
          } catch (err) {
            console.warn('Failed to parse course_update:', err);
          }
        });

        this.eventSource.addEventListener('student_enrollment', (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('student_enrollment', data);
          } catch (err) {
            console.warn('Failed to parse student_enrollment:', err);
          }
        });

        this.eventSource.addEventListener('discussion_update', (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('discussion_update', data);
          } catch (err) {
            console.warn('Failed to parse discussion_update:', err);
          }
        });

        this.eventSource.addEventListener('quiz_submission', (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('quiz_submission', data);
          } catch (err) {
            console.warn('Failed to parse quiz_submission:', err);
          }
        });

        this.eventSource.addEventListener('heartbeat', (event) => {
          this.emit('heartbeat', {});
        });

        this.eventSource.onerror = (err) => {
          console.error('SSE connection error:', err);
          this.isConnected = false;
          this.emit('error', err);
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`Attempting SSE reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
              this.connect(userId, token).catch(() => {});
            }, delay);
          } else {
            this.emit('max_retries_reached', {});
            reject(new Error('Max reconnection attempts reached'));
          }
        };
      } catch (err) {
        reject(err);
      }
    });
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
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.listeners.clear();
    this.userId = null;
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
    const payloadBase64 = token.split('.')[1];
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

    realtimeService.connect(userId, token).catch(err => {
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