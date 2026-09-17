import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GlobalLeaderboardSection from '../src/modules/quizzes/components/GlobalLeaderboardSection';
import QuizzesListPage from '../src/modules/quizzes/pages/QuizzesListPage';
import * as quizzesService from '../src/modules/quizzes/services/quizzes.service';

const mockLeaderboard = [
  {
    rank: 1,
    user_id: 10,
    user_name: 'Trần Văn Vàng',
    avatar: null,
    role_id: 3,
    total_score: 490,
    total_quizzes_taken: 5,
    average_score: 98.0,
    perfect_scores: 4,
    last_activity_at: '2026-09-17T10:00:00Z'
  },
  {
    rank: 2,
    user_id: 11,
    user_name: 'Lê Thị Bạc',
    avatar: 'https://example.com/avatar2.jpg',
    role_id: 2,
    total_score: 380,
    total_quizzes_taken: 4,
    average_score: 95.0,
    perfect_scores: 2,
    last_activity_at: '2026-09-16T15:30:00Z'
  },
  {
    rank: 3,
    user_id: 12,
    user_name: 'Nguyễn Văn Đồng',
    avatar: null,
    role_id: 1,
    total_score: 290,
    total_quizzes_taken: 3,
    average_score: 96.7,
    perfect_scores: 1,
    last_activity_at: '2026-09-15T08:20:00Z'
  },
  {
    rank: 4,
    user_id: 99,
    user_name: 'Học Viên Hiện Tại',
    avatar: null,
    role_id: 3,
    total_score: 270,
    total_quizzes_taken: 3,
    average_score: 90.0,
    perfect_scores: 0,
    last_activity_at: '2026-09-14T09:00:00Z'
  }
];

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      userId: 99,
      user_id: 99,
      username: 'Học Viên Hiện Tại',
      role_id: 3,
      roleId: 3
    },
    logout: vi.fn()
  })
}));

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn()
  })
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'VIE',
    toggleLanguage: vi.fn(),
    t: (s) => s
  })
}));

vi.mock('../src/context/GamificationContext', () => ({
  useGamification: () => ({
    streak: 5,
    streakError: null,
    isGamificationLoading: false,
    reloadGamification: vi.fn()
  })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

vi.mock('../src/modules/quizzes/services/quizzes.service', () => ({
  getGlobalQuizLeaderboard: vi.fn(),
  getFreeQuizzesList: vi.fn(() => Promise.resolve([])),
  createQuiz: vi.fn(),
  generateQuizAi: vi.fn(),
  getQuizByPin: vi.fn(),
  getAllQuizzesForManagement: vi.fn(() => Promise.resolve([])),
  deleteQuizById: vi.fn()
}));

describe('Global Leaderboard Component & Quizzes Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizzesService.getGlobalQuizLeaderboard.mockResolvedValue(mockLeaderboard);
  });

  it('renders Top 3 podium with Gold champion, Silver, Bronze, and Rank 4 in detail table', async () => {
    render(
      <MemoryRouter>
        <GlobalLeaderboardSection onGoToQuizzes={() => {}} />
      </MemoryRouter>
    );

    // Wait for leaderboard to load
    expect(await screen.findByText('Trần Văn Vàng')).toBeInTheDocument();
    expect(screen.getByText(/Quán quân/i)).toBeInTheDocument();
    expect(screen.getByText('Lê Thị Bạc')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn Đồng')).toBeInTheDocument();

    // Verify scores are shown
    expect(screen.getByText(/490/)).toBeInTheDocument();
    expect(screen.getByText(/380/)).toBeInTheDocument();
    expect(screen.getByText(/290/)).toBeInTheDocument();

    // Verify Rank 4 in detail table and user rank banner
    const rank4Elements = screen.getAllByText('#4');
    expect(rank4Elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/270/).length).toBeGreaterThanOrEqual(1);
  });

  it('identifies current user and displays "Vị trí của bạn" ranking banner', async () => {
    render(
      <MemoryRouter>
        <GlobalLeaderboardSection onGoToQuizzes={() => {}} />
      </MemoryRouter>
    );

    // User id 99 is ranked #4
    expect(await screen.findByText('Trần Văn Vàng')).toBeInTheDocument();
    const rank4Badges = screen.getAllByText('#4');
    expect(rank4Badges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Học Viên Hiện Tại').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/270 điểm/i)).toBeInTheDocument();
  });

  it('filters leaderboard by timeframe when switching pills', async () => {
    render(
      <MemoryRouter>
        <GlobalLeaderboardSection onGoToQuizzes={() => {}} />
      </MemoryRouter>
    );

    await screen.findByText('Trần Văn Vàng');
    expect(quizzesService.getGlobalQuizLeaderboard).toHaveBeenCalledWith('all', 20);

    // Click "Tháng này"
    const monthBtn = screen.getByRole('button', { name: /Tháng này/i });
    fireEvent.click(monthBtn);

    await waitFor(() => {
      expect(quizzesService.getGlobalQuizLeaderboard).toHaveBeenCalledWith('month', 20);
    });

    // Click "Tuần này"
    const weekBtn = screen.getByRole('button', { name: /Tuần này/i });
    fireEvent.click(weekBtn);

    await waitFor(() => {
      expect(quizzesService.getGlobalQuizLeaderboard).toHaveBeenCalledWith('week', 20);
    });
  });

  it('QuizzesListPage seamlessly switches between Quizzes and Leaderboard tabs', async () => {
    quizzesService.getFreeQuizzesList.mockResolvedValue([
      {
        id: '1',
        title: 'Đề thi trắc nghiệm mẫu',
        description: 'Mô tả bài thi',
        difficulty: 'Easy',
        timeLimit: 15,
        questions: []
      }
    ]);

    render(
      <MemoryRouter initialEntries={['/quizzes']}>
        <Routes>
          <Route path="/quizzes" element={<QuizzesListPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial tab: Quizzes List
    expect(await screen.findByText('Đề thi trắc nghiệm mẫu')).toBeInTheDocument();

    // Click "Bảng xếp hạng" tab
    const leaderboardTabs = screen.getAllByRole('button', { name: /Bảng xếp hạng/i });
    fireEvent.click(leaderboardTabs[0]);

    // Leaderboard section should now be visible
    expect(await screen.findByText('Trần Văn Vàng')).toBeInTheDocument();
    expect(screen.getByText(/Quán quân/i)).toBeInTheDocument();

    // Click "Danh sách đề thi" tab to switch back
    const quizzesTab = screen.getByRole('button', { name: /Danh sách đề thi/i });
    fireEvent.click(quizzesTab);

    expect(await screen.findByText('Đề thi trắc nghiệm mẫu')).toBeInTheDocument();
  });
});
