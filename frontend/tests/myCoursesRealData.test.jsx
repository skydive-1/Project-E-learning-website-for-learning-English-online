import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from '../src/config/api.config';
import MyCoursesPage from '../src/modules/courses/pages/MyCoursesPage';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../src/components/common/Header', () => ({
  default: () => <div data-testid="header" />
}));

vi.mock('../src/components/common/Footer', () => ({
  default: () => <div data-testid="footer" />
}));

vi.mock('../src/modules/lessons/services/lessons.service', () => ({
  getCourseDetails: vi.fn(),
  getUserIdFromToken: vi.fn()
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyCoursesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MyCoursesPage real-data states', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('hiển thị empty state thật khi API trả danh sách rỗng', async () => {
    apiClient.get.mockResolvedValue({ data: { courses: [] } });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Bạn chưa đăng ký khóa học nào' })).toBeInTheDocument();
    expect(screen.queryByText('IELTS Masterclass: Target Band 7.5+')).not.toBeInTheDocument();
    expect(screen.queryByText(/mock-/i)).not.toBeInTheDocument();
  });

  it('hiển thị lỗi và retry thay vì biến API error thành danh sách mock', async () => {
    apiClient.get.mockRejectedValue(new Error('Database unavailable'));

    renderPage();

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Không thể tải khóa học của bạn');
    expect(errorAlert).toHaveTextContent('Vui lòng kiểm tra kết nối mạng và bấm thử lại.');

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('IELTS Masterclass: Target Band 7.5+')).not.toBeInTheDocument();
  });

  it('hiển thị chính xác số chương, số bài học và phân loại khóa 100% vào tab Đã hoàn thành', async () => {
    const { getCourseDetails } = await import('../src/modules/lessons/services/lessons.service');
    apiClient.get.mockResolvedValue({
      data: {
        courses: [
          {
            course_id: 48,
            course_name: 'Phát âm cơ bản - Phụ âm và âm cuối',
            instructor_name: 'Nihooma',
            thumbnail_url: '/images/hero_illustration.png',
            subject_name: 'Tiếng Anh',
            sections_count: 2,
            lessons_count: 3
          }
        ]
      }
    });

    getCourseDetails.mockResolvedValue({
      id: '48',
      title: 'Phát âm cơ bản - Phụ âm và âm cuối',
      instructor: 'Nihooma',
      progress: 100,
      sectionsCount: 2,
      lessonsCount: 3,
      sections: [
        { id: '1', title: 'Chương 1', lessons: [{ id: '159' }, { id: '160' }] },
        { id: '2', title: 'Chương 2', lessons: [{ id: '161' }] }
      ]
    });

    renderPage();

    // Xác nhận khóa học và thông tin số chương, số bài học
    expect(await screen.findByText('Phát âm cơ bản - Phụ âm và âm cuối')).toBeInTheDocument();
    expect(await screen.findByText(/2 chương/i)).toBeInTheDocument();
    expect(await screen.findByText(/3 bài học/i)).toBeInTheDocument();
    expect(screen.getByText('Ôn tập lại')).toBeInTheDocument();

    // Chuyển sang tab "Đã hoàn thành"
    const completedTab = screen.getByRole('button', { name: /Đã hoàn thành/i });
    expect(completedTab).toHaveTextContent('(1)');
    fireEvent.click(completedTab);

    // Khóa học hoàn thành 100% phải hiển thị trong tab này
    expect(screen.getByText('Phát âm cơ bản - Phụ âm và âm cuối')).toBeInTheDocument();
    expect(screen.getByText('Ôn tập lại')).toBeInTheDocument();
  });

  it('nút làm mới tiến độ kích hoạt refetch lại API khóa học', async () => {
    apiClient.get.mockResolvedValue({ data: { courses: [] } });

    renderPage();

    await screen.findByRole('heading', { name: 'Bạn chưa đăng ký khóa học nào' });

    const refreshBtn = screen.getByTitle('Làm mới tiến độ học tập');
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
