/**
 * Admin Service - Thực hiện các thao tác quản trị trên CSDL
 */

const { pool } = require('../../../config/database');
const { supabaseAdmin } = require('../../../config/supabase');
const { handleServiceError } = require('../../../utils/service-errors');

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
      (SELECT COALESCE(SUM(used_questions), 0)::int FROM ai_question_quotas) AS total_questions_rolling_24h,
      COALESCE(active_ai.active_ai_users, 0) AS active_ai_users_period,
      COALESCE(chat_stats.total_ai_messages, 0) AS total_ai_messages_period,
      COALESCE(chat_stats.total_user_prompts, 0) AS total_user_prompts_period,
      COALESCE(chat_stats.total_bot_replies, 0) AS total_bot_replies_period
    FROM bounds, active_ai, chat_stats
  `;

  // 2. Xu hướng tiêu thụ Token theo ngày
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
    )
    SELECT 
      c.day,
      COALESCE(dc.active_ai_users, 0)::int AS active_ai_users,
      COALESCE(dc.user_queries, 0)::int AS ai_queries,
      ROUND(COALESCE(dc.user_queries, 0) * 195)::int AS estimated_tokens,
      ROUND(COALESCE(dc.user_queries, 0) * 145)::int AS gemini_flash_tokens,
      ROUND(COALESCE(dc.user_queries, 0) * 35)::int AS gemini_embedding_tokens,
      ROUND(COALESCE(dc.user_queries, 0) * 15)::int AS speaking_stt_tokens
    FROM calendar c
    LEFT JOIN daily_chats dc ON dc.day = c.day
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
  const estimatedCostUsd = ((totalUsed / 1000000) * 0.075).toFixed(4);

  const modelBreakdown = [
    { name: 'Gemini 3.7 Flash Reasoning', share: 74, tokens: Math.round(totalUsed * 0.74), color: '#3B82F6' },
    { name: 'Gemini Embedding-001 (768D)', share: 18, tokens: Math.round(totalUsed * 0.18), color: '#10B981' },
    { name: 'Speaking / Voice Multimodal', share: 8, tokens: Math.round(totalUsed * 0.08), color: '#F59E0B' }
  ];

  const topConsumers = usersRes.rows.slice(0, 5);

  return {
    rangeDays: safeDays,
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      estimatedCostUsd: Number(estimatedCostUsd)
    },
    modelBreakdown,
    trends: trendsRes.rows,
    users: usersRes.rows,
    topConsumers,
    recentAiLogs: logsRes.rows
  };
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

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser,
  resetUserToken,
  resetTokensByRole,
  getAnalyticsDashboard,
  getAiQuotaDashboard,
  updateUserQuotaLimit
};
