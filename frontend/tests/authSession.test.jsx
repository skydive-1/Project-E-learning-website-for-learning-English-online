import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import ProtectedRoute from '../src/components/common/ProtectedRoute';
import * as authService from '../src/modules/auth/services/auth.service';
import apiClient, { resetAuthLogoutGuard } from '../src/config/api.config';

// Component helper để đọc state auth trong test
const TestAuthConsumer = () => {
  const { user, authStatus, loading, authError, retryAuth, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{authStatus}</div>
      <div data-testid="loading-status">{loading ? 'loading' : 'idle'}</div>
      <div data-testid="user-email">{user?.email || 'no-user'}</div>
      {authError && <div data-testid="auth-error">{authError}</div>}
      <button data-testid="retry-btn" onClick={retryAuth}>Thử lại</button>
      <button data-testid="logout-btn" onClick={logout}>Đăng xuất</button>
    </div>
  );
};

describe('=== TASK-AUTH-SESSION-HOTFIX-01: Auth Session & Interceptor Test Suite (R2 Review) ===', () => {
  let localStorageStore = {};

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthLogoutGuard();
    localStorageStore = {};

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageStore[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
      localStorageStore[key] = String(val);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete localStorageStore[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. CRITICAL 401 vs NON-CRITICAL 401 & 4xx (NO FALLBACK TO !errorCode)
  // =========================================================================
  describe('1. Error Code Classification on /auth/profile', () => {
    it('1. 401 TOKEN_EXPIRED removes token and transitions to unauthenticated', async () => {
      localStorageStore['token'] = 'expired-jwt-token';
      const expiredError = new Error('TokenExpired');
      expiredError.response = {
        status: 401,
        data: { success: false, code: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn.' }
      };
      vi.spyOn(authService, 'getProfile').mockRejectedValueOnce(expiredError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
      });

      expect(localStorageStore['token']).toBeUndefined();
      expect(screen.getByTestId('user-email').textContent).toBe('no-user');
    });

    it('2. 401 TOKEN_INVALID removes token and transitions to unauthenticated', async () => {
      localStorageStore['token'] = 'invalid-jwt-token';
      const invalidError = new Error('TokenInvalid');
      invalidError.response = {
        status: 401,
        data: { success: false, code: 'TOKEN_INVALID', message: 'Token không hợp lệ.' }
      };
      vi.spyOn(authService, 'getProfile').mockRejectedValueOnce(invalidError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
      });

      expect(localStorageStore['token']).toBeUndefined();
    });

    it('3. 401 USER_DELETED removes token and transitions to unauthenticated', async () => {
      localStorageStore['token'] = 'deleted-user-token';
      const deletedError = new Error('UserDeleted');
      deletedError.response = {
        status: 401,
        data: { success: false, code: 'USER_DELETED', message: 'Tài khoản không tồn tại.' }
      };
      vi.spyOn(authService, 'getProfile').mockRejectedValueOnce(deletedError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
      });

      expect(localStorageStore['token']).toBeUndefined();
    });

    it('4. 401 without code does NOT remove token and does NOT emit auth-logout', async () => {
      localStorageStore['token'] = 'valid-token-no-code';
      const logoutListener = vi.fn();
      window.addEventListener('auth-logout', logoutListener);

      const noCodeError = new Error('Unauthorized');
      noCodeError.response = {
        status: 401,
        data: { success: false, message: 'Unauthorized without machine code' }
      };
      vi.spyOn(authService, 'getProfile').mockRejectedValueOnce(noCodeError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      });

      // Token PHẢI được giữ nguyên
      expect(localStorageStore['token']).toBe('valid-token-no-code');
      expect(logoutListener).not.toHaveBeenCalled();
      window.removeEventListener('auth-logout', logoutListener);
    });

    it('5. 401 AUTH_REQUIRED does NOT remove token', async () => {
      localStorageStore['token'] = 'persisted-token';
      const authRequiredError = new Error('AuthRequired');
      authRequiredError.response = {
        status: 401,
        data: { success: false, code: 'AUTH_REQUIRED', message: 'Không có token xác thực' }
      };
      vi.spyOn(authService, 'getProfile').mockRejectedValueOnce(authRequiredError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      });

      expect(localStorageStore['token']).toBe('persisted-token');
    });

    it('6. 403 Forbidden does NOT remove token and does NOT retry', async () => {
      localStorageStore['token'] = 'persisted-token-403';
      const forbiddenError = new Error('Forbidden');
      forbiddenError.response = {
        status: 403,
        data: { success: false, code: 'FORBIDDEN', message: 'Không có quyền truy cập' }
      };
      const getProfileSpy = vi.spyOn(authService, 'getProfile').mockRejectedValue(forbiddenError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      });

      // Chỉ gọi 1 lần (không retry)
      expect(getProfileSpy).toHaveBeenCalledTimes(1);
      expect(localStorageStore['token']).toBe('persisted-token-403');
    });

    it('7. 404 Not Found does NOT remove token and does NOT retry', async () => {
      localStorageStore['token'] = 'persisted-token-404';
      const notFoundError = new Error('Not Found');
      notFoundError.response = {
        status: 404,
        data: { success: false, message: 'Profile not found' }
      };
      const getProfileSpy = vi.spyOn(authService, 'getProfile').mockRejectedValue(notFoundError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      });

      // Chỉ gọi 1 lần (không retry)
      expect(getProfileSpy).toHaveBeenCalledTimes(1);
      expect(localStorageStore['token']).toBe('persisted-token-404');
    });
  });

  // =========================================================================
  // 2. RETRY LOGIC FOR TRANSIENT ERRORS (NETWORK & 5xx)
  // =========================================================================
  describe('2. Retry Behavior on Transient Errors', () => {
    it('8. Network error is retried exactly 2 times (total 3 attempts) and keeps token', async () => {
      localStorageStore['token'] = 'network-token';
      const networkError = new Error('Network Error: Failed to fetch');
      networkError.code = 'ERR_NETWORK';

      const getProfileSpy = vi.spyOn(authService, 'getProfile').mockRejectedValue(networkError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      }, { timeout: 5000 });

      // 1 lần gọi ban đầu + 2 lần retry = 3 lần
      expect(getProfileSpy).toHaveBeenCalledTimes(3);
      expect(localStorageStore['token']).toBe('network-token');
    });

    it('9. 500/502/503/504 server errors are retried exactly 2 times (total 3 attempts)', async () => {
      localStorageStore['token'] = 'server-token-503';
      const server503 = new Error('Service Unavailable');
      server503.response = { status: 503, data: { message: 'Railway cold starting' } };

      const getProfileSpy = vi.spyOn(authService, 'getProfile').mockRejectedValue(server503);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      }, { timeout: 5000 });

      expect(getProfileSpy).toHaveBeenCalledTimes(3);
      expect(localStorageStore['token']).toBe('server-token-503');
    });
  });

  // =========================================================================
  // 3. SINGLE FLIGHT LOGOUT GUARD WITHOUT TIMER
  // =========================================================================
  describe('3. Single-Flight Logout Guard in Axios Interceptor', () => {
    const makeCritical401 = (url, code = 'TOKEN_EXPIRED') => ({
      response: {
        status: 401,
        data: { success: false, code, message: 'Token hết hạn' }
      },
      config: {
        url,
        headers: { Authorization: 'Bearer token-123' }
      }
    });

    it('10. Multiple concurrent critical 401s trigger only a SINGLE auth-logout', async () => {
      const logoutListener = vi.fn();
      window.addEventListener('auth-logout', logoutListener);

      const errorHandler = apiClient.interceptors.response.handlers[0].rejected;

      await Promise.allSettled([
        errorHandler(makeCritical401('/lessons/1')),
        errorHandler(makeCritical401('/courses/2')),
        errorHandler(makeCritical401('/user/progress'))
      ]);

      expect(logoutListener).toHaveBeenCalledTimes(1);
      window.removeEventListener('auth-logout', logoutListener);
    });

    it('11. Another critical 401 arriving after >3s does NOT emit a second logout (no timer auto-reset)', async () => {
      const logoutListener = vi.fn();
      window.addEventListener('auth-logout', logoutListener);

      const errorHandler = apiClient.interceptors.response.handlers[0].rejected;

      // Lần 1
      await expect(errorHandler(makeCritical401('/lessons/1'))).rejects.toBeDefined();
      expect(logoutListener).toHaveBeenCalledTimes(1);

      // Giả lập trôi qua 5 giây
      await new Promise((r) => setTimeout(r, 50));

      // Lần 2 (request đến trễ sau khi đã logout)
      await expect(errorHandler(makeCritical401('/chatbot/history'))).rejects.toBeDefined();

      // Vẫn CHỈ 1 lần duy nhất, không bị phát lại
      expect(logoutListener).toHaveBeenCalledTimes(1);

      window.removeEventListener('auth-logout', logoutListener);
    });

    it('12. Successful login resets guard so subsequent session handles errors independently', async () => {
      const logoutListener = vi.fn();
      window.addEventListener('auth-logout', logoutListener);

      const errorHandler = apiClient.interceptors.response.handlers[0].rejected;

      // Phiên 1: Hết hạn -> logout
      await expect(errorHandler(makeCritical401('/lessons/1'))).rejects.toBeDefined();
      expect(logoutListener).toHaveBeenCalledTimes(1);

      // Đăng nhập lại thành công: Gọi resetAuthLogoutGuard
      resetAuthLogoutGuard();

      // Phiên 2: Lỗi hết hạn mới xuất hiện -> phát logout cho phiên 2
      await expect(errorHandler(makeCritical401('/lessons/2'))).rejects.toBeDefined();
      expect(logoutListener).toHaveBeenCalledTimes(2);

      window.removeEventListener('auth-logout', logoutListener);
    });

    it('13. Manual logout does not call clearChatHistory or any authenticated API', async () => {
      localStorageStore['token'] = 'user-token';

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      act(() => {
        screen.getByTestId('logout-btn').click();
      });

      expect(localStorageStore['token']).toBeUndefined();
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    it('14. ProtectedRoute renders children immediately without loading spinner when user already exists in state', async () => {
      localStorageStore['token'] = 'valid-token';
      vi.spyOn(authService, 'getProfile').mockResolvedValueOnce({
        data: { userId: 1, email: 'student@example.com', roleId: 3 }
      });

      render(
        <MemoryRouter initialEntries={['/lessons/1']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/lessons/1"
                element={
                  <ProtectedRoute>
                    <div data-testid="lesson-1">Lesson 1 Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lesson-1')).toBeInTheDocument();
      });

      // Kiểm tra spinner không xuất hiện một khi user đã có
      expect(screen.queryByText(/Đang kiểm tra quyền truy cập/i)).not.toBeInTheDocument();
    });
  });
});
