import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext';
import ProfilePage from '../src/modules/profile/pages/ProfilePage';
import * as authService from '../src/modules/auth/services/auth.service';

const mockNavigate = vi.fn();
const mockRefreshProfile = vi.fn();

const mockUser = {
  id: 4,
  username: 'quocanh',
  fullName: 'Nguyễn Dũng Quốc Anh',
  email: 'quocanh@example.com',
  roleId: 3,
  profilePictureUrl: '',
  created_date: '2026-01-01'
};

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../src/components/common/Header', () => ({
  default: () => <header data-testid="mock-header">Header</header>
}));

vi.mock('../src/components/common/Footer', () => ({
  default: () => <footer data-testid="mock-footer">Footer</footer>
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    refreshProfile: mockRefreshProfile
  })
}));

vi.mock('../src/context/GamificationContext', () => ({
  useGamification: () => ({
    badges: [],
    badgesError: null,
    isGamificationLoading: false,
    reloadGamification: vi.fn(),
    triggerBadgeUnlock: vi.fn()
  })
}));

vi.mock('../src/modules/auth/services/auth.service', () => ({
  updateProfileApi: vi.fn(),
  uploadAvatarApi: vi.fn(),
  changePasswordApi: vi.fn(),
  requestPasswordChangeOtpApi: vi.fn(),
  getUserStatsApi: vi.fn().mockResolvedValue({ data: {} })
}));

describe('Profile Password 2-Step OTP Verification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderProfile = () => {
    return render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );
  };

  it('renders Step 1 when switching to password tab and validates password mismatch', async () => {
    renderProfile();

    // Click on "Đổi mật khẩu" tab
    const passwordTabBtn = screen.getByRole('button', { name: /Đổi mật khẩu/i });
    fireEvent.click(passwordTabBtn);

    expect(screen.getByText(/Đổi mật khẩu bảo mật/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập mật khẩu hiện tại/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập mật khẩu mới/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập lại mật khẩu mới để xác nhận/i)).toBeInTheDocument();

    // Enter mismatching passwords
    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu hiện tại/i), {
      target: { value: 'OldPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu mới/i), {
      target: { value: 'NewPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập lại mật khẩu mới để xác nhận/i), {
      target: { value: 'Mismatch123!' }
    });

    const submitBtn = screen.getByText(/^Đổi mật khẩu$/i, { selector: 'button.save-btn' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Mật khẩu mới và xác nhận mật khẩu không khớp/i)).toBeInTheDocument();
    });

    expect(authService.requestPasswordChangeOtpApi).not.toHaveBeenCalled();
  });

  it('submits Step 1 and advances to Step 2 OTP verification upon success', async () => {
    authService.requestPasswordChangeOtpApi.mockResolvedValueOnce({
      success: true,
      message: 'Mã xác thực OTP đã được gửi đến Gmail của bạn. Vui lòng kiểm tra hộp thư.'
    });

    renderProfile();

    const passwordTabBtn = screen.getByRole('button', { name: /Đổi mật khẩu/i });
    fireEvent.click(passwordTabBtn);

    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu hiện tại/i), {
      target: { value: 'OldPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu mới/i), {
      target: { value: 'NewPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập lại mật khẩu mới để xác nhận/i), {
      target: { value: 'NewPass123!' }
    });

    const submitBtn = screen.getByText(/^Đổi mật khẩu$/i, { selector: 'button.save-btn' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.requestPasswordChangeOtpApi).toHaveBeenCalledWith({
        oldPassword: 'OldPass123!',
        newPassword: 'NewPass123!'
      });
    });

    // Verify Step 2 UI is shown
    await waitFor(() => {
      expect(screen.getByText(/Xác thực mã OTP bảo mật 2 lớp/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(mockUser.email, 'i'))).toBeInTheDocument();
      expect(screen.getByPlaceholderText('------')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Xác nhận đổi mật khẩu/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Quay lại sửa mật khẩu/i })).toBeInTheDocument();
    });
  });

  it('completes password change in Step 2 when 6-digit OTP is entered', async () => {
    authService.requestPasswordChangeOtpApi.mockResolvedValueOnce({
      success: true,
      message: 'Mã xác thực OTP đã được gửi đến Gmail của bạn.'
    });

    authService.changePasswordApi.mockResolvedValueOnce({
      success: true,
      message: 'Đổi mật khẩu thành công! Email xác nhận đã được gửi đến hộp thư của bạn.'
    });

    renderProfile();

    const passwordTabBtn = screen.getByRole('button', { name: /Đổi mật khẩu/i });
    fireEvent.click(passwordTabBtn);

    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu hiện tại/i), {
      target: { value: 'OldPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu mới/i), {
      target: { value: 'NewPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập lại mật khẩu mới để xác nhận/i), {
      target: { value: 'NewPass123!' }
    });

    fireEvent.click(screen.getByText(/^Đổi mật khẩu$/i, { selector: 'button.save-btn' }));

    // Wait for Step 2
    await waitFor(() => {
      expect(screen.getByPlaceholderText('------')).toBeInTheDocument();
    });

    const otpInput = screen.getByPlaceholderText('------');
    fireEvent.change(otpInput, { target: { value: '889900' } });

    const confirmBtn = screen.getByRole('button', { name: /Xác nhận đổi mật khẩu/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(authService.changePasswordApi).toHaveBeenCalledWith({
        oldPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
        otp: '889900'
      });
    });

    // Returns to Step 1 upon success
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Nhập mật khẩu hiện tại/i)).toBeInTheDocument();
      expect(screen.getByText(/Đổi mật khẩu thành công!/i)).toBeInTheDocument();
    });
  });

  it('allows user to navigate back to Step 1 to revise passwords', async () => {
    authService.requestPasswordChangeOtpApi.mockResolvedValueOnce({ success: true });

    renderProfile();

    const passwordTabBtn = screen.getByRole('button', { name: /Đổi mật khẩu/i });
    fireEvent.click(passwordTabBtn);

    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu hiện tại/i), {
      target: { value: 'OldPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu mới/i), {
      target: { value: 'NewPass123!' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nhập lại mật khẩu mới để xác nhận/i), {
      target: { value: 'NewPass123!' }
    });

    fireEvent.click(screen.getByText(/^Đổi mật khẩu$/i, { selector: 'button.save-btn' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Quay lại sửa mật khẩu/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Quay lại sửa mật khẩu/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Nhập mật khẩu hiện tại/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('------')).not.toBeInTheDocument();
    });
  });
});
