/**
 * Lesson Suggested Questions Service (Udemy-like AI Assistant Feature)
 * - Tự động sinh và lưu trữ 4 câu hỏi gợi ý cho từng bài học sau khi có transcript
 * - Tận dụng Gemini 3.7 Flash để tạo câu hỏi sát với bài giảng thực tế
 * - Cơ chế Deterministic Fallback Template (0 token, 0ms) khi chưa có transcript
 * 
 * Phụ trách:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

'use strict';

const db = require('../../../config/database');
const { geminiModel } = require('../../../utils/ai-clients');

/**
 * 1. Trả về 4 câu hỏi gợi ý mẫu theo Template chuỗi (0 token, 0ms latency, KHÔNG gọi Gemini)
 * @param {string} lessonTitle 
 * @param {string} courseName 
 * @returns {Array<string>} 4 câu hỏi gợi ý
 */
function getFallbackSuggestedQuestions(lessonTitle = '', courseName = '') {
  const cleanTitle = (lessonTitle || '').trim() || 'bài học này';
  return [
    `Mục đích và nội dung chính của bài "${cleanTitle}" là gì?`,
    `Giải thích các điểm ngữ pháp và cấu trúc câu quan trọng trong "${cleanTitle}".`,
    `Trích xuất các từ vựng mới và ví dụ minh họa xuất hiện trong bài này.`,
    `Tóm tắt những kiến thức cốt lõi tôi cần ghi nhớ sau khi học xong "${cleanTitle}".`
  ];
}

/**
 * 2. Lấy 4 câu hỏi gợi ý cho một bài học từ Database (hoặc trả về Fallback tức thì nếu chưa có)
 * @param {number|string} lessonId 
 * @returns {Promise<Array<string>>}
 */
async function getSuggestedQuestionsByLessonId(lessonId) {
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
    return getFallbackSuggestedQuestions();
  }

  try {
    // Truy vấn bảng lưu trữ câu hỏi gợi ý
    const res = await db.query(
      'SELECT questions FROM lesson_suggested_questions WHERE lesson_id = $1',
      [parsedLessonId]
    );

    if (res.rows.length > 0 && res.rows[0].questions) {
      let questions = res.rows[0].questions;
      if (typeof questions === 'string') {
        try { questions = JSON.parse(questions); } catch (_) {}
      }
      if (Array.isArray(questions) && questions.length > 0) {
        return questions.slice(0, 4);
      }
    }

    // Nếu chưa có trong DB -> Lấy tiêu đề bài học và trả về Fallback Template nhanh (< 2ms)
    const lessonRes = await db.query(
      'SELECT title FROM lessons WHERE lesson_id = $1',
      [parsedLessonId]
    );
    const lessonTitle = lessonRes.rows[0]?.title || '';
    return getFallbackSuggestedQuestions(lessonTitle);
  } catch (err) {
    console.warn(`[SuggestedQuestions Warning] Lỗi đọc DB lessonId=${lessonId}:`, err.message);
    return getFallbackSuggestedQuestions();
  }
}

/**
 * 3. Tự động sinh và lưu 4 câu hỏi gợi ý bằng Gemini Flash dựa trên Transcript (Phase 2 Ingestion)
 * @param {number|string} lessonId 
 * @param {Array<Object>|null} cues - Mảng phụ đề cues [{ start, end, en, vi }]
 * @returns {Promise<Array<string>>}
 */
