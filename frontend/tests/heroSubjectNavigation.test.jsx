import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DolHeroSection from '../src/components/common/DolHeroSection';
import CourseListPage from '../src/modules/courses/pages/CourseListPage';
import apiClient from '../src/config/api.config';
import { ToastProvider } from '../src/context/ToastContext';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../src/components/common/Header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('../src/components/common/Footer', () => ({ default: () => <div data-testid="footer" /> }));
vi.mock('../src/context/LanguageContext', () => ({ useLanguage: () => ({ t: value => value }) }));
vi.mock('../src/modules/courses/components/VocabularyFlashcardModal', () => ({ default: () => null }));
vi.mock('../src/modules/courses/components/AddWordModal', () => ({ default: () => null }));
vi.mock('../src/modules/courses/components/HowItWorksModal', () => ({ default: () => null }));
vi.mock('../src/modules/courses/components/TestsAndQuizzesPanel', () => ({ default: () => <div>Tests</div> }));

const MOCK_COURSES = [
  {
    course_id: 1,
    subject_id: 1,
    course_name: 'Khóa học IELTS Nâng cao',
    instructor_name: 'Thầy David',
    subject_name: 'IELTS Masterclass',
    price: 0
  },
  {
    course_id: 5,
    subject_id: 4,
    course_name: 'Giao tiếp Tiếng Anh Cơ bản',
    instructor_name: 'Cô Sarah',
    subject_name: 'General English Communication',
    price: 199000
  }
];

const MOCK_SUBJECTS = [
  { subject_id: 1, subject_name: 'IELTS Masterclass' },
  { subject_id: 2, subject_name: 'TOEIC Prep' },
  { subject_id: 3, subject_name: 'Business English' },
  { subject_id: 4, subject_name: 'General English Communication' }
];

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false }
  }
});

describe('Hero 4 Quadrants & Course Navigation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) => {
      if (url === '/courses/subjects') {
        return Promise.resolve({ data: { subjects: MOCK_SUBJECTS } });
      }
      if (url === '/courses' || url.startsWith('/courses?')) {
        return Promise.resolve({ data: { courses: MOCK_COURSES } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('navigates from Hero quadrant IELTS click to courses page with IELTS courses visible', async () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<DolHeroSection />} />
              <Route path="/courses" element={<CourseListPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Click on IELTS Masterclass quadrant cell
    const ieltsCell = screen.getByRole('button', { name: /IELTS Masterclass/i });
    fireEvent.click(ieltsCell);

    // Should navigate to /courses?subject=1 and show IELTS course
    expect(await screen.findByText('Khóa học IELTS Nâng cao')).toBeInTheDocument();
    expect(screen.queryByText('Giao tiếp Tiếng Anh Cơ bản')).not.toBeInTheDocument();
  });

  it('displays "Hiện chưa có khóa học phù hợp" when a subject has no courses (e.g. TOEIC)', async () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/courses?subject=2']}>
            <Routes>
              <Route path="/courses" element={<CourseListPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Hiện chưa có khóa học phù hợp')).toBeInTheDocument();

    // Resetting filter to 'all' should reveal all courses
    const showAllBtn = screen.getByRole('button', { name: 'Xem tất cả khóa học' });
    fireEvent.click(showAllBtn);

    expect(await screen.findByText('Khóa học IELTS Nâng cao')).toBeInTheDocument();
    expect(await screen.findByText('Giao tiếp Tiếng Anh Cơ bản')).toBeInTheDocument();
  });

  it('displays "Hiện chưa có khóa học phù hợp" when user clicks TOEIC quadrant from Hero', async () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<DolHeroSection />} />
              <Route path="/courses" element={<CourseListPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Wait for courses query to settle
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/courses');
    });

    // Click TOEIC Chuẩn đầu ra quadrant
    const toeicCell = screen.getByRole('button', { name: /TOEIC Chuẩn đầu ra/i });
    fireEvent.click(toeicCell);

    // Destination page must show the specified message
    expect(await screen.findByText('Hiện chưa có khóa học phù hợp')).toBeInTheDocument();
  });
});
