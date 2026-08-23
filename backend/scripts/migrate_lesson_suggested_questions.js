require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');

async function migrate() {
  try {
    console.log('[Migration] Creating table lesson_suggested_questions...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS lesson_suggested_questions (
        lesson_id INT PRIMARY KEY REFERENCES lessons(lesson_id) ON DELETE CASCADE,
        questions JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_lesson_suggested_questions_lesson_id 
      ON lesson_suggested_questions(lesson_id);
    `);
    console.log('[Migration] ✅ Table lesson_suggested_questions created or verified successfully!');
  } catch (err) {
    console.error('[Migration] ❌ Error:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

migrate();
