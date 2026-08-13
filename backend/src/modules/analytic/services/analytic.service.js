const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

/**
 * Trả về tổng số phút học theo từng ngày trong năm
 * - userId: id học viên
 * - year: năm muốn lấy (ví dụ '2026'). Nếu không có thì dùng năm hiện tại
 */
const getUserHeatmap = async (userId, year) => {
    try {
        const finalYear = year ? parseInt(year, 10) : new Date().getFullYear();
        const yearStart = `${finalYear}-01-01`;

        const query = `
            WITH days AS (
                SELECT generate_series(
                    date_trunc('year', $2::date),
                    date_trunc('year', $2::date) + interval '1 year' - interval '1 day',
                    interval '1 day'
                )::date AS day
            )
            SELECT
                d.day AS study_date,
                COALESCE(ROUND(SUM(
                    EXTRACT(EPOCH FROM (
                        LEAST(ls.end_at, (d.day + INTERVAL '1 day')) - GREATEST(ls.start_at, d.day)
                    )) / 60
                )::numeric, 2), 0) AS total_minutes
            FROM days d
            LEFT JOIN learning_sessions ls
                ON ls.user_id = $1
                AND ls.end_at IS NOT NULL
                AND ls.start_at < (d.day + INTERVAL '1 day')
                AND ls.end_at >= d.day
            GROUP BY d.day
            ORDER BY d.day;
        `;

        const result = await db.query(query, [parseInt(userId, 10), yearStart]);
        return result.rows;
    } catch (error) {
        handleServiceError(error, 'Lỗi khi lấy dữ liệu heatmap của người dùng');
    }
};

module.exports = {
    getUserHeatmap
};