require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');

async function inspect() {
  try {
    const courses = await db.query('SELECT course_id, course_name FROM courses ORDER BY course_id LIMIT 10');
    console.log('=== COURSES ===');
    console.log(JSON.stringify(courses.rows, null, 2));

    const lessons = await db.query(`
      SELECT l.lesson_id, l.title, l.section_id, s.course_id, c.course_name,
             (SELECT COUNT(*) FROM lesson_subtitles ls WHERE ls.lesson_id = l.lesson_id) as has_subtitles
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses c ON s.course_id = c.course_id
      ORDER BY s.course_id, l.lesson_id
      LIMIT 40
    `);
    console.log('=== LESSONS ===');
    console.log(JSON.stringify(lessons.rows, null, 2));

    const subtitles = await db.query(`
      SELECT ls.lesson_id, l.title, ls.cues
      FROM lesson_subtitles ls
      JOIN lessons l ON ls.lesson_id = l.lesson_id
      ORDER BY ls.lesson_id
      LIMIT 10
    `);
    console.log('=== SUBTITLES SAMPLES ===');
    subtitles.rows.forEach(r => {
      let cuesSample = [];
      try {
        const parsed = typeof r.cues === 'string' ? JSON.parse(r.cues) : r.cues;
        cuesSample = (parsed || []).slice(0, 3).map(c => c.en);
      } catch (e) {}
      console.log(`Lesson ID ${r.lesson_id} - "${r.title}":`, cuesSample);
    });

    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
inspect();
