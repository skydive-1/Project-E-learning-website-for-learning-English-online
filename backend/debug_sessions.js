require('dotenv').config();
const { pool } = require('./src/config/database');

async function run() {
  const c = await pool.connect();
  try {
    const r = await c.query(
      "SELECT *, EXTRACT(EPOCH FROM (end_at - start_at))/3600 AS hours FROM learning_ss ORDER BY (end_at - start_at) DESC NULLS LAST"
    );
    console.log('Sessions sorted by duration (hours):');
    r.rows.forEach(row => console.log(JSON.stringify(row)));
  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
