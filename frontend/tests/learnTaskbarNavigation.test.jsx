import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const authState = vi.hoisted(() => ({ user: null }));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => authState
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => ({ home: 'Trang chủ', learn: 'Học tập', roadmap: 'Lộ trình', login: 'Đăng nhập' }[key] || key)
  })
}));

import MobileBottomNav from '../src/components/common/MobileBottomNav';

const CourseRoute = () => {
  const location = useLocation();
  return (
    <div>
      <span>Trang khóa học</span>
      <span data-testid="course-tab-state">{location.state?.activeHubTab || ''}</span>
    </div>
  );
};

const renderTaskbar = () => render(
  <MemoryRouter initialEntries={['/']}>
    <MobileBottomNav />
    <Routes>
      <Route path="/" element={<div>Trang chủ</div>} />
      <Route path="/courses" element={<CourseRoute />} />
    </Routes>
  </MemoryRouter>
);

describe('Learn taskbar navigation', () => {
  beforeEach(() => {
    authState.user = null;
  });

  it('navigates guests to the course page', () => {
    renderTaskbar();
    fireEvent.click(screen.getByRole('link', { name: 'Học tập' }));
    expect(screen.getByText('Trang khóa học')).toBeInTheDocument();
    expect(screen.getByTestId('course-tab-state')).toHaveTextContent('course');
  });

  it('navigates signed-in users to the same course page', () => {
    authState.user = { userId: 1 };
    renderTaskbar();
    fireEvent.click(screen.getByRole('link', { name: 'Học tập' }));
    expect(screen.getByText('Trang khóa học')).toBeInTheDocument();
    expect(screen.getByTestId('course-tab-state')).toHaveTextContent('course');
  });
});
