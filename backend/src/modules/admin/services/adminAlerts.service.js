const { pool } = require('../../../config/database');
const adminService = require('./admin.service');

const CACHE_TTL_MS = 10_000;
const MAX_ALERTS = 100;

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
  source,
  entity
}) => ({
  id,
  type,
  severity,
  title,
  message,
  timestamp,
  actionUrl,
  actionLabel,
  source,
  entity
});

const withQuery = (path, params) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
};

const courseTarget = (row, issue, extra = {}) => {
  // Chỉ tạo deep-link từ quan hệ đã được PostgreSQL xác thực. ID nằm trong
  // storage_key chỉ là metadata đặt tên, không chứng minh course còn tồn tại.
  const courseId = asNumber(row.course_id);
  if (!courseId) return null;
  return withQuery(`/instructor/edit-course/${courseId}`, {
    tab: extra.tab || 'curriculum',
    lessonId: row.lesson_id,
    quizId: row.quiz_id,
    issue,
    ...extra
  });
};

const userTarget = (userId, extra = {}) => withQuery('/admin/dashboard', {
  tab: 'ai-quota',
  userId,
  ...extra
});

const collectDatabaseAlerts = async (generatedAt) => {
  const [
    mediaResult,
    pendingUploadResult,
    deletionResult,
    subtitleResult,
    emptyCourseResult,
    emptyQuizResult,
    quotaResult,
    aiErrorResult,
    incidentResult
  ] = await Promise.all([
    pool.query(`
      SELECT ma.media_id, ma.status, ma.object_key, ma.original_filename, ma.created_by, ma.updated_at,
             target.lesson_id, target.lesson_title, target.course_id, target.course_name
      FROM media_assets ma
      LEFT JOIN LATERAL (
        SELECT linked.*
        FROM (
          SELECT l.lesson_id, l.title AS lesson_title, s.course_id, c.course_name
          FROM lessons l
          JOIN sections s ON s.section_id = l.section_id
          JOIN courses c ON c.course_id = s.course_id
          WHERE l.media_asset_id = ma.media_id OR l.storage_key = ma.object_key
          UNION ALL
          SELECT l.lesson_id, l.title AS lesson_title, s.course_id, c.course_name
          FROM lesson_materials lm
          JOIN lessons l ON l.lesson_id = lm.lesson_id
          JOIN sections s ON s.section_id = l.section_id
          JOIN courses c ON c.course_id = s.course_id
          WHERE lm.media_asset_id = ma.media_id OR lm.storage_key = ma.object_key
        ) linked
        LIMIT 1
      ) target ON TRUE
      WHERE ma.deleted_at IS NULL AND ma.status IN ('FAILED', 'MISSING_SOURCE')
      ORDER BY ma.updated_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT p.upload_id, p.instructor_id, p.storage_key, p.status, p.created_at, p.expires_at,
             u.full_name AS instructor_name, target.lesson_id, target.lesson_title,
             COALESCE(target.course_id, upload_course.course_id) AS course_id,
             COALESCE(target.course_name, upload_course.course_name) AS course_name
      FROM pending_media_uploads p
      LEFT JOIN users u ON u.user_id = p.instructor_id
      LEFT JOIN courses upload_course ON upload_course.course_id = p.course_id
      LEFT JOIN LATERAL (
        SELECT linked.*
        FROM (
          SELECT l.lesson_id, l.title AS lesson_title, s.course_id, c.course_name
          FROM lessons l
          JOIN sections s ON s.section_id = l.section_id
          JOIN courses c ON c.course_id = s.course_id
          WHERE l.media_asset_id = p.media_id OR l.storage_key = p.storage_key
          UNION ALL
          SELECT l.lesson_id, l.title AS lesson_title, s.course_id, c.course_name
          FROM lesson_materials lm
          JOIN lessons l ON l.lesson_id = lm.lesson_id
          JOIN sections s ON s.section_id = l.section_id
          JOIN courses c ON c.course_id = s.course_id
          WHERE lm.media_asset_id = p.media_id OR lm.storage_key = p.storage_key
        ) linked
        LIMIT 1
      ) target ON TRUE
      WHERE p.status IN ('PENDING', 'CLAIMING', 'CLEANING')
        AND (p.expires_at <= NOW() OR p.created_at <= NOW() - INTERVAL '30 minutes')
        AND NOT EXISTS (
          SELECT 1 FROM failed_storage_deletions deletion
          WHERE deletion.pending_upload_id = p.upload_id
            AND deletion.status IN ('PENDING_RETRY', 'FAILED_PERMANENT')
        )
      ORDER BY p.created_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT d.deletion_id, p.upload_id AS pending_upload_id, d.storage_key, d.status,
             d.retry_count, d.last_error, d.created_at,
             p.instructor_id, u.full_name AS instructor_name,
             target.lesson_id, target.lesson_title,
             COALESCE(target.course_id, pending_course.course_id) AS course_id,
             COALESCE(target.course_name, pending_course.course_name) AS course_name
      FROM failed_storage_deletions d
      LEFT JOIN LATERAL (
        SELECT pending.*
        FROM pending_media_uploads pending
        WHERE pending.storage_provider = d.storage_provider
          AND pending.storage_bucket = d.storage_bucket
          AND pending.storage_key = d.storage_key
        ORDER BY pending.created_at DESC
        LIMIT 1
      ) p ON TRUE
      LEFT JOIN users u ON u.user_id = p.instructor_id
      LEFT JOIN courses pending_course ON pending_course.course_id = p.course_id
      LEFT JOIN LATERAL (
        SELECT linked.*
        FROM (
          SELECT l.lesson_id, l.title AS lesson_title, s.course_id, c.course_name
          FROM lessons l
          JOIN sections s ON s.section_id = l.section_id
          JOIN courses c ON c.course_id = s.course_id
          WHERE l.storage_key = d.storage_key
          UNION ALL
          SELECT l.lesson_id, l.title AS lesson_title, s.course_id, c.course_name
          FROM lesson_materials lm
          JOIN lessons l ON l.lesson_id = lm.lesson_id
          JOIN sections s ON s.section_id = l.section_id
          JOIN courses c ON c.course_id = s.course_id
          WHERE lm.storage_key = d.storage_key
        ) linked
        LIMIT 1
      ) target ON TRUE
      WHERE d.status IN ('PENDING_RETRY', 'FAILED_PERMANENT')
      ORDER BY d.created_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT ls.subtitle_id, ls.lesson_id, ls.error_code, ls.error_message, ls.updated_at,
             l.title AS lesson_title, s.course_id, c.course_name
      FROM lesson_subtitles ls
      JOIN lessons l ON l.lesson_id = ls.lesson_id
      JOIN sections s ON s.section_id = l.section_id
      JOIN courses c ON c.course_id = s.course_id
      WHERE ls.subtitle_status = 'failed'
      ORDER BY ls.updated_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT c.course_id, c.course_name, c.updated_at
      FROM courses c
      WHERE c.status = 'published'
        AND NOT EXISTS (
          SELECT 1 FROM sections s
          JOIN lessons l ON l.section_id = s.section_id
          WHERE s.course_id = c.course_id
        )
      ORDER BY c.updated_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT q.quiz_id, q.course_id, q.lesson_id, q.title, q.updated_at,
             l.title AS lesson_title, c.course_name
      FROM quizzes q
      LEFT JOIN lessons l ON l.lesson_id = q.lesson_id
      LEFT JOIN courses c ON c.course_id = q.course_id
      WHERE NOT EXISTS (SELECT 1 FROM questions question WHERE question.quiz_id = q.quiz_id)
      ORDER BY q.updated_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT utl.user_id, utl.remaining_tokens, utl.updated_at,
             u.full_name, u.username, u.email
      FROM user_token_limits utl
      JOIN users u ON u.user_id = utl.user_id
      WHERE utl.remaining_tokens <= 0
      ORDER BY utl.updated_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT e.id, e.user_id, e.purpose, e.model, e.error_code, e.created_at,
             u.full_name, u.username
      FROM ai_usage_events e
      LEFT JOIN users u ON u.user_id = e.user_id
      WHERE e.request_status = 'error'
        AND e.created_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY e.created_at DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT incident_id, workload, purpose, model, error_code, http_status,
             message, occurrence_count, last_seen_at
      FROM ai_provider_incidents
      WHERE resolved_at IS NULL
        AND workload = 'rag'
        AND LEFT(purpose, 4) = 'rag_'
        AND last_seen_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY last_seen_at DESC
      LIMIT 25
    `)
  ]);

  const alerts = [];

  for (const row of mediaResult.rows) {
    const missing = row.status === 'MISSING_SOURCE';
    const targetUrl = courseTarget(row, missing ? 'missing-media-source' : 'media-processing-failed');
    alerts.push(createAlert({
      id: `media-${row.media_id}`,
      type: 'failed_upload',
      severity: 'high',
      title: missing ? 'Media bị thiếu tệp nguồn' : 'Media xử lý thất bại',
      message: `${row.lesson_title ? `Bài “${row.lesson_title}”` : (row.original_filename || row.object_key || `Media ${row.media_id}`)} đang ở trạng thái ${row.status}.`,
      timestamp: asTimestamp(row.updated_at, generatedAt),
      actionUrl: targetUrl || withQuery('/admin/dashboard', { tab: 'users', userId: row.created_by }),
      actionLabel: targetUrl ? 'Mở đúng bài học' : 'Xem chủ sở hữu',
      source: `PostgreSQL · media_assets · ${row.media_id}`,
      entity: { type: 'media', id: row.media_id, courseId: row.course_id, lessonId: row.lesson_id, storageKey: row.object_key }
    }));
  }

  for (const row of pendingUploadResult.rows) {
    const targetUrl = courseTarget(row, 'stale-upload', { uploadId: row.upload_id });
    const isOrphaned = !row.lesson_id;
    const isExpired = row.expires_at && new Date(row.expires_at).getTime() <= new Date(generatedAt).getTime();
    alerts.push(createAlert({
      id: `pending-upload-${row.upload_id}`,
      type: 'failed_upload',
      severity: 'medium',
      title: isOrphaned && isExpired ? 'Upload hết hạn chưa được dọn' : 'Upload media bị treo',
      message: row.lesson_title
        ? `Bài “${row.lesson_title}” chưa hoàn tất upload sau 30 phút hoặc đã hết hạn.`
        : isExpired
          ? `Tệp “${row.storage_key}” đã hết hạn và không còn liên kết với bài học nào.`
          : `Tệp “${row.storage_key}” chưa được liên kết với bài học sau 30 phút.`,
      timestamp: asTimestamp(row.created_at, generatedAt),
      actionUrl: targetUrl || withQuery('/admin/dashboard', { tab: 'users', userId: row.instructor_id, uploadId: row.upload_id }),
      actionLabel: targetUrl ? 'Mở đúng nội dung lỗi' : 'Xem chủ upload',
      source: `PostgreSQL · pending_media_uploads · ${row.upload_id}`,
      entity: {
        type: 'pending_upload', id: row.upload_id, courseId: row.course_id,
        lessonId: row.lesson_id, userId: row.instructor_id, storageKey: row.storage_key,
        orphaned: isOrphaned, expired: Boolean(isExpired)
      }
    }));
  }

  for (const row of deletionResult.rows) {
    const targetUrl = courseTarget(row, 'storage-deletion-failed', { deletionId: row.deletion_id });
    const ownerUrl = row.instructor_id
      ? withQuery('/admin/dashboard', { tab: 'users', userId: row.instructor_id, deletionId: row.deletion_id })
      : null;
    alerts.push(createAlert({
      id: `storage-deletion-${row.deletion_id}`,
      type: 'server',
      severity: row.status === 'FAILED_PERMANENT' ? 'high' : 'medium',
      title: 'Dọn dẹp kho lưu trữ chưa hoàn tất',
      message: `Tệp “${row.storage_key}” xóa thất bại sau ${asNumber(row.retry_count)} lần thử${row.last_error ? `: ${row.last_error}` : '.'}`,
      timestamp: asTimestamp(row.created_at, generatedAt),
      actionUrl: targetUrl || ownerUrl,
      actionLabel: targetUrl ? 'Mở đúng nội dung lỗi' : ownerUrl ? 'Xem chủ sở hữu' : null,
      source: `PostgreSQL · failed_storage_deletions · #${row.deletion_id}`,
      entity: { type: 'storage_deletion', id: row.deletion_id, courseId: row.course_id, lessonId: row.lesson_id, userId: row.instructor_id, storageKey: row.storage_key }
    }));
  }

  for (const row of subtitleResult.rows) {
    alerts.push(createAlert({
      id: `subtitle-${row.subtitle_id}`,
      type: 'failed_upload',
      severity: 'medium',
      title: 'Tạo phụ đề thất bại',
      message: `Bài “${row.lesson_title}”${row.error_message ? `: ${row.error_message}` : ' cần được tạo lại phụ đề.'}`,
      timestamp: asTimestamp(row.updated_at, generatedAt),
      actionUrl: courseTarget(row, 'subtitle-failed'),
      actionLabel: 'Mở đúng bài học',
      source: `PostgreSQL · lesson_subtitles · bài #${row.lesson_id}`,
      entity: { type: 'subtitle', id: row.subtitle_id, courseId: row.course_id, lessonId: row.lesson_id, errorCode: row.error_code }
    }));
  }

  for (const row of emptyCourseResult.rows) {
    alerts.push(createAlert({
      id: `empty-course-${row.course_id}`,
      type: 'course',
      severity: 'high',
      title: 'Khóa học đã xuất bản nhưng chưa có bài học',
      message: `Khóa “${row.course_name}” đang hiển thị cho học viên nhưng không có bài học.`,
      timestamp: asTimestamp(row.updated_at, generatedAt),
      actionUrl: courseTarget(row, 'published-without-lessons'),
      actionLabel: 'Mở đúng khóa học',
      source: `PostgreSQL · courses · #${row.course_id}`,
      entity: { type: 'course', id: row.course_id, courseId: row.course_id }
    }));
  }

  for (const row of emptyQuizResult.rows) {
    const targetUrl = courseTarget(row, 'quiz-without-questions', { tab: 'quizzes' });
    alerts.push(createAlert({
      id: `empty-quiz-${row.quiz_id}`,
      type: 'quiz',
      severity: 'medium',
      title: 'Đề quiz chưa có câu hỏi',
      message: `Đề “${row.title}” chưa chứa câu hỏi nào.`,
      timestamp: asTimestamp(row.updated_at, generatedAt),
      actionUrl: targetUrl || `/quizzes/play/${row.quiz_id}`,
      actionLabel: targetUrl ? 'Mở đúng quiz' : 'Mở đúng đề quiz',
      source: `PostgreSQL · quizzes · #${row.quiz_id}`,
      entity: { type: 'quiz', id: row.quiz_id, courseId: row.course_id, lessonId: row.lesson_id, quizId: row.quiz_id }
    }));
  }

  for (const row of quotaResult.rows) {
    alerts.push(createAlert({
      id: `exhausted-quota-${row.user_id}`,
      type: 'quota_warning',
      severity: 'medium',
      title: 'Tài khoản đã hết hạn mức Token AI',
      message: `Tài khoản “${row.full_name || row.username || row.email}” đã dùng hết hạn mức token được cấp.`,
      timestamp: asTimestamp(row.updated_at, generatedAt),
      actionUrl: userTarget(row.user_id),
      actionLabel: 'Mở đúng tài khoản',
      source: `PostgreSQL · user_token_limits · user #${row.user_id}`,
      entity: { type: 'user_quota', id: row.user_id, userId: row.user_id }
    }));
  }

  for (const row of aiErrorResult.rows) {
    alerts.push(createAlert({
      id: `ai-request-${row.id}`,
      type: 'server',
      severity: 'medium',
      title: 'Yêu cầu AI phát sinh lỗi gần đây',
      message: `${row.full_name || row.username || 'Hệ thống'} · ${row.purpose} · ${row.model}${row.error_code ? ` · ${row.error_code}` : ''}.`,
      timestamp: asTimestamp(row.created_at, generatedAt),
      actionUrl: userTarget(row.user_id, { eventId: row.id }),
      actionLabel: row.user_id ? 'Mở đúng tài khoản' : 'Mở đúng sự kiện',
      source: `PostgreSQL · ai_usage_events · #${row.id}`,
      entity: { type: 'ai_event', id: row.id, userId: row.user_id, model: row.model }
    }));
  }

  for (const row of incidentResult.rows) {
    alerts.push(createAlert({
      id: `ai-incident-${row.incident_id}`,
      type: 'server',
      severity: 'high',
      title: 'Sự cố nhà cung cấp AI chưa phục hồi',
      message: `${row.model} · ${row.purpose} · ${row.error_code}: ${row.message} (${asNumber(row.occurrence_count)} lần).`,
      timestamp: asTimestamp(row.last_seen_at, generatedAt),
      actionUrl: userTarget(null, { incidentId: row.incident_id }),
      actionLabel: 'Mở đúng sự cố AI',
      source: `PostgreSQL · ai_provider_incidents · #${row.incident_id}`,
      entity: { type: 'ai_incident', id: row.incident_id, model: row.model }
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
      actionUrl: userTarget(null, { view: 'rate-limits', model: model.model }),
      actionLabel: 'Mở đúng model',
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
      actionUrl: userTarget(null, { view: 'rate-limits', model: notice.model }),
      actionLabel: 'Mở đúng model',
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
