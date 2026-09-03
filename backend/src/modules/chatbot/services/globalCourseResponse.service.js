'use strict';

const { GEMINI_MODELS } = require('../../../config/ai-model');

const COURSE_TERM_PATTERN = /kh[oó]a học|khoá học|\bcourses?\b/i;
const CATALOG_INTENT_PATTERN = /tóm tắt|tổng quan|danh sách|hiện có|đang có|có những|giới thiệu|đề xuất|available|offered|offer|list|overview|summari[sz]e|what courses/i;
const COMPLEX_GLOBAL_PATTERN = /phân tích (?:sâu|chi tiết)|giải thích (?:chuyên sâu|chi tiết)|so sánh (?:chuyên sâu|chi tiết)|lập (?:một )?lộ trình|kế hoạch học tập|chấm (?:và )?sửa|sửa (?:bài|đoạn văn|bài luận)|viết (?:một )?bài luận|ielts writing|academic writing|advanced grammar|analy[sz]e in depth|explain in detail|detailed comparison|study plan|learning roadmap|review and correct|grade (?:my|this)|write (?:an? )?essay/i;

const isCourseCatalogQuestion = (question) => {
  const normalizedQuestion = String(question || '').trim();
  return COURSE_TERM_PATTERN.test(normalizedQuestion)
    && CATALOG_INTENT_PATTERN.test(normalizedQuestion);
};

const isComplexGlobalQuestion = (question) => {
  const normalizedQuestion = String(question || '').replace(/\s+/g, ' ').trim();
  return normalizedQuestion.length >= 280 || COMPLEX_GLOBAL_PATTERN.test(normalizedQuestion);
};

const selectGlobalChatProfile = (
  question,
  {
    fastModel = GEMINI_MODELS.fast,
    complexModel = GEMINI_MODELS.primary
  } = {}
) => {
  if (isComplexGlobalQuestion(question)) {
    return {
      tier: 'deep',
      model: complexModel,
      maxOutputTokens: 2048,
      thinkingLevel: 'LOW'
    };
  }

  return {
    tier: 'fast',
    model: fastModel,
    maxOutputTokens: 768,
    thinkingLevel: 'MINIMAL'
  };
};

const buildCourseCatalogReply = (courses, { loadFailed = false } = {}) => {
  if (loadFailed) {
    return 'Hiện tại tôi chưa thể tải danh sách khóa học từ hệ thống. Bạn vui lòng thử lại sau ít phút nhé.';
  }

  const safeCourses = Array.isArray(courses) ? courses.filter(Boolean) : [];
  if (safeCourses.length === 0) {
    return 'Hiện tại E-Learn Academy chưa có khóa học nào được đăng tải.';
  }

  const courseLines = safeCourses.map((course, index) => {
    const name = String(course.course_name || course.courseName || 'Khóa học chưa đặt tên').trim();
    const description = String(course.description || '').replace(/\s+/g, ' ').trim();
    return description
      ? `${index + 1}. ${name}: ${description}`
      : `${index + 1}. ${name}: Hiện chưa có mô tả chi tiết.`;
  });

  return [
    `Hiện E-Learn Academy có ${safeCourses.length} khóa học tiếng Anh:`,
    '',
    ...courseLines,
    '',
    'Bạn muốn tôi tư vấn khóa học phù hợp với mục tiêu hoặc trình độ của bạn không?'
  ].join('\n');
};

module.exports = {
  isCourseCatalogQuestion,
  isComplexGlobalQuestion,
  selectGlobalChatProfile,
  buildCourseCatalogReply
};
