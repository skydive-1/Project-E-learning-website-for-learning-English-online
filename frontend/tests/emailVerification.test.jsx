import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VerifyEmailPage from '../src/modules/auth/pages/VerifyEmailPage';
import * as authService from '../src/modules/auth/services/auth.service';

vi.mock('../src/modules/auth/services/auth.service', async () => {
  const actual = await vi.importActual('../src/modules/auth/services/auth.service');
  return {
    ...actual,
    verifyEmailApi: vi.fn(),
    resendVerificationEmailApi: vi.fn()
  };
});

const renderPage = (initialEntry) => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/login" element={<div>Trang đăng nhập</div>} />
    </Routes>
  </MemoryRouter>
);

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies a token from the link and removes it from the visible route', async () => {
    const token = 'a'.repeat(64);
    authService.verifyEmailApi.mockResolvedValue({
      message: 'Email đã được xác minh.'
    });

    renderPage(`/verify-email?token=${token}`);

    expect(screen.getByText('Đang kiểm tra liên kết...')).toBeInTheDocument();
    await waitFor(() => expect(authService.verifyEmailApi).toHaveBeenCalledWith({ token }));
    expect(await screen.findByText('Xác minh thành công')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng nhập ngay' })).toBeInTheDocument();
  });

  it('resends verification using the email carried from registration', async () => {
    authService.resendVerificationEmailApi.mockResolvedValue({
      message: 'Yêu cầu gửi lại đã được tiếp nhận.'
    });

    renderPage({
      pathname: '/verify-email',
      state: { email: 'student@gmail.com', deliveryAccepted: true }
    });

    expect(screen.getByLabelText('Email đăng ký')).toHaveValue('student@gmail.com');
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại email xác minh' }));

    await waitFor(() => {
      expect(authService.resendVerificationEmailApi).toHaveBeenCalledWith({ email: 'student@gmail.com' });
    });
    expect(await screen.findByText('Yêu cầu đã được tiếp nhận')).toBeInTheDocument();
  });
});
