const { pool } = require('../../../config/database');
const adminService = require('./admin.service');

const CACHE_TTL_MS = 10_000;
const MAX_ALERTS = 50;

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let pendingSnapshot = null;

const severityOrder = { high: 0, medium: 1, low: 2 };

const asNumber = (value) => Number(value || 0);
const asTimestamp = (value, fallback) => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const createAlert = ({
  id,
  type,
  severity,
  title,
  message,
  timestamp,
  actionUrl,
  actionLabel,
  source
}) => ({
  id,
  type,
  severity,
  title,
  message,
  timestamp,
  actionUrl,
  actionLabel,
  source
});

const collectDatabaseAlerts = async (generatedAt) => {
  const [
    mediaResult,
    pipelineResult,
    subtitleResult,
    integrityResult,
    quotaResult,
    aiErrorResult,
    incidentResult
  ] = await Promise.all([
    pool.query(`
      SELECT status, COUNT(*)::int AS issue_count, MAX(updated_at) AS latest_at
      FROM media_assets
      WHERE deleted_at IS NULL AND status IN ('FAILED', 'MISSING_SOURCE')
      GROUP BY status
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE status IN ('PENDING', 'CLAIMING', 'CLEANING')
            AND (expires_at <= NOW() OR created_at <= NOW() - INTERVAL '30 minutes')
        )::int AS stale_uploads,
        MAX(created_at) FILTER (
          WHERE status IN ('PENDING', 'CLAIMING', 'CLEANING')
            AND (expires_at <= NOW() OR created_at <= NOW() - INTERVAL '30 minutes')
        ) AS latest_stale_upload,
        (SELECT COUNT(*)::int
         FROM failed_storage_deletions
         WHERE status IN ('PENDING_RETRY', 'FAILED_PERMANENT')) AS failed_deletions,
        (SELECT MAX(created_at)
         FROM failed_storage_deletions
         WHERE status IN ('PENDING_RETRY', 'FAILED_PERMANENT')) AS latest_failed_deletion,
        (SELECT COUNT(*)::int
         FROM failed_storage_deletions
         WHERE status = 'FAILED_PERMANENT') AS permanent_deletions
      FROM pending_media_uploads
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS failed_count,
        MAX(ls.updated_at) AS latest_at
      FROM lesson_subtitles ls
      WHERE ls.subtitle_status = 'failed'
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int
         FROM courses c
         WHERE c.status = 'published'
           AND NOT EXISTS (
             SELECT 1
             FROM sections s
             JOIN lessons l ON l.section_id = s.section_id
             WHERE s.course_id = c.course_id
           )) AS published_without_lessons,
        (SELECT MAX(c.updated_at)
         FROM courses c
         WHERE c.status = 'published'
           AND NOT EXISTS (
             SELECT 1
             FROM sections s
             JOIN lessons l ON l.section_id = s.section_id
             WHERE s.course_id = c.course_id
           )) AS latest_empty_course,
        (SELECT COUNT(*)::int
         FROM quizzes q
         WHERE NOT EXISTS (
           SELECT 1 FROM questions question WHERE question.quiz_id = q.quiz_id
         )) AS quizzes_without_questions,
        (SELECT MAX(q.updated_at)
         FROM quizzes q
         WHERE NOT EXISTS (
           SELECT 1 FROM questions question WHERE question.quiz_id = q.quiz_id
         )) AS latest_empty_quiz
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS exhausted_count,
        MAX(utl.updated_at) AS latest_at
      FROM user_token_limits utl
      WHERE utl.remaining_tokens <= 0
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS error_count,
        COUNT(DISTINCT model)::int AS affected_models,
        MAX(created_at) AS latest_at
      FROM ai_usage_events
      WHERE request_status = 'error'
        AND created_at >= NOW() - INTERVAL '30 minutes'
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS incident_count,
        SUM(occurrence_count)::int AS occurrences,
        MAX(last_seen_at) AS latest_at
      FROM ai_provider_incidents
      WHERE resolved_at IS NULL
        AND last_seen_at >= NOW() - INTERVAL '24 hours'
    `)
  ]);

  const alerts = [];

  for (const row of mediaResult.rows) {
    const count = asNumber(row.issue_count);
    const missing = row.status === 'MISSING_SOURCE';
    alerts.push(createAlert({
      id: `media-${String(row.status).toLowerCase()}`,
      type: 'failed_upload',
      severity: 'high',
      title: missing ? 'Media bị thiếu tệp nguồn' : 'Media xử lý thất bại',
      message: `${count} media đang ở trạng thái ${row.status}. Cần kiểm tra nội dung khóa học và kho lưu trữ.`,
      timestamp: asTimestamp(row.latest_at, generatedAt),
      actionUrl: '/admin/dashboard?tab=courses',
      actionLabel: 'Quản lý khóa học',
      source: 'PostgreSQL · media_assets'
    }));
  }

  const pipeline = pipelineResult.rows[0] || {};
  const staleUploads = asNumber(pipeline.stale_uploads);
  if (staleUploads > 0) {
    alerts.push(createAlert({
      id: 'media-stale-uploads',
      type: 'failed_upload',
      severity: 'medium',
      title: 'Upload media bị treo',
      message: `${staleUploads} phiên upload chưa hoàn tất sau 30 phút hoặc đã hết hạn.`,
      timestamp: asTimestamp(pipeline.latest_stale_upload, generatedAt),
      actionUrl: '/admin/dashboard?tab=courses',
      actionLabel: 'Kiểm tra khóa học',
      source: 'PostgreSQL · pending_media_uploads'
    }));
  }

  const failedDeletions = asNumber(pipeline.failed_deletions);
  if (failedDeletions > 0) {
    const permanent = asNumber(pipeline.permanent_deletions);
    alerts.push(createAlert({
      id: 'storage-cleanup-failures',
      type: 'server',
      severity: permanent > 0 ? 'high' : 'medium',
      title: 'Dọn dẹp kho lưu trữ chưa hoàn tất',
      message: `${failedDeletions} tệp đang chờ xóa lại${permanent > 0 ? `, trong đó ${permanent} tệp đã lỗi vĩnh viễn` : ''}.`,
      timestamp: asTimestamp(pipeline.latest_failed_deletion, generatedAt),
      actionUrl: '/admin/dashboard?tab=courses',
      actionLabel: 'Xem nội dung',
      source: 'PostgreSQL · failed_storage_deletions'
    }));
  }

  const subtitles = subtitleResult.rows[0] || {};
  const failedSubtitles = asNumber(subtitles.failed_count);
  if (failedSubtitles > 0) {
    alerts.push(createAlert({
      id: 'subtitle-generation-failures',
      type: 'failed_upload',
      severity: 'medium',
      title: 'Tạo phụ đề thất bại',
      message: `${failedSubtitles} bài học có tác vụ phụ đề thất bại và cần được tạo lại.`,
      timestamp: asTimestamp(subtitles.latest_at, generatedAt),
      actionUrl: '/admin/dashboard?tab=courses',
      actionLabel: 'Quản lý khóa học',
      source: 'PostgreSQL · lesson_subtitles'
    }));
  }

  const integrity = integrityResult.rows[0] || {};
  const emptyCourses = asNumber(integrity.published_without_lessons);
  if (emptyCourses > 0) {
    alerts.push(createAlert({
      id: 'published-courses-without-lessons',
      type: 'course',
      severity: 'high',
      title: 'Khóa học đã xuất bản nhưng chưa có bài học',
      message: `${emptyCourses} khóa học đang hiển thị cho học viên nhưng không có bài học.`,
      timestamp: asTimestamp(integrity.latest_empty_course, generatedAt),
      actionUrl: '/admin/dashboard?tab=courses',
      actionLabel: 'Quản lý khóa học',
      source: 'PostgreSQL · courses/sections/lessons'
    }));
  }

  const emptyQuizzes = asNumber(integrity.quizzes_without_questions);
  if (emptyQuizzes > 0) {
    alerts.push(createAlert({
      id: 'quizzes-without-questions',
      type: 'quiz',
      severity: 'medium',
      title: 'Đề quiz chưa có câu hỏi',
      message: `${emptyQuizzes} đề quiz chưa chứa câu hỏi nào.`,
      timestamp: asTimestamp(integrity.latest_empty_quiz, generatedAt),
      actionUrl: '/admin/dashboard?tab=quizzes',
      actionLabel: 'Quản lý quiz',
      source: 'PostgreSQL · quizzes/questions'
    }));
  }

  const quota = quotaResult.rows[0] || {};
  const exhaustedUsers = asNumber(quota.exhausted_count);
  if (exhaustedUsers > 0) {
    alerts.push(createAlert({
      id: 'users-with-exhausted-token-quota',
      type: 'quota_warning',
      severity: 'medium',
      title: 'Tài khoản đã hết hạn mức Token AI',
      message: `${exhaustedUsers} tài khoản đã dùng hết hoặc vượt hạn mức token được Admin cấp.`,
      timestamp: asTimestamp(quota.latest_at, generatedAt),
      actionUrl: '/admin/dashboard?tab=ai-quota',
      actionLabel: 'Quản lý Token AI',
      source: 'PostgreSQL · user_token_limits'
    }));
  }

  const aiErrors = aiErrorResult.rows[0] || {};
  const recentAiErrors = asNumber(aiErrors.error_count);
  if (recentAiErrors > 0) {
    alerts.push(createAlert({
      id: 'recent-ai-request-errors',
      type: 'server',
      severity: recentAiErrors >= 5 ? 'high' : 'medium',
      title: 'Yêu cầu AI phát sinh lỗi gần đây',
      message: `${recentAiErrors} yêu cầu lỗi trên ${asNumber(aiErrors.affected_models)} model trong 30 phút gần nhất.`,
      timestamp: asTimestamp(aiErrors.latest_at, generatedAt),
      actionUrl: '/admin/dashboard?tab=ai-quota',
      actionLabel: 'Xem giám sát AI',
      source: 'PostgreSQL · ai_usage_events'
    }));
  }

  const incidents = incidentResult.rows[0] || {};
  const incidentCount = asNumber(incidents.incident_count);
  if (incidentCount > 0) {
    alerts.push(createAlert({
      id: 'open-ai-provider-incidents',
      type: 'server',
      severity: 'high',
      title: 'Sự cố nhà cung cấp AI chưa phục hồi',
      message: `${incidentCount} sự cố đang mở, ghi nhận ${asNumber(incidents.occurrences)} lần trong 24 giờ gần nhất.`,
      timestamp: asTimestamp(incidents.latest_at, generatedAt),
      actionUrl: '/admin/dashboard?tab=ai-quota',
      actionLabel: 'Xem sự cố AI',
      source: 'PostgreSQL · ai_provider_incidents'
    }));
  }

  return alerts;
};

