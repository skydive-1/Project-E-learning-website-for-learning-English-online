import apiClient from '../../../config/api.config';

/**
 * Lấy dữ liệu Daily Streak hiện tại của người dùng
 * API Backend: GET /api/gamification/streak
 */
export const getUserStreakInfo = async () => {
  try {
    const response = await apiClient.get('/gamification/streak');
    if (response.data && response.data.streak) {
      return response.data.streak;
    }
  } catch (err) {
    console.warn("Sử dụng dữ liệu Streak mô phỏng (Backend offline):", err.message);
  }

  // Fallback Streak Data
  return {
    currentStreak: 14,
    longestStreak: 21,
    lastActiveDate: new Date().toISOString().split('T')[0],
    weeklyStatus: [
      { day: 'T2', active: true, label: 'Thứ 2' },
      { day: 'T3', active: true, label: 'Thứ 3' },
      { day: 'T4', active: true, label: 'Thứ 4' },
      { day: 'T5', active: true, label: 'Thứ 5' },
      { day: 'T6', active: true, label: 'Thứ 6' },
      { day: 'T7', active: true, label: 'Thứ 7' },
      { day: 'CN', active: true, label: 'Chủ nhật' }
    ],
    freezeStreakCount: 1 // Bảo bối đóng băng chuỗi
  };
};

/**
 * Danh sách huy hiệu thành tích mặc định của hệ thống
 */
export const SYSTEM_BADGES = [
  {
    id: 'badge-lessons-5',
    title: 'Bậc Thầy Chăm Chỉ 🌟',
    category: 'Lessons',
    icon: '📚',
    gradient: 'from-amber-400 to-amber-600',
    description: 'Hoàn thành đủ 5 bài học tích xanh trên hệ thống E-Learn Academy.',
    requiredCount: 5,
    unlocked: true,
    unlockedAt: '10/08/2026'
  },
  {
    id: 'badge-quiz-100',
    title: 'Xạ Thủ Trắc Nghiệm 🎯',
    category: 'Quiz',
    icon: '🎯',
    gradient: 'from-emerald-400 to-teal-600',
    description: 'Đạt điểm tuyệt đối 100% trong bất kỳ bài tập trắc nghiệm phản xạ nào.',
    requiredCount: 100,
    unlocked: true,
    unlockedAt: '11/08/2026'
  },
  {
    id: 'badge-streak-7',
    title: 'Chiến Binh Luyện Tập 🔥',
    category: 'Streak',
    icon: '🔥',
    gradient: 'from-rose-500 to-orange-600',
    description: 'Duy trì chuỗi học tập liên tiếp 7 ngày không gián đoạn.',
    requiredCount: 7,
    unlocked: true,
    unlockedAt: '08/08/2026'
  },
  {
    id: 'badge-speaking-ai',
    title: 'Ngôi Sao Phát Âm 🎙️',
    category: 'Speaking',
    icon: '🎙️',
    gradient: 'from-indigo-500 to-purple-600',
    description: 'Thực hiện ít nhất 1 bài học luyện phát âm và thu âm phản xạ với Trợ lý AI.',
    requiredCount: 1,
    unlocked: false,
    unlockedAt: null
  },
  {
    id: 'badge-lessons-20',
    title: 'Học Giả Uyên Bác 🎓',
    category: 'Lessons',
    icon: '🎓',
    gradient: 'from-blue-500 to-cyan-600',
    description: 'Hoàn thành 20 bài học trên hệ thống.',
    requiredCount: 20,
    unlocked: false,
    unlockedAt: null
  }
];

/**
 * Lấy danh sách Huy hiệu của người dùng
 * API Backend: GET /api/gamification/badges
 */
export const getUserBadges = async () => {
  try {
    const response = await apiClient.get('/gamification/badges');
    if (response.data && response.data.badges) {
      return response.data.badges;
    }
  } catch (err) {
    console.warn("Sử dụng dữ liệu Huy hiệu mô phỏng (Backend offline):", err.message);
  }

  return SYSTEM_BADGES;
};
