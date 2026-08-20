/**
 * =========================================================================================
 * ⚠️ QUY ƯỚC BẮT BUỘC KHI THAY ĐỔI / BỔ SUNG SCHEMA CƠ SỞ DỮ LIỆU (DATABASE SCHEMA CONVENTION)
 * =========================================================================================
 * 1. Lệnh `CREATE TABLE IF NOT EXISTS` trong schema.sql CHỈ tạo bảng MỚI, KHÔNG tự thêm cột
 *    cho các bảng đã tồn tại từ trước trên môi trường Production / Docker / Staging.
 * 2. MỖI KHI BỔ SUNG CỘT MỚI hoặc THAY ĐỔI KIỂU DỮ LIỆU CỘT:
 *    - BƯỚC 1: Cập nhật file `backend/schema.sql` (cho việc khởi tạo DB trắng ban đầu).
 *    - BƯỚC 2: BẮT BUỘC viết thêm câu lệnh `ALTER TABLE <table_name> ADD COLUMN IF NOT EXISTS ...`
 *              ngay vào hàm `testConnection()` trong file `database.js` này (hoặc migration script).
 *    - BƯỚC 3: Tuyệt đối không xóa bỏ các câu lệnh `ADD COLUMN IF NOT EXISTS` cũ vì chúng bảo vệ
 *              toàn bộ hệ thống khỏi lỗi sập server do thiếu cột (Column Does Not Exist) trên Production.
 * =========================================================================================
 */

const { Pool } = require('pg');
require('dotenv').config();

let rawDbUrl = process.env.DATABASE_URL;
if (rawDbUrl && rawDbUrl.includes('southeast-2.pooler')) {
  rawDbUrl = rawDbUrl.replace(/(southeast-2\.pooler\.)+/g, 'southeast-2.pooler.');
}
const dbConnectionString = rawDbUrl;

