/**
 * Source Builder & PostgreSQL Authoritative Verification Service (Phase 7)
 * - Xây dựng Structured Sources & Actions cho phản hồi của AI Assistant
 * - Xác minh thực thể 100% qua PostgreSQL (Source of Truth), tuyệt đối không để LLM bịa Lesson ID
 * - Xử lý nguồn dựa theo Intent cụ thể (SEARCH_LESSON, NAVIGATE_TO_LESSON, RECOMMEND_LESSON, COURSE_QA, CURRENT_LESSON_QA)
 * - Giới hạn tối đa Top 1 - 3 bài học xác thực
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const db = require('../../../config/database');
const { INTENTS } = require('./intentRouter.service');

const MAX_SOURCES_LIMIT = 3;

/**
 * Xác minh danh sách lesson_id và lấy thông tin chính xác từ PostgreSQL
 * @param {Array<number>} lessonIds Danh sách ID bài học cần xác thực
 * @param {number|null} expectedCourseId Khóa học đang xét (nếu có)
 * @returns {Promise<Map<number, Object>>}
 */
async function fetchAuthoritativeLessons(lessonIds = [], expectedCourseId = null) {
  if (!lessonIds || lessonIds.length === 0) return new Map();

  const validIds = lessonIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
  if (validIds.length === 0) return new Map();

  try {
    const query = `
      SELECT 
        l.lesson_id,
        l.title AS lesson_title,
        l.content_type,
        s.section_id,
        s.title AS section_title,
        s.course_id,
        c.course_name
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE l.lesson_id = ANY($1)
      ${expectedCourseId ? 'AND s.course_id = $2' : ''}
    `;

    const params = expectedCourseId ? [validIds, Number(expectedCourseId)] : [validIds];
    const res = await db.query(query, params);

    const map = new Map();
    for (const row of res.rows) {
      map.set(row.lesson_id, {
        lessonId: row.lesson_id,
        lessonTitle: row.lesson_title,
        contentType: row.content_type,
        sectionId: row.section_id,
        sectionTitle: row.section_title,
        courseId: row.course_id,
        courseName: row.course_name
      });
    }
    return map;
  } catch (err) {
    console.warn('[Source Builder Warning] Lỗi truy vấn PostgreSQL authoritative lessons:', err.message);
    return new Map();
  }
}

/**
 * Định dạng số giây thành chuỗi thời gian hiển thị (MM:SS hoặc HH:MM:SS)
 */
