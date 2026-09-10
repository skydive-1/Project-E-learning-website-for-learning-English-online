import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoadmapPage from '../src/modules/academy/pages/RoadmapPage';
import apiClient from '../src/config/api.config';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../src/components/common/Header', () => ({
  default: () => <header data-testid="header">Header</header>
}));

vi.mock('../src/components/common/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (value) => value })
}));

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('Roadmap detail dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver = IntersectionObserverMock;
    window.IntersectionObserver = IntersectionObserverMock;
    apiClient.get.mockResolvedValue({ data: { courses: [] } });
  });

  it('renders above the fixed header and closes from the visible X button', async () => {
    render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>
    );

    const roadmapCards = screen.getAllByRole('article');
    expect(roadmapCards).toHaveLength(3);
    await waitFor(() => expect(roadmapCards[0]).toHaveTextContent('0 courses'));

    fireEvent.click(screen.getAllByRole('button', { name: /Xem chi tiết lộ trình/i })[0]);

    const dialog = await screen.findByRole('dialog');
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(dialog).toHaveClass('z-[1100]');
    expect(dialog).toHaveClass('max-h-[calc(100dvh-2rem)]');
    expect(overlay).toHaveClass('z-[1100]');
    expect(screen.getByRole('heading', { name: 'Tiếng Anh Cơ Bản' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
