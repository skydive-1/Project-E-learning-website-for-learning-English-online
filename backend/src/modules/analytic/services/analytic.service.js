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
            LEFT JOIN learning_ss ls
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

/**
 * Trả về tổng quan analytics thực tế của học viên từ CSDL
 */
const getUserAnalyticsSummary = async (userId) => {
    try {
        const uid = parseInt(userId, 10);
        
        // 1. Tính tổng thời gian học (phút) từ learning_ss
        const timeRes = await db.query(`
            SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 60), 0) AS total_minutes
            FROM learning_ss
            WHERE user_id = $1 AND end_at IS NOT NULL
        `, [uid]);
        const totalMinutes = parseFloat(timeRes.rows[0]?.total_minutes || 0);

        // 2. Đếm số bài học đã hoàn thành từ user_progress
        const progressRes = await db.query(`
            SELECT COUNT(*) AS completed_count
            FROM user_progress
            WHERE user_id = $1 AND is_completed = true
        `, [uid]);
        const completedLessonsCount = parseInt(progressRes.rows[0]?.completed_count || 0, 10);

        // 3. Điểm Quiz trung bình từ quiz_attempts
        const quizRes = await db.query(`
            SELECT COUNT(*) AS attempts_count, COALESCE(AVG(score), 0) AS avg_score
            FROM quiz_attempts
            WHERE user_id = $1
        `, [uid]);
        const totalQuizzesTaken = parseInt(quizRes.rows[0]?.attempts_count || 0, 10);
        const avgQuizScorePercent = parseFloat(parseFloat(quizRes.rows[0]?.avg_score || 0).toFixed(1));

        return {
            kpi: {
                totalStudyMinutes: totalMinutes,
                totalStudyHours: (totalMinutes / 60).toFixed(1),
                completedLessonsCount,
                totalQuizzesTaken,
                avgQuizScorePercent,
                weeklyGrowthPercent: 0
            }
        };
    } catch (error) {
        handleServiceError(error, 'Lỗi khi lấy tổng quan phân tích học tập');
    }
};

module.exports = {
    getUserHeatmap,
    getUserAnalyticsSummary
};