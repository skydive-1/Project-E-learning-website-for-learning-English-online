import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VideoReviewsSection from '../src/modules/homepage/components/VideoReviewsSection';
import apiClient from '../src/config/api.config';

vi.mock('../src/config/api.config', () => ({
  default: { get: vi.fn() }
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (value) => value })
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 7, username: 'Learner' }, loading: false })
}));

vi.mock('../src/context/GamificationContext', () => ({
  useGamification: () => ({
    streak: {
      currentStreak: 4,
      longestStreak: 9,
      weeklyStatus: [
        { day: 'Thứ 2', active: true },
        { day: 'Thứ 3', active: false },
        { day: 'Thứ 4', active: true }
      ]
    },
    badges: [
      { id: 1, name: 'Khởi động', unlocked: true },
      { id: 2, name: 'Bền bỉ', unlocked: false }
    ],
    streakError: null,
    badgesError: null,
    isGamificationLoading: false
  })
}));

class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {
    this.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
  }

  disconnect() {}
}

const renderShowcase = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <VideoReviewsSection />
    </QueryClientProvider>
  );
};

const mockShowcaseApi = () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/courses') {
      return Promise.resolve({
        data: {
          courses: [
            { course_id: 1, title: 'Tiếng Anh nền tảng' },
            { course_id: 2, title: 'TOEIC thực hành' }
          ]
        }
      });
    }

    if (url === '/quizzes/free') {
      return Promise.resolve({
        data: { data: [{ quiz_id: 5, title: 'Quiz từ vựng', difficulty: 'Easy' }] }
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
};

describe('Platform showcase carousel', () => {
  it('uses project data without exposing manual carousel controls', async () => {
    global.IntersectionObserver = IntersectionObserverMock;
    window.IntersectionObserver = IntersectionObserverMock;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    mockShowcaseApi();

    const { container } = renderShowcase();

    expect(container.querySelectorAll('.platform-showcase-panel')).toHaveLength(6);
    expect(screen.queryByText('BÊN TRONG NỀN TẢNG')).not.toBeInTheDocument();
    expect(screen.queryByText('Nền tảng trông như thế nào khi bạn học')).not.toBeInTheDocument();
    expect(screen.queryByText(/Trợ lý AI, theo dõi tiến độ và chấm điểm phát âm/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2 khóa học đang hiển thị')).toBeInTheDocument();
      expect(screen.getByText('1 bài quiz công khai')).toBeInTheDocument();
    });

    const coursePanel = Array.from(container.querySelectorAll('.platform-showcase-panel'))
      .find((panel) => within(panel).queryByText('Kho khóa học'));
    expect(coursePanel).toBeTruthy();
    expect(within(coursePanel).getByText('Tiếng Anh nền tảng')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kho khóa học' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạm dừng chuyển động' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tiếp tục chuyển động' })).not.toBeInTheDocument();
    expect(screen.queryByText('12 ngày liên tiếp')).not.toBeInTheDocument();
    expect(screen.queryByText('82/100')).not.toBeInTheDocument();
  });

  it('loops through every panel and continues into the next cycle', () => {
    vi.useFakeTimers();
    const hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    global.IntersectionObserver = IntersectionObserverMock;
    window.IntersectionObserver = IntersectionObserverMock;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    mockShowcaseApi();

    const { container, unmount } = renderShowcase();
    const carousel = screen.getByRole('region', {
      name: 'Xem trước các tính năng và dữ liệu nền tảng'
    });

    fireEvent.mouseEnter(carousel);
    expect(carousel).toHaveAttribute('data-autoplay', 'true');
    expect(carousel).not.toHaveClass('scroll-animate');

    const expectedPanelTitles = [
      'Nhịp học trong tuần',
      'Huy hiệu học tập',
      'Luyện tập với AI',
      'Tổng quan nền tảng',
      'Kho khóa học',
      'Kho trắc nghiệm',
      'Nhịp học trong tuần'
    ];

    expectedPanelTitles.forEach((title) => {
      act(() => vi.advanceTimersByTime(1801));
      expect(carousel).toHaveClass('is-shifting');

      act(() => vi.advanceTimersByTime(801));
      const activePanel = container.querySelector('.platform-showcase-panel[data-slot="0"]');
      expect(within(activePanel).getByText(title)).toBeInTheDocument();
      expect(activePanel).toHaveAttribute('data-motion-active', 'true');
    });

    const activePanel = container.querySelector('.platform-showcase-panel[data-slot="0"]');
    expect(within(activePanel).getByLabelText('4')).toBeInTheDocument();
    expect(carousel).not.toHaveClass('scroll-animate');

    unmount();
    hiddenSpy.mockRestore();
    vi.useRealTimers();
  });
});
