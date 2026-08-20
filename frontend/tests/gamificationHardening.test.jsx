import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import apiClient from '../src/config/api.config';
import { GamificationProvider, useGamification } from '../src/context/GamificationContext';
import { getUserBadges, getUserStreakInfo } from '../src/modules/gamification/services/gamification.service';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 42 } })
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

  it('gọi endpoint theo Bearer-token contract, không gửi user_id trong query', async () => {
    apiClient.get
      .mockResolvedValueOnce({
        data: {
          data: {
            currentStreak: 2,
            longestStreak: 4,
            weeklyStatus: []
          }
        }
      })
      .mockResolvedValueOnce({ data: { badges: [] } });

    await getUserStreakInfo(999999);
    await getUserBadges(999999);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/gamification/streak');
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/gamification/badges');
  });

  it('ném lại lỗi API thay vì trả streak hoặc badges mô phỏng', async () => {
    const apiError = new Error('Backend unavailable');
    apiClient.get.mockRejectedValue(apiError);

    await expect(getUserStreakInfo()).rejects.toBe(apiError);
    await expect(getUserBadges()).rejects.toBe(apiError);
  });

  it('context công bố error state và giữ dữ liệu rỗng khi cả hai API lỗi', async () => {
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
});
