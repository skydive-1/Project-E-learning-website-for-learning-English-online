require('dotenv').config();
const { pool } = require('./src/config/database');

async function run() {
  const c = await pool.connect();
  try {
    const yearStart = '2026-01-01';
    const yearEnd = '2026-12-31';
    const uid = 5;

    const r = await c.query(`
      WITH calendar AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS study_date
      ),
      daily_minutes AS (
        SELECT
          start_at::date AS day,
          ROUND(SUM(GREATEST(0, EXTRACT(EPOCH FROM (end_at - start_at)) / 60))::numeric, 2) AS total_minutes
        FROM learning_ss
        WHERE user_id = $1
          AND end_at IS NOT NULL
          AND end_at > start_at
          AND start_at >= $2::timestamp
          AND start_at <= ($3::date + interval '1 day')::timestamp
        GROUP BY start_at::date
      )
      SELECT c.study_date, COALESCE(dm.total_minutes, 0) AS total_minutes
      FROM calendar c
      LEFT JOIN daily_minutes dm ON dm.day = c.study_date
      WHERE COALESCE(dm.total_minutes, 0) > 0
      ORDER BY c.study_date
    `, [uid, yearStart, yearEnd]);

    console.log('Non-zero heatmap with NEW query for user 5:');
    r.rows.forEach(row => console.log(JSON.stringify(row)));
    console.log('Total non-zero days:', r.rows.length);
    const max = Math.max(...r.rows.map(row => parseFloat(row.total_minutes)));
    console.log('Max minutes in a day:', max);
  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
