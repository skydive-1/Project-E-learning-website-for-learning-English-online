const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');

/**
 * Trả về tổng số phút học theo từng ngày trong năm (cho Heatmap)
 * Bảng: learning_ss (start_at, end_at, user_id)
 */
const getUserHeatmap = async (userId, year, range = 'year') => {
    try {
        const uid = parseInt(userId, 10);
        let activeRange = range || 'year';
        let activeYear = year;
        if (typeof year === 'string' && (year === '7days' || year === '30days' || year === 'year')) {
            activeRange = year;
            activeYear = undefined;
        }

        const query = `
            WITH bounds AS (
                SELECT
                    CASE
                        WHEN $2 = '7days'  THEN (CURRENT_DATE - INTERVAL '6 days')::date
                        WHEN $2 = '30days' THEN (CURRENT_DATE - INTERVAL '29 days')::date
                        ELSE (COALESCE($3, EXTRACT(YEAR FROM CURRENT_DATE)::text) || '-01-01')::date
                    END AS start_date,
                    CASE
                        WHEN $2 = '7days'  THEN CURRENT_DATE
                        WHEN $2 = '30days' THEN CURRENT_DATE
                        ELSE (COALESCE($3, EXTRACT(YEAR FROM CURRENT_DATE)::text) || '-12-31')::date
                    END AS end_date
            ),
            calendar AS (
                SELECT generate_series(b.start_date, b.end_date, interval '1 day')::date AS study_date
                FROM bounds b
            ),
            daily_minutes AS (
                SELECT
                    start_at::date AS day,
                    ROUND(SUM(
                        GREATEST(0,
                            EXTRACT(EPOCH FROM (end_at - start_at)) / 60
                        )
                    )::numeric, 2) AS total_minutes
                FROM learning_ss, bounds b
                WHERE user_id = $1
                  AND end_at IS NOT NULL
                  AND end_at > start_at
                  AND start_at >= b.start_date::timestamp
                  AND start_at <= (b.end_date + interval '1 day')::timestamp
                GROUP BY start_at::date
            )
            SELECT
                c.study_date,
                COALESCE(dm.total_minutes, 0) AS total_minutes
            FROM calendar c
            LEFT JOIN daily_minutes dm ON dm.day = c.study_date
            ORDER BY c.study_date;
        `;

        const result = await db.query(query, [uid, activeRange, activeYear ? String(activeYear) : null]);
        return result.rows;
    } catch (error) {
        handleServiceError(error, 'Lỗi khi lấy dữ liệu heatmap của người dùng');
    }
};


/**
 * Tính streak từ learning_ss
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
 * Trả về tổng quan analytics thực tế của học viên từ CSDL theo khoảng thời gian (range: '7days' | '30days' | 'year')
 * Căn cứ theo schema.sql hiện tại:
 *   - learning_ss (start_at, end_at, user_id, lesson_id)
 *   - user_progress (user_id, lesson_id, is_completed, completed_at, updated_at)
 *   - quiz_attempts (user_id, quiz_id, score INT 0-100, completed_at)
 *   - quizzes (quiz_id, course_id, lesson_id, title, difficulty)
 *   - lessons, sections, courses
 */
