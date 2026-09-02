const db = require('../../../config/database');

// Vietnam is always UTC+7 (no DST), so a constant offset is safe.
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const QUESTION_LIMIT_BY_ROLE = Object.freeze({
  2: 20, // Instructor
  3: 10  // Student
});

const getQuestionLimitForRole = (roleId) => {
  const normalizedRoleId = Number(roleId);
  if (normalizedRoleId === 1) return null; // Admin và Super Admin không giới hạn
  return QUESTION_LIMIT_BY_ROLE[normalizedRoleId] || QUESTION_LIMIT_BY_ROLE[3];
};

/**
 * Compute the Y-M-D calendar date in Vietnam time from a UTC millisecond
 * timestamp. Because the offset is a constant +7 hours we can shift the
 * epoch value and then extract the UTC date parts — no ICU / Intl needed.
 */
const getVietnamDateString = (utcMs) => {
  const d = new Date(utcMs + VIETNAM_UTC_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Return the next upcoming midnight in Vietnam time as a UTC ms timestamp.
 * "Next" means: if now is exactly 00:00:00.000 VN, the next midnight is
 * 24 h later, not now (i.e. a day boundary counts as the start of the
 * new window, so the next reset is 24 h away).
 */
const getNextVietnamMidnightMs = (nowMs) => {
  // Shift to VN-local epoch so UTC date functions give VN-local results.
  const vnLocal = new Date(nowMs + VIETNAM_UTC_OFFSET_MS);
  // Truncate to start-of-day in this shifted timeline.
  const startOfVnDay = Date.UTC(
    vnLocal.getUTCFullYear(),
    vnLocal.getUTCMonth(),
    vnLocal.getUTCDate()
  );
  // startOfVnDay is the shifted epoch of today's VN midnight.
  // Un-shift back to real UTC and advance to next midnight.
  const todayMidnightUtc = startOfVnDay - VIETNAM_UTC_OFFSET_MS;
  const nextMidnightUtc = todayMidnightUtc + 24 * 60 * 60 * 1000;
  return nextMidnightUtc;
};

const getQuestionQuotaSnapshot = ({
  roleId,
  usedQuestions = 0,
  windowStartedAt = null,
  now = Date.now()
}) => {
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

  const startedAtMs = windowStartedAt ? new Date(windowStartedAt).getTime() : NaN;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  // Window is expired when the VN calendar date of windowStartedAt differs
  // from the VN calendar date of now (i.e. a new day has begun in VN time).
  if (!Number.isFinite(startedAtMs) || getVietnamDateString(startedAtMs) !== getVietnamDateString(nowMs)) {
    return {
      unlimited: false,
      limit,
      used: 0,
      remaining: limit,
      windowStartedAt: null,
      resetAt: null
    };
  }

  const used = Math.max(0, Number(usedQuestions || 0));
  return {
    unlimited: false,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    windowStartedAt: new Date(startedAtMs).toISOString(),
    resetAt: new Date(getNextVietnamMidnightMs(nowMs)).toISOString()
  };
};

const toQuotaState = (row, limit, granted = true) => {
  const windowStartedAt = row?.window_started_at ? new Date(row.window_started_at) : new Date();
  const usedQuestions = Number(row?.used_questions || 0);
  const resetAt = new Date(getNextVietnamMidnightMs(Date.now()));

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
           WHEN date_trunc('day', ai_question_quotas.window_started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
                <> date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') THEN 1
           ELSE ai_question_quotas.used_questions + 1
         END,
         window_started_at = CASE
           WHEN date_trunc('day', ai_question_quotas.window_started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
                <> date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') THEN NOW()
           ELSE ai_question_quotas.window_started_at
         END,
         updated_at = NOW()
       WHERE date_trunc('day', ai_question_quotas.window_started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
             <> date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
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
  return getQuestionQuotaSnapshot({
    roleId,
    usedQuestions: row?.used_questions,
    windowStartedAt: row?.window_started_at
  });
};

module.exports = {
  QUESTION_LIMIT_BY_ROLE,
  VIETNAM_UTC_OFFSET_MS,
  getQuestionLimitForRole,
  getQuestionQuotaSnapshot,
  getQuestionQuotaStatus,
  getVietnamDateString,
  getNextVietnamMidnightMs,
  releaseQuestion,
  reserveQuestion
};
