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
  connectionTimeoutMillis: 2000,
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
        VALUES (4, 'English for Communication & AI Interaction', 'Khóa học tiếng Anh giao tiếp phản xạ kết hợp Trợ lý học tập AI.', $1, '/images/hero_illustration.png', 0, 1, '2026-06-20', '2027-06-20')
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
    console.error('❌ Không thể kết nối hoặc khởi tạo bảng trong PostgreSQL:', error.message);
    return false;
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};
