require('dotenv').config();
const { pool } = require('./src/config/database');

async function inspectQuizzTable() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'quizz';
    `);
    if (res.rows.length === 0) {
      console.log("Table 'quizz' does not exist in this database.");
      return;
    }
    console.log("Table 'quizz' exists!");
    const colRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'quizz' AND table_schema = 'public';
    `);
    console.log('Columns of quizz table:');
    console.table(colRes.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
inspectQuizzTable();