const collectRuntimeAlerts = async (generatedAt) => {
  const alerts = [];

  const status = await adminService.getRateLimitStatus();
  for (const model of status.models || []) {
    if (!['warning', 'critical', 'exceeded'].includes(model.riskLevel)) continue;

    alerts.push(createAlert({
      id: `ai-rate-limit-${model.model}`,
      type: 'rate_limit',
      severity: ['critical', 'exceeded'].includes(model.riskLevel) ? 'high' : 'medium',
      title: `Hạn mức AI: ${model.model}`,
      message: `Mức sử dụng cao nhất đang ở ${Math.round(model.peakPercent)}% cap do Admin cấu hình.`,
      timestamp: asTimestamp(model.updatedAt, generatedAt),
      actionUrl: '/admin/dashboard?tab=ai-quota',
      actionLabel: 'Quản lý Token AI',
      source: 'Backend telemetry · ai_usage_events'
    }));
  }

  for (const notice of status.notices || []) {
    alerts.push(createAlert({
      id: `ai-cap-discrepancy-${notice.model}-${notice.dimension}`,
      type: 'rate_limit',
      severity: 'high',
      title: `Cap ${String(notice.dimension).toUpperCase()} có thể không chính xác`,
      message: `${notice.model}: cap cấu hình ${notice.configuredCap}, usage quan sát ${notice.observedUsage}.`,
      timestamp: asTimestamp(notice.detectedAt, generatedAt),
      actionUrl: '/admin/dashboard?tab=ai-quota',
      actionLabel: 'Kiểm tra cap AI',
      source: 'Backend telemetry · ai_rate_limit_discrepancies'
    }));
  }

  return alerts;
};

