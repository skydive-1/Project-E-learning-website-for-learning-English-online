/**
 * Database Configuration
 * - Thiết lập kết nối PostgreSQL sử dụng pg Pool
 */

const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'elearning_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Lắng nghe sự kiện lỗi trên các client nhàn rỗi trong pool
pool.on('error', (err) => {
  console.error('❌ Lỗi bất ngờ trên client PostgreSQL nhàn rỗi:', err);
});

// Hàm kiểm tra kết nối tới Database và khởi tạo bảng nếu cần
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Kết nối thành công tới cơ sở dữ liệu PostgreSQL!');

    // Tạo bảng roles trước để làm khóa ngoại
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE
      );
    `);

    // Chèn vai trò mặc định nếu chưa có
    await client.query(`
      INSERT INTO roles (role_id, role_name) 
      VALUES (1, 'Admin'), (2, 'Instructor'), (3, 'Student') 
      ON CONFLICT (role_id) DO UPDATE SET role_name = EXCLUDED.role_name;
    `);

    // Tạo bảng users theo cấu trúc mới của bạn
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, -- Cần VARCHAR(255) để chứa chuỗi mã hóa bcrypt (60 ký tự)
        created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        full_name VARCHAR(100) NOT NULL,
        birth_date DATE,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(15) UNIQUE,
        role_id INT NOT NULL DEFAULT 3,
        gender VARCHAR(10) CHECK (gender IN ('Male','Female','Other')),
        profile_picture_url VARCHAR(255),
        CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
      );
    `);

    // Tự động nâng cấp độ dài cột username nếu bảng đã tồn tại trước đó với VARCHAR(20)
    await client.query(`
      ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(50);
    `);

    // Tự động thay đổi default role_id sang 3 (Student) cho bảng đã tồn tại
    await client.query(`
      ALTER TABLE users ALTER COLUMN role_id SET DEFAULT 3;
    `);

    // Tự động kiểm tra và bổ sung cột profile_picture_url nếu chưa tồn tại
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(255);
    `);

    // Tự động khởi tạo/kiểm tra các môn học mẫu trong bảng subjects
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        subject_id SERIAL PRIMARY KEY,
        subject_name VARCHAR(100) NOT NULL UNIQUE,
        credits INT NOT NULL DEFAULT 3
      );
    `);

    await client.query(`
      INSERT INTO subjects (subject_id, subject_name, credits) 
      VALUES 
        (1, 'IELTS Masterclass', 4),
        (2, 'TOEIC Prep', 3),
        (3, 'Business English', 3),
        (4, 'General English Communication', 2),
        (5, 'English Grammar Essentials', 2)
      ON CONFLICT (subject_id) DO UPDATE 
      SET subject_name = EXCLUDED.subject_name, credits = EXCLUDED.credits;
    `);

    console.log('✅ Đã kiểm tra/khởi tạo các bảng "roles", "users" và "subjects" thành công.');

    // Tạo bảng courses
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        course_id SERIAL PRIMARY KEY,
        subject_id INT,
        course_name VARCHAR(255) NOT NULL,
        description TEXT,
        instructor_id INT NOT NULL,
        thumbnail_url VARCHAR(255),
        price DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_course_instructor FOREIGN KEY (instructor_id) REFERENCES users(user_id),
        CONSTRAINT fk_course_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
      );
    `);

    // Tạo bảng sections
    await client.query(`
      CREATE TABLE IF NOT EXISTS sections (
        section_id SERIAL PRIMARY KEY,
        course_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        order_index INT NOT NULL,
        CONSTRAINT fk_section_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
      );
    `);

    // Tạo bảng lessons
    await client.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        lesson_id SERIAL PRIMARY KEY,
        section_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content_type VARCHAR(20) NOT NULL, -- video, pdf, quiz, text
        content_url TEXT,
        order_index INT NOT NULL,
        CONSTRAINT fk_lesson_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE
      );
    `);

    // Tạo bảng user_progress để lưu tiến độ học tập
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        progress_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        lesson_id INT NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE,
        CONSTRAINT uq_user_lesson UNIQUE (user_id, lesson_id)
      );
    `);

    console.log('✅ Đã kiểm tra/khởi tạo các bảng "courses", "sections", "lessons", "user_progress" thành công.');

    // Tạo bảng questions (trắc nghiệm cho course)
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        question_id SERIAL PRIMARY KEY,
        course_id INT NOT NULL,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer TEXT NOT NULL,
        CONSTRAINT fk_question_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
      );
    `);

    // Tạo bảng quiz_history
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_history (
        history_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        score NUMERIC(5,2) NOT NULL,
        total_questions INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_quiz_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_quiz_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
      );
    `);

    console.log('✅ Đã kiểm tra/khởi tạo các bảng "questions", "quiz_history" thành công.');

    // Tạo/Kiểm tra bảng ai_chat và thêm cột lesson_id nếu chưa có
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_chat (
        ai_chat SERIAL PRIMARY KEY,
        student_id INT NOT NULL,
        title TEXT NOT NULL,
        sender_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_chat_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    // Sửa khóa ngoại: Nếu tồn tại khóa ngoại cũ 'fk_student_id' (liên kết với bảng students trống), 
    // ta bỏ đi và thêm liên kết chính xác với bảng users(user_id)
    await client.query(`
      ALTER TABLE ai_chat DROP CONSTRAINT IF EXISTS fk_student_id;
      ALTER TABLE ai_chat DROP CONSTRAINT IF EXISTS fk_chat_student;
      ALTER TABLE ai_chat ADD CONSTRAINT fk_chat_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE;
    `);

    await client.query(`
      ALTER TABLE ai_chat ADD COLUMN IF NOT EXISTS lesson_id INT CONSTRAINT fk_ai_chat_lesson REFERENCES lessons(lesson_id) ON DELETE CASCADE;
    `);

    // Tăng độ dài/kiểu dữ liệu của title thành TEXT nếu trước đây nó là VARCHAR (để lưu trữ câu trả lời AI dài thoải mái)
    await client.query(`
      ALTER TABLE ai_chat ALTER COLUMN title TYPE TEXT;
    `);

    console.log('✅ Đã kiểm tra/khởi tạo bảng "ai_chat", cập nhật cột "lesson_id" và sửa đổi các khóa ngoại thành công.');



    // Tự động chuyển đổi cột status của bảng courses sang VARCHAR(20) nếu nó đang là integer
    const statusColTypeRes = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'status'
    `);
    if (statusColTypeRes.rows.length > 0 && statusColTypeRes.rows[0].data_type === 'integer') {
      console.log('🔄 Đang chuyển đổi kiểu dữ liệu cột "status" của bảng "courses" từ INTEGER sang VARCHAR(20)...');
      await client.query(`
        ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
        ALTER TABLE courses ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE courses ALTER COLUMN status TYPE VARCHAR(20) USING (CASE WHEN status::text = '1' THEN 'published' WHEN status::text = '2' THEN 'archived' WHEN status::text = 'published' THEN 'published' WHEN status::text = 'archived' THEN 'archived' ELSE 'draft' END);
        ALTER TABLE courses ADD CONSTRAINT courses_status_check CHECK (status IN ('draft', 'published', 'archived'));
      `);
      await client.query(`
        ALTER TABLE courses ALTER COLUMN status SET DEFAULT 'draft';
      `);
      console.log('✅ Đã chuyển đổi cột "status" thành công!');
    }

    // --- SEED DỮ LIỆU MẪU KHÓA HỌC TIẾNG ANH MẶC ĐỊNH ---
    let instructorId = 1;
    const instructorRes = await client.query('SELECT user_id FROM users WHERE role_id = 2 LIMIT 1');
    if (instructorRes.rows.length > 0) {
      instructorId = instructorRes.rows[0].user_id;
    } else {
      const anyUserRes = await client.query('SELECT user_id FROM users LIMIT 1');
      if (anyUserRes.rows.length > 0) {
        instructorId = anyUserRes.rows[0].user_id;
      }
    }

    const courseCheck = await client.query("SELECT course_id FROM courses WHERE course_name = 'English for Communication & AI Interaction'");
    if (courseCheck.rows.length === 0) {
      console.log('🌱 Đang khởi tạo dữ liệu mẫu khóa học "English for Communication & AI Interaction"...');

      // Chèn khóa học (subject_id = 4: General English Communication)
      const courseRes = await client.query(`
        INSERT INTO courses (subject_id, course_name, description, instructor_id, thumbnail_url, price, status, start_date, end_date)
        VALUES (4, 'English for Communication & AI Interaction', 'Khóa học tiếng Anh giao tiếp phản xạ kết hợp Trợ lý học tập AI.', $1, '/images/hero_illustration.png', 0, 'published', '2026-06-20', '2027-06-20')
        RETURNING course_id
      `, [instructorId]);

      const newCourseId = courseRes.rows[0].course_id;

      // Chương 1
      const sec1Res = await client.query(`
        INSERT INTO sections (course_id, title, order_index)
        VALUES ($1, 'Chương 1: Giới thiệu & Định hướng học tập', 1)
        RETURNING section_id
      `, [newCourseId]);
      const sec1Id = sec1Res.rows[0].section_id;

      // Lesson 1
      await client.query(`
        INSERT INTO lessons (section_id, title, content_type, content_url, order_index)
        VALUES ($1, '1. Chào mừng & Hướng dẫn học tập hiệu quả cùng AI Assistant', 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 1)
      `, [sec1Id]);

      // Lesson 2
      await client.query(`
        INSERT INTO lessons (section_id, title, content_type, content_url, order_index)
        VALUES ($1, '2. Cài đặt tư duy phản xạ tiếng Anh (English Mindset)', 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 2)
      `, [sec1Id]);

      // Chương 2
      const sec2Res = await client.query(`
        INSERT INTO sections (course_id, title, order_index)
        VALUES ($1, 'Chương 2: Ngữ pháp phản xạ cơ bản (Reflexive Grammar)', 2)
        RETURNING section_id
      `, [newCourseId]);
      const sec2Id = sec2Res.rows[0].section_id;

      // Lesson 3
      await client.query(`
        INSERT INTO lessons (section_id, title, content_type, content_url, order_index)
        VALUES ($1, '3. Các thì thời gian trong văn phong nói (Speaking Tenses)', 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 1)
      `, [sec2Id]);

      // Lesson 4
      await client.query(`
        INSERT INTO lessons (section_id, title, content_type, content_url, order_index)
        VALUES ($1, '4. Cấu trúc câu hỏi đuôi & Câu nghi vấn tự nhiên', 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 2)
      `, [sec2Id]);

      // Chương 3
      const sec3Res = await client.query(`
        INSERT INTO sections (course_id, title, order_index)
        VALUES ($1, 'Chương 3: Luyện nghe và phản xạ hội thoại', 3)
        RETURNING section_id
      `, [newCourseId]);
      const sec3Id = sec3Res.rows[0].section_id;

      // Lesson 5
      await client.query(`
        INSERT INTO lessons (section_id, title, content_type, content_url, order_index)
        VALUES ($1, '5. Phương pháp nghe thụ động (Passive Listening) & nghe chép chính tả', 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 1)
      `, [sec3Id]);

      console.log('🌱 Seed khóa học mặc định thành công!');
    }

    client.release();
    return true;
  } catch (error) {
    console.error('❌ Không thể kết nối hoặc khởi tạo bảng trong PostgreSQL:', error);
    return false;
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};
