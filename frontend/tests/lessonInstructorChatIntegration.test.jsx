import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LessonDetailPage from '../src/modules/lessons/pages/LessonDetailPage';
import {
  getCourseDetails,
  getLessonById
} from '../src/modules/lessons/services/lessons.service';
import { getStudentLessonDiscussions } from '../src/modules/discussions/services/discussions.service';

vi.mock('shaka-player', () => ({
  default: {
    Player: class {
      static isBrowserSupported() { return true; }
      destroy = vi.fn().mockResolvedValue();
    }
  }
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 33, userId: 33, roleId: 3 } })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

vi.mock('../src/components/common/Header', () => ({ default: () => null }));
vi.mock('../src/components/common/Footer', () => ({ default: () => null }));
vi.mock('../src/modules/lessons/components/LessonVideoPlayer', () => ({ default: () => <div>Video</div> }));
vi.mock('../src/modules/lessons/components/LessonYouTubePlayer', () => ({ default: () => <div>YouTube</div> }));
vi.mock('../src/modules/lessons/hooks/useStudyTimeTracker', () => ({ default: vi.fn() }));
vi.mock('../src/modules/lessons/services/subtitles.service', () => ({
  subtitlesService: {
    getSubtitles: vi.fn().mockResolvedValue(null),
    getSubtitleStatus: vi.fn().mockResolvedValue({ status: 'none' })
  }
}));

vi.mock('../src/modules/lessons/services/lessons.service', () => ({
  getCourseDetails: vi.fn(),
  getLessonById: vi.fn(),
  toggleLessonCompletion: vi.fn(),
  getVideoTicket: vi.fn()
}));

vi.mock('../src/modules/discussions/services/discussions.service', () => ({
  getStudentLessonDiscussions: vi.fn(),
  sendStudentMessage: vi.fn(),
  markDiscussionRead: vi.fn(),
  discussionApiErrorMessage: (error, fallback) => error?.message || fallback
}));

describe('Lesson instructor chat integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();

    const lesson = {
      id: 27,
      courseId: 7,
      title: 'IELTS Reading',
      type: 'youtube',
      videoUrl: 'https://www.youtube.com/watch?v=test'
    };

    getLessonById.mockResolvedValue(lesson);
    getCourseDetails.mockResolvedValue({
      id: 7,
      title: 'IELTS Course',
      instructorName: 'Giảng viên Minh Huyền',
      sections: [{ id: 1, title: 'Phần 1', lessons: [lesson] }]
    });
    getStudentLessonDiscussions.mockResolvedValue({
      instructor: { id: 9, name: 'Giảng viên Minh Huyền' },
      discussions: [],
      announcements: [],
      unreadCount: 0
    });
  });

  it('keeps the real instructor conversation while omitting suggested questions', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lessons/27']}>
          <Routes>
            <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const instructorTab = await screen.findByRole('tab', { name: /Giảng viên/i });
    expect(getStudentLessonDiscussions).toHaveBeenCalledWith('27');

    fireEvent.click(instructorTab);

    await waitFor(() => {
      expect(instructorTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByPlaceholderText('Nhập tin nhắn cho giảng viên...')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Câu hỏi gợi ý thường gặp/i)).not.toBeInTheDocument();
  });
});
