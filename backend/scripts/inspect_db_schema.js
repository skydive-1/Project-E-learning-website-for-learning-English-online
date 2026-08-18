require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');

async function inspect() {
  try {
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('=== PUBLIC TABLES ===');
    console.log(tables.rows.map(r => r.table_name));

    const enrollCols = await db.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('enrollments', 'course_enrollments', 'user_courses', 'orders', 'payments', 'sections', 'lessons', 'lesson_materials')
      ORDER BY table_name, ordinal_position;
    `);
    console.log('=== RELEVANT SCHEMAS ===');
    enrollCols.rows.forEach(r => console.log(`${r.table_name}.${r.column_name} (${r.data_type})`));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
inspect();
