const db = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const TABLES_ORDERED = [
  'roles',
  'users',
  'subjects',
  'courses',
  'sections',
  'lessons',
  'quizzes',
  'questions',
  'quiz_attempts',
  'user_progress',
  'ai_chat',
  'user_token_limits',
  'lesson_comments',
  'comment_upvotes',
  'instructor_policy_agreements',
  'learning_ss',
  'lesson_subtitles',
  'lesson_materials',
  'pdf_notes',
  'pending_media_uploads',
  'failed_storage_deletions'
];

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val;
  if (typeof val === 'object') {
    if (val instanceof Date) {
      return `'${val.toISOString()}'`;
    }
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

(async () => {
  try {
    console.log('🔄 Bắt đầu xuất dữ liệu từ Production Database sang SQL Seed...');
    let sqlOutput = `-- =====================================================================\n`;
    sqlOutput += `-- DỮ LIỆU ĐỒNG BỘ TỪ PRODUCTION (SUPABASE) CHO DOCKER LOCAL TESTING\n`;
    sqlOutput += `-- Tạo lúc: ${new Date().toISOString()}\n`;
    sqlOutput += `-- =====================================================================\n\n`;

    for (const table of TABLES_ORDERED) {
      try {
        const res = await db.query(`SELECT * FROM "${table}" ORDER BY 1 ASC`);
        if (res.rows.length === 0) {
          console.log(`- ${table}: 0 dòng (bỏ qua)`);
          continue;
        }

        console.log(`- ${table}: ${res.rows.length} dòng`);
        const cols = Object.keys(res.rows[0]);
        
        sqlOutput += `-- Dữ liệu bảng ${table} (${res.rows.length} records)\n`;
        sqlOutput += `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')})\nVALUES\n`;

        const rowStrings = res.rows.map(row => {
          const vals = cols.map(c => escapeSqlVal(row[c]));
          return `  (${vals.join(', ')})`;
        });

        sqlOutput += rowStrings.join(',\n');
        sqlOutput += `\nON CONFLICT DO NOTHING;\n\n`;

        // Update sequence if table has a serial primary key
        const pkCol = cols[0];
        if (pkCol && pkCol.endsWith('_id')) {
          sqlOutput += `SELECT setval(pg_get_serial_sequence('"${table}"', '${pkCol}'), coalesce(max("${pkCol}"), 1), max("${pkCol}") IS NOT NULL) FROM "${table}";\n\n`;
        }
      } catch (err) {
        console.warn(`⚠️ Bảng ${table} lỗi:`, err.message);
      }
    }

    const outputPath = path.join(__dirname, 'seed_prod_data.sql');
    fs.writeFileSync(outputPath, sqlOutput, 'utf8');
    console.log(`\n✅ Đã tạo file SQL seed dữ liệu Production thành công tại: ${outputPath}`);

    process.exit(0);
  } catch (e) {
    console.error('❌ Lỗi xuất dữ liệu:', e);
    process.exit(1);
  }
})();
