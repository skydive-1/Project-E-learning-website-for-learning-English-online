import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
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

const DetailRouteProbe = () => {
  const { roadmapId } = useParams();
  return <h1>Trang chi tiết {roadmapId}</h1>;
};

describe('Roadmap detail navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver = IntersectionObserverMock;
    window.IntersectionObserver = IntersectionObserverMock;
    apiClient.get.mockResolvedValue({ data: { courses: [] } });
  });

  it('opens the full detail route for the selected roadmap', async () => {
    render(
      <MemoryRouter initialEntries={['/academy']}>
        <Routes>
          <Route path="/academy" element={<RoadmapPage />} />
          <Route path="/academy/:roadmapId" element={<DetailRouteProbe />} />
        </Routes>
      </MemoryRouter>
    );

    const roadmapCards = screen.getAllByRole('article');
    expect(roadmapCards).toHaveLength(3);
    await waitFor(() => expect(roadmapCards[0]).toHaveTextContent('0 courses'));

    fireEvent.click(screen.getAllByRole('button', { name: /Xem chi tiết lộ trình/i })[0]);

    expect(await screen.findByRole('heading', { name: 'Trang chi tiết basic' })).toBeInTheDocument();
  });
});
