/**
 * Progress Service - Nghiệp vụ quản lý tiến trình học tập
 */

const db = require('../../../config/database');

class ProgressService {
  /**
   * Lấy danh sách tiến trình học tập của học viên
   * @param {number} userId - ID của học viên
   */
  async getProgressByUserId(userId) {
    const queryText = `
      SELECT lesson_id, is_completed, completed_at, updated_at
      FROM user_progress
      WHERE user_id = $1
    `;
    const result = await db.query(queryText, [userId]);
    return result.rows;
  }

  /**
   * Ghi nhận tiến độ học tập (Insert nếu chưa có, Update nếu đã có)
   * @param {number} userId - ID của học viên
   * @param {number} lessonId - ID của bài học
   * @param {boolean} isCompleted - Trạng thái hoàn thành bài học (mặc định: true)
   */
  async recordProgress(userId, lessonId, isCompleted = true) {
    // Sử dụng câu lệnh INSERT ON CONFLICT để đảm bảo tính toàn vẹn dữ liệu
    // và xử lý bất đồng bộ tránh race-condition.
    const queryText = `
      INSERT INTO user_progress (user_id, lesson_id, is_completed, completed_at)
      VALUES ($1, $2, $3, CASE WHEN $3 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END)
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET
        is_completed = EXCLUDED.is_completed,
        completed_at = CASE 
          WHEN EXCLUDED.is_completed = TRUE THEN COALESCE(user_progress.completed_at, CURRENT_TIMESTAMP)
          ELSE NULL 
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await db.query(queryText, [userId, lessonId, isCompleted]);

    // Tự động ghi nhận phiên học vào learning_ss để cập nhật Heatmap, Tổng thời gian học và Streak real-time
    if (isCompleted) {
      try {
        await db.query(`
          INSERT INTO learning_ss (user_id, lesson_id, start_at, end_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP)
        `, [userId, lessonId]);
      } catch (sessionErr) {
        console.warn('Lỗi ghi nhận phiên học tự động cho progress:', sessionErr.message);
      }
    }

    return result.rows[0];
  }
}

module.exports = new ProgressService();
