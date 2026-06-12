require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing connection to Supabase...');
console.log('Host:', process.env.DB_HOST);
console.log('User:', process.env.DB_USER);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runTest() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database successfully!');
    
    // Check if table users exists
    const res = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'users'");
    if (res.rows.length > 0) {
      console.log('✅ "users" table exists!');
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      console.log('Number of users currently in DB:', userCount.rows[0].count);
    } else {
      console.log('❌ "users" table does not exist!');
    }
    
    client.release();
  } catch (err) {
    console.error('❌ Database connection error:', err);
  } finally {
    await pool.end();
  }
}

runTest();
