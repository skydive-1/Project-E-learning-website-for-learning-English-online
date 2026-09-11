import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 7 } })
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: value => value })
}));

import MobileBottomNav from '../src/components/common/MobileBottomNav';

const NavigationFixture = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/courses')}>Mở khóa học</button>
      <button type="button" onClick={() => navigate('/lessons/12')}>Mở bài học</button>
      <MobileBottomNav />
    </>
  );
};

describe('MobileBottomNav hook order', () => {
  it('keeps the same hooks when navigating from a hidden lesson route to /courses', () => {
    render(
      <MemoryRouter initialEntries={['/lessons/12']}>
        <NavigationFixture />
      </MemoryRouter>
    );

    expect(screen.queryByRole('navigation', { name: 'Mobile Navigation Bar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mở khóa học' }));
    expect(screen.getByRole('navigation', { name: 'Mobile Navigation Bar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mở bài học' }));
    expect(screen.queryByRole('navigation', { name: 'Mobile Navigation Bar' })).not.toBeInTheDocument();
  });
});
