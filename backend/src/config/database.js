/**
 * Database Configuration
 * - Thiết lập kết nối PostgreSQL sử dụng pg Pool
 */

const { Pool } = require('pg');

const DEFAULT_DB_URL = 'postgresql://postgres.tdiqliihqdlpcelacypc:Chuongdeptraivodichvutru%40%40%40@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres';

let rawDbUrl = process.env.DATABASE_URL || (process.env.DB_HOST ? null : DEFAULT_DB_URL);
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
    password: process.env.DB_PASSWORD || 'postgres123',
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

// Hàm kiểm tra kết nối tới Database và khởi tạo bảng nếu cần
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Kết nối thành công tới cơ sở dữ liệu PostgreSQL!');

    // Chỉ chạy kiểm thử kết nối đơn giản để tránh deadlock khi boot app
    const res = await client.query('SELECT 1 + 1 AS result');
    console.log(`✅ DB Health Check: Connection verified successfully (1 + 1 = ${res.rows[0].result})`);

    // Tự động đồng bộ cấu trúc: Đảm bảo cột supabase_uid tồn tại trong bảng users
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE;');
      console.log('✅ Tự động đồng bộ: Đảm bảo cột supabase_uid tồn tại trong bảng users');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột supabase_uid (có thể bảng users chưa được khởi tạo):', migErr.message);
    }

    try {
      await client.query('ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);');
      await client.query('ALTER TABLE quiz_attempts ALTER COLUMN user_id DROP NOT NULL;');
      console.log('✅ Tự động đồng bộ: Đảm bảo cột nickname tồn tại và user_id cho phép NULL trong quiz_attempts');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột nickname:', migErr.message);
    }

    try {
      await client.query("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) DEFAULT 'multiple_choice';");
      await client.query("ALTER TABLE questions ALTER COLUMN correct_answer TYPE TEXT;");
      console.log('✅ Tự động đồng bộ: Đảm bảo cột question_type tồn tại và correct_answer có kiểu TEXT trong bảng questions');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột questions:', migErr.message);
    }

    try {
      await client.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;");
      await client.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20) DEFAULT NULL;");
      console.log('✅ Tự động đồng bộ: Đảm bảo cột is_private và pin_code tồn tại trong bảng quizzes');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động đồng bộ cột quizzes:', migErr.message);
    }

    try {
      await client.query("CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON quizzes(course_id);");
      await client.query("CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);");
      await client.query("CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);");
      await client.query("CREATE INDEX IF NOT EXISTS idx_ai_chat_student_id ON ai_chat(student_id);");
      console.log('✅ Tự động đồng bộ: Đã tạo các chỉ mục Index tối ưu hiệu năng truy vấn Database');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo index database:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng user_token_limits tồn tại để tránh lỗi Token Limit
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
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng user_token_limits tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng user_token_limits:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo các bảng lesson_comments và comment_upvotes tồn tại
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
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS comment_upvotes (
          comment_id INT NOT NULL REFERENCES lesson_comments(comment_id) ON DELETE CASCADE,
          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          PRIMARY KEY (comment_id, user_id),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson_id ON lesson_comments(lesson_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent_id ON lesson_comments(parent_id);`);
      console.log('✅ Tự động đồng bộ: Đảm bảo các bảng lesson_comments và comment_upvotes tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng lesson_comments & comment_upvotes:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng instructor_policy_agreements tồn tại
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
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng instructor_policy_agreements tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng instructor_policy_agreements:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng learning_ss tồn tại cho Gamification & Analytics
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
      await client.query(`CREATE INDEX IF NOT EXISTS idx_learning_ss_user_id ON learning_ss(user_id);`);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng learning_ss tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng learning_ss:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng lesson_subtitles tồn tại cho Smart AI Subtitles & Interactive Transcript
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_subtitles (
          subtitle_id SERIAL PRIMARY KEY,
          lesson_id INT NOT NULL UNIQUE REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          en_vtt TEXT,
          vi_vtt TEXT,
          bilingual_vtt TEXT,
          cues JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_lesson_subtitles_lesson_id ON lesson_subtitles(lesson_id);`);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng lesson_subtitles tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng lesson_subtitles:', migErr.message);
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
