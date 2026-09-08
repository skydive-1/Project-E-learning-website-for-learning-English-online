import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  post: vi.fn()
}));

const themeMock = vi.hoisted(() => ({
  value: 'light'
}));

vi.mock('../src/config/api.config', () => ({
  default: apiMocks
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'VIE' })
}));

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ theme: themeMock.value })
}));

vi.mock('../src/components/common/ProtectedVideo', () => ({
  default: ({ assetId, ...props }) => <video data-asset-id={assetId} {...props} />
}));

import Footer from '../src/components/common/Footer';

describe('Footer project navigation', () => {
  beforeEach(() => {
    apiMocks.post.mockReset();
    themeMock.value = 'light';
  });

  it('shows only routes and homepage sections that exist in the project', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Chương trình học' })).toHaveAttribute('href', '/courses');
    expect(screen.getByRole('link', { name: 'Lộ trình Academy' })).toHaveAttribute('href', '/academy');
    expect(screen.getByRole('link', { name: 'Luyện tập Quiz' })).toHaveAttribute('href', '/quizzes');
    expect(screen.getByRole('link', { name: 'Khóa học của tôi' })).toHaveAttribute('href', '/my-courses');
    expect(screen.getByRole('link', { name: 'Đội ngũ phát triển' })).toHaveAttribute('href', '/#team');
    expect(screen.getByRole('link', { name: 'Phân tích học tập' })).toHaveAttribute('href', '/analytics');
    expect(screen.getByRole('link', { name: 'Hỗ trợ & Hỏi đáp' })).toHaveAttribute('href', '/#faq');

    expect(screen.queryByText('Tính năng AI')).not.toBeInTheDocument();
    expect(screen.queryByText('Giới thiệu')).not.toBeInTheDocument();
    expect(screen.queryByText('Bảo mật nội dung')).not.toBeInTheDocument();
    expect(screen.queryByText('Dành cho những ai muốn bứt phá phản xạ tiếng Anh cùng Trợ lý AI cá nhân hóa.')).not.toBeInTheDocument();
    expect(screen.queryByText('Chính sách bảo mật')).not.toBeInTheDocument();
    expect(screen.queryByText('Điều khoản dịch vụ')).not.toBeInTheDocument();
    expect(screen.queryByText('Cookies')).not.toBeInTheDocument();

    expect(screen.getByText('Cập nhật tin tức')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Địa chỉ email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng ký' })).toBeInTheDocument();
    expect(document.querySelector('video[data-asset-id="mascot-idle-light"]')).toBeInTheDocument();
  });

  it('uses the dedicated dark mascot video in dark mode', () => {
    themeMock.value = 'dark';

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(document.querySelector('footer[data-theme="dark"]')).toBeInTheDocument();
    expect(document.querySelector('video[data-asset-id="mascot-sleep-dark"]')).toBeInTheDocument();
  });

  it('registers the footer email through the consultation backend', async () => {
    apiMocks.post.mockResolvedValueOnce({ data: { success: true } });

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Địa chỉ email' }), {
      target: { value: '  student@example.com  ' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith('/consultation/register', {
        fullname: 'Học viên E-Learn',
        email: 'student@example.com'
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Đăng ký thành công');
  });

  it('validates the email before calling the backend', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Địa chỉ email' }), {
      target: { value: 'email-khong-hop-le' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập địa chỉ email hợp lệ.');
    expect(apiMocks.post).not.toHaveBeenCalled();
  });

  it('shows the backend error and keeps the entered email for retry', async () => {
    apiMocks.post.mockRejectedValueOnce({
      response: { data: { message: 'Email này đã được đăng ký.' } }
    });

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const emailInput = screen.getByRole('textbox', { name: 'Địa chỉ email' });
    fireEvent.change(emailInput, { target: { value: 'student@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email này đã được đăng ký.');
    expect(emailInput).toHaveValue('student@example.com');
  });
});
