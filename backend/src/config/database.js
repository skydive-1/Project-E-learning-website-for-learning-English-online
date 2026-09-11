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
  max: 10,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
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
    // 2. TỰ ĐỘNG CHẠY VERSIONED MIGRATIONS (Transactional, Idempotent, Checksum-tracked)
    // -----------------------------------------------------------------------------------------
    try {
      const { runPendingMigrations } = require('../utils/migrationRunner');
      const summary = await runPendingMigrations({ dbClient: client });
      if (summary.appliedCount > 0) {
        console.log(`✅ Database Migrations: Đã áp dụng ${summary.appliedCount} migration mới thành công.`);
      }
    } catch (migErr) {
      console.error('❌ Lỗi tự động chạy migration khi khởi động:', migErr.message);
      throw migErr;
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
  getClient: () => pool.connect(),
  testConnection
};
