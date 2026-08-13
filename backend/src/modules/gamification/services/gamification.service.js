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
      FROM learning_sessions
      WHERE user_id = $1
        AND end_at IS NOT NULL
      ORDER BY day DESC
    `;

    const result = await db.query(query, [parseInt(userId, 10)]);
    const days = result.rows.map(r => r.day.toISOString().slice(0, 10));
    const daySet = new Set(days);

    // Start from today and count backwards
    let streak = 0;
    const today = new Date();
    // normalize to YYYY-MM-DD
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    let cur = utcToday;
    while (true) {
      const key = cur.toISOString().slice(0, 10);
      if (daySet.has(key)) {
        streak += 1;
        // subtract one day
        cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }

    const lastActivity = days.length > 0 ? days[0] : null;

    return {
      user_id: parseInt(userId, 10),
      streak,
      last_activity_date: lastActivity
    };
  } catch (error) {
    handleServiceError(error, 'Lỗi khi tính streak gamification');
  }
};

module.exports = {
  calculateStreak
};
