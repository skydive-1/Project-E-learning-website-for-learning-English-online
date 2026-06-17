require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/src/config/database');

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

    // Inspect subjects table if it exists
    if (res.rows.find(r => r.table_name === 'subjects')) {
      const subRes = await pool.query("SELECT * FROM subjects LIMIT 5");
      console.log('\nSubjects Sample:', subRes.rows);
      
      const colRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'subjects'
      `);
      console.log('\nSubjects Columns:', colRes.rows);
    }
    
    // Check all tables structure
    const tables = ['courses', 'sections', 'lessons', 'subjects', 'teachers', 'classes', 'users'];
    for (const table of tables) {
      if (res.rows.find(r => r.table_name === table)) {
        const colRes = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
        console.log(`\nTable: ${table}`);
        colRes.rows.forEach(col => {
          console.log(`- ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });
      }
    }

    // Check foreign keys of courses table
    const fkRes = await pool.query(`
      SELECT
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='courses';
    `);
    console.log('\nCourses Foreign Keys:', fkRes.rows);

    // Check row counts
    const tablesList = ['courses', 'sections', 'lessons', 'subjects', 'teachers', 'classes', 'users', 'roles'];
    console.log('\nRow Counts:');
    for (const table of tablesList) {
      const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`- ${table}: ${countRes.rows[0].count}`);
    }

    // Check default column values to see if they use serial sequences
    const defaultRes = await pool.query(`
      SELECT table_name, column_name, column_default 
      FROM information_schema.columns 
      WHERE table_name IN ('courses', 'sections', 'lessons', 'subjects')
        AND table_schema = 'public';
    `);
    console.log('\nColumn Defaults:');
    defaultRes.rows.forEach(col => {
      console.log(`- ${col.table_name}.${col.column_name}: default = ${col.column_default}`);
    });

  } catch (err) {
    console.error('Error inspecting DB:', err.message);
  } finally {
    await pool.end();
  }
}

inspectDb();
