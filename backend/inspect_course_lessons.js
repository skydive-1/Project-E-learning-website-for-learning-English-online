require('dotenv').config();
const { pool } = require('./src/config/database');

async function check() {
  try {
    const res = await pool.query(`
      SELECT l.lesson_id, l.title, s.course_id, s.title as section_title
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      WHERE s.course_id = 14
      ORDER BY l.lesson_id
    `);
    console.log("Lessons for Course 14:");
    res.rows.forEach(r => {
      console.log(`LessonID: ${r.lesson_id} | Title: "${r.title}" | Section: "${r.section_title}"`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
