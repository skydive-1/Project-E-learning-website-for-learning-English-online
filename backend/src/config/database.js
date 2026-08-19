const { Pool } = require('pg');
require('dotenv').config();

// Cấu hình kết nối PostgreSQL hỗ trợ đa môi trường
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.co'))
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('✅ Đã kết nối cơ sở dữ liệu PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Lỗi kết nối cơ sở dữ liệu bất ngờ:', err.message);
});

// Helper function chạy query
const query = (text, params) => pool.query(text, params);

// Hàm kiểm tra kết nối & tự động khởi tạo cấu trúc nếu thiếu
const checkConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('📡 Kiểm tra kết nối Database thành công');

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng users có cột bio
    try {
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;");
      console.log('✅ Tự động đồng bộ: Cột users.bio đã sẵn sàng');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động thêm cột users.bio:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng lessons có các cột Speaking
    try {
      await client.query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS speaking_sentences TEXT;");
      await client.query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS speaking_questions TEXT;");
      console.log('✅ Tự động đồng bộ: Cột speaking_sentences và speaking_questions đã sẵn sàng');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động thêm cột lessons Speaking:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng study_sessions tồn tại
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS study_sessions (
          session_id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          lesson_id INTEGER NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          session_date DATE NOT NULL DEFAULT CURRENT_DATE,
          duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
          last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_user_lesson_date UNIQUE (user_id, lesson_id, session_date)
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, session_date);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_study_sessions_lesson ON study_sessions(lesson_id);`);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng study_sessions tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng study_sessions:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng ai_conversations tồn tại
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
          conversation_id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          lesson_id INTEGER NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'evaluation')),
          content TEXT NOT NULL,
          audio_url TEXT NULL,
          audio_duration_seconds REAL NULL,
          evaluation_score JSONB NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_lesson ON ai_conversations(user_id, lesson_id, created_at);`);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng ai_conversations tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng ai_conversations:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng lesson_materials tồn tại
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_materials (
          material_id SERIAL PRIMARY KEY,
          lesson_id INT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          file_type VARCHAR(50) DEFAULT 'application/pdf',
          file_size_kb INT DEFAULT 0,
          pdf_version INT NOT NULL DEFAULT 1 CHECK (pdf_version >= 1),
          uploaded_by INT REFERENCES users(user_id) ON DELETE SET NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson_id ON lesson_materials(lesson_id);`);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng lesson_materials tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng lesson_materials:', migErr.message);
    }

    // Tự động đồng bộ cấu trúc: Đảm bảo bảng pdf_notes tồn tại cho PDF Highlight & Smart Notes (TASK-PDF-SMART-NOTES-01, 02 & 03)
    try {
      await client.query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pdf_version INT NOT NULL DEFAULT 1;");
      await client.query("UPDATE lessons SET pdf_version = 1 WHERE pdf_version IS NULL OR pdf_version < 1;");
      await client.query("ALTER TABLE lesson_materials ADD COLUMN IF NOT EXISTS pdf_version INT NOT NULL DEFAULT 1;");
      await client.query("UPDATE lesson_materials SET pdf_version = 1 WHERE pdf_version IS NULL OR pdf_version < 1;");

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
      `);
      await client.query("ALTER TABLE pdf_notes ADD COLUMN IF NOT EXISTS selection_type VARCHAR(20) NOT NULL DEFAULT 'text';");
      await client.query("ALTER TABLE pdf_notes ALTER COLUMN selected_text DROP NOT NULL;");
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'chk_pdf_notes_selection_type'
          ) THEN
            ALTER TABLE pdf_notes ADD CONSTRAINT chk_pdf_notes_selection_type CHECK (selection_type IN ('text', 'area'));
          END IF;
        END $$;
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pdf_notes_user_lesson_doc ON pdf_notes(user_id, lesson_id, document_ref);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pdf_notes_user_lesson_page ON pdf_notes(user_id, lesson_id, page_number);`);
      console.log('✅ Tự động đồng bộ: Đảm bảo bảng pdf_notes, selection_type và pdf_version tồn tại thành công');
    } catch (migErr) {
      console.warn('⚠️ Cảnh báo tự động tạo bảng pdf_notes:', migErr.message);
    }

    client.release();
    return true;
  } catch (error) {
    console.error('❌ Kết nối Database thất bại:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  checkConnection
};
