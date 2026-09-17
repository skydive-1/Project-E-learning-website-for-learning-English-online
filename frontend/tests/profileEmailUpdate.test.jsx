import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext';
import ProfilePage from '../src/modules/profile/pages/ProfilePage';
import * as authService from '../src/modules/auth/services/auth.service';

const mockNavigate = vi.fn();
const mockRefreshProfile = vi.fn();

const mockUser = {
  id: 57,
  username: 'Nguyen Lý',
  fullName: 'Nguyen Lý',
  email: 'nly85304@gmail.com',
  roleId: 3,
  profilePictureUrl: '',
  createdDate: '2026-09-16T02:08:13.047Z'
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

describe('Profile Email Editing & Joined Date Display', () => {
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

  it('renders email input as editable and formats joined date properly without "Chưa xác định"', () => {
    renderProfile();

    const emailInput = screen.getByLabelText(/Địa chỉ Email/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).not.toBeDisabled();
    expect(emailInput.value).toBe('nly85304@gmail.com');

    // Joined date should not be 'Chưa xác định'
    const joinedInput = screen.getByDisplayValue(/2026/);
    expect(joinedInput).toBeInTheDocument();
    expect(joinedInput).toBeDisabled();
    expect(screen.queryByDisplayValue('Chưa xác định')).toBeNull();
  });

  it('submits profile with updated email and triggers refreshProfile', async () => {
    authService.updateProfileApi.mockResolvedValueOnce({
      success: true,
      data: {
        ...mockUser,
        email: 'newemail85304@gmail.com'
      }
    });

    renderProfile();

    const emailInput = screen.getByLabelText(/Địa chỉ Email/i);
    fireEvent.change(emailInput, { target: { value: 'newemail85304@gmail.com' } });
    expect(emailInput.value).toBe('newemail85304@gmail.com');

    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.updateProfileApi).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newemail85304@gmail.com',
          username: 'Nguyen Lý',
          fullName: 'Nguyen Lý'
        })
      );
    });

    expect(mockRefreshProfile).toHaveBeenCalled();
  });
});