async function generateAndSaveSuggestedQuestions(lessonId, cues = null) {
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId) || parsedLessonId <= 0) {
    return getFallbackSuggestedQuestions();
  }

  try {
    console.log(`[SuggestedQuestions] 🚀 Bắt đầu sinh câu hỏi gợi ý cho lessonId=${parsedLessonId}...`);

    // 1. Lấy thông tin bài học & khóa học
    const infoRes = await db.query(`
      SELECT l.title AS lesson_title, s.title AS section_title, c.course_name
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      WHERE l.lesson_id = $1
    `, [parsedLessonId]);

    if (infoRes.rows.length === 0) {
      console.warn(`[SuggestedQuestions] ⚠️ Không tìm thấy bài học id=${parsedLessonId}`);
      return getFallbackSuggestedQuestions();
    }

    const { lesson_title, section_title, course_name } = infoRes.rows[0];

    // 2. Lấy transcript nếu cues chưa được truyền vào trực tiếp
    let transcriptCues = cues;
    if (!transcriptCues || transcriptCues.length === 0) {
      const subRes = await db.query(
        'SELECT cues FROM lesson_subtitles WHERE lesson_id = $1',
        [parsedLessonId]
      );
      if (subRes.rows.length > 0 && subRes.rows[0].cues) {
        transcriptCues = subRes.rows[0].cues;
      }
    }

    // Nếu hoàn toàn không có transcript -> Lưu fallback template
    if (!transcriptCues || !Array.isArray(transcriptCues) || transcriptCues.length === 0) {
      console.log(`[SuggestedQuestions] ℹ️ Không có transcript -> Dùng Fallback Template cho lessonId=${parsedLessonId}`);
      const fallbackQuestions = getFallbackSuggestedQuestions(lesson_title, course_name);
      await saveQuestionsToDb(parsedLessonId, fallbackQuestions);
      return fallbackQuestions;
    }

    // 3. Chuẩn bị ngữ cảnh transcript rút gọn (tối đa ~3500 ký tự để tối ưu chi phí & tốc độ)
    const transcriptText = transcriptCues
      .slice(0, 70)
      .map(c => c.en || c.text || c.vi || '')
      .filter(Boolean)
      .join(' ')
      .slice(0, 3500);

    // 4. Xây dựng Prompt cho Gemini Flash
    const prompt = `Bạn là chuyên gia sư phạm tiếng Anh kiêm cố vấn AI Assistant tại E-Learn Academy.
Dựa vào thông tin bài giảng và đoạn bóc băng âm thanh (transcript) dưới đây, hãy tạo ĐÚNG 4 CÂU HỎI GỢI Ý ngắn gọn, tự nhiên, và hữu ích nhất mà học viên tiếng Anh có khả năng cao sẽ hỏi AI Assistant về bài học này (giống tính năng Suggested Questions của Udemy AI).

THÔNG TIN BÀI HỌC:
- Khóa học: ${course_name}
- Chương: ${section_title}
- Bài học: ${lesson_title}

NỘI DUNG BÓC BĂNG TRANSCRIPT:
${transcriptText}

YÊU CẦU:
1. Tạo đúng 4 câu hỏi bằng tiếng Việt tự nhiên hoặc tiếng Anh tùy theo ngữ cảnh bài học (ưu tiên tiếng Việt thân thiện, rõ ràng).
2. Các câu hỏi cần bao quát: mục đích bài học, giải thích ngữ pháp/khái niệm khó, từ vựng hoặc ví dụ cụ thể, và tóm tắt cốt lõi.
3. Không đặt câu hỏi mơ hồ hay chung chung kiểu "Bài này nói về gì?". Hãy gắn liền với nội dung cụ thể được nhắc tới trong transcript.
4. Trả về DUY NHẤT một JSON hợp lệ theo schema sau (không thêm markdown hay văn bản ngoài):
{"questions": ["Câu hỏi 1?", "Câu hỏi 2?", "Câu hỏi 3?", "Câu hỏi 4?"]}`;

    // 5. Gọi Gemini với Timeout 4.5s
    let generatedQuestions = null;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Suggested Questions Generation Timeout (4500ms)')), 4500)
      );

      const aiResponse = await Promise.race([
        geminiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }),
        timeoutPromise
      ]);

      let text = aiResponse.response ? aiResponse.response.text() : (typeof aiResponse === 'string' ? aiResponse : '');
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
        generatedQuestions = parsed.questions.slice(0, 4).map(q => String(q).trim()).filter(Boolean);
      }
    } catch (aiErr) {
      console.warn(`[SuggestedQuestions Warning] Gemini gặp lỗi/timeout cho lessonId=${parsedLessonId}:`, aiErr.message);
    }

    // Nếu AI không trả về đủ 4 câu hỏi -> Sử dụng Fallback Template
    if (!generatedQuestions || generatedQuestions.length < 3) {
      console.log(`[SuggestedQuestions] ⚠️ Dùng Fallback Template do AI không phản hồi đủ câu hỏi (lessonId=${parsedLessonId})`);
      generatedQuestions = getFallbackSuggestedQuestions(lesson_title, course_name);
    }

    // 6. Lưu / Ghi đè vào bảng lesson_suggested_questions
    await saveQuestionsToDb(parsedLessonId, generatedQuestions);
    console.log(`[SuggestedQuestions] ✅ Đã lưu thành công 4 câu hỏi gợi ý cho lessonId=${parsedLessonId} ("${lesson_title}")`);

    return generatedQuestions;
  } catch (err) {
    console.error(`[SuggestedQuestions Error] Lỗi sinh câu hỏi gợi ý cho lessonId=${parsedLessonId}:`, err.message);
    return getFallbackSuggestedQuestions();
  }
}

/**
 * 4. Hàm trợ giúp lưu câu hỏi vào PostgreSQL (Upsert)
 */
async function saveQuestionsToDb(lessonId, questions) {
  const query = `
    INSERT INTO lesson_suggested_questions (lesson_id, questions, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (lesson_id)
    DO UPDATE SET
      questions = EXCLUDED.questions,
      updated_at = NOW()
    RETURNING *;
  `;
  await db.query(query, [lessonId, JSON.stringify(questions)]);
}

module.exports = {
  getFallbackSuggestedQuestions,
  getSuggestedQuestionsByLessonId,
  generateAndSaveSuggestedQuestions,
  saveQuestionsToDb
};
