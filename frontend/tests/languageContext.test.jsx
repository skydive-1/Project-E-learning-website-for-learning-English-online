import React, { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';

const LanguageHarness = () => {
  const { language, setLanguage, toggleLanguage, t } = useLanguage();
  const [status, setStatus] = useState('');

  return (
    <main>
      <button type="button" onClick={toggleLanguage}>Switch {language}</button>
      <button type="button" onClick={() => setLanguage('ENG')}>Use English</button>
      <button type="button" onClick={() => setStatus('Đang tải...')}>Load later</button>
      <p>{t('login')}</p>
      <nav aria-label="Admin navigation">
        <span>{t('adminAccounts')}</span>
        <span>{t('adminCourses')}</span>
        <span>{t('adminCreateQuiz')}</span>
        <span>{t('adminSecurity')}</span>
        <span>{t('adminUserAnalytics')}</span>
      </nav>
      <p>Thông tin cá nhân</p>
      <p>Học từ vựng &amp; Đọc sách tiếng Anh</p>
      <p>12 giờ</p>
      <input
        aria-label="Tìm kiếm"
        placeholder="Tìm kiếm khóa học..."
        title="Tìm kiếm khóa học..."
      />
      <output>{status}</output>
    </main>
  );
};

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
    delete document.documentElement.dataset.language;
    document.title = 'E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu';

    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = 'Nền tảng học tiếng Anh trực tuyến hiện đại với lộ trình cá nhân hóa, bài tập tương tác và trợ lý AI thông minh.';
  });

  it('updates keyed and legacy UI copy atomically across text and attributes', async () => {
    render(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>,
    );

    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('Quản lý tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Quản lý khóa học')).toBeInTheDocument();
    expect(screen.getByText('Tạo đề trắc nghiệm (Quiz)')).toBeInTheDocument();
    expect(screen.getByText('Cấu hình bảo mật')).toBeInTheDocument();
    expect(screen.getByText('Phân tích người dùng')).toBeInTheDocument();
    expect(screen.getByText('Thông tin cá nhân')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'vi');

    fireEvent.click(screen.getByRole('button', { name: 'Switch VIE' }));

    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Account management')).toBeInTheDocument();
    expect(screen.getByText('Instructor Panel')).toBeInTheDocument();
    expect(screen.getByText('Create quiz')).toBeInTheDocument();
    expect(screen.getByText('Security configuration')).toBeInTheDocument();
    expect(screen.getByText('User Analytics')).toBeInTheDocument();
    expect(screen.getByText('Personal information')).toBeInTheDocument();
    expect(screen.getByText('Learn vocabulary & Read English books')).toBeInTheDocument();
    expect(screen.getByText('12 hours')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveAttribute('placeholder', 'Search courses...');
    expect(screen.getByRole('textbox')).toHaveAttribute('title', 'Search courses...');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.documentElement).toHaveAttribute('data-language', 'eng');
    expect(document.title).toBe('E-Learn Academy - Leading Online English Learning Platform');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'A modern online English learning platform with personalized learning paths, interactive exercises, and a smart AI tutor.',
    );

    await waitFor(() => expect(window.localStorage.getItem('language')).toBe('ENG'));
  });

  it('translates UI mounted asynchronously and restores the original Vietnamese copy', async () => {
    render(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load later' }));

    expect(await screen.findByText('Loading...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch ENG' }));

    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
    expect(screen.getByText('Quản lý tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Quản lý khóa học')).toBeInTheDocument();
    expect(screen.getByText('Thông tin cá nhân')).toBeInTheDocument();
    expect(screen.getByText('Học từ vựng & Đọc sách tiếng Anh')).toBeInTheDocument();
    expect(screen.getByText('12 giờ')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'vi');
    expect(document.title).toBe('E-Learn Academy - Nền Tảng Học Tiếng Anh Trực Tuyến Hàng Đầu');
  });

  it('ignores an invalid stored language and falls back to Vietnamese', () => {
    window.localStorage.setItem('language', 'UNKNOWN');

    render(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>,
    );

    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'vi');
  });
});
