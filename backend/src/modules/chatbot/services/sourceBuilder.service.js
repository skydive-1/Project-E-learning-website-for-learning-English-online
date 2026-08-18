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
 * Xây dựng Structured Sources và Navigation Actions đã được kiểm chứng
 * @param {Object} params
 * @param {string} params.intent Ý định người dùng (SEARCH_LESSON, NAVIGATE_TO_LESSON, etc.)
 * @param {Array} params.rankedLessons Danh sách bài học từ Hybrid Retrieval (nếu có)
 * @param {number|null} params.currentLessonId ID bài học hiện tại (nếu có)
 * @param {number|null} params.courseId ID khóa học hiện tại (nếu có)
 * @param {number} params.maxSources Giới hạn số thẻ tối đa (mặc định 3)
 * @returns {Promise<{sources: Array, actions: Array}>}
 */
async function buildVerifiedSources({
  intent,
  rankedLessons = [],
  currentLessonId = null,
  courseId = null,
  maxSources = MAX_SOURCES_LIMIT
}) {
  // 1. Nếu là câu hỏi Tiếng Anh chung hoặc không có ý định liên quan bài học -> Không tạo source
  if (intent === INTENTS.GENERAL_ENGLISH_QA || intent === 'none') {
    return { sources: [], actions: [] };
  }

  // 2. Thu thập danh sách candidate lesson IDs cần xác thực
  let candidateIds = [];

  if (intent === INTENTS.CURRENT_LESSON_QA && currentLessonId && Number(currentLessonId) > 0) {
    candidateIds = [Number(currentLessonId)];
  } else if (intent === INTENTS.RECOMMEND_LESSON) {
    if (rankedLessons && rankedLessons.length > 0) {
      candidateIds = rankedLessons.map(l => l.lessonId).filter(id => id !== Number(currentLessonId));
    }
    // Nếu chưa có đề xuất khác ngoài bài hiện tại, tự động lấy các bài học tiếp theo theo lộ trình của khóa học
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
          // Nếu đang ở bài cuối cùng của khóa học -> Gợi ý các bài học ôn tập trọng tâm khác trong khóa
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
    // Lấy ID theo thứ tự xếp hạng của Reranker
    candidateIds = rankedLessons.map(l => l.lessonId).filter(Boolean);
    if (intent === INTENTS.NAVIGATE_TO_LESSON) {
      // NAVIGATE_TO_LESSON chỉ tập trung vào 1 bài học đích duy nhất
      candidateIds = candidateIds.slice(0, 1);
    } else {
      candidateIds = candidateIds.slice(0, maxSources);
    }
  }

  if (candidateIds.length === 0) {
    return { sources: [], actions: [] };
  }

  // 3. Xác thực tính tồn tại và lấy dữ liệu chính xác từ PostgreSQL (Source of Truth)
  const authLessonsMap = await fetchAuthoritativeLessons(candidateIds, courseId);

  const sources = [];
  const actions = [];

  const itemsToIterate = candidateIds.map(id => {
    const foundRanked = (rankedLessons || []).find(l => l.lessonId === id);
    return foundRanked || { lessonId: id };
  });

  for (const item of itemsToIterate) {
    const auth = authLessonsMap.get(item.lessonId);
    if (!auth) continue; // Bỏ qua nếu không tồn tại trong PostgreSQL (Anti-Hallucination)

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
      badgeText: intent === INTENTS.RECOMMEND_LESSON 
        ? 'Đề xuất học tiếp' 
        : (intent === INTENTS.NAVIGATE_TO_LESSON ? 'Bài học đích' : 'Bài học liên quan')
    };

    sources.push(sourceObj);

    // Xây dựng Action mở bài học cho Frontend
    actions.push({
      type: 'OPEN_LESSON',
      lessonId: auth.lessonId,
      courseId: auth.courseId,
      lessonTitle: auth.lessonTitle,
      route: `/lessons/${auth.lessonId}`
    });

    if (sources.length >= maxSources) break;
  }

  return { sources, actions };
}

module.exports = {
  MAX_SOURCES_LIMIT,
  fetchAuthoritativeLessons,
  buildVerifiedSources
};
