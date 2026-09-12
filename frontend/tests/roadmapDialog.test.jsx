import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    apiClient.get.mockResolvedValue({
      data: {
        courses: [{
          course_id: 41,
          course_name: 'Tiếng Anh cơ bản',
          subject_id: 5,
          subject_name: 'English Grammar Essentials'
        }]
      }
    });
  });

  it('opens the full detail route for the selected roadmap', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/academy']}>
          <Routes>
            <Route path="/academy" element={<RoadmapPage />} />
            <Route path="/academy/:roadmapId" element={<DetailRouteProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const roadmapCards = screen.getAllByRole('article');
    expect(roadmapCards).toHaveLength(3);
    await waitFor(() => expect(roadmapCards[0]).toHaveTextContent('1 khóa học'));
    expect(within(roadmapCards[0]).getByRole('link', { name: 'Tiếng Anh cơ bản' })).toHaveAttribute(
      'href',
      '/lessons?courseId=41'
    );
    expect(within(roadmapCards[0]).getByRole('link', { name: 'Xem tất cả khóa học' })).toHaveAttribute(
      'href',
      '/courses?roadmap=basic'
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Xem chi tiết lộ trình/i })[0]);

    expect(await screen.findByRole('heading', { name: 'Trang chi tiết basic' })).toBeInTheDocument();
  });
});
