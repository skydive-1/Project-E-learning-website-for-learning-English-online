const db = require('../../../config/database');

const QUESTION_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
const QUESTION_LIMIT_BY_ROLE = Object.freeze({
  2: 20, // Instructor
  3: 10  // Student
});

const getQuestionLimitForRole = (roleId) => {
  const normalizedRoleId = Number(roleId);
  if (normalizedRoleId === 1) return null; // Admin và Super Admin không giới hạn
  return QUESTION_LIMIT_BY_ROLE[normalizedRoleId] || QUESTION_LIMIT_BY_ROLE[3];
};

const toQuotaState = (row, limit, granted = true) => {
  const windowStartedAt = row?.window_started_at ? new Date(row.window_started_at) : new Date();
  const usedQuestions = Number(row?.used_questions || 0);
  const resetAt = new Date(windowStartedAt.getTime() + QUESTION_QUOTA_WINDOW_MS);

  return {
    granted,
    unlimited: false,
    limit,
    used: usedQuestions,
    remaining: Math.max(0, limit - usedQuestions),
    windowStartedAt: windowStartedAt.toISOString(),
    resetAt: resetAt.toISOString()
  };
};

const reserveQuestion = async ({ userId, roleId }) => {
  const limit = getQuestionLimitForRole(roleId);
  if (limit === null) {
    return {
      granted: true,
      unlimited: true,
      limit: null,
      used: null,
      remaining: null,
      windowStartedAt: null,
      resetAt: null
    };
  }

  const result = await db.query(
    `WITH quota_attempt AS (
       INSERT INTO ai_question_quotas (user_id, used_questions, window_started_at, updated_at)
       VALUES ($1, 1, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         used_questions = CASE
           WHEN ai_question_quotas.window_started_at <= NOW() - INTERVAL '24 hours' THEN 1
           ELSE ai_question_quotas.used_questions + 1
         END,
         window_started_at = CASE
           WHEN ai_question_quotas.window_started_at <= NOW() - INTERVAL '24 hours' THEN NOW()
           ELSE ai_question_quotas.window_started_at
         END,
         updated_at = NOW()
       WHERE ai_question_quotas.window_started_at <= NOW() - INTERVAL '24 hours'
          OR ai_question_quotas.used_questions < $2
       RETURNING used_questions, window_started_at
     )
     SELECT used_questions, window_started_at, TRUE AS granted
     FROM quota_attempt
     UNION ALL
     SELECT used_questions, window_started_at, FALSE AS granted
     FROM ai_question_quotas
     WHERE user_id = $1
       AND NOT EXISTS (SELECT 1 FROM quota_attempt)
     LIMIT 1`,
    [userId, limit]
  );

  const row = result.rows[0];
  return toQuotaState(row, limit, row?.granted === true || row?.granted === 'true');
};

const releaseQuestion = async (reservation) => {
  if (!reservation?.granted || reservation.unlimited || reservation.released) return;

  reservation.released = true;
  await db.query(
    `UPDATE ai_question_quotas
     SET used_questions = GREATEST(used_questions - 1, 0), updated_at = NOW()
     WHERE user_id = $1 AND window_started_at = $2`,
    [reservation.userId, reservation.windowStartedAt]
  );
};

const getQuestionQuotaStatus = async ({ userId, roleId }) => {
  const limit = getQuestionLimitForRole(roleId);
  if (limit === null) {
    return {
      unlimited: true,
      limit: null,
      used: null,
      remaining: null,
      windowStartedAt: null,
      resetAt: null
    };
  }

  const result = await db.query(
    `SELECT used_questions, window_started_at
     FROM ai_question_quotas
     WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0];
  if (!row || new Date(row.window_started_at).getTime() + QUESTION_QUOTA_WINDOW_MS <= Date.now()) {
    return {
      unlimited: false,
      limit,
      used: 0,
      remaining: limit,
      windowStartedAt: null,
      resetAt: null
    };
  }

  return toQuotaState(row, limit, true);
};

module.exports = {
  QUESTION_LIMIT_BY_ROLE,
  QUESTION_QUOTA_WINDOW_MS,
  getQuestionLimitForRole,
  getQuestionQuotaStatus,
  releaseQuestion,
  reserveQuestion
};
