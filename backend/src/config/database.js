/**
 * Database Configuration
 * - Thiết lập kết nối PostgreSQL sử dụng pg Pool
 */

const { Pool } = require('pg');

const DEFAULT_DB_URL = 'postgresql://postgres.tdiqliihqdlpcelacypc:Chuongdeptraivodichvutru@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres';

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
