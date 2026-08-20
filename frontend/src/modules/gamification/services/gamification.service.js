import apiClient from '../../../config/api.config';

/**
 * Lấy dữ liệu Daily Streak hiện tại của người dùng
 * API Backend: GET /api/gamification/streak
 */
export const getUserStreakInfo = async () => {
  try {
    const response = await apiClient.get('/gamification/streak');
    const realData = response.data?.data || response.data;

    if (!realData || (realData.streak === undefined && realData.currentStreak === undefined)) {
      throw new Error('Phản hồi streak từ máy chủ không hợp lệ');
    }

    const streakVal = realData.streak ?? realData.currentStreak;
    return {
      currentStreak: streakVal,
      longestStreak: realData.longestStreak ?? streakVal,
      lastActiveDate: realData.last_activity_date ?? null,
      weeklyStatus: Array.isArray(realData.weeklyStatus) ? realData.weeklyStatus : []
    };
  } catch (err) {
    throw err;
  }
};

/**
 * Lấy danh sách Huy hiệu của người dùng
 * API Backend: GET /api/gamification/badges
 */
export const getUserBadges = async () => {
  try {
    const response = await apiClient.get('/gamification/badges');
    if (!Array.isArray(response.data?.badges)) {
      throw new Error('Phản hồi huy hiệu từ máy chủ không hợp lệ');
    }

    return response.data.badges.map(badge => ({
      ...badge,
      description: badge.description ?? badge.desc ?? ''
    }));
  } catch (err) {
    throw err;
  }
};
