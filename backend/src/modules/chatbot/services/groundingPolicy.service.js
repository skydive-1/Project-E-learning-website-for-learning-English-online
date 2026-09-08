'use strict';

const GROUNDED_SCOPES = new Set(['current_lesson', 'course_wide']);

function requiresSourceGrounding({ isGlobalChat = false, detectedIntent = null } = {}) {
  if (isGlobalChat || !detectedIntent) return false;
  return GROUNDED_SCOPES.has(detectedIntent.scope);
}

function hasUsableGrounding(contextText, sources = [], options = {}) {
  const hasVerifiedContext = typeof contextText === 'string' && contextText.trim().length > 0;
  const hasVerifiedSource = Array.isArray(sources) && sources.length > 0;
  const hasContentEvidence = options.hasContentEvidence === true;
  const allowMetadataOnly = options.allowMetadataOnly === true;

  return hasVerifiedContext
    && hasVerifiedSource
    && (hasContentEvidence || allowMetadataOnly);
}

function getInsufficientGroundingReply(intent) {
  if (intent === 'SEARCH_LESSON' || intent === 'NAVIGATE_TO_LESSON' || intent === 'RECOMMEND_LESSON' || intent === 'COURSE_QA') {
    return 'Tôi chưa tìm thấy nội dung đủ tin cậy trong khóa học để trả lời câu hỏi này. Bạn có thể nêu rõ chủ đề hoặc tên bài học cần tìm.';
  }

  return 'Tôi chưa tìm thấy nội dung đủ tin cậy trong bài học để trả lời câu hỏi này. Bạn có thể hỏi lại về một đoạn cụ thể hoặc cung cấp thêm ngữ cảnh.';
}

function getPromptGroundingRules(groundingRequired) {
  if (!groundingRequired) {
    return [
      '- Đây là câu hỏi tiếng Anh tổng quát. Bạn có thể dùng kiến thức tiếng Anh chuẩn để trả lời.',
      '- Không được suy đoán thông tin riêng về bài học, khóa học hoặc dữ liệu của hệ thống.'
    ].join('\n');
  }

  return [
    '- Chỉ được dùng thông tin có trong NGỮ CẢNH ĐÃ XÁC MINH bên dưới.',
    '- Không bổ sung kiến thức bên ngoài, không suy đoán và không tạo tên bài học, số liệu, ví dụ hoặc kết luận mà ngữ cảnh không hỗ trợ.',
    '- Nếu ngữ cảnh không đủ để trả lời, hãy nói rõ rằng chưa tìm thấy nội dung đủ tin cậy trong bài học hoặc khóa học.',
    '- Mọi nhận định về bài học hoặc khóa học phải truy ngược được về ngữ cảnh đã cung cấp.'
  ].join('\n');
}

module.exports = {
  GROUNDED_SCOPES,
  requiresSourceGrounding,
  hasUsableGrounding,
  getInsufficientGroundingReply,
  getPromptGroundingRules
};
