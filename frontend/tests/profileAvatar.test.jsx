import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext';
import ProfilePage from '../src/modules/profile/pages/ProfilePage';
import * as authService from '../src/modules/auth/services/auth.service';

const mockNavigate = vi.fn();
const mockRefreshProfile = vi.fn();

let mockUser = {
  id: 1,
  username: 'teststudent',
  fullName: 'Test Student',
  email: 'student@example.com',
  roleId: 3,
  profilePictureUrl: 'https://example.com/avatar.png',
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
  getUserStatsApi: vi.fn().mockResolvedValue({ data: {} })
}));

describe('Profile Avatar Upload & Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 1,
      username: 'teststudent',
      fullName: 'Test Student',
      email: 'student@example.com',
      roleId: 3,
      profilePictureUrl: 'https://example.com/avatar.png',
      created_date: '2026-01-01'
    };

    authService.updateProfileApi.mockResolvedValue({ status: 'success' });
    authService.uploadAvatarApi.mockResolvedValue({
      status: 'success',
      data: {
        profilePictureUrl: 'https://example.com/new-avatar.png',
        user: { id: 1, username: 'teststudent', profilePictureUrl: 'https://example.com/new-avatar.png' }
      }
    });

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders user avatar image when profilePictureUrl is provided', async () => {
    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );

    const avatarImg = await screen.findByRole('img', { name: /user avatar/i });
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  it('renders user fallback initial when profilePictureUrl is empty', async () => {
    mockUser.profilePictureUrl = '';

    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );

    const fallback = await screen.findByText('T');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveClass('avatar-fallback-large');
  });

  it('successfully handles file upload and refreshes profile', async () => {
    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    const file = new File(['mock content'], 'my-avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(authService.uploadAvatarApi).toHaveBeenCalledWith(file);
      expect(mockRefreshProfile).toHaveBeenCalled();
    });

    expect(await screen.findByText(/cập nhật ảnh đại diện thành công/i)).toBeInTheDocument();
  });

  it('rejects files larger than 5MB without calling upload API', async () => {
    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );

    const fileInput = document.querySelector('input[type="file"]');
    // 6MB file
    const largeFile = new File(['a'.repeat(100)], 'huge.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(await screen.findByText(/kích thước ảnh không được vượt quá 5mb/i)).toBeInTheDocument();
    expect(authService.uploadAvatarApi).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types without calling upload API', async () => {
    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );

    const fileInput = document.querySelector('input[type="file"]');
    const invalidFile = new File(['text'], 'document.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(await screen.findByText(/vui lòng chọn tệp hình ảnh hợp lệ/i)).toBeInTheDocument();
    expect(authService.uploadAvatarApi).not.toHaveBeenCalled();
  });

  it('handles remove avatar button and resets to initial fallback', async () => {
    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );

    const removeBtn = await screen.findByRole('button', { name: /gỡ ảnh/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(authService.updateProfileApi).toHaveBeenCalledWith(expect.objectContaining({
        profilePictureUrl: null
      }));
      expect(mockRefreshProfile).toHaveBeenCalled();
    });

    expect(await screen.findByText(/đã gỡ ảnh đại diện/i)).toBeInTheDocument();
  });

  it('falls back to initials when avatar image fails to load (onError)', async () => {
    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>
    );

    const avatarImg = await screen.findByRole('img', { name: /user avatar/i });
    fireEvent.error(avatarImg);

    expect(await screen.findByText('T')).toBeInTheDocument();
  });
});
