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
  getCourseDetails: vi.fn()
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

    expect(await screen.findByRole('heading', { name: 'Bạn chưa đăng ký/xem khóa học nào' })).toBeInTheDocument();
    expect(screen.queryByText('IELTS Masterclass: Target Band 7.5+')).not.toBeInTheDocument();
    expect(screen.queryByText(/mock-/i)).not.toBeInTheDocument();
  });

  it('hiển thị lỗi và retry thay vì biến API error thành danh sách mock', async () => {
    apiClient.get.mockRejectedValue(new Error('Database unavailable'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể tải khóa học của bạn, vui lòng thử lại sau'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('IELTS Masterclass: Target Band 7.5+')).not.toBeInTheDocument();
  });
});
