require('dotenv').config();
const { pool } = require('./src/config/database');

async function inspectDb() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Existing Tables:');
    res.rows.forEach(row => console.log(`- ${row.table_name}`));

    // Inspect subjects table
    const subjectsExist = res.rows.find(r => r.table_name === 'subjects');
    if (subjectsExist) {
      console.log('\n--- SUBJECTS TABLE ---');
      const colRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'subjects'
      `);
      console.log('Columns:', colRes.rows);
    }
    
    // Check courses
    const coursesExist = res.rows.find(r => r.table_name === 'courses');
    if (coursesExist) {
      console.log('\n--- COURSES TABLE ---');
       const colRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'courses'
      `);
      console.log('Columns:', colRes.rows);
    }

  } catch (err) {
    console.error('Error inspecting DB:', err.message);
  } finally {
    await pool.end();
  }
}

inspectDb();