function formatTimestamp(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return null;
  const totalSecs = Math.floor(Number(seconds));
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Xác thực mốc thời gian an toàn (0 <= start < end, là số hữu hạn)
 */
function validateTimestamp(startTime, endTime) {
  if (startTime === null || startTime === undefined) return null;
  const start = Number(startTime);
  if (isNaN(start) || !isFinite(start) || start < 0) return null;
  
  let end = endTime !== null && endTime !== undefined ? Number(endTime) : null;
  if (end !== null && (isNaN(end) || !isFinite(end) || end < start)) {
    end = null;
  }
  return { startTime: start, endTime: end };
}

/**
 * Xây dựng danh sách Verified Sources có cấu trúc và Action tương ứng cho Frontend
 * - Xác thực 100% qua PostgreSQL (Anti-Hallucination)
 * - Tách biệt rõ ràng theo từng Intent
 * - Giới hạn số lượng tối đa 1-3 thẻ
 * - Gắn timestamp (startTime/endTime) khi có dữ liệu phụ đề tin cậy
 * 
 * @param {Object} params
 * @param {string} params.intent
 * @param {Array} params.rankedLessons - Danh sách bài học được xếp hạng từ Reranker
 * @param {number|string} params.currentLessonId - ID bài học hiện tại (nếu có)
 * @param {number|string} params.courseId - ID khóa học (nếu có)
 * @param {number} params.maxSources - Giới hạn tối đa (mặc định 3)
 * @param {Object|Array} params.timestampInfo - Thông tin mốc thời gian { lessonId, startTime, endTime }
 * @returns {Promise<{ sources: Array, actions: Array }>}
 */
async function buildVerifiedSources({
  intent,
  rankedLessons = [],
  currentLessonId = null,
  courseId = null,
  maxSources = MAX_SOURCES_LIMIT,
  timestampInfo = null
}) {
  // 1. Nếu là Out-of-Domain hoặc General English QA -> Trả về mảng rỗng (Tuyệt đối không sinh card ảo)
  if (
    intent === INTENTS.GENERAL_ENGLISH_QA ||
    intent === 'OUT_OF_DOMAIN' ||
    intent === 'OOD'
  ) {
    return { sources: [], actions: [] };
  }

  let candidateIds = [];

  // 2. Phân loại theo Intent
  if (
    (intent === INTENTS.CURRENT_LESSON_QA || 
     intent === 'SUMMARIZE_CURRENT_LESSON' || 
     intent === INTENTS.SUMMARIZE_CURRENT_LESSON ||
     intent === 'CURRENT_LESSON_QA' ||
     intent === 'current_lesson') && 
    currentLessonId && Number(currentLessonId) > 0
  ) {
    candidateIds = [Number(currentLessonId)];
  } else if (intent === INTENTS.RECOMMEND_LESSON) {
    if (rankedLessons && rankedLessons.length > 0) {
      candidateIds = rankedLessons.map(l => l.lessonId).filter(id => id !== Number(currentLessonId));
    }
    if (candidateIds.length === 0 && courseId && currentLessonId) {
      try {
        let nextQuery = `
          SELECT l.lesson_id
          FROM lessons l
          JOIN sections s ON l.section_id = s.section_id
          WHERE s.course_id = $1 AND l.lesson_id > $2
          ORDER BY s.order_index ASC, l.order_index ASC, l.lesson_id ASC
          LIMIT 3
        `;
        let nextRes = await db.query(nextQuery, [Number(courseId), Number(currentLessonId)]);
        if (nextRes.rows.length === 0) {
          nextQuery = `
            SELECT l.lesson_id
            FROM lessons l
            JOIN sections s ON l.section_id = s.section_id
            WHERE s.course_id = $1 AND l.lesson_id != $2
            ORDER BY s.order_index ASC, l.order_index ASC, l.lesson_id ASC
            LIMIT 2
          `;
          nextRes = await db.query(nextQuery, [Number(courseId), Number(currentLessonId)]);
        }
        if (nextRes.rows.length > 0) {
          candidateIds = nextRes.rows.map(r => r.lesson_id);
        }
      } catch (err) {
        console.warn('[Source Builder Warning] Lỗi truy vấn next lessons:', err.message);
      }
    }
    candidateIds = candidateIds.slice(0, maxSources);
  } else if (rankedLessons && rankedLessons.length > 0) {
    candidateIds = rankedLessons.map(l => l.lessonId).filter(Boolean);
    if (intent === INTENTS.NAVIGATE_TO_LESSON) {
      candidateIds = candidateIds.slice(0, 1);
    } else {
      candidateIds = candidateIds.slice(0, maxSources);
    }
  }

  if (candidateIds.length === 0) return { sources: [], actions: [] };

  const authLessonsMap = await fetchAuthoritativeLessons(candidateIds, courseId);
  const sources = [];
  const actions = [];

  const itemsToIterate = candidateIds.map(id => {
    const foundRanked = (rankedLessons || []).find(l => l.lessonId === id);
    return foundRanked || { lessonId: id };
  });

  for (const item of itemsToIterate) {
    const auth = authLessonsMap.get(item.lessonId);
    if (!auth) continue;

    let rawStart = item.startTime !== undefined ? item.startTime : (item.start_time !== undefined ? item.start_time : null);
    let rawEnd = item.endTime !== undefined ? item.endTime : (item.end_time !== undefined ? item.end_time : null);

    if (rawStart === null && timestampInfo) {
      if (Array.isArray(timestampInfo)) {
        const foundTs = timestampInfo.find(t => Number(t.lessonId) === Number(item.lessonId));
        if (foundTs) {
          rawStart = foundTs.startTime;
          rawEnd = foundTs.endTime;
        }
      } else if (Number(timestampInfo.lessonId) === Number(item.lessonId) || !timestampInfo.lessonId) {
        rawStart = timestampInfo.startTime;
        rawEnd = timestampInfo.endTime;
      }
    }

    const validatedTs = validateTimestamp(rawStart, rawEnd);
    const formattedStart = validatedTs ? formatTimestamp(validatedTs.startTime) : null;

    let badgeText = 'Bài học liên quan';
    if (intent === INTENTS.RECOMMEND_LESSON) {
      badgeText = 'Đề xuất học tiếp';
    } else if (intent === INTENTS.NAVIGATE_TO_LESSON) {
      badgeText = 'Bài học đích';
    } else if (intent === INTENTS.CURRENT_LESSON_QA) {
      badgeText = formattedStart 
        ? `Nội dung bài học hiện tại (${formattedStart})` 
        : 'Nội dung bài học hiện tại';
    }

    const sourceObj = {
      courseId: auth.courseId,
      courseName: auth.courseName,
      sectionId: auth.sectionId,
      sectionTitle: auth.sectionTitle,
      lessonId: auth.lessonId,
      lessonTitle: auth.lessonTitle,
      contentType: auth.contentType || 'video',
      sourceType: item.lexicalScore > 0 ? (item.semanticScore > 0 ? 'hybrid' : 'lexical') : 'transcript',
      relevanceScore: item.rerankScore || 1.0,
      badgeText
    };

    if (validatedTs) {
      sourceObj.startTime = validatedTs.startTime;
      if (validatedTs.endTime !== null) sourceObj.endTime = validatedTs.endTime;
      sourceObj.formattedTime = formattedStart;
    }

    sources.push(sourceObj);

    if (validatedTs) {
      actions.push({
        type: 'SEEK_VIDEO',
        lessonId: auth.lessonId,
        courseId: auth.courseId,
        lessonTitle: auth.lessonTitle,
        startTime: validatedTs.startTime,
        formattedTime: formattedStart,
        route: `/lessons/${auth.lessonId}?seek=${validatedTs.startTime}`
      });
    } else {
      actions.push({
        type: 'OPEN_LESSON',
        lessonId: auth.lessonId,
        courseId: auth.courseId,
        lessonTitle: auth.lessonTitle,
        route: `/lessons/${auth.lessonId}`
      });
    }

    if (sources.length >= maxSources) break;
  }

  return { sources, actions };
}

module.exports = {
  MAX_SOURCES_LIMIT,
  formatTimestamp,
  validateTimestamp,
  fetchAuthoritativeLessons,
  buildVerifiedSources
};
