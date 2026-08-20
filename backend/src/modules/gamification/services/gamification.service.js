const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

/**
 * Tính streak học liên tiếp (Daily Streak)
 * - Lấy các ngày có hoạt động (learning_sessions with end_at)
 * - Đếm số ngày liên tiếp tính từ ngày hôm nay trở về trước
 */
const calculateStreak = async (userId) => {
  try {
    const query = `
      SELECT DISTINCT (start_at::date) AS day
      FROM learning_ss
      WHERE user_id = $1
        AND end_at IS NOT NULL
      ORDER BY day DESC
    `;

    const result = await db.query(query, [parseInt(userId, 10)]);
    const days = result.rows.map(r => {
      if (!r.day) return null;
      if (typeof r.day === 'string') return r.day.slice(0, 10);
      if (r.day instanceof Date) return r.day.toISOString().slice(0, 10);
      return String(r.day).slice(0, 10);
    }).filter(Boolean);
    const daySet = new Set(days);

    const getLocalDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${date}`;
    };

    let streak = 0;
    const now = new Date();
    let checkDate = new Date(now);

    // 1. Tính ngày Thứ 2 của tuần hiện tại (Thứ 2 -> Chủ nhật) TRƯỚC vòng lặp đếm streak
    const currentDayOfWeek = now.getDay(); // 0 = CN, 1 = T2,...
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayKey = getLocalDateStr(monday);

    const todayKey = getLocalDateStr(now);
    const hasToday = daySet.has(todayKey) || daySet.has(now.toISOString().slice(0, 10));

    if (!hasToday) {
      // Nếu hôm nay chưa học, kiểm tra xem hôm qua có học không (để không bị mất streak trước khi hết ngày)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayKey = getLocalDateStr(yesterday);
      if (daySet.has(yesterdayKey) || daySet.has(yesterday.toISOString().slice(0, 10))) {
        checkDate = yesterday;
      } else {
        checkDate = null;
      }
    }

    if (checkDate) {
      while (true) {
        const localKey = getLocalDateStr(checkDate);
        const utcKey = checkDate.toISOString().slice(0, 10);

        // Nếu checkDate lùi về trước Thứ 2 của tuần hiện tại, dừng ngay không tính tiếp ngày thuộc tuần trước
        if (localKey < mondayKey) {
          break;
        }

        if (daySet.has(localKey) || daySet.has(utcKey)) {
          streak += 1;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }
    }

    // Đảm bảo streak trong tuần trả về tối đa 7 ngày
    streak = Math.min(streak, 7);

    // 2. Tính trạng thái 7 ngày trong tuần hiện tại (Thứ 2 -> Chủ nhật)
    const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const weekLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    const weeklyStatus = weekDays.map((day, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const lKey = getLocalDateStr(d);
      const uKey = d.toISOString().slice(0, 10);
      const isActive = daySet.has(lKey) || daySet.has(uKey);
      return {
        day,
        label: weekLabels[idx],
        date: lKey,
        active: isActive
      };
    });

    const lastActivity = days.length > 0 ? days[0] : null;

    // 3. Quản lý Longest Streak lưu trữ trong CSDL (MAX giữa kỷ lục cũ và streak hiện tại)
    let savedLongestStreak = 0;
    try {
      const userRes = await db.query(
        'SELECT longest_streak FROM users WHERE user_id = $1',
        [parseInt(userId, 10)]
      );
      if (userRes.rows.length > 0 && userRes.rows[0].longest_streak != null) {
        savedLongestStreak = parseInt(userRes.rows[0].longest_streak, 10) || 0;
      }
    } catch (dbErr) {
      console.warn('⚠️ Lỗi đọc longest_streak từ users table:', dbErr.message);
    }

    const finalLongestStreak = Math.max(savedLongestStreak, streak);

    if (streak > savedLongestStreak) {
      try {
        await db.query(
          'UPDATE users SET longest_streak = $1 WHERE user_id = $2',
          [finalLongestStreak, parseInt(userId, 10)]
        );
      } catch (upErr) {
        console.warn('⚠️ Lỗi cập nhật longest_streak vào users table:', upErr.message);
      }
    }

    return {
      user_id: parseInt(userId, 10),
      streak,
      currentStreak: streak,
      longestStreak: finalLongestStreak,
      weeklyStatus,
      last_activity_date: lastActivity
    };
  } catch (error) {
    handleServiceError(error, 'Lỗi khi tính streak gamification');
  }
};

/**
 * Lấy danh sách huy hiệu của người dùng (User Badges)
 */
const getUserBadges = async (userId) => {
  const DEFAULT_BADGES = [
    { id: 'first_lesson', title: 'Khởi đầu nan', desc: 'Hoàn thành bài học đầu tiên', icon: '🌱', unlocked: false },
    { id: 'streak_3', title: 'Chiến binh kiên trì', desc: 'Đạt chuỗi học 3 ngày liên tiếp', icon: '🔥', unlocked: false },
    { id: 'streak_7', title: 'Thói quen vàng', desc: 'Đạt chuỗi học 7 ngày liên tiếp', icon: '⚡', unlocked: false },
    { id: 'streak_30', title: 'Bậc thầy kỷ luật', desc: 'Đạt chuỗi học 30 ngày liên tiếp', icon: '👑', unlocked: false },
    { id: 'quiz_master', title: 'Vua trắc nghiệm', desc: 'Đạt điểm tuyệt đối trong 5 bài Quiz', icon: '🎯', unlocked: false },
    { id: 'ai_interactive', title: 'Tương tác thông minh', desc: 'Hỏi đáp với AI Chatbot trên 10 lần', icon: '🤖', unlocked: false },
    { id: 'grammar_guru', title: 'Bậc thầy Ngữ pháp', desc: 'Hoàn thành toàn bộ bài tập ngữ pháp', icon: '📚', unlocked: false },
    { id: 'speed_learner', title: 'Tốc độ ánh sáng', desc: 'Hoàn thành 3 bài học trong 1 ngày', icon: '🚀', unlocked: false }
  ];

  if (!userId) {
    const error = new Error('Người dùng chưa được xác thực');
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const streakInfo = await calculateStreak(userId);
  const curStreak = streakInfo?.currentStreak || 0;

  return DEFAULT_BADGES.map(b => {
    if (b.id === 'streak_3' && curStreak >= 3) return { ...b, unlocked: true };
    if (b.id === 'streak_7' && curStreak >= 7) return { ...b, unlocked: true };
    if (b.id === 'streak_30' && curStreak >= 30) return { ...b, unlocked: true };
    return b;
  });
};

module.exports = {
  calculateStreak,
  getUserBadges
};
