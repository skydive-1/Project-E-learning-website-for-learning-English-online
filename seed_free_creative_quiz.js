require('./backend/node_modules/dotenv').config({path: './backend/.env'});
const { pool } = require('./backend/src/config/database');

async function seed() {
  try {
    console.log("Đang bắt đầu seed đề thi tự luyện sáng tạo mới...");
    
    // Kiểm tra xem đề thi đã tồn tại chưa
    const checkQuiz = await pool.query("SELECT quiz_id FROM quizzes WHERE title = 'Creative English Challenge (AI Writing & Speaking)'");
    if (checkQuiz.rows.length > 0) {
      console.log("Đề thi sáng tạo đã được tạo trước đó!");
      process.exit(0);
    }
    
    // 1. Tạo đề thi tự luyện tự do (course_id = NULL)
    const quizRes = await pool.query(`
      INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit)
      VALUES (NULL, NULL, 'Creative English Challenge (AI Writing & Speaking)', 'Thách thức viết luận ngắn và luyện phát âm nói tiếng Anh tương tác trực tiếp với Trợ lý ảo AI.', 'Medium', 15)
      RETURNING quiz_id
    `);
    
    const quizId = quizRes.rows[0].quiz_id;
    console.log("Đã tạo đề thi với ID:", quizId);
    
    // 2. Chèn các câu hỏi tự luận (writing) và phát âm (pronunciation)
    await pool.query(`
      INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, question_type)
      VALUES 
      ($1, 'Describe your favorite English learning method in 2-3 sentences. Why do you like it?', '[]'::jsonb, '', 'AI Trợ lý ảo sẽ tự động phân tích ngữ pháp, chính tả, cách dùng từ và đề xuất bài viết mẫu tối ưu.', 'writing'),
      ($1, 'Read the following sentence aloud with clear pronunciation and natural intonation.', '[]'::jsonb, 'English has become a global language for communication and education.', 'Đọc to rõ ràng câu mẫu. AI sẽ tự động phân tích giọng nói của bạn để chấm điểm và chỉ ra lỗi phát âm cụ thể.', 'pronunciation'),
      ($1, 'Write a short paragraph (3-4 sentences) about what you did yesterday.', '[]'::jsonb, '', 'Tập viết câu chuyện quá khứ sử dụng Thì quá khứ đơn (Past Simple). Trợ lý AI sẽ sửa lỗi ngữ pháp thì cho bạn.', 'writing')
    `, [quizId]);
    
    console.log("✅ Seed câu hỏi sáng tạo thành công!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed thất bại:", error);
    process.exit(1);
  }
}

seed();
