import apiClient from '../../../config/api.config';

const normalizeStreak = realData => {
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
};

const normalizeBadges = badges => {
  if (!Array.isArray(badges)) {
    throw new Error('Phản hồi huy hiệu từ máy chủ không hợp lệ');
  }

  return badges.map(badge => ({
    ...badge,
    description: badge.description ?? badge.desc ?? '',
    requirement: badge.requirement ?? '',
    progress: badge.progress && typeof badge.progress === 'object'
      ? badge.progress
      : null
  }));
};

/**
 * Lấy một snapshot nhất quán của streak và huy hiệu từ dữ liệu học tập thật.
 * API Backend: GET /api/gamification/summary
 */
export const getGamificationSummary = async () => {
  const response = await apiClient.get('/gamification/summary');
  const realData = response.data?.data;

  if (!realData) {
    throw new Error('Phản hồi gamification từ máy chủ không hợp lệ');
  }

  return {
    streak: normalizeStreak(realData.streak),
    badges: normalizeBadges(realData.badges)
  };
};

/**
 * Lấy dữ liệu Daily Streak hiện tại của người dùng
 * API Backend: GET /api/gamification/streak
 */
export const getUserStreakInfo = async () => {
  const response = await apiClient.get('/gamification/streak');
  return normalizeStreak(response.data?.data || response.data);
};

/**
 * Lấy danh sách Huy hiệu của người dùng
 * API Backend: GET /api/gamification/badges
 */
export const getUserBadges = async () => {
  const response = await apiClient.get('/gamification/badges');
  return normalizeBadges(response.data?.badges);
};

/**
 * Admin rà soát điều kiện huy hiệu cho toàn bộ user từ dữ liệu học tập thật.
 * API Backend: POST /api/gamification/resync?limit=&offset=
 */
export const resyncAllBadges = async ({ limit = 200, offset = 0 } = {}) => {
  const response = await apiClient.post('/gamification/resync', null, {
    params: { limit, offset }
  });
  return response.data?.data;
};
