const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

/**
 * Trả về tổng số phút học theo từng ngày trong năm (cho Heatmap)
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
 * Tính streak từ learning_ss (tái sử dụng logic từ gamification module)
 */
const _calculateStreakFromDB = async (uid) => {
    const result = await db.query(`
        SELECT DISTINCT (start_at::date) AS day
        FROM learning_ss
        WHERE user_id = $1
          AND end_at IS NOT NULL
        ORDER BY day DESC
    `, [uid]);

    const days = result.rows.map(r => {
        if (!r.day) return null;
        if (typeof r.day === 'string') return r.day.slice(0, 10);
        if (r.day instanceof Date) return r.day.toISOString().slice(0, 10);
        return String(r.day).slice(0, 10);
    }).filter(Boolean);

    const daySet = new Set(days);
    let streak = 0;
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    let cur = utcToday;
    while (true) {
        const key = cur.toISOString().slice(0, 10);
        if (daySet.has(key)) {
            streak++;
            cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
        } else {
            break;
        }
    }
    return streak;
};

/**
 * Trả về tổng quan analytics thực tế của học viên từ CSDL
 * Bao gồm: KPI, weeklyActivity, quizTrends, courseCompletion, skillRadar
 */
const getUserAnalyticsSummary = async (userId) => {
    try {
        const uid = parseInt(userId, 10);

        // ── 1. Tổng thời gian học (phút) từ learning_ss ──
        const timeRes = await db.query(`
            SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 60), 0) AS total_minutes
            FROM learning_ss
            WHERE user_id = $1 AND end_at IS NOT NULL
        `, [uid]);
        const totalMinutes = parseFloat(timeRes.rows[0]?.total_minutes || 0);

        // ── 2. Số bài học đã hoàn thành từ user_progress ──
        const progressRes = await db.query(`
            SELECT COUNT(*) AS completed_count
            FROM user_progress
            WHERE user_id = $1 AND is_completed = true
        `, [uid]);
        const completedLessonsCount = parseInt(progressRes.rows[0]?.completed_count || 0, 10);

        // ── 3. Điểm Quiz trung bình từ quiz_attempts ──
        const quizRes = await db.query(`
            SELECT COUNT(*) AS attempts_count, COALESCE(AVG(score), 0) AS avg_score
            FROM quiz_attempts
            WHERE user_id = $1
        `, [uid]);
        const totalQuizzesTaken = parseInt(quizRes.rows[0]?.attempts_count || 0, 10);
        const rawAvgScore = parseFloat(quizRes.rows[0]?.avg_score || 0);
        // Chuẩn hóa score: nếu avg <= 1.0 thì nhân 100 (dạng 0–1), ngược lại giữ nguyên (dạng 0–100)
        const avgQuizScorePercent = parseFloat((rawAvgScore <= 1.0 && rawAvgScore > 0 ? rawAvgScore * 100 : rawAvgScore).toFixed(1));

        // ── 4. Streak hiện tại ──
        let currentStreakDays = 0;
        try {
            currentStreakDays = await _calculateStreakFromDB(uid);
        } catch (_) { /* bỏ qua nếu lỗi */ }

        // ── 5. Weekly Activity — phút học theo ngày trong tuần (7 ngày gần nhất) ──
        const weeklyRes = await db.query(`
            WITH last7 AS (
                SELECT
                    start_at::date AS day,
                    EXTRACT(DOW FROM start_at) AS dow,
                    EXTRACT(EPOCH FROM (end_at - start_at)) / 60 AS duration_min
                FROM learning_ss
                WHERE user_id = $1
                  AND end_at IS NOT NULL
                  AND start_at >= (CURRENT_DATE - INTERVAL '6 days')
            )
            SELECT
                dow,
                COALESCE(ROUND(SUM(duration_min)::numeric, 1), 0) AS minutes
            FROM last7
            GROUP BY dow
            ORDER BY dow
        `, [uid]);

        const dowLabels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        const weeklyMap = {};
        weeklyRes.rows.forEach(r => {
            weeklyMap[parseInt(r.dow)] = parseFloat(r.minutes);
        });
        // Tạo mảng 7 ngày đầy đủ, bắt đầu từ Thứ 2
        const weeklyActivity = [1, 2, 3, 4, 5, 6, 0].map(dow => ({
            day: dowLabels[dow],
            minutes: weeklyMap[dow] || 0
        }));

        // ── 6. Quiz Trends — điểm TB theo tuần (8 tuần gần nhất) ──
        const trendRes = await db.query(`
            SELECT
                EXTRACT(WEEK FROM attempted_at) AS week_num,
                DATE_TRUNC('week', attempted_at) AS week_start,
                COUNT(*) AS attempts,
                COALESCE(AVG(score), 0) AS avg_score
            FROM quiz_attempts
            WHERE user_id = $1
              AND attempted_at >= (CURRENT_DATE - INTERVAL '8 weeks')
            GROUP BY week_num, week_start
            ORDER BY week_start ASC
            LIMIT 8
        `, [uid]);

        const quizTrends = trendRes.rows.map((r, idx) => {
            const raw = parseFloat(r.avg_score);
            const score = parseFloat((raw <= 1.0 && raw > 0 ? raw * 100 : raw).toFixed(1));
            return {
                week: `Tuần ${idx + 1}`,
                score,
                attempts: parseInt(r.attempts, 10)
            };
        });

        // ── 7. Course Completion — trạng thái khóa học từ user_enrollments ──
        const courseRes = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE ue.completed_at IS NOT NULL) AS completed,
                COUNT(*) FILTER (WHERE ue.completed_at IS NULL AND ue.enrolled_at IS NOT NULL) AS in_progress,
                COUNT(*) FILTER (WHERE ue.enrolled_at IS NULL) AS not_started
            FROM user_enrollments ue
            WHERE ue.user_id = $1
        `, [uid]);

        const cc = courseRes.rows[0] || {};
        const courseCompletion = [
            { name: 'Đã hoàn thành', value: parseInt(cc.completed || 0, 10), color: '#10b981' },
            { name: 'Đang học', value: parseInt(cc.in_progress || 0, 10), color: '#6366f1' },
            { name: 'Chưa bắt đầu', value: parseInt(cc.not_started || 0, 10), color: '#94a3b8' }
        ];

        // ── 8. Skill Radar — điểm theo category kỹ năng ──
        // Thử lấy từ quiz nếu có trường category, nếu không thì dùng giá trị mặc định 0
        let skillRadar = [
            { skill: 'Phát âm (Speaking)', A: 0, fullMark: 100 },
            { skill: 'Từ vựng (Vocabulary)', A: 0, fullMark: 100 },
            { skill: 'Ngữ pháp (Grammar)', A: 0, fullMark: 100 },
            { skill: 'Kỹ năng nghe (Listening)', A: 0, fullMark: 100 },
            { skill: 'Viết tự luận (Writing)', A: 0, fullMark: 100 }
        ];
        try {
            const radarRes = await db.query(`
                SELECT
                    q.category,
                    COALESCE(AVG(qa.score), 0) AS avg_score
                FROM quiz_attempts qa
                JOIN quizzes q ON qa.quiz_id = q.quiz_id
                WHERE qa.user_id = $1
                  AND q.category IS NOT NULL
                GROUP BY q.category
            `, [uid]);

            if (radarRes.rows.length > 0) {
                const categoryMap = {
                    'speaking': 0, 'pronunciation': 0,
                    'vocabulary': 1, 'vocab': 1,
                    'grammar': 2,
                    'listening': 3,
                    'writing': 4
                };
                radarRes.rows.forEach(r => {
                    const key = (r.category || '').toLowerCase();
                    const idx = categoryMap[key];
                    if (idx !== undefined) {
                        const raw = parseFloat(r.avg_score);
                        skillRadar[idx].A = parseFloat((raw <= 1.0 && raw > 0 ? raw * 100 : raw).toFixed(1));
                    }
                });
            }
        } catch (_) { /* bỏ qua nếu bảng quizzes chưa có cột category */ }

        return {
            kpi: {
                totalStudyMinutes: totalMinutes,
                totalStudyHours: (totalMinutes / 60).toFixed(1),
                completedLessonsCount,
                totalQuizzesTaken,
                avgQuizScorePercent,
                currentStreakDays,
                weeklyGrowthPercent: 0
            },
            weeklyActivity,
            quizTrends,
            courseCompletion,
            skillRadar
        };
    } catch (error) {
        handleServiceError(error, 'Lỗi khi lấy tổng quan phân tích học tập');
    }
};

module.exports = {
    getUserHeatmap,
    getUserAnalyticsSummary
};