import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        courses: [{
          course_id: 7,
          course_name: 'English Communication',
          instructor_name: 'E-Learn Academy',
          subject_name: 'General English',
          price: 0
        }]
      }
    })
  }
}));

vi.mock('../src/components/common/Header', () => ({ default: () => null }));
vi.mock('../src/components/common/Footer', () => ({ default: () => null }));
vi.mock('../src/modules/courses/components/VocabularyFlashcardModal', () => ({ default: () => null }));
vi.mock('../src/modules/courses/components/AddWordModal', () => ({ default: () => null }));
vi.mock('../src/modules/courses/components/HowItWorksModal', () => ({ default: () => null }));
vi.mock('../src/modules/courses/components/TestsAndQuizzesPanel', () => ({ default: () => <div>Tests panel</div> }));
vi.mock('../src/context/LanguageContext', () => ({ useLanguage: () => ({ t: value => value }) }));

import CourseListPage from '../src/modules/courses/pages/CourseListPage';

const renderCoursePage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/courses']}>
        <Routes>
          <Route
            path="/courses"
            element={(
              <>
                <Link to="/courses" state={{ activeHubTab: 'course' }}>Learn reset</Link>
                <CourseListPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Learn course destination', () => {
  it('opens Course by default and resets back to Course when Learn is clicked again', async () => {
    renderCoursePage();

    expect(await screen.findByText('Khóa học Video & Lộ trình chuẩn CEFR')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vocab' }));
    expect(screen.getByRole('heading', { name: 'Vocabulary' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Learn reset' }));
    expect(await screen.findByText('Khóa học Video & Lộ trình chuẩn CEFR')).toBeInTheDocument();
  });
});
