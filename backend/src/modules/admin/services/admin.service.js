/**
 * Admin Service - Thực hiện các thao tác quản trị trên CSDL
 */

const { pool } = require('../../../config/database');
const { supabaseAdmin } = require('../../../config/supabase');
const { handleServiceError } = require('../../../utils/service-errors');
const { getQuestionQuotaSnapshot } = require('../../chatbot/services/aiQuestionQuota.service');

// Helper lấy ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam (UTC+7)
const getVietnamDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

/**
 * Lấy danh sách tất cả người dùng kèm thông tin vai trò
 */
const getAllUsers = async () => {
  const query = `
    SELECT 
      u.user_id,
      u.username,
      u.email,
      u.full_name,
      u.created_date,
      u.role_id,
      COALESCE(r.role_name, CASE WHEN u.role_id = 1 THEN 'Admin' WHEN u.role_id = 2 THEN 'Instructor' ELSE 'Student' END) as role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.role_id
    ORDER BY u.created_date DESC
  `;
  const result = await pool.query(query);
  return result.rows;
};

/**
 * Cập nhật vai trò (role_id) của người dùng
 * @param {number} userId - ID của người dùng cần cập nhật
 * @param {number} roleId - ID vai trò mới (1: Admin, 2: Instructor, 3: Student)
 */
const updateUserRole = async (userId, roleId) => {
  const query = `
    UPDATE users 
    SET role_id = $1 
    WHERE user_id = $2 
    RETURNING user_id, username, email, role_id
  `;
  const result = await pool.query(query, [roleId, userId]);
  
  if (result.rows.length === 0) {
    const error = new Error('Không tìm thấy người dùng');
    error.status = 404;
    throw error;
  }
  
  return result.rows[0];
};

/**
 * Xóa tài khoản người dùng triệt để (xóa sạch ở tất cả các bảng liên quan để tránh dính lỗi khóa ngoại)
 * @param {number} userId - ID của người dùng cần xóa
 */
