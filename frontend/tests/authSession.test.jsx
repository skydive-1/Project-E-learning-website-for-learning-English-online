import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

describe('=== TASK-AUTH-SESSION-HOTFIX-01: Auth Session & Interceptor Test Suite ===', () => {
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
  // 1. AUTH CONTEXT PROFILE INITIALIZATION
  // =========================================================================
  describe('1. Profile Fetching & Auth Status Flow', () => {
    it('1.1 /auth/profile returns 200 -> user is authenticated and token is preserved', async () => {
      localStorageStore['token'] = 'valid-jwt-token-123';
      vi.spyOn(authService, 'getProfile').mockResolvedValueOnce({
        data: { userId: 1, email: 'student@example.com', roleId: 3, fullName: 'Student A' }
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
      });

      expect(screen.getByTestId('user-email').textContent).toBe('student@example.com');
      expect(localStorageStore['token']).toBe('valid-jwt-token-123');
    });

    it('1.2 /auth/profile returns 401 with TOKEN_EXPIRED -> token is removed and status is unauthenticated', async () => {
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

    it('1.3 /auth/profile returns 500 server error -> token is PRESERVED and status is temporarily_unavailable', async () => {
      localStorageStore['token'] = 'persisted-jwt-token';
      const serverError = new Error('Internal Server Error');
      serverError.response = {
        status: 500,
        data: { success: false, code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ tạm thời' }
      };
      vi.spyOn(authService, 'getProfile').mockRejectedValue(serverError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      }, { timeout: 4000 });

      // Token vẫn còn nguyên trong localStorage
      expect(localStorageStore['token']).toBe('persisted-jwt-token');
      expect(screen.getByTestId('user-email').textContent).toBe('no-user');
    });

    it('1.4 Network Error or Timeout -> token is PRESERVED and allows retry', async () => {
      localStorageStore['token'] = 'network-jwt-token';
      const networkError = new Error('Network Error: Connection refused');
      networkError.code = 'ERR_NETWORK';
      vi.spyOn(authService, 'getProfile').mockRejectedValue(networkError);

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('temporarily_unavailable');
      }, { timeout: 4000 });

      expect(localStorageStore['token']).toBe('network-jwt-token');

      // Thử lại khi mạng phục hồi
      vi.spyOn(authService, 'getProfile').mockResolvedValueOnce({
        data: { userId: 2, email: 'recovered@example.com', roleId: 3 }
      });

      act(() => {
        screen.getByTestId('retry-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
      });

      expect(screen.getByTestId('user-email').textContent).toBe('recovered@example.com');
    });
  });

  // =========================================================================
  // 2. AXIOS INTERCEPTOR & SINGLE FLIGHT LOGOUT
  // =========================================================================
  describe('2. Axios Interceptor Behavior', () => {
    it('2.1 Wrong password on login (401 on /auth/login) does NOT trigger global auth-logout', async () => {
      const logoutListener = vi.fn();
      window.addEventListener('auth-logout', logoutListener);

      const login401Error = {
        response: {
          status: 401,
          data: { success: false, message: 'Email hoặc mật khẩu không chính xác' }
        },
        config: {
          url: '/auth/login',
          headers: {}
        }
      };

      // Gọi qua interceptor handler
      const errorHandler = apiClient.interceptors.response.handlers[0].rejected;
      await expect(errorHandler(login401Error)).rejects.toBeDefined();

      expect(logoutListener).not.toHaveBeenCalled();
      window.removeEventListener('auth-logout', logoutListener);
    });

    it('2.2 Multiple concurrent 401s trigger only a SINGLE auth-logout event (Single Flight Guard)', async () => {
      const logoutListener = vi.fn();
      window.addEventListener('auth-logout', logoutListener);

      const makeExpiredError = (url) => ({
        response: {
          status: 401,
          data: { success: false, code: 'TOKEN_EXPIRED', message: 'Token hết hạn' }
        },
        config: {
          url,
          headers: { Authorization: 'Bearer token-123' }
        }
      });

      const errorHandler = apiClient.interceptors.response.handlers[0].rejected;

      // 3 request 401 đồng thời
      await Promise.allSettled([
        errorHandler(makeExpiredError('/lessons/1')),
        errorHandler(makeExpiredError('/courses/2')),
        errorHandler(makeExpiredError('/user/progress'))
      ]);

      expect(logoutListener).toHaveBeenCalledTimes(1);
      window.removeEventListener('auth-logout', logoutListener);
    });
  });

  // =========================================================================
  // 3. PROTECTED ROUTE INTEGRATION
  // =========================================================================
  describe('3. ProtectedRoute Integration', () => {
    it('3.1 ProtectedRoute does NOT redirect to /login when status is temporarily_unavailable', async () => {
      localStorageStore['token'] = 'valid-token';
      const serverErr = new Error('Server 503');
      serverErr.response = { status: 503, data: { message: 'Service Unavailable' } };
      vi.spyOn(authService, 'getProfile').mockRejectedValue(serverErr);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="secret-dashboard">Private Content</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Không thể kiểm tra phiên đăng nhập/i)).toBeInTheDocument();
      }, { timeout: 4000 });

      // Tuyệt đối không tự nhảy sang màn hình /login
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Thử lại kết nối/i })).toBeInTheDocument();
    });
  });
});
