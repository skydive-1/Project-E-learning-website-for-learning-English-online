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

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng user_token_usage tồn tại để tránh lỗi Token Limit
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_token_usage (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          date DATE NOT NULL,
          used_tokens INT DEFAULT 0,
          CONSTRAINT uq_user_date UNIQUE (user_id, date)
        );
      `);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng user_token_usage tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng user_token_usage:', migErr.message);
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
