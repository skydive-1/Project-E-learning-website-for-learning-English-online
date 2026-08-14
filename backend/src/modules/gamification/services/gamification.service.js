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
        if (daySet.has(localKey) || daySet.has(utcKey)) {
          streak += 1;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }
    }

    // Tính trạng thái 7 ngày trong tuần hiện tại (Thứ 2 -> Chủ nhật)
    const currentDayOfWeek = now.getDay(); // 0 = CN, 1 = T2,...
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

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

    return {
      user_id: parseInt(userId, 10),
      streak,
      currentStreak: streak,
      longestStreak: streak,
      weeklyStatus,
      last_activity_date: lastActivity
    };
  } catch (error) {
    handleServiceError(error, 'Lỗi khi tính streak gamification');
  }
};

module.exports = {
  calculateStreak
};
