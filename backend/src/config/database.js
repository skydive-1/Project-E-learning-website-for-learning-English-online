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
    console.log('✅ Đã kiểm tra/khởi tạo các bảng "roles" và "users" thành công.');

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
