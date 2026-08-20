import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from '../src/config/api.config';
import CourseListPage, { fetchCourses } from '../src/modules/courses/pages/CourseListPage';

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

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: value => value })
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
        <CourseListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CourseListPage real-data states', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('hiển thị lỗi và cho phép refetch thay vì trả danh sách khóa học giả', async () => {
    let courseRequests = 0;
    apiClient.get.mockImplementation(path => {
      if (path === '/courses/subjects') {
        return Promise.resolve({ data: { subjects: [] } });
      }

      courseRequests += 1;
      return Promise.reject(new Error('Database unavailable'));
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể tải danh sách khóa học, vui lòng thử lại sau'
    );
    expect(screen.queryByText('IELTS Masterclass: Target Band 7.5+')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      expect(courseRequests).toBe(2);
    });
  });

  it('hiển thị empty state minh bạch khi API trả danh sách rỗng', async () => {
    apiClient.get.mockImplementation(path => Promise.resolve({
      data: path === '/courses' ? { courses: [] } : { subjects: [] }
    }));

    renderPage();

    expect(await screen.findByRole('status')).toHaveTextContent('Chưa có khóa học nào');
    expect(screen.queryByText('Không tìm thấy kết quả phù hợp')).not.toBeInTheDocument();
    expect(screen.queryByText('IELTS Masterclass: Target Band 7.5+')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'IELTS Masterclass' })).not.toBeInTheDocument();
  });

  it('không tự bịa rating, lượt đánh giá hoặc học viên cho khóa học thật', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        courses: [{
          course_id: 7,
          course_name: 'Khóa học từ API',
          instructor_name: 'Giảng viên thật',
          subject_name: 'Giao tiếp',
          price: '125000'
        }]
      }
    });

    const [course] = await fetchCourses();

    expect(course).toMatchObject({
      id: 'db-7',
      instructor: 'Giảng viên thật',
      rating: null,
      reviews: null,
      students: null,
      duration: null,
      price: '125.000 ₫'
    });
  });
});
