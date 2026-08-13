require('dotenv').config();
const { pool } = require('./src/config/database');

async function run() {
  const client = await pool.connect();
  try {
    // Check timezone của PostgreSQL server
    const tz = await client.query("SHOW timezone");
    console.log('DB timezone:', tz.rows[0]);

    // Xem full heatmap query kết quả cho user 5 (365 ngày)
    const hm = await client.query(`
      WITH days AS (
        SELECT generate_series(
          date_trunc('year', $2::date),
          date_trunc('year', $2::date) + interval '1 year' - interval '1 day',
          interval '1 day'
        )::date AS day
      )
      SELECT
        d.day AS study_date,
        COALESCE(ROUND(SUM(
          EXTRACT(EPOCH FROM (
            LEAST(ls.end_at, (d.day + INTERVAL '1 day')::timestamp)
            - GREATEST(ls.start_at, d.day::timestamp)
          )) / 60
        )::numeric, 2), 0) AS total_minutes
      FROM days d
      LEFT JOIN learning_ss ls
        ON ls.user_id = $1
        AND ls.end_at IS NOT NULL
        AND ls.start_at < (d.day + INTERVAL '1 day')::timestamp
        AND ls.end_at >= d.day::timestamp
      GROUP BY d.day
      HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (
          LEAST(ls.end_at, (d.day + INTERVAL '1 day')::timestamp)
          - GREATEST(ls.start_at, d.day::timestamp)
        )) / 60), 0) > 0
      ORDER BY d.day
    `, [5, '2026-01-01']);
    
    console.log('\nNon-zero heatmap for user 5:');
    hm.rows.forEach(r => console.log(JSON.stringify(r)));

    // Kiểm tra xem user đang test là user nào (user login thật)
    const u = await client.query(`
      SELECT u.user_id, u.username,
        (SELECT COUNT(*) FROM learning_ss WHERE user_id=u.user_id AND end_at IS NOT NULL) as sessions,
        (SELECT COUNT(*) FROM quiz_attempts WHERE user_id=u.user_id) as quizzes
      FROM users u ORDER BY u.user_id
    `);
    console.log('\nAll users with data counts:');
    u.rows.forEach(r => console.log(JSON.stringify(r)));

  } catch(e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
