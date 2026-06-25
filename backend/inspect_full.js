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
    
    console.log('--- ALL TABLES ---');
    for (const row of res.rows) {
      const tableName = row.table_name;
      const countRes = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`- ${tableName}: ${countRes.rows[0].count} rows`);
    }

    console.log('\n--- AI CHAT STRUCTURE ---');
    if (res.rows.find(r => r.table_name === 'ai_chat')) {
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'ai_chat'
      `);
      console.log(colRes.rows);
      
      const sample = await pool.query(`SELECT * FROM ai_chat LIMIT 3`);
      console.log('Sample rows:', sample.rows);
    }

    console.log('\n--- USER PROGRESS STRUCTURE ---');
    if (res.rows.find(r => r.table_name === 'user_progress')) {
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'user_progress'
      `);
      console.log(colRes.rows);
      
      const sample = await pool.query(`SELECT * FROM user_progress LIMIT 3`);
      console.log('Sample rows:', sample.rows);
    }

    console.log('\n--- USERS STRUCTURE ---');
    if (res.rows.find(r => r.table_name === 'users')) {
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      console.log(colRes.rows);
      
      const sample = await pool.query(`SELECT * FROM users LIMIT 3`);
      console.log('Sample rows:', sample.rows);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

inspectDb();
