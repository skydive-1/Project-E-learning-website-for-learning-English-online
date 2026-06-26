require('dotenv').config();
const { pool } = require('./src/config/database');

async function inspect() {
  try {
    const res = await pool.query(`SELECT * FROM subjects`);
    console.log('Subjects in DB:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
