import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoadmapDetailPage from '../src/modules/academy/pages/RoadmapDetailPage';
import apiClient from '../src/config/api.config';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../src/components/common/Header', () => ({
  default: () => <header>Header</header>
}));

vi.mock('../src/components/common/Footer', () => ({
  default: () => <footer>Footer</footer>
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'VI', t: (value) => value })
}));

const renderRoute = (path) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/academy/:roadmapId" element={<RoadmapDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Roadmap detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        courses: [
          {
            course_id: 12,
            course_name: 'Phát âm IPA cho người mới',
            subject_id: 4,
            instructor_name: 'E-Learn Academy',
            price: 0,
            thumbnail_url: null
          },
          {
            course_id: 28,
            course_name: 'IELTS Writing nâng cao',
            subject_id: 1,
            instructor_name: 'E-Learn Academy',
            price: 350000,
            thumbnail_url: null
          }
        ]
      }
    });
  });

  it('renders the selected roadmap and only courses from its subject', async () => {
    renderRoute('/academy/basic');

    expect(screen.getByRole('heading', { level: 1, name: 'Tiếng Anh Cơ Bản' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nội dung lộ trình' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /Chuẩn hóa phát âm IPA/i })).toHaveLength(1);

    const courseHeading = await screen.findByRole('heading', { name: 'Phát âm IPA cho người mới' });
    expect(courseHeading).toBeInTheDocument();
    expect(screen.queryByText('IELTS Writing nâng cao')).not.toBeInTheDocument();
    expect(courseHeading.closest('article')).toHaveTextContent('Miễn phí');
    expect(within(courseHeading.closest('article')).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/lessons?courseId=12'
    );
  });

  it('shows a useful empty state when the roadmap has no matching course', async () => {
    apiClient.get.mockResolvedValue({ data: { courses: [] } });
    renderRoute('/academy/toeic');

    expect(await screen.findByRole('heading', { name: 'Khóa học cho lộ trình đang được cập nhật' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem tất cả khóa học' })).toHaveAttribute('href', '/courses');
  });

  it('includes a production course categorized as English Grammar Essentials in the basic roadmap', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        courses: [{
          course_id: 41,
          course_name: 'Tiếng Anh cơ bản',
          subject_id: 5,
          subject_name: 'English Grammar Essentials',
          price: 0
        }]
      }
    });

    renderRoute('/academy/basic');

    const courseHeading = await screen.findByRole('heading', { name: 'Tiếng Anh cơ bản' });
    expect(courseHeading.closest('article')).toHaveTextContent('Miễn phí');
    expect(within(courseHeading.closest('article')).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/lessons?courseId=41'
    );
  });

  it('handles an unknown roadmap without requesting courses', async () => {
    renderRoute('/academy/khong-ton-tai');

    expect(screen.getByRole('heading', { name: 'Không tìm thấy lộ trình' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay lại danh sách lộ trình' })).toHaveAttribute('href', '/academy');
    await waitFor(() => expect(apiClient.get).not.toHaveBeenCalled());
  });
});
