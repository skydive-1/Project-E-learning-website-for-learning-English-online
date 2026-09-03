'use strict';

// Một nguồn cấu hình duy nhất cho toàn bộ tác vụ sinh nội dung Gemini.
// Không cho phép request hoặc biến môi trường chuyên biệt âm thầm đổi model.
const GEMINI_GENERATIVE_MODEL = 'gemini-3.7-flash';

module.exports = Object.freeze({
  GEMINI_GENERATIVE_MODEL
});
