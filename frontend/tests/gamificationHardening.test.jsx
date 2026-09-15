import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import apiClient from '../src/config/api.config';
import { GamificationProvider, useGamification } from '../src/context/GamificationContext';
import {
  getGamificationSummary,
  getUserBadges,
  getUserStreakInfo
} from '../src/modules/gamification/services/gamification.service';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn()
  }
}));

const mockAuthUser = { id: 42 };

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser })
}));

const ContextProbe = () => {
  const { streak, badges, streakError, badgesError } = useGamification();
  return (
    <div>
      <span data-testid="streak-value">{streak ? streak.currentStreak : 'none'}</span>
      <span data-testid="badges-count">{badges.length}</span>
      {streakError && <span>streak-error</span>}
      {badgesError && <span>badges-error</span>}
    </div>
  );
};

describe('Gamification real-data contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lấy một snapshot thật, không gửi user_id và giữ tiến độ từng huy hiệu', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        data: {
          streak: {
            currentStreak: 2,
            longestStreak: 4,
            weeklyStatus: []
          },
          badges: [{
            id: 'first_lesson',
            title: 'Khởi đầu nan',
            desc: 'Hoàn thành bài học đầu tiên',
            unlocked: false,
            progress: { current: 0, target: 1, unit: 'bài học' }
          }]
        }
      }
    });

    const summary = await getGamificationSummary(999999);

    expect(apiClient.get).toHaveBeenCalledOnce();
    expect(apiClient.get).toHaveBeenCalledWith('/gamification/summary');
    expect(summary.streak.longestStreak).toBe(4);
    expect(summary.badges[0]).toEqual(expect.objectContaining({
      description: 'Hoàn thành bài học đầu tiên',
      progress: { current: 0, target: 1, unit: 'bài học' }
    }));
  });

  it('ném lại lỗi API thay vì trả streak hoặc badges mô phỏng', async () => {
    const apiError = new Error('Backend unavailable');
    apiClient.get.mockRejectedValue(apiError);

    await expect(getGamificationSummary()).rejects.toBe(apiError);
    await expect(getUserStreakInfo()).rejects.toBe(apiError);
    await expect(getUserBadges()).rejects.toBe(apiError);
  });

  it('context công bố error state và giữ dữ liệu rỗng khi snapshot API lỗi', async () => {
    apiClient.get.mockRejectedValue(new Error('Backend unavailable'));

    render(
      <GamificationProvider>
        <ContextProbe />
      </GamificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('streak-error')).toBeInTheDocument();
      expect(screen.getByText('badges-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('streak-value')).toHaveTextContent('none');
    expect(screen.getByTestId('badges-count')).toHaveTextContent('0');
  });

  it('context nạp streak và badges từ cùng một snapshot API', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        data: {
          streak: { currentStreak: 3, longestStreak: 7, weeklyStatus: [] },
          badges: [{
            id: 'streak_3',
            title: 'Chiến binh kiên trì',
            description: 'Đạt chuỗi học 3 ngày liên tiếp',
            unlocked: true,
            progress: { current: 7, target: 3, unit: 'ngày' }
          }]
        }
      }
    });

    render(
      <GamificationProvider>
        <ContextProbe />
      </GamificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('streak-value')).toHaveTextContent('3');
      expect(screen.getByTestId('badges-count')).toHaveTextContent('1');
    });
    expect(apiClient.get).toHaveBeenCalledOnce();
    expect(apiClient.get).toHaveBeenCalledWith('/gamification/summary');
  });
});