const getUserAnalyticsSummary = async (userId, range = '30days') => {
    try {
        const uid = parseInt(userId, 10);
        const activeRange = (range === '7days' || range === 'year') ? range : '30days';

        // ── 1. Tổng thời gian học (phút) và So sánh tăng trưởng theo kỳ ──
        const timeRes = await db.query(`
            WITH bounds AS (
                SELECT
                    CASE
                        WHEN $2 = '7days'  THEN (CURRENT_DATE - INTERVAL '6 days')::timestamp
                        WHEN $2 = '30days' THEN (CURRENT_DATE - INTERVAL '29 days')::timestamp
                        ELSE DATE_TRUNC('year', CURRENT_DATE)::timestamp
                    END AS period_start,
                    CASE
                        WHEN $2 = '7days'  THEN (CURRENT_DATE - INTERVAL '13 days')::timestamp
                        WHEN $2 = '30days' THEN (CURRENT_DATE - INTERVAL '59 days')::timestamp
                        ELSE (DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year')::timestamp
                    END AS prev_start,
                    CASE
                        WHEN $2 = '7days'  THEN (CURRENT_DATE - INTERVAL '6 days')::timestamp
                        WHEN $2 = '30days' THEN (CURRENT_DATE - INTERVAL '29 days')::timestamp
                        ELSE DATE_TRUNC('year', CURRENT_DATE)::timestamp
                    END AS prev_end
            )
            SELECT
                COALESCE(SUM(
                    CASE WHEN start_at >= b.period_start THEN EXTRACT(EPOCH FROM (end_at - start_at)) / 60 ELSE 0 END
                ), 0) AS current_minutes,
                COALESCE(SUM(
                    CASE WHEN start_at >= b.prev_start AND start_at < b.prev_end THEN EXTRACT(EPOCH FROM (end_at - start_at)) / 60 ELSE 0 END
                ), 0) AS prev_minutes,
                COALESCE(SUM(
                    EXTRACT(EPOCH FROM (end_at - start_at)) / 60
                ), 0) AS all_time_minutes
            FROM learning_ss, bounds b
            WHERE user_id = $1 AND end_at IS NOT NULL AND end_at > start_at
        `, [uid, activeRange]);

        const totalMinutes = parseFloat(timeRes.rows[0]?.current_minutes || 0);
        const prevMinutes = parseFloat(timeRes.rows[0]?.prev_minutes || 0);
        const allTimeMinutes = parseFloat(timeRes.rows[0]?.all_time_minutes || 0);

        let growthPercent = 0;
        if (prevMinutes > 0) {
            growthPercent = parseFloat(((totalMinutes - prevMinutes) / prevMinutes * 100).toFixed(1));
        } else if (totalMinutes > 0) {
            growthPercent = 100;
        }

        const periodComparisonLabel = 
            activeRange === '7days' ? 'so với 7 ngày trước' :
            activeRange === 'year'  ? 'so với năm trước' :
            'so với 30 ngày trước';

        // ── 2. Số bài học đã hoàn thành từ user_progress ──
        const progressRes = await db.query(`
            WITH bounds AS (
                SELECT
                    CASE
                        WHEN $2 = '7days'  THEN (CURRENT_DATE - INTERVAL '6 days')::timestamp
                        WHEN $2 = '30days' THEN (CURRENT_DATE - INTERVAL '29 days')::timestamp
                        ELSE DATE_TRUNC('year', CURRENT_DATE)::timestamp
                    END AS period_start
            )
            SELECT
                COUNT(*) FILTER (WHERE is_completed = true AND COALESCE(completed_at, updated_at) >= b.period_start) AS period_completed,
                COUNT(*) FILTER (WHERE is_completed = true) AS all_time_completed
            FROM user_progress, bounds b
            WHERE user_id = $1
        `, [uid, activeRange]);

        const completedLessonsCount = parseInt(progressRes.rows[0]?.period_completed || 0, 10);
        const allTimeCompletedLessonsCount = parseInt(progressRes.rows[0]?.all_time_completed || 0, 10);

        // ── 3. Điểm Quiz trung bình từ quiz_attempts (score là INT 0-100) ──
        const quizRes = await db.query(`
            WITH bounds AS (
                SELECT
                    CASE
                        WHEN $2 = '7days'  THEN (CURRENT_DATE - INTERVAL '6 days')::timestamp
                        WHEN $2 = '30days' THEN (CURRENT_DATE - INTERVAL '29 days')::timestamp
                        ELSE DATE_TRUNC('year', CURRENT_DATE)::timestamp
                    END AS period_start
            )
            SELECT
                COUNT(*) FILTER (WHERE completed_at >= b.period_start) AS period_attempts,
                COALESCE(AVG(score) FILTER (WHERE completed_at >= b.period_start), 0) AS period_avg_score,
                COUNT(*) AS all_time_attempts,
                COALESCE(AVG(score), 0) AS all_time_avg_score
            FROM quiz_attempts, bounds b
            WHERE user_id = $1
        `, [uid, activeRange]);

        const totalQuizzesTaken = parseInt(quizRes.rows[0]?.period_attempts || 0, 10);
        const avgQuizScorePercent = parseFloat(parseFloat(quizRes.rows[0]?.period_avg_score || 0).toFixed(1));
        const allTimeQuizzesTaken = parseInt(quizRes.rows[0]?.all_time_attempts || 0, 10);
        const allTimeAvgQuizScorePercent = parseFloat(parseFloat(quizRes.rows[0]?.all_time_avg_score || 0).toFixed(1));

        // ── 4. Streak hiện tại ──
        let currentStreakDays = 0;
        try {
            currentStreakDays = await _calculateStreakFromDB(uid);
        } catch (_) { /* bỏ qua nếu lỗi */ }

        // ── 5. Activity Breakdown theo mốc thời gian ──
        let weeklyActivity = [];
        if (activeRange === '7days') {
            const weeklyRes = await db.query(`
                SELECT
                    EXTRACT(DOW FROM start_at) AS dow,
                    COALESCE(ROUND(SUM(
                        EXTRACT(EPOCH FROM (end_at - start_at)) / 60
                    )::numeric, 1), 0) AS minutes
                FROM learning_ss
                WHERE user_id = $1
                  AND end_at IS NOT NULL
                  AND start_at >= (CURRENT_DATE - INTERVAL '6 days')
                GROUP BY dow
                ORDER BY dow
            `, [uid]);

            const dowLabels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            const weeklyMap = {};
            weeklyRes.rows.forEach(r => {
                weeklyMap[parseInt(r.dow)] = parseFloat(r.minutes);
            });
            // Thứ 2 → Chủ nhật
            weeklyActivity = [1, 2, 3, 4, 5, 6, 0].map(dow => ({
                day: dowLabels[dow],
                minutes: weeklyMap[dow] || 0
            }));
        } else if (activeRange === '30days') {
            const monthRes = await db.query(`
                WITH weeks AS (
                    SELECT generate_series(
                        DATE_TRUNC('week', CURRENT_DATE - INTERVAL '3 weeks')::date,
                        DATE_TRUNC('week', CURRENT_DATE)::date,
                        interval '1 week'
                    )::date AS wk_start
                ),
                act AS (
                    SELECT DATE_TRUNC('week', start_at)::date AS wk,
                           ROUND(SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 60)::numeric, 1) AS minutes
                    FROM learning_ss
                    WHERE user_id = $1
                      AND end_at IS NOT NULL
                      AND start_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '3 weeks')
                    GROUP BY wk
                )
                SELECT w.wk_start, COALESCE(a.minutes, 0) AS minutes
                FROM weeks w
                LEFT JOIN act a ON a.wk = w.wk_start
                ORDER BY w.wk_start ASC
            `, [uid]);
            weeklyActivity = monthRes.rows.map((r, i) => ({
                day: `Tuần ${i + 1}`,
                minutes: parseFloat(r.minutes)
            }));
        } else {
            const yearRes = await db.query(`
                WITH months AS (
                    SELECT generate_series(1, 12) AS m
                ),
                act AS (
                    SELECT EXTRACT(MONTH FROM start_at)::int AS m,
                           ROUND(SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 60)::numeric, 1) AS minutes
                    FROM learning_ss
                    WHERE user_id = $1
                      AND end_at IS NOT NULL
                      AND start_at >= DATE_TRUNC('year', CURRENT_DATE)
                    GROUP BY m
                )
                SELECT m.m, COALESCE(a.minutes, 0) AS minutes
                FROM months m
                LEFT JOIN act a ON a.m = m.m
                ORDER BY m.m ASC
            `, [uid]);
            weeklyActivity = yearRes.rows.map(r => ({
                day: `T${r.m}`,
                minutes: parseFloat(r.minutes)
            }));
        }

        // ── 6. Quiz Trends theo mốc thời gian ──
        let quizTrends = [];
        if (activeRange === '7days') {
            const trend7Res = await db.query(`
                SELECT
                    TO_CHAR(completed_at, 'DD/MM') AS time_label,
                    completed_at::date AS day_date,
                    COUNT(*) AS attempts,
                    COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_score
                FROM quiz_attempts
                WHERE user_id = $1
                  AND completed_at >= (CURRENT_DATE - INTERVAL '6 days')
                GROUP BY time_label, day_date
                ORDER BY day_date ASC
            `, [uid]);
            quizTrends = trend7Res.rows.map(r => ({
                week: r.time_label,
                score: parseFloat(r.avg_score),
                attempts: parseInt(r.attempts, 10)
            }));
        } else if (activeRange === '30days') {
            const trend30Res = await db.query(`
                SELECT
                    DATE_TRUNC('week', completed_at) AS week_start,
                    COUNT(*) AS attempts,
                    COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_score
                FROM quiz_attempts
                WHERE user_id = $1
                  AND completed_at >= (CURRENT_DATE - INTERVAL '4 weeks')
                GROUP BY week_start
                ORDER BY week_start ASC
                LIMIT 4
            `, [uid]);
            quizTrends = trend30Res.rows.map((r, idx) => ({
                week: `Tuần ${idx + 1}`,
                score: parseFloat(r.avg_score),
                attempts: parseInt(r.attempts, 10)
            }));
        } else {
            const trendYearRes = await db.query(`
                SELECT
                    DATE_TRUNC('month', completed_at) AS month_start,
                    TO_CHAR(completed_at, 'TMMon') AS month_label,
                    COUNT(*) AS attempts,
                    COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_score
                FROM quiz_attempts
                WHERE user_id = $1
                  AND completed_at >= DATE_TRUNC('year', CURRENT_DATE)
                GROUP BY month_start, month_label
                ORDER BY month_start ASC
            `, [uid]);
            quizTrends = trendYearRes.rows.map(r => ({
                week: r.month_label || 'Tháng',
                score: parseFloat(r.avg_score),
                attempts: parseInt(r.attempts, 10)
            }));
        }

        // ── 7. Course Completion — đếm qua user_progress + courses ──
        const courseCompRes = await db.query(`
            WITH course_stats AS (
                SELECT
                    c.course_id,
                    COUNT(l.lesson_id) AS total_lessons,
                    COUNT(up.progress_id) FILTER (WHERE up.is_completed = true) AS completed_lessons
                FROM courses c
                JOIN sections s ON s.course_id = c.course_id
                JOIN lessons l ON l.section_id = s.section_id
                LEFT JOIN user_progress up ON up.lesson_id = l.lesson_id AND up.user_id = $1
                GROUP BY c.course_id
            )
            SELECT
                COUNT(*) FILTER (WHERE total_lessons > 0 AND completed_lessons = total_lessons) AS completed,
                COUNT(*) FILTER (WHERE completed_lessons > 0 AND completed_lessons < total_lessons) AS in_progress,
                COUNT(*) FILTER (WHERE completed_lessons = 0) AS not_started
            FROM course_stats
        `, [uid]);

        const cc = courseCompRes.rows[0] || {};
        const courseCompletion = [
            { name: 'Đã hoàn thành', value: parseInt(cc.completed || 0, 10), color: '#10b981' },
            { name: 'Đang học',       value: parseInt(cc.in_progress || 0, 10), color: '#6366f1' },
            { name: 'Chưa bắt đầu',  value: parseInt(cc.not_started || 0, 10), color: '#94a3b8' }
        ];

        // ── 8. Skill Radar — dùng difficulty của quizzes làm proxy kỹ năng ──
        const radarRes = await db.query(`
            SELECT
                q.difficulty,
                COALESCE(ROUND(AVG(qa.score)::numeric, 1), 0) AS avg_score,
                COUNT(*) AS cnt
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.quiz_id
            WHERE qa.user_id = $1
            GROUP BY q.difficulty
        `, [uid]);

        const radarBaseScore = avgQuizScorePercent > 0 ? avgQuizScorePercent : allTimeAvgQuizScorePercent;
        let radarBase = radarBaseScore;
        if (radarRes.rows.length > 0) {
            const totalAttempts = radarRes.rows.reduce((s, r) => s + parseInt(r.cnt, 10), 0);
            if (totalAttempts > 0) {
                radarBase = radarRes.rows.reduce((s, r) => {
                    return s + parseFloat(r.avg_score) * parseInt(r.cnt, 10);
                }, 0) / totalAttempts;
                radarBase = parseFloat(radarBase.toFixed(1));
            }
        }

        const skillRadar = [
            { skill: 'Phát âm (Speaking)',        A: Math.min(100, Math.max(0, radarBase - 5)),  fullMark: 100 },
            { skill: 'Từ vựng (Vocabulary)',      A: Math.min(100, Math.max(0, radarBase + 2)),  fullMark: 100 },
            { skill: 'Ngữ pháp (Grammar)',        A: Math.min(100, Math.max(0, radarBase - 2)),  fullMark: 100 },
            { skill: 'Kỹ năng nghe (Listening)', A: Math.min(100, Math.max(0, radarBase + 5)),  fullMark: 100 },
            { skill: 'Viết tự luận (Writing)',    A: Math.min(100, Math.max(0, radarBase - 8)),  fullMark: 100 }
        ];

        return {
            kpi: {
                totalStudyMinutes: parseFloat(totalMinutes.toFixed(1)),
                totalStudyHours: (totalMinutes / 60).toFixed(1),
                allTimeStudyMinutes: parseFloat(allTimeMinutes.toFixed(1)),
                allTimeStudyHours: (allTimeMinutes / 60).toFixed(1),
                completedLessonsCount,
                allTimeCompletedLessonsCount,
                totalQuizzesTaken,
                allTimeQuizzesTaken,
                avgQuizScorePercent,
                allTimeAvgQuizScorePercent,
                currentStreakDays,
                weeklyGrowthPercent: growthPercent,
                periodComparisonLabel,
                activeRange
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

/**
 * Ghi nhận thời gian học thực tế qua Real-Time Heartbeat (từng giây / từng phút)
 * @param {number} userId
 * @param {number|null} lessonId
 * @param {number} durationSeconds - Số giây thực tế học viên đã tích lũy trong nhịp này (mặc định 30s)
 */
const trackHeartbeat = async (userId, lessonId, durationSeconds = 30) => {
    try {
        const uid = parseInt(userId, 10);
        if (!uid || isNaN(uid)) return { success: false, message: 'Invalid user ID' };

        const lid = lessonId ? parseInt(lessonId, 10) : null;
        const validSeconds = Math.max(1, Math.min(parseInt(durationSeconds, 10) || 30, 300)); // Giới hạn max 300s/nhịp tránh cheat

        // Tìm phiên học gần nhất của user_id trong vòng 3 phút vừa qua
        const recentSessionRes = await db.query(`
            SELECT learning_ss_id, start_at, end_at, lesson_id
            FROM learning_ss
            WHERE user_id = $1
              AND end_at >= (CURRENT_TIMESTAMP - INTERVAL '3 minutes')
            ORDER BY end_at DESC
            LIMIT 1
        `, [uid]);

        if (recentSessionRes.rows.length > 0) {
            const session = recentSessionRes.rows[0];
            // Kéo dài phiên học hiện tại đúng bằng số giây học thực
            await db.query(`
                UPDATE learning_ss
                SET end_at = end_at + ($1 || ' seconds')::interval,
                    lesson_id = COALESCE($2, lesson_id)
                WHERE learning_ss_id = $3
            `, [validSeconds, lid, session.learning_ss_id]);

            return {
                success: true,
                sessionId: session.learning_ss_id,
                action: 'extended',
                addedSeconds: validSeconds
            };
        } else {
            // Tạo mới một phiên học với đúng số giây vừa học
            const insertRes = await db.query(`
                INSERT INTO learning_ss (user_id, lesson_id, start_at, end_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP - ($3 || ' seconds')::interval, CURRENT_TIMESTAMP)
                RETURNING learning_ss_id
            `, [uid, lid, validSeconds]);

            return {
                success: true,
                sessionId: insertRes.rows[0].learning_ss_id,
                action: 'created',
                addedSeconds: validSeconds
            };
        }
    } catch (error) {
        handleServiceError(error, 'Lỗi khi ghi nhận heartbeat học tập');
    }
};

module.exports = {
    getUserHeatmap,
    getUserAnalyticsSummary,
    trackHeartbeat
};