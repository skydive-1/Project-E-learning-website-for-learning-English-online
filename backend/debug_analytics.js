require('dotenv').config();
const { pool } = require('./src/config/database');

// Dùng user_id = 1 hoặc bất kỳ user có data để test
const TEST_USER_ID = 1;

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check learning_ss
    const ls = await client.query('SELECT COUNT(*), MIN(start_at), MAX(end_at) FROM learning_ss WHERE user_id = $1 AND end_at IS NOT NULL', [TEST_USER_ID]);
    console.log('learning_ss:', ls.rows[0]);

    // 2. Check user_progress
    const up = await client.query('SELECT COUNT(*) FROM user_progress WHERE user_id = $1 AND is_completed = true', [TEST_USER_ID]);
    console.log('user_progress completed:', up.rows[0]);

    // 3. Check quiz_attempts
    const qa = await client.query('SELECT COUNT(*), AVG(score) FROM quiz_attempts WHERE user_id = $1', [TEST_USER_ID]);
    console.log('quiz_attempts:', qa.rows[0]);

    // 4. Check quiz_attempts with completed_at for trends
    const trends = await client.query(`
      SELECT DATE_TRUNC('week', completed_at) AS week_start, COUNT(*), AVG(score)
      FROM quiz_attempts WHERE user_id = $1 AND completed_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY week_start ORDER BY week_start
    `, [TEST_USER_ID]);
    console.log('quiz trends:', trends.rows);

    // 5. Check courses structure for completion
    const courses = await client.query(`
      WITH course_stats AS (
        SELECT c.course_id, COUNT(l.lesson_id) AS total, COUNT(up.progress_id) FILTER (WHERE up.is_completed=true) AS done
        FROM courses c
        JOIN sections s ON s.course_id = c.course_id
        JOIN lessons l ON l.section_id = s.section_id
        LEFT JOIN user_progress up ON up.lesson_id = l.lesson_id AND up.user_id = $1
        GROUP BY c.course_id
      )
      SELECT COUNT(*) FILTER (WHERE total>0 AND done=total) AS completed,
             COUNT(*) FILTER (WHERE done>0 AND done<total) AS in_progress,
             COUNT(*) FILTER (WHERE done=0) AS not_started
      FROM course_stats
    `, [TEST_USER_ID]);
    console.log('course completion:', courses.rows[0]);

    // 6. Check weekly activity
    const weekly = await client.query(`
      SELECT EXTRACT(DOW FROM start_at) AS dow, ROUND(SUM(EXTRACT(EPOCH FROM (end_at-start_at))/60)::numeric,1) AS minutes
      FROM learning_ss WHERE user_id = $1 AND end_at IS NOT NULL AND start_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY dow ORDER BY dow
    `, [TEST_USER_ID]);
    console.log('weekly activity:', weekly.rows);

    // 7. List all users to find ones with data
    const users = await client.query('SELECT user_id, username FROM users ORDER BY user_id LIMIT 10');
    console.log('\nAll users:', users.rows);

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
