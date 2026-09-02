const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/database');

async function run() {
  try {
    const res = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('=== ALL TABLES ===');
    res.rows.forEach(r => console.log(' -', r.table_name));

    const quizTables = res.rows.filter(r => r.table_name.includes('quiz'));
    console.log('\n=== QUIZ TABLES ===');
    for (const t of quizTables) {
      const cols = await pool.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position",
        [t.table_name]
      );
      console.log('\nTable:', t.table_name);
      cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
    }
  } catch(e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}
run();