const buildSnapshot = async () => {
  const generatedAt = new Date().toISOString();
  const [databaseAlerts, runtimeAlerts] = await Promise.all([
    collectDatabaseAlerts(generatedAt),
    collectRuntimeAlerts(generatedAt)
  ]);

  const alerts = [...databaseAlerts, ...runtimeAlerts]
    .sort((left, right) => {
      const severityDifference = severityOrder[left.severity] - severityOrder[right.severity];
      if (severityDifference !== 0) return severityDifference;
      return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    })
    .slice(0, MAX_ALERTS);

  return {
    alerts,
    generatedAt,
    source: 'PostgreSQL và telemetry runtime của backend',
    transport: {
      primary: 'sse',
      refreshIntervalMs: 15_000,
      fallbackPollIntervalMs: 60_000
    },
    summary: {
      total: alerts.length,
      high: alerts.filter((alert) => alert.severity === 'high').length,
      medium: alerts.filter((alert) => alert.severity === 'medium').length,
      low: alerts.filter((alert) => alert.severity === 'low').length
    }
  };
};

const getAdminAlertsSnapshot = async ({ fresh = false } = {}) => {
  const now = Date.now();
  if (!fresh && cachedSnapshot && cacheExpiresAt > now) return cachedSnapshot;
  if (pendingSnapshot) return pendingSnapshot;

  pendingSnapshot = buildSnapshot()
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return snapshot;
    })
    .finally(() => {
      pendingSnapshot = null;
    });

  return pendingSnapshot;
};

const resetCache = () => {
  cachedSnapshot = null;
  cacheExpiresAt = 0;
  pendingSnapshot = null;
};

module.exports = {
  getAdminAlertsSnapshot,
  resetCache
};