const isRemoteDb = Boolean(
  dbConnectionString || 
  (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1')
);

const sslConfig = (process.env.DB_SSL === 'false') ? false : { rejectUnauthorized: false };

const poolConfig = dbConnectionString
  ? {
    connectionString: dbConnectionString,
    ssl: sslConfig
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: isRemoteDb ? sslConfig : (process.env.DB_SSL === 'true' ? sslConfig : false)
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

/**
 * Hàm kiểm tra kết nối tới Database và tự động đồng bộ cấu trúc cột / bảng (Idempotent Schema Migration)
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Kết nối thành công tới cơ sở dữ liệu PostgreSQL!');

    // 1. Health Check kết nối
    const res = await client.query('SELECT 1 + 1 AS result');
    console.log(`✅ DB Health Check: Connection verified successfully (1 + 1 = ${res.rows[0].result})`);

    // -----------------------------------------------------------------------------------------
    // 2. TỰ ĐỘNG ĐỒNG BỘ CỘT CỦA CÁC BẢNG ĐÃ TỒN TẠI (ALTER TABLE ADD COLUMN IF NOT EXISTS)
    // -----------------------------------------------------------------------------------------

    // 2.1. Bảng `courses` (Khóa học)
    try {
      await client.query(`
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(255);
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo đầy đủ cột bảng courses (created_at, updated_at, status, price, ...)');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột bảng courses:', migErr.message);
    }

    // 2.2. Bảng `lessons` (Bài học)
    try {
      await client.query(`
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS speaking_sentences TEXT DEFAULT '';
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS speaking_questions TEXT DEFAULT '';
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pdf_version INT DEFAULT 1;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT NULL;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(50) DEFAULT NULL;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS storage_key TEXT DEFAULT NULL;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT NULL;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) DEFAULT NULL;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT NULL;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo đầy đủ cột bảng lessons (speaking, storage, media_status, timestamps, ...)');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột bảng lessons:', migErr.message);
    }

    // 2.3. Bảng `sections` (Chương học)
    try {
      await client.query(`
        ALTER TABLE sections ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo các cột created_at, updated_at tồn tại trong bảng sections');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột bảng sections:', migErr.message);
    }

    // 2.4. Bảng `users` (Người dùng)
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo đầy đủ cột bảng users (supabase_uid, longest_streak, profile_picture_url, ...)');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột bảng users:', migErr.message);
    }

    // 2.5. Bảng `lesson_materials` (Tài liệu đính kèm)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_materials (
          material_id SERIAL PRIMARY KEY,
          lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          file_type VARCHAR(50) DEFAULT 'application/pdf',
          file_size_kb INT DEFAULT 0,
          uploaded_by INT REFERENCES users(user_id) ON DELETE SET NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS pdf_version INT DEFAULT 1;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT NULL;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(50) DEFAULT NULL;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS storage_key TEXT DEFAULT NULL;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf';
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) DEFAULT NULL;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS media_status VARCHAR(30) DEFAULT NULL;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(user_id) ON DELETE SET NULL;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS file_size_kb INT DEFAULT 0;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng lesson_materials và các cột storage/metadata tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột bảng lesson_materials:', migErr.message);
    }

    // 2.6. Bảng `quizzes` (Đề trắc nghiệm)
    try {
      await client.query(`
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20) DEFAULT NULL;
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'Medium';
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INT DEFAULT 10;
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo các cột is_private, pin_code, time_limit trong bảng quizzes');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột bảng quizzes:', migErr.message);
    }

    // 2.7. Bảng `questions` (Câu hỏi trắc nghiệm)
    try {
      await client.query(`
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) DEFAULT 'multiple_choice';
        ALTER TABLE questions ALTER COLUMN correct_answer TYPE TEXT;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo các cột question_type, explanation, correct_answer kiểu TEXT trong questions');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột bảng questions:', migErr.message);
    }

    // 2.8. Bảng `quiz_attempts` (Lịch sử làm bài)
    try {
      await client.query(`
        ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
        ALTER TABLE quiz_attempts ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo cột nickname và user_id nullable trong quiz_attempts');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột quiz_attempts:', migErr.message);
    }

    // 2.9. Bảng `user_progress` (Tiến độ học)
    try {
      await client.query(`
        ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo cột completed_at, updated_at trong user_progress');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột user_progress:', migErr.message);
    }

    // 2.10. Bảng `ai_chat` (Lịch sử chat AI)
    try {
      await client.query(`
        ALTER TABLE ai_chat ADD COLUMN IF NOT EXISTS lesson_id INT;
        ALTER TABLE ai_chat ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo cột lesson_id và created_at trong bảng ai_chat');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột ai_chat:', migErr.message);
    }

    // -----------------------------------------------------------------------------------------
    // 3. TỰ ĐỘNG ĐỒNG BỘ CÁC BẢNG CHỨC NĂNG BỔ SUNG & CHỈ MỤC INDEX
    // -----------------------------------------------------------------------------------------

    // 3.1. Bảng `user_token_limits`
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_token_limits (
          token_limit_id SERIAL PRIMARY KEY,
          user_id INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
          max_tokens INT NOT NULL CHECK (max_tokens >= 0) DEFAULT 6000,
          used_tokens INT NOT NULL CHECK (used_tokens >= 0) DEFAULT 0,
          remaining_tokens INT GENERATED ALWAYS AS (max_tokens - used_tokens) STORED,
          reset_date DATE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo bảng user_token_limits:', migErr.message);
    }

    // 3.2. Bảng `lesson_comments` & `comment_upvotes`
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_comments (
          comment_id SERIAL PRIMARY KEY,
          lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          parent_id INT REFERENCES lesson_comments(comment_id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS comment_upvotes (
          comment_id INT NOT NULL REFERENCES lesson_comments(comment_id) ON DELETE CASCADE,
          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          PRIMARY KEY (comment_id, user_id),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo bảng lesson_comments & comment_upvotes:', migErr.message);
    }

    // 3.3. Bảng `instructor_policy_agreements`
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS instructor_policy_agreements (
          agreement_id SERIAL PRIMARY KEY,
          instructor_id INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
          ip_address VARCHAR(45) NOT NULL,
          signature TEXT NOT NULL,
          accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo bảng instructor_policy_agreements:', migErr.message);
    }

    // 3.4. Bảng `learning_ss`
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS learning_ss (
          learning_ss_id SERIAL PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          lesson_id INT REFERENCES lessons(lesson_id) ON DELETE SET NULL,
          start_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          end_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo bảng learning_ss:', migErr.message);
    }

    // 3.5. Bảng `lesson_subtitles`
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_subtitles (
          subtitle_id SERIAL PRIMARY KEY,
          lesson_id INT NOT NULL UNIQUE REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          en_vtt TEXT,
          vi_vtt TEXT,
          bilingual_vtt TEXT,
          cues JSONB NOT NULL DEFAULT '[]',
          is_auto_generated_fallback BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE lesson_subtitles ADD COLUMN IF NOT EXISTS is_auto_generated_fallback BOOLEAN NOT NULL DEFAULT FALSE;
      `);
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo bảng lesson_subtitles:', migErr.message);
    }

    // 3.6. Bảng `pdf_notes`
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS pdf_notes (
          note_id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          lesson_id INTEGER NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          material_id INTEGER NULL REFERENCES lesson_materials(material_id) ON DELETE CASCADE,
          document_ref VARCHAR(255) NOT NULL,
          page_number INTEGER NOT NULL CHECK (page_number >= 1),
          selection_type VARCHAR(20) NOT NULL DEFAULT 'text',
          selected_text TEXT NULL,
          note_text TEXT NOT NULL DEFAULT '',
          category VARCHAR(30) NOT NULL CHECK (category IN ('important', 'not_understood', 'review', 'vocabulary')),
          color VARCHAR(20) NOT NULL CHECK (color IN ('yellow', 'green', 'blue', 'pink')),
          rects JSONB NOT NULL,
          context_before TEXT DEFAULT '',
          context_after TEXT DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE pdf_notes ADD COLUMN IF NOT EXISTS selection_type VARCHAR(20) NOT NULL DEFAULT 'text';
        ALTER TABLE pdf_notes ALTER COLUMN selected_text DROP NOT NULL;
      `);
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo bảng pdf_notes:', migErr.message);
    }

    // 3.7. Bảng `pending_media_uploads` & `failed_storage_deletions`
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS pending_media_uploads (
          upload_id UUID PRIMARY KEY,
          instructor_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          storage_provider VARCHAR(50) NOT NULL DEFAULT 'supabase',
          storage_bucket VARCHAR(50) NOT NULL,
          storage_key TEXT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          size_bytes BIGINT NOT NULL DEFAULT 0,
          checksum_sha256 VARCHAR(64) NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CLAIMING', 'CLEANING', 'COMMITTED', 'EXPIRED')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
          claimed_at TIMESTAMP WITH TIME ZONE,
          cleaning_started_at TIMESTAMP WITH TIME ZONE
        );
        CREATE TABLE IF NOT EXISTS failed_storage_deletions (
          deletion_id SERIAL PRIMARY KEY,
          storage_provider VARCHAR(50) NOT NULL DEFAULT 'supabase',
          storage_bucket VARCHAR(50) NOT NULL,
          storage_key TEXT NOT NULL,
          retry_count INT NOT NULL DEFAULT 0,
          last_error TEXT,
          status VARCHAR(30) NOT NULL DEFAULT 'PENDING_RETRY' CHECK (status IN ('PENDING_RETRY', 'FAILED_PERMANENT', 'RESOLVED')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP WITH TIME ZONE,
          pending_upload_id UUID REFERENCES pending_media_uploads(upload_id) ON DELETE SET NULL
        );
      `);
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo bảng pending_media_uploads & failed_storage_deletions:', migErr.message);
    }

    // 3.8. Tạo các Index tối ưu hiệu năng truy vấn
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON quizzes(course_id);
        CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
        CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_chat_student_id ON ai_chat(student_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson_id ON lesson_comments(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent_id ON lesson_comments(parent_id);
        CREATE INDEX IF NOT EXISTS idx_learning_ss_user_id ON learning_ss(user_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_subtitles_lesson_id ON lesson_subtitles(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson_id ON lesson_materials(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_materials_storage_key ON lesson_materials(storage_key);
        CREATE INDEX IF NOT EXISTS idx_lesson_materials_media_status ON lesson_materials(media_status);
        CREATE INDEX IF NOT EXISTS idx_pdf_notes_user_lesson_doc ON pdf_notes(user_id, lesson_id, document_ref);
        CREATE INDEX IF NOT EXISTS idx_pdf_notes_user_lesson_page ON pdf_notes(user_id, lesson_id, page_number);
        CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_status_expires ON pending_media_uploads(status, expires_at);
        CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_instructor ON pending_media_uploads(instructor_id);
        CREATE INDEX IF NOT EXISTS idx_pending_media_uploads_key ON pending_media_uploads(storage_key);
        CREATE INDEX IF NOT EXISTS idx_failed_storage_deletions_retry ON failed_storage_deletions(status, next_retry_at);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_failed_storage_deletions_object ON failed_storage_deletions(storage_provider, storage_bucket, storage_key);
      `);
      console.log('✅ Tự động đồng bộ: Đã tạo và đảm bảo toàn bộ chỉ mục Index hoạt động chính xác');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tạo chỉ mục Index:', migErr.message);
    }

    client.release();
    return true;
  } catch (error) {
    console.error('❌ Không thể kết nối hoặc thực thi Health Check PostgreSQL:', error.message);
    return false;
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};