const deleteUser = async (userId) => {
  // 1. Lấy thông tin email & supabase_uid để xóa tài khoản trên Supabase Auth
  const userRes = await pool.query('SELECT email, supabase_uid FROM users WHERE user_id = $1', [userId]);
  if (userRes.rows.length === 0) {
    const error = new Error('Không tìm thấy người dùng để xóa');
    error.status = 404;
    throw error;
  }

  const { email: targetEmail, supabase_uid: supabaseUid } = userRes.rows[0];

  const client = await pool.connect();
  let deletedUserRow = null;

  try {
    await client.query('BEGIN');

    // Dọn dẹp tất cả các bảng liên quan đến user_id trong schema public trước khi xóa trong users
    const tablesToClean = [
      { table: 'user_token_usage', col: 'user_id' },
      { table: 'user_token_limits', col: 'user_id' },
      { table: 'ai_question_quotas', col: 'user_id' },
      { table: 'quiz_attempts', col: 'user_id' },
      { table: 'user_progress', col: 'user_id' },
      { table: 'ai_chat', col: 'student_id' },
      { table: 'teachers', col: 'user_id' },
      { table: 'students', col: 'user_id' }
    ];

    for (const item of tablesToClean) {
      const checkExist = await client.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [item.table]
      );
      if (checkExist.rows[0].exists) {
        await client.query(`DELETE FROM ${item.table} WHERE ${item.col} = $1`, [userId]);
      }
    }

    // Cập nhật instructor_id = NULL ở bảng courses nếu có
    const checkCourses = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courses')"
    );
    if (checkCourses.rows[0].exists) {
      await client.query('UPDATE courses SET instructor_id = NULL WHERE instructor_id = $1', [userId]);
    }

    // Xóa chính tài khoản trong bảng users
    const result = await client.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, username, email', 
      [userId]
    );

    await client.query('COMMIT');
    deletedUserRow = result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Lỗi CSDL khi xóa người dùng ${userId}:`, error);
    handleServiceError(error, 'Lỗi xóa người dùng trong AdminService');
  } finally {
    client.release();
  }

  // 2. Xóa tài khoản trên Supabase Auth SDK và auth.users ngoài Transaction block
  if (supabaseUid && supabaseAdmin) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
      console.log(`✅ Đã xóa user ${userId} trên Supabase Auth SDK`);
    } catch (sbException) {
      console.warn(`⚠️ Cảnh báo khi xóa user trên Supabase Auth SDK:`, sbException.message);
    }
  }

  try {
    await pool.query('DELETE FROM auth.users WHERE email = $1 OR id = $2', [targetEmail, supabaseUid]);
  } catch (authSqlErr) {
    // Bỏ qua nếu CSDL local không có schema auth
  }

  return deletedUserRow;
};

/**
 * Reset token cho một tài khoản cụ thể (đưa used_tokens về 0)
 * @param {number} userId - ID của người dùng cần reset token
 */
const resetUserToken = async (userId) => {
  const query = `
    INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date)
    VALUES ($1, 6000, 0, $2)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      used_tokens = 0,
      reset_date = EXCLUDED.reset_date,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, max_tokens, used_tokens, reset_date
  `;
  const result = await pool.query(query, [userId, getVietnamDateString()]);
  await pool.query(
    `INSERT INTO ai_question_quotas (user_id, used_questions, window_started_at, updated_at)
     VALUES ($1, 0, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       used_questions = 0,
       window_started_at = NOW(),
       updated_at = NOW()`,
    [userId]
  );
  return { ...result.rows[0], questions_used: 0 };
};

/**
 * Reset token hàng loạt cho toàn bộ người dùng theo Role (Học sinh/Giảng viên)
 * @param {number} roleId - ID vai trò cần reset token (2: Instructor, 3: Student)
 */
const resetTokensByRole = async (roleId) => {
  const todayStr = getVietnamDateString();
  const query = `
    INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date)
    SELECT user_id, 6000, 0, $1
    FROM users
    WHERE role_id = $2
    ON CONFLICT (user_id)
    DO UPDATE SET
      used_tokens = 0,
      reset_date = EXCLUDED.reset_date,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, used_tokens, reset_date
  `;
  const result = await pool.query(query, [todayStr, roleId]);
  await pool.query(
    `INSERT INTO ai_question_quotas (user_id, used_questions, window_started_at, updated_at)
     SELECT user_id, 0, NOW(), NOW()
     FROM users
     WHERE role_id = $1
     ON CONFLICT (user_id) DO UPDATE SET
       used_questions = 0,
       window_started_at = NOW(),
       updated_at = NOW()`,
    [roleId]
  );
  return result.rows;
};

/**
 * Tổng hợp dữ liệu vận hành và tiến trình học của toàn bộ học viên.
 * Các chỉ số theo khoảng thời gian dùng dữ liệu thật; tiến độ khóa học là lũy kế.
 * @param {number} days - Khoảng thời gian 7, 30, 90 hoặc 365 ngày
 */
const getAnalyticsDashboard = async (days = 30) => {
  const safeDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;

  const overviewQuery = `
    WITH bounds AS (
      SELECT
        CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day' AS period_start,
        CURRENT_DATE + INTERVAL '1 day' AS period_end
    ),
    period_activity AS (
      SELECT user_id FROM learning_ss, bounds
      WHERE start_at >= period_start AND start_at < period_end
      UNION
      SELECT user_id FROM user_progress, bounds
      WHERE updated_at >= period_start AND updated_at < period_end
      UNION
      SELECT user_id FROM quiz_attempts, bounds
      WHERE completed_at >= period_start AND completed_at < period_end
      UNION
      SELECT student_id AS user_id FROM ai_chat, bounds
      WHERE created_at >= period_start AND created_at < period_end
    )
    SELECT
      (SELECT COUNT(*) FROM users WHERE role_id = 3)::int AS total_learners,
      (SELECT COUNT(*) FROM users, bounds WHERE role_id = 3 AND created_date >= period_start AND created_date < period_end)::int AS new_learners,
      (SELECT COUNT(*) FROM users u WHERE u.role_id = 3 AND EXISTS (
        SELECT 1 FROM period_activity pa WHERE pa.user_id = u.user_id
      ))::int AS active_learners,
      (SELECT COUNT(*) FROM courses WHERE status = 'published')::int AS published_courses,
      (SELECT COUNT(*) FROM lessons)::int AS total_lessons,
      (SELECT COUNT(*) FROM user_progress, bounds
        WHERE is_completed = true AND completed_at >= period_start AND completed_at < period_end)::int AS lessons_completed,
      (SELECT COALESCE(ROUND(SUM(LEAST(240, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(end_at, start_at) - start_at)) / 60)))::numeric, 0), 0)
        FROM learning_ss, bounds WHERE start_at >= period_start AND start_at < period_end)::int AS study_minutes,
      (SELECT COALESCE(ROUND(AVG(score)::numeric, 1), 0)
        FROM quiz_attempts, bounds WHERE completed_at >= period_start AND completed_at < period_end)::float AS average_quiz_score,
      (SELECT COUNT(*) FROM quiz_attempts, bounds
        WHERE completed_at >= period_start AND completed_at < period_end)::int AS quiz_attempts,
      (SELECT COUNT(*) FROM ai_chat, bounds
        WHERE created_at >= period_start AND created_at < period_end)::int AS ai_messages,
      (SELECT COALESCE(SUM(used_tokens), 0) FROM user_token_limits)::bigint AS ai_tokens_used
  `;

  const trendQuery = `
    WITH bounds AS (
      SELECT CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day' AS period_start
    ),
    calendar AS (
      SELECT generate_series(period_start::date, CURRENT_DATE, INTERVAL '1 day')::date AS day
      FROM bounds
    ),
    sessions AS (
      SELECT
        start_at::date AS day,
        COUNT(DISTINCT user_id)::int AS active_learners,
        ROUND(SUM(LEAST(240, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(end_at, start_at) - start_at)) / 60)))::numeric, 0)::int AS study_minutes
      FROM learning_ss, bounds
      WHERE start_at >= period_start
      GROUP BY start_at::date
    ),
    completions AS (
      SELECT completed_at::date AS day, COUNT(*)::int AS completed_lessons
      FROM user_progress, bounds
      WHERE is_completed = true AND completed_at >= period_start
      GROUP BY completed_at::date
    ),
    registrations AS (
      SELECT created_date::date AS day, COUNT(*)::int AS new_learners
      FROM users, bounds
      WHERE role_id = 3 AND created_date >= period_start
      GROUP BY created_date::date
    )
    SELECT
      c.day,
      COALESCE(s.active_learners, 0)::int AS active_learners,
      COALESCE(s.study_minutes, 0)::int AS study_minutes,
      COALESCE(cp.completed_lessons, 0)::int AS completed_lessons,
      COALESCE(r.new_learners, 0)::int AS new_learners
    FROM calendar c
    LEFT JOIN sessions s ON s.day = c.day
    LEFT JOIN completions cp ON cp.day = c.day
    LEFT JOIN registrations r ON r.day = c.day
    ORDER BY c.day
  `;

  const learnersQuery = `
    WITH bounds AS (
      SELECT CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day' AS period_start
    ),
    course_lesson_counts AS (
      SELECT s.course_id, COUNT(l.lesson_id)::int AS lesson_count
      FROM sections s
      JOIN lessons l ON l.section_id = s.section_id
      GROUP BY s.course_id
    ),
    started_courses AS (
      SELECT DISTINCT up.user_id, s.course_id
      FROM user_progress up
      JOIN lessons l ON l.lesson_id = up.lesson_id
      JOIN sections s ON s.section_id = l.section_id
    ),
    learner_scope AS (
      SELECT sc.user_id, COALESCE(SUM(clc.lesson_count), 0)::int AS available_lessons
      FROM started_courses sc
      JOIN course_lesson_counts clc ON clc.course_id = sc.course_id
      GROUP BY sc.user_id
    ),
    progress AS (
      SELECT
        up.user_id,
        COUNT(*) FILTER (WHERE up.is_completed = true)::int AS completed_lessons,
        COUNT(*) FILTER (WHERE up.is_completed = true AND up.completed_at >= bounds.period_start)::int AS period_completions,
        MAX(COALESCE(up.updated_at, up.completed_at)) AS last_progress_at
      FROM user_progress up, bounds
      GROUP BY up.user_id
    ),
    study AS (
      SELECT
        ls.user_id,
        ROUND(SUM(LEAST(240, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ls.end_at, ls.start_at) - ls.start_at)) / 60)))::numeric, 0)::int AS study_minutes,
        MAX(ls.start_at) AS last_study_at
      FROM learning_ss ls, bounds
      WHERE ls.start_at >= bounds.period_start
      GROUP BY ls.user_id
    ),
    quiz AS (
      SELECT
        qa.user_id,
        COUNT(*)::int AS quiz_attempts,
        ROUND(AVG(qa.score)::numeric, 1)::float AS average_quiz_score,
        MAX(qa.completed_at) AS last_quiz_at
      FROM quiz_attempts qa, bounds
      WHERE qa.completed_at >= bounds.period_start
      GROUP BY qa.user_id
    ),
    chat AS (
      SELECT student_id AS user_id, COUNT(*)::int AS ai_messages, MAX(created_at) AS last_chat_at
      FROM ai_chat, bounds
      WHERE created_at >= bounds.period_start
      GROUP BY student_id
    )
    SELECT
      u.user_id,
      u.username,
      u.full_name,
      u.email,
      u.profile_picture_url,
      u.created_date,
      COALESCE(p.completed_lessons, 0)::int AS completed_lessons,
      COALESCE(p.period_completions, 0)::int AS period_completions,
      COALESCE(ls.available_lessons, 0)::int AS available_lessons,
      CASE WHEN COALESCE(ls.available_lessons, 0) > 0
        THEN LEAST(100, ROUND(COALESCE(p.completed_lessons, 0) * 100.0 / ls.available_lessons))::int
        ELSE 0
      END AS progress_percent,
      COALESCE(st.study_minutes, 0)::int AS study_minutes,
      COALESCE(q.quiz_attempts, 0)::int AS quiz_attempts,
      COALESCE(q.average_quiz_score, 0)::float AS average_quiz_score,
      COALESCE(ch.ai_messages, 0)::int AS ai_messages,
      COALESCE(utl.used_tokens, 0)::int AS used_tokens,
      GREATEST(u.last_seen_at, p.last_progress_at, st.last_study_at, q.last_quiz_at, ch.last_chat_at) AS last_activity_at
    FROM users u
    LEFT JOIN progress p ON p.user_id = u.user_id
    LEFT JOIN learner_scope ls ON ls.user_id = u.user_id
    LEFT JOIN study st ON st.user_id = u.user_id
    LEFT JOIN quiz q ON q.user_id = u.user_id
    LEFT JOIN chat ch ON ch.user_id = u.user_id
    LEFT JOIN user_token_limits utl ON utl.user_id = u.user_id
    WHERE u.role_id = 3
    ORDER BY last_activity_at DESC NULLS LAST, u.created_date DESC
  `;

  const coursesQuery = `
    WITH course_lessons AS (
      SELECT c.course_id, c.course_name, c.status, COUNT(l.lesson_id)::int AS total_lessons
      FROM courses c
      LEFT JOIN sections s ON s.course_id = c.course_id
      LEFT JOIN lessons l ON l.section_id = s.section_id
      GROUP BY c.course_id, c.course_name, c.status
    ),
    learner_course_progress AS (
      SELECT
        s.course_id,
        up.user_id,
        COUNT(*) FILTER (WHERE up.is_completed = true)::int AS completed_lessons
      FROM user_progress up
      JOIN lessons l ON l.lesson_id = up.lesson_id
      JOIN sections s ON s.section_id = l.section_id
      GROUP BY s.course_id, up.user_id
    )
    SELECT
      cl.course_id,
      cl.course_name,
      cl.status,
      cl.total_lessons,
      COUNT(lcp.user_id)::int AS learners,
      COALESCE(ROUND(AVG(
        CASE WHEN cl.total_lessons > 0 THEN LEAST(100, lcp.completed_lessons * 100.0 / cl.total_lessons) ELSE 0 END
      )::numeric, 0), 0)::int AS average_progress,
      COUNT(*) FILTER (WHERE cl.total_lessons > 0 AND lcp.completed_lessons >= cl.total_lessons)::int AS completed_learners
    FROM course_lessons cl
    LEFT JOIN learner_course_progress lcp ON lcp.course_id = cl.course_id
    GROUP BY cl.course_id, cl.course_name, cl.status, cl.total_lessons
    ORDER BY learners DESC, cl.course_name ASC
    LIMIT 8
  `;

  const [overviewResult, trendResult, learnersResult, coursesResult] = await Promise.all([
    pool.query(overviewQuery, [safeDays]),
    pool.query(trendQuery, [safeDays]),
    pool.query(learnersQuery, [safeDays]),
    pool.query(coursesQuery)
  ]);

  const now = Date.now();
  const learners = learnersResult.rows.map((learner) => {
    const lastActivityTime = learner.last_activity_at ? new Date(learner.last_activity_at).getTime() : null;
    let inactiveMinutes = null;
    let inactiveDays = null;
    let engagementStatus = 'inactive';
    let isOnline = false;

    if (lastActivityTime) {
      const diffMs = now - lastActivityTime;
      inactiveMinutes = Math.max(0, Math.floor(diffMs / 60000));
      inactiveDays = Math.max(0, Math.floor(diffMs / 86400000));

      if (inactiveMinutes <= 15) {
        isOnline = true;
        engagementStatus = 'online';
      } else if (inactiveDays === 0 || inactiveMinutes <= 24 * 60) {
        engagementStatus = 'active';
      } else if (inactiveDays <= 7) {
        engagementStatus = 'recent';
      } else if (inactiveDays <= 30) {
        engagementStatus = 'attention';
      } else {
        engagementStatus = 'inactive';
      }
    }

    return {
      ...learner,
      is_online: isOnline,
      inactive_minutes: inactiveMinutes,
      inactive_days: inactiveDays,
      engagement_status: engagementStatus
    };
  });

  const engagement = learners.reduce((summary, learner) => {
    const status = learner.engagement_status;
    if (status === 'online' || status === 'active') {
      summary.active = (summary.active || 0) + 1;
    } else if (status === 'recent') {
      summary.recent = (summary.recent || 0) + 1;
    } else if (status === 'attention') {
      summary.attention = (summary.attention || 0) + 1;
    } else {
      summary.inactive = (summary.inactive || 0) + 1;
    }
    return summary;
  }, { active: 0, recent: 0, attention: 0, inactive: 0 });

  return {
    rangeDays: safeDays,
    generatedAt: new Date().toISOString(),
    overview: overviewResult.rows[0],
    engagement,
    trend: trendResult.rows,
    learners,
    courses: coursesResult.rows
  };
};

const parsePositiveCap = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 2147483647) {
    const error = new Error(`${fieldName} phải là số nguyên dương`);
    error.status = 400;
    error.code = 'INVALID_RATE_LIMIT_CAP';
    throw error;
  }
  return parsed;
};

const normalizeRateLimitSetting = (row) => ({
  model: row.model,
  rpmCap: Number(row.rpm_cap),
  tpmCap: Number(row.tpm_cap),
  rpdCap: Number(row.rpd_cap),
  updatedAt: row.updated_at || null,
  updatedBy: row.updated_by === null || row.updated_by === undefined
    ? null
    : Number(row.updated_by),
  updatedByName: row.updated_by_name || null
});

const percentOfCap = (current, cap) => {
  if (!Number.isFinite(cap) || cap <= 0) return null;
  return Number(((current / cap) * 100).toFixed(2));
};

/**
 * Lấy toàn diện Dashboard Quota & Token AI của tất cả User
 */
const getAiQuotaDashboard = async (days = 30) => {
  const safeDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;

  // 1. Tổng quan số liệu Quota & Token toàn hệ thống
  const summaryQuery = `
    WITH bounds AS (
      SELECT CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day' AS period_start
    ),
    active_ai AS (
      SELECT COUNT(DISTINCT student_id)::int as active_ai_users
      FROM ai_chat, bounds
      WHERE created_at >= period_start
    ),
    chat_stats AS (
      SELECT 
        COUNT(*)::int AS total_ai_messages,
        COUNT(*) FILTER (WHERE sender_type = 'user')::int AS total_user_prompts,
        COUNT(*) FILTER (WHERE sender_type = 'bot')::int AS total_bot_replies
      FROM ai_chat, bounds
      WHERE created_at >= period_start
    )
    SELECT
      (SELECT COALESCE(SUM(used_tokens), 0) FROM user_token_limits)::bigint AS total_used_tokens,
      (SELECT COALESCE(SUM(max_tokens), 0) FROM user_token_limits)::bigint AS total_max_tokens,
      (SELECT COALESCE(SUM(remaining_tokens), 0) FROM user_token_limits)::bigint AS total_remaining_tokens,
      (SELECT COALESCE(AVG(used_tokens), 0)::int FROM user_token_limits WHERE used_tokens > 0) AS avg_tokens_per_active_user,
      (SELECT COUNT(*)::int FROM user_token_limits WHERE used_tokens >= max_tokens AND max_tokens > 0) AS exhausted_users_count,
      (SELECT COUNT(*)::int FROM user_token_limits WHERE used_tokens >= (max_tokens * 0.8) AND used_tokens < max_tokens AND max_tokens > 0) AS critical_users_count,
      (SELECT COUNT(*)::int FROM user_token_limits WHERE used_tokens > 0) AS total_users_with_usage,
      (SELECT COALESCE(SUM(
        CASE WHEN date_trunc('day', window_started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  = date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
             THEN used_questions ELSE 0 END
      ), 0)::int FROM ai_question_quotas) AS total_questions_rolling_24h,
      COALESCE(active_ai.active_ai_users, 0) AS active_ai_users_period,
      COALESCE(chat_stats.total_ai_messages, 0) AS total_ai_messages_period,
      COALESCE(chat_stats.total_user_prompts, 0) AS total_user_prompts_period,
      COALESCE(chat_stats.total_bot_replies, 0) AS total_bot_replies_period
    FROM bounds, active_ai, chat_stats
  `;

  // 2. Xu hướng tiêu thụ Token theo ngày (dữ liệu thực từ ai_usage_events)
  const trendsQuery = `
    WITH bounds AS (
      SELECT CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day' AS period_start
    ),
    calendar AS (
      SELECT generate_series(period_start::date, CURRENT_DATE, INTERVAL '1 day')::date AS day
      FROM bounds
    ),
    daily_chats AS (
      SELECT 
        created_at::date AS day,
        COUNT(DISTINCT student_id)::int AS active_ai_users,
        COUNT(*)::int AS total_messages,
        COUNT(*) FILTER (WHERE sender_type = 'user')::int AS user_queries
      FROM ai_chat, bounds
      WHERE created_at >= period_start
      GROUP BY created_at::date
    ),
    live_usage AS (
      SELECT
        created_at::date AS day,
        COALESCE(SUM(total_tokens), 0)::int AS estimated_tokens,
        COALESCE(SUM(total_tokens) FILTER (WHERE purpose NOT IN ('embedding', 'speaking_stt')), 0)::int AS gemini_flash_tokens,
        COALESCE(SUM(total_tokens) FILTER (WHERE purpose = 'embedding'), 0)::int AS gemini_embedding_tokens,
        COALESCE(SUM(total_tokens) FILTER (WHERE purpose = 'speaking_stt'), 0)::int AS speaking_stt_tokens,
        0::int AS backfilled_tokens
      FROM ai_usage_events, bounds
      WHERE created_at >= period_start
      GROUP BY created_at::date
    ),
    historical_usage AS (
      SELECT
        h.usage_date AS day,
        COALESCE(SUM(h.total_tokens), 0)::int AS estimated_tokens,
        COALESCE(SUM(h.total_tokens) FILTER (
          WHERE LOWER(h.model) NOT LIKE '%embedding%'
            AND LOWER(h.model) !~ '(speaking|tts|audio)'
        ), 0)::int AS gemini_flash_tokens,
        COALESCE(SUM(h.total_tokens) FILTER (
          WHERE LOWER(h.model) LIKE '%embedding%'
        ), 0)::int AS gemini_embedding_tokens,
        COALESCE(SUM(h.total_tokens) FILTER (
          WHERE LOWER(h.model) ~ '(speaking|tts|audio)'
        ), 0)::int AS speaking_stt_tokens,
        COALESCE(SUM(h.total_tokens), 0)::int AS backfilled_tokens
      FROM ai_usage_daily_model_history h, bounds
      WHERE h.usage_date >= period_start::date
        AND h.usage_date <= CURRENT_DATE
        AND h.is_trusted = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM ai_usage_events live_event
          WHERE live_event.created_at::date = h.usage_date
        )
      GROUP BY h.usage_date
    ),
    daily_usage AS (
      SELECT
        combined.day,
        SUM(combined.estimated_tokens)::int AS estimated_tokens,
        SUM(combined.gemini_flash_tokens)::int AS gemini_flash_tokens,
        SUM(combined.gemini_embedding_tokens)::int AS gemini_embedding_tokens,
        SUM(combined.speaking_stt_tokens)::int AS speaking_stt_tokens,
        SUM(combined.backfilled_tokens)::int AS backfilled_tokens
      FROM (
        SELECT * FROM live_usage
        UNION ALL
        SELECT * FROM historical_usage
      ) combined
      GROUP BY combined.day
    )
    SELECT 
      c.day,
      COALESCE(dc.active_ai_users, 0)::int AS active_ai_users,
      COALESCE(dc.user_queries, 0)::int AS ai_queries,
      COALESCE(du.estimated_tokens, 0)::int AS estimated_tokens,
      COALESCE(du.gemini_flash_tokens, 0)::int AS gemini_flash_tokens,
      COALESCE(du.gemini_embedding_tokens, 0)::int AS gemini_embedding_tokens,
      COALESCE(du.speaking_stt_tokens, 0)::int AS speaking_stt_tokens,
      COALESCE(du.backfilled_tokens, 0)::int AS backfilled_tokens
    FROM calendar c
    LEFT JOIN daily_chats dc ON dc.day = c.day
    LEFT JOIN daily_usage du ON du.day = c.day
    ORDER BY c.day ASC
  `;

  // 3. Danh sách toàn bộ Người dùng và Hạn mức Token Quota chi tiết
  const usersQuery = `
    SELECT 
      u.user_id,
      u.username,
      u.full_name,
      u.email,
      u.profile_picture_url,
      u.role_id,
      COALESCE(r.role_name, CASE WHEN u.role_id = 1 THEN 'Admin' WHEN u.role_id = 2 THEN 'Instructor' ELSE 'Student' END) AS role_name,
      u.created_date,
      COALESCE(utl.max_tokens, 6000)::int AS max_tokens,
      COALESCE(utl.used_tokens, 0)::int AS used_tokens,
      COALESCE(utl.remaining_tokens, COALESCE(utl.max_tokens, 6000) - COALESCE(utl.used_tokens, 0))::int AS remaining_tokens,
      utl.reset_date,
      COALESCE(aqq.used_questions, 0)::int AS used_questions_24h,
      aqq.window_started_at AS question_window_started_at,
      COALESCE(chat_agg.total_messages, 0)::int AS ai_messages_count,
      chat_agg.last_chat_at AS last_ai_activity_at,
      CASE 
        WHEN COALESCE(utl.max_tokens, 6000) = 0 THEN 0
        ELSE LEAST(100, ROUND((COALESCE(utl.used_tokens, 0)::numeric / NULLIF(COALESCE(utl.max_tokens, 6000), 0)) * 100))::int
      END AS usage_percentage,
      CASE
        WHEN COALESCE(utl.used_tokens, 0) = 0 THEN 'unused'
        WHEN COALESCE(utl.used_tokens, 0) >= COALESCE(utl.max_tokens, 6000) THEN 'exhausted'
        WHEN COALESCE(utl.used_tokens, 0) >= (COALESCE(utl.max_tokens, 6000) * 0.8) THEN 'critical'
        WHEN COALESCE(utl.used_tokens, 0) >= (COALESCE(utl.max_tokens, 6000) * 0.5) THEN 'warning'
        ELSE 'normal'
      END AS quota_status
    FROM users u
    LEFT JOIN roles r ON r.role_id = u.role_id
    LEFT JOIN user_token_limits utl ON utl.user_id = u.user_id
    LEFT JOIN ai_question_quotas aqq ON aqq.user_id = u.user_id
    LEFT JOIN (
      SELECT student_id, COUNT(*)::int AS total_messages, MAX(created_at) AS last_chat_at
      FROM ai_chat
      GROUP BY student_id
    ) chat_agg ON chat_agg.student_id = u.user_id
    ORDER BY 
      COALESCE(utl.used_tokens, 0) DESC, 
      chat_agg.last_chat_at DESC NULLS LAST, 
      u.created_date DESC
  `;

  // 4. Lịch sử Prompt AI gần nhất
  const recentLogsQuery = `
    SELECT 
      c.ai_chat AS log_id,
      c.student_id AS user_id,
      u.username,
      u.full_name,
      u.email,
      u.role_id,
      c.title AS prompt_content,
      c.sender_type,
      c.created_at,
      c.lesson_id,
      l.title AS lesson_title
    FROM ai_chat c
    JOIN users u ON u.user_id = c.student_id
    LEFT JOIN lessons l ON l.lesson_id = c.lesson_id
    WHERE c.sender_type = 'user'
    ORDER BY c.created_at DESC
    LIMIT 25
  `;

  const [summaryRes, trendsRes, usersRes, logsRes] = await Promise.all([
    pool.query(summaryQuery, [safeDays]),
    pool.query(trendsQuery, [safeDays]),
    pool.query(usersQuery),
    pool.query(recentLogsQuery)
  ]);

  const summary = summaryRes.rows[0] || {};
  const totalUsed = Number(summary.total_used_tokens || 0);
  const totalModelTokensPeriod = trendsRes.rows.reduce(
    (sum, row) => sum + Number(row.estimated_tokens || 0),
    0
  );
  const backfilledTokensPeriod = trendsRes.rows.reduce(
    (sum, row) => sum + Number(row.backfilled_tokens || 0),
    0
  );

  // Chi phí chỉ lấy từ event thật; history từ Google không có cost/purpose theo request.
  let estimatedCostUsd = 0;
  let historicalTokensExcludedFromCost = 0;
  let modelBreakdown = [];
  try {
    const breakdownRes = await pool.query(`
      WITH bounds AS (
        SELECT CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day' AS period_start
      ),
      combined_usage AS (
        SELECT
          purpose,
          total_tokens::bigint AS total_tokens,
          estimated_cost_usd::numeric AS estimated_cost_usd
        FROM ai_usage_events, bounds
        WHERE created_at >= period_start

        UNION ALL

        SELECT
          CASE
            WHEN LOWER(h.model) LIKE '%embedding%' THEN 'historical_google_embedding'
            WHEN LOWER(h.model) ~ '(speaking|tts|audio)' THEN 'historical_google_speaking'
            ELSE 'historical_google_flash'
          END AS purpose,
          h.total_tokens::bigint AS total_tokens,
          0::numeric AS estimated_cost_usd
        FROM ai_usage_daily_model_history h, bounds
        WHERE h.usage_date >= period_start::date
          AND h.usage_date <= CURRENT_DATE
          AND h.is_trusted = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM ai_usage_events live_event
            WHERE live_event.created_at::date = h.usage_date
          )
      )
      SELECT
        purpose,
        COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
        COALESCE(SUM(estimated_cost_usd), 0)::numeric AS cost
      FROM combined_usage
      GROUP BY purpose
    `, [safeDays]);

    const totalRealCost = breakdownRes.rows.reduce((s, r) => s + Number(r.cost || 0), 0);
    estimatedCostUsd = Number(totalRealCost.toFixed(4));

    const totalRealTokens = breakdownRes.rows.reduce((s, r) => s + Number(r.tokens || 0), 0);
    historicalTokensExcludedFromCost = breakdownRes.rows
      .filter((row) => String(row.purpose || '').startsWith('historical_google_'))
      .reduce((sum, row) => sum + Number(row.tokens || 0), 0);

    // Map purposes to display categories
    const PURPOSE_DISPLAY = {
      chat:       { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6', group: 'flash' },
      intent:     { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6', group: 'flash' },
      query_rewrite: { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6', group: 'flash' },
      quiz_gen:   { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6', group: 'flash' },
      subtitle:   { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6', group: 'flash' },
      suggested_questions: { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6', group: 'flash' },
      embedding:  { name: 'Gemini Embedding-001 (768D)', color: '#10B981', group: 'embedding' },
      speaking_stt: { name: 'Speaking / Voice Multimodal', color: '#F59E0B', group: 'speaking' },
      historical_google_flash: { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6', group: 'flash' },
      historical_google_embedding: { name: 'Gemini Embedding-001 (768D)', color: '#10B981', group: 'embedding' },
      historical_google_speaking: { name: 'Speaking / Voice Multimodal', color: '#F59E0B', group: 'speaking' },
    };

    // Aggregate by display group
    const grouped = {};
    for (const row of breakdownRes.rows) {
      const display = PURPOSE_DISPLAY[row.purpose] || PURPOSE_DISPLAY.chat;
      if (!grouped[display.group]) {
        grouped[display.group] = { name: display.name, tokens: 0, color: display.color };
      }
      grouped[display.group].tokens += Number(row.tokens || 0);
    }

    modelBreakdown = Object.values(grouped).map(g => ({
      name: g.name,
      share: totalRealTokens > 0 ? Math.round((g.tokens / totalRealTokens) * 100) : 0,
      tokens: g.tokens,
      color: g.color
    }));

    // Ensure at least the 3 expected categories exist (frontend expects them)
    const expectedGroups = [
      { name: 'Gemini 3.7 Flash Reasoning', color: '#3B82F6' },
      { name: 'Gemini Embedding-001 (768D)', color: '#10B981' },
      { name: 'Speaking / Voice Multimodal', color: '#F59E0B' }
    ];
    for (const eg of expectedGroups) {
      if (!modelBreakdown.find(m => m.name === eg.name)) {
        modelBreakdown.push({ name: eg.name, share: 0, tokens: 0, color: eg.color });
      }
    }
  } catch (breakdownErr) {
    console.warn('[AI Dashboard] Failed to query ai_usage_events breakdown, falling back:', breakdownErr.message);
    estimatedCostUsd = Number(((totalUsed / 1000000) * 0.075).toFixed(4));
    modelBreakdown = [
      { name: 'Gemini 3.7 Flash Reasoning', share: 74, tokens: Math.round(totalUsed * 0.74), color: '#3B82F6' },
      { name: 'Gemini Embedding-001 (768D)', share: 18, tokens: Math.round(totalUsed * 0.18), color: '#10B981' },
      { name: 'Speaking / Voice Multimodal', share: 8, tokens: Math.round(totalUsed * 0.08), color: '#F59E0B' }
    ];
  }

  const users = usersRes.rows.map((user) => {
    const isAdmin = user.role_id === 1;
    const adminDefaultLimit = 50;
    const questionQuota = getQuestionQuotaSnapshot({
      roleId: user.role_id,
      usedQuestions: user.used_questions_24h,
      windowStartedAt: user.question_window_started_at
    });

    const effectiveLimit = isAdmin ? (user.question_limit_24h || adminDefaultLimit) : questionQuota.limit;
    const effectiveUsed = isAdmin ? (user.used_questions_24h || 0) : (questionQuota.used || 0);
    const effectiveRemaining = isAdmin ? Math.max(0, effectiveLimit - effectiveUsed) : questionQuota.remaining;
    const effectiveUnlimited = isAdmin ? false : questionQuota.unlimited;

    const usagePercentage = effectiveUnlimited || !effectiveLimit
      ? 0
      : Math.min(100, Math.round((effectiveUsed / effectiveLimit) * 100));

    const quotaStatus = effectiveUnlimited
      ? 'unlimited'
      : usagePercentage >= 100
        ? 'exhausted'
        : usagePercentage >= 80
          ? 'critical'
          : usagePercentage >= 50
            ? 'warning'
            : effectiveUsed === 0
              ? 'unused'
              : 'normal';

    return {
      ...user,
      used_questions_24h: effectiveUsed,
      question_limit_24h: effectiveLimit,
      questions_remaining_24h: effectiveRemaining,
      question_quota_unlimited: effectiveUnlimited,
      question_window_started_at: questionQuota.windowStartedAt,
      question_reset_at: questionQuota.resetAt || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      question_usage_percentage: usagePercentage,
      question_quota_status: quotaStatus
    };
  });

  const topConsumers = users.slice(0, 5);

  return {
    rangeDays: safeDays,
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      total_model_tokens_period: totalModelTokensPeriod,
      backfilled_tokens_period: backfilledTokensPeriod,
      historical_tokens_excluded_from_cost: historicalTokensExcludedFromCost,
      estimatedCostUsd
    },
    modelBreakdown,
    trends: trendsRes.rows,
    users,
    topConsumers,
    recentAiLogs: logsRes.rows
  };
};

/**
 * Lấy cấu hình hạn mức Gemini do admin đã xác nhận.
 * Không tự điền cap khi chưa có cấu hình.
 */
const getAiRateLimitCaps = async () => {
  const result = await pool.query(`
    SELECT
      s.model,
      s.rpm_cap,
      s.tpm_cap,
      s.rpd_cap,
      s.updated_at,
      s.updated_by,
      COALESCE(u.full_name, u.username, u.email) AS updated_by_name
    FROM ai_model_rate_limit_settings s
    LEFT JOIN users u ON u.user_id = s.updated_by
    ORDER BY s.model ASC
  `);

  return result.rows.map(normalizeRateLimitSetting);
};

/**
 * Tính usage theo model: RPM/TPM là rolling 60 giây, RPD reset lúc 00:00 Pacific.
 */
const getRateLimitStatus = async () => {
  const [result, noticesResult] = await Promise.all([
    pool.query(`
    WITH bounds AS (
      SELECT
        NOW() - INTERVAL '60 seconds' AS last_minute,
        NOW() - INTERVAL '24 hours' AS last_24_hours,
        date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') AS pacific_today
    ),
    recent_models AS (
      SELECT DISTINCT e.model
      FROM ai_usage_events e
      CROSS JOIN bounds b
      WHERE e.created_at >= b.last_24_hours
    ),
    usage_by_model AS (
      SELECT
        e.model,
        COUNT(*) FILTER (
          WHERE e.created_at >= b.last_minute
        )::int AS rpm_current,
        COALESCE(SUM(e.total_tokens) FILTER (
          WHERE e.created_at >= b.last_minute
        ), 0)::bigint AS tpm_current,
        COUNT(*) FILTER (
          WHERE date_trunc('day', e.created_at AT TIME ZONE 'America/Los_Angeles') = b.pacific_today
        )::int AS rpd_current
      FROM ai_usage_events e
      JOIN recent_models rm ON rm.model = e.model
      CROSS JOIN bounds b
      WHERE e.created_at >= LEAST(b.last_minute, b.pacific_today AT TIME ZONE 'America/Los_Angeles')
      GROUP BY e.model
    )
    SELECT
      rm.model,
      COALESCE(ubm.rpm_current, 0)::int AS rpm_current,
      COALESCE(ubm.tpm_current, 0)::bigint AS tpm_current,
      COALESCE(ubm.rpd_current, 0)::int AS rpd_current,
      s.rpm_cap,
      s.tpm_cap,
      s.rpd_cap,
      s.updated_at,
      s.updated_by,
      COALESCE(u.full_name, u.username, u.email) AS updated_by_name
    FROM recent_models rm
    LEFT JOIN usage_by_model ubm ON ubm.model = rm.model
    LEFT JOIN ai_model_rate_limit_settings s ON s.model = rm.model
    LEFT JOIN users u ON u.user_id = s.updated_by
    ORDER BY rm.model ASC
    `),
    pool.query(`
      SELECT
        d.model,
        d.dimension,
        d.configured_cap,
        d.observed_usage,
        d.provider_limit,
        d.last_seen_at,
        d.occurrence_count
      FROM ai_rate_limit_discrepancies d
      JOIN ai_model_rate_limit_settings s ON s.model = d.model
      WHERE d.last_seen_at > s.updated_at
      ORDER BY d.last_seen_at DESC
    `).catch((noticeError) => {
      console.warn('[AI Rate Limits] Không thể đọc notice 429 (non-fatal):', noticeError.message);
      return { rows: [] };
    })
  ]);

  const models = result.rows.map((row) => {
    const usage = {
      rpm: Number(row.rpm_current || 0),
      tpm: Number(row.tpm_current || 0),
      rpd: Number(row.rpd_current || 0)
    };
    const caps = {
      rpm: row.rpm_cap === null ? null : Number(row.rpm_cap),
      tpm: row.tpm_cap === null ? null : Number(row.tpm_cap),
      rpd: row.rpd_cap === null ? null : Number(row.rpd_cap)
    };

    return {
      model: row.model,
      usage,
      caps,
      percentUsed: {
        rpm: percentOfCap(usage.rpm, caps.rpm),
        tpm: percentOfCap(usage.tpm, caps.tpm),
        rpd: percentOfCap(usage.rpd, caps.rpd)
      },
      configured: caps.rpm !== null && caps.tpm !== null && caps.rpd !== null,
      updatedAt: row.updated_at || null,
      updatedBy: row.updated_by === null || row.updated_by === undefined
        ? null
        : Number(row.updated_by),
      updatedByName: row.updated_by_name || null
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    windows: {
      rpmSeconds: 60,
      tpmSeconds: 60,
      rpdTimezone: 'America/Los_Angeles'
    },
    models,
    notices: noticesResult.rows.map((row) => ({
      model: row.model,
      dimension: row.dimension,
      configuredCap: Number(row.configured_cap),
      observedUsage: Number(row.observed_usage || 0),
      providerLimit: row.provider_limit === null ? null : Number(row.provider_limit),
      detectedAt: row.last_seen_at,
      occurrenceCount: Number(row.occurrence_count || 1)
    }))
  };
};

/**
 * Tạo/cập nhật cap của một model. Tất cả cap phải do admin gửi lên.
 */
const updateAiRateLimitCaps = async ({ model, rpmCap, tpmCap, rpdCap, updatedBy }) => {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel || normalizedModel.length > 160) {
    const error = new Error('Tên model không hợp lệ');
    error.status = 400;
    error.code = 'INVALID_RATE_LIMIT_MODEL';
    throw error;
  }

  const safeRpmCap = parsePositiveCap(rpmCap, 'RPM');
  const safeTpmCap = parsePositiveCap(tpmCap, 'TPM');
  const safeRpdCap = parsePositiveCap(rpdCap, 'RPD');

  const result = await pool.query(`
    INSERT INTO ai_model_rate_limit_settings
      (model, rpm_cap, tpm_cap, rpd_cap, updated_at, updated_by)
    VALUES ($1, $2, $3, $4, NOW(), $5)
    ON CONFLICT (model) DO UPDATE SET
      rpm_cap = EXCLUDED.rpm_cap,
      tpm_cap = EXCLUDED.tpm_cap,
      rpd_cap = EXCLUDED.rpd_cap,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING model, rpm_cap, tpm_cap, rpd_cap, updated_at, updated_by
  `, [normalizedModel, safeRpmCap, safeTpmCap, safeRpdCap, updatedBy || null]);

  return normalizeRateLimitSetting(result.rows[0]);
};

/**
 * Cập nhật hạn mức Token tối đa (max_tokens) cho người dùng
 */
const updateUserQuotaLimit = async (userId, maxTokens) => {
  const parsedMax = Number(maxTokens);
  if (isNaN(parsedMax) || parsedMax < 0) {
    const err = new Error('Hạn mức Token không hợp lệ');
    err.status = 400;
    throw err;
  }

  const todayStr = getVietnamDateString();
  const query = `
    INSERT INTO user_token_limits (user_id, max_tokens, used_tokens, reset_date)
    VALUES ($1, $2, 0, $3)
    ON CONFLICT (user_id)
    DO UPDATE SET
      max_tokens = $2,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, max_tokens, used_tokens, remaining_tokens, reset_date
  `;
  const result = await pool.query(query, [userId, parsedMax, todayStr]);
  return result.rows[0];
};

/**
 * Admin: Migrate toàn bộ media của một khóa học sang Cloudflare R2.
 * Dùng cho các khóa học cũ đã published trước khi hệ thống có auto-migration.
 *
 * Options:
 *   - deleteSource (bool, default true): Xoá file cũ trên Supabase sau khi migrate thành công
 *   - dryRun (bool, default false): Chạy thử, in kế hoạch nhưng không thực sự move/xoá file
 */
const migrateCourseMedia = async (courseId, { deleteSource = true, dryRun = false } = {}) => {
  const parsedCourseId = parseInt(courseId, 10);
  if (!parsedCourseId || isNaN(parsedCourseId)) {
    const err = new Error('course_id không hợp lệ');
    err.status = 400;
    throw err;
  }

  // Kiểm tra khóa học tồn tại
  const courseCheck = await pool.query(
    'SELECT course_id, course_name, status FROM courses WHERE course_id = $1',
    [parsedCourseId]
  );
  if (courseCheck.rows.length === 0) {
    const err = new Error(`Không tìm thấy khóa học #${parsedCourseId}`);
    err.status = 404;
    throw err;
  }

  const course = courseCheck.rows[0];

  if (dryRun) {
    // Dry-run: Chỉ thống kê, không thực sự migrate
    const { loadSupabaseMedia, loadReferencedMedia } = require('../../../utils/r2CourseReorganizer');
    const supabaseRows = await loadSupabaseMedia({ courseId: parsedCourseId });
    const r2Rows = await loadReferencedMedia({ courseId: parsedCourseId });
    const { isAlreadyCourseScoped, targetKeyFor } = require('../../../utils/r2CourseReorganizer');
    const r2NeedsReorg = r2Rows.filter(row => !isAlreadyCourseScoped(row));

    return {
      courseId: parsedCourseId,
      courseName: course.course_name,
      status: course.status,
      dryRun: true,
      supabase: {
        total: supabaseRows.length,
        items: supabaseRows.map(r => ({
          ref: `${r.ref_type}#${r.ref_id}`,
          lesson: r.lesson_name,
          sourceKey: r.source_key,
          targetKey: (() => {
            try { return targetKeyFor(r); } catch { return '(error building key)'; }
          })()
        }))
      },
      r2Reorganize: {
        total: r2NeedsReorg.length,
        items: r2NeedsReorg.map(r => ({
          ref: `${r.ref_type}#${r.ref_id}`,
          lesson: r.lesson_name,
          sourceKey: r.source_key,
          targetKey: (() => {
            try { return targetKeyFor(r); } catch { return '(error building key)'; }
          })()
        }))
      }
    };
  }

  // Thực sự migrate
  const { migrateCourseAllMedia } = require('../../../utils/r2CourseReorganizer');
  const report = await migrateCourseAllMedia(parsedCourseId, { deleteSource });

  return {
    courseId: parsedCourseId,
    courseName: course.course_name,
    status: course.status,
    dryRun: false,
    ...report
  };
};

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser,
  resetUserToken,
  resetTokensByRole,
  getAnalyticsDashboard,
  getAiQuotaDashboard,
  getAiRateLimitCaps,
  getRateLimitStatus,
  updateAiRateLimitCaps,
  updateUserQuotaLimit,
  migrateCourseMedia
};
