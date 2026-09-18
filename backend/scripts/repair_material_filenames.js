const { pool } = require('../src/config/database');

async function repair() {
  try {
    const selectRes = await pool.query('SELECT material_id, file_name FROM lesson_materials');
    console.log('Found', selectRes.rows.length, 'records in lesson_materials');
    
    for (const row of selectRes.rows) {
      if (!row.file_name) continue;
      try {
        const fixed = Buffer.from(row.file_name, 'latin1').toString('utf8');
        if (fixed && !fixed.includes('\ufffd') && fixed !== row.file_name) {
          console.log(`Repairing material_id ${row.material_id}:\n  From: ${row.file_name}\n  To:   ${fixed}`);
          await pool.query('UPDATE lesson_materials SET file_name = $1 WHERE material_id = $2', [fixed, row.material_id]);
        }
      } catch (err) {
        console.error(`Error repairing material_id ${row.material_id}:`, err.message);
      }
    }

    const checkRes = await pool.query('SELECT material_id, file_name FROM lesson_materials');
    console.log('Final DB state:', checkRes.rows);
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

repair();
