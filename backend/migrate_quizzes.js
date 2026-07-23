require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'elearning_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("🔄 Đang bắt đầu di chuyển cấu trúc bảng Quizzes (với lesson_id)...");

    await client.query('BEGIN');

    // 1. Drop các bảng cũ
    console.log("🗑️ Đang dọn dẹp các bảng cũ...");
    await client.query('DROP TABLE IF EXISTS quiz_attempts CASCADE');
    await client.query('DROP TABLE IF EXISTS questions CASCADE');
    await client.query('DROP TABLE IF EXISTS quizzes CASCADE');
    await client.query('DROP TABLE IF EXISTS quiz_history CASCADE');
    await client.query('DROP TABLE IF EXISTS quizz CASCADE');

    // 2. Tạo bảng quizzes (Có thêm cột lesson_id để ánh xạ với bài học)
    console.log("📁 Đang tạo bảng quizzes...");
    await client.query(`
      CREATE TABLE quizzes (
        quiz_id SERIAL PRIMARY KEY,
        course_id INT REFERENCES courses(course_id) ON DELETE CASCADE,
        lesson_id INT REFERENCES lessons(lesson_id) ON DELETE CASCADE, -- Liên kết trực tiếp bài học
        title VARCHAR(255) NOT NULL,
        description TEXT,
        difficulty VARCHAR(50) DEFAULT 'Medium',
        time_limit INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Tạo bảng questions (liên kết với quizzes qua quiz_id)
    console.log("❓ Đang tạo bảng questions...");
    await client.query(`
      CREATE TABLE questions (
        question_id SERIAL PRIMARY KEY,
        quiz_id INT REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer VARCHAR(50) NOT NULL,
        explanation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Tạo bảng quiz_attempts
    console.log("📝 Đang tạo bảng quiz_attempts...");
    await client.query(`
      CREATE TABLE quiz_attempts (
        attempt_id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
        quiz_id INT REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
        score INT NOT NULL,
        nickname VARCHAR(100),
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Seed dữ liệu trắc nghiệm mẫu
    console.log("🌱 Đang seed dữ liệu mẫu...");
    
    // Lấy ID của các bài học thực tế trong DB
    const lesson13Res = await client.query("SELECT lesson_id, course_id FROM lessons l JOIN sections s ON l.section_id = s.section_id WHERE l.title LIKE '%Speaking Tenses%' LIMIT 1");
    const lesson14Res = await client.query("SELECT lesson_id, course_id FROM lessons l JOIN sections s ON l.section_id = s.section_id WHERE l.title LIKE '%câu hỏi đuôi%' OR l.title LIKE '%question%' LIMIT 1");

    let lesson13Id = null;
    let lesson14Id = null;
    let courseId = null;

    if (lesson13Res.rows.length > 0) {
      lesson13Id = lesson13Res.rows[0].lesson_id;
      courseId = lesson13Res.rows[0].course_id;
    }
    if (lesson14Res.rows.length > 0) {
      lesson14Id = lesson14Res.rows[0].lesson_id;
      if (!courseId) courseId = lesson14Res.rows[0].course_id;
    }

    // Fallback nếu không tìm thấy bài học đúng tên
    if (!lesson13Id) {
      const fallbackLessons = await client.query("SELECT lesson_id, course_id FROM lessons l JOIN sections s ON l.section_id = s.section_id LIMIT 2");
      if (fallbackLessons.rows.length > 0) {
        lesson13Id = fallbackLessons.rows[0].lesson_id;
        courseId = fallbackLessons.rows[0].course_id;
      }
      if (fallbackLessons.rows.length > 1) {
        lesson14Id = fallbackLessons.rows[1].lesson_id;
      }
    }

    console.log(`Lấy được: Speaking Tenses (Lesson ID: ${lesson13Id}), Tag Questions (Lesson ID: ${lesson14Id}), Course ID: ${courseId}`);

    // --- QUIZ 1: Speaking Tenses (Khóa học, gán vào Lesson 13) ---
    if (lesson13Id) {
      const quiz1Res = await client.query(`
        INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit)
        VALUES ($1, $2, 'Speaking Tenses Quiz', 'Trắc nghiệm kiểm tra phản xạ về 3 thì cơ bản trong văn nói.', 'Medium', 10)
        RETURNING quiz_id
      `, [courseId, lesson13Id]);
      const quiz1Id = quiz1Res.rows[0].quiz_id;

      await client.query(`
        INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation)
        VALUES 
        ($1, 'Every morning, my brother __________ a cup of warm water before breakfast.', '["A. is drinking", "B. drinks", "C. drank", "D. will drink"]', 'B', 'Thì hiện tại đơn diễn tả một thói quen hàng ngày (Every morning). Chủ ngữ ''my brother'' số ít nên động từ chia là ''drinks''.'),
        ($1, 'Yesterday, she __________ to the library to borrow some grammar books.', '["A. goes", "B. was going", "C. went", "D. will go"]', 'C', 'Dấu hiệu nhận biết ''Yesterday'' chỉ hành động xảy ra và kết thúc trong quá khứ, chia thì Quá khứ đơn (went).'),
        ($1, 'I promise I __________ you with your English homework tomorrow evening.', '["A. will help", "B. help", "C. helped", "D. helping"]', 'A', 'Dấu hiệu nhận biết lời hứa (I promise) kết hợp với mốc thời gian tương lai (tomorrow) dùng thì Tương lai đơn (will help).'),
        ($1, 'Look! The students __________ English in the classroom.', '["A. practice", "B. are practicing", "C. practiced", "D. will practice"]', 'B', 'Từ cảm thán ''Look!'' (Nhìn kìa!) báo hiệu hành động đang xảy ra tại thời điểm nói, chia thì Hiện tại tiếp diễn (are practicing).'),
        ($1, 'At 8 PM yesterday, we __________ a video lesson on speaking reflexes.', '["A. watch", "B. are watching", "C. were watching", "D. will watch"]', 'C', 'Hành động đang diễn ra tại một thời điểm cụ thể trong quá khứ (At 8 PM yesterday) chia thì Quá khứ tiếp diễn (were watching).')
      `, [quiz1Id]);
    }

    // --- QUIZ 2: Tag Questions (Khóa học, gán vào Lesson 14) ---
    if (lesson14Id) {
      const quiz2Res = await client.query(`
        INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit)
        VALUES ($1, $2, 'Tag Questions Quiz', 'Trắc nghiệm kiểm tra phản xạ về cấu trúc câu hỏi đuôi.', 'Medium', 10)
        RETURNING quiz_id
      `, [courseId, lesson14Id]);
      const quiz2Id = quiz2Res.rows[0].quiz_id;

      await client.query(`
        INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation)
        VALUES 
        ($1, 'You aren''t going to the English club today, __________?', '["A. are you", "B. aren''t you", "C. do you", "D. don''t you"]', 'A', 'Mệnh đề chính ở thể phủ định (aren''t), phần hỏi đuôi phải ở thể khẳng định (are you).'),
        ($1, 'She plays the piano beautifully, __________?', '["A. is she", "B. does she", "C. doesn''t she", "D. isn''t she"]', 'C', 'Mệnh đề chính dùng động từ thường ở thể khẳng định (plays), phần hỏi đuôi dùng trợ động từ phù hợp ở thể phủ định (doesn''t she).'),
        ($1, 'Let''s go out for a walk in the park, __________?', '["A. shall we", "B. will you", "C. do we", "D. don''t we"]', 'A', 'Câu rủ rê bắt đầu bằng ''Let''s'' thì câu hỏi đuôi mặc định luôn là ''shall we''.'),
        ($1, 'He has never been to London before, __________?', '["A. hasn''t he", "B. has he", "C. did he", "D. didn''t he"]', 'B', 'Câu chứa trạng từ phủ định ''never'' (chưa bao giờ), do đó mệnh đề chính mang nghĩa phủ định, phần hỏi đuôi phải ở thể khẳng định (has he).'),
        ($1, 'Nobody called me last night, __________?', '["A. did they", "B. didn''t they", "C. did he", "D. didn''t he"]', 'A', 'Chủ ngữ phủ định ''Nobody'' được thay thế bằng đại từ ''they'' ở phần hỏi đuôi. Mệnh đề chính mang nghĩa phủ định nên đuôi phải là khẳng định (did they).')
      `, [quiz2Id]);
    }

    // --- QUIZ 3: English Slangs & Idioms Quiz (Tự do - course_id = NULL, lesson_id = NULL) ---
    const quiz3Res = await client.query(`
      INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit)
      VALUES (NULL, NULL, 'English Slangs & Idioms Quiz', 'Thử thách hiểu biết của bạn về tiếng lóng và các thành ngữ tiếng Anh giao tiếp thông dụng hàng ngày.', 'Medium', 5)
      RETURNING quiz_id
    `);
    const quiz3Id = quiz3Res.rows[0].quiz_id;

    await client.query(`
      INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation)
      VALUES 
      ($1, 'When someone says ''Break a leg!'', what do they mean?', '["A. Go hurt yourself", "B. Good luck", "C. Hurry up", "D. Be quiet"]', 'B', '''Break a leg'' là thành ngữ tiếng Anh dùng để chúc ai đó may mắn trước khi họ lên sân khấu biểu diễn.'),
      ($1, 'If a task is ''a piece of cake'', it is __________.', '["A. very delicious", "B. extremely easy", "C. complicated", "D. expensive"]', 'B', '''A piece of cake'' là thành ngữ ví von một việc gì đó cực kỳ dễ dàng để hoàn thành.'),
      ($1, 'What does ''cost an arm and a leg'' mean?', '["A. Very cheap", "B. Painful", "C. Extremely expensive", "D. Dangerous"]', 'C', '''Cost an arm and a leg'' diễn tả một món đồ hoặc dịch vụ có giá cắt cổ, rất đắt đỏ.'),
      ($1, 'Choose the meaning of the slang: ''I feel under the weather today.''', '["A. I feel sick", "B. I like the weather", "C. I am happy", "D. I want to go out"]', 'A', '''Under the weather'' là trạng thái cảm thấy không được khỏe, mệt mỏi trong người.'),
      ($1, 'When you ''hit the sack'', you __________.', '["A. play football", "B. clean the room", "C. go to sleep", "D. pack bags"]', 'C', '''Hit the sack'' (hoặc ''hit the hay'') có nghĩa là đi ngủ.')
    `, [quiz3Id]);

    // --- QUIZ 4: Travel English Essentials (Tự do - course_id = NULL, lesson_id = NULL) ---
    const quiz4Res = await client.query(`
      INSERT INTO quizzes (course_id, lesson_id, title, description, difficulty, time_limit)
      VALUES (NULL, NULL, 'Travel English Essentials', 'Trang bị các mẫu câu giao tiếp tiếng Anh thiết thực tại sân bay, khách sạn, nhà hàng khi đi du lịch nước ngoài.', 'Easy', 8)
      RETURNING quiz_id
    `);
    const quiz4Id = quiz4Res.rows[0].quiz_id;

    await client.query(`
      INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation)
      VALUES 
      ($1, 'At the airport check-in counter, which phrase is used to ask for a seat near the window?', '["A. I''d like an aisle seat, please.", "B. I''d like a window seat, please.", "C. Can I sit on the wing?", "D. Where is the gate?"]', 'B', '''Window seat'' là ghế ngồi sát cửa sổ máy bay.'),
      ($1, 'When checking into a hotel, what should you ask if you want breakfast included?', '["A. Is breakfast free?", "B. Is breakfast included?", "C. What time is dinner?", "D. Do you have breakfast?"]', 'B', 'Cấu trúc thông dụng: ''Is breakfast included?'' (Bữa sáng đã bao gồm trong tiền phòng chưa?).'),
      ($1, 'In a restaurant, what is the most polite way to ask for the bill/check?', '["A. Bring me the bill!", "B. Could we have the bill, please?", "C. I want to pay now.", "D. Money, please."]', 'B', '''Could we have the bill, please?'' là cách hỏi tính tiền lịch sự nhất.'),
      ($1, 'What does a traveler mean when they ask: ''Where is the baggage claim?''', '["A. Nơi ký gửi hành lý", "B. Nơi nhận lại hành lý sau chuyến bay", "C. Nơi mua túi xách", "D. Quầy làm thủ tục"]', 'B', '''Baggage claim'' là khu vực băng chuyền lấy lại hành lý ký gửi sau khi hạ cánh.'),
      ($1, 'If you get lost and want to ask the way to the subway station, you say: __________', '["A. Where subway?", "B. Could you show me the way to the subway station, please?", "C. I want subway station.", "D. Take me to subway."]', 'B', 'Cách hỏi đường lịch sự: ''Could you show me the way to..., please?''')
    `, [quiz4Id]);

    await client.query('COMMIT');
    console.log("✅ Di chuyển cấu trúc bảng Quizzes và seed dữ liệu thành công!");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Di chuyển cấu trúc bảng Quizzes thất bại:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
