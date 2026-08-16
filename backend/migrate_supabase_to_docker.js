const { Client } = require('pg');
require('dotenv').config();

const supabaseUrl = process.env.DATABASE_URL;

const dockerHost = process.env.DB_HOST || 'localhost';
const dockerPort = process.env.DB_PORT || '5432';
const dockerUser = process.env.DB_USER || 'postgres';
const dockerPassword = process.env.DB_PASSWORD;
const dockerDatabase = process.env.DB_NAME || 'elearning_db';

const dockerUrl =
  `postgresql://${encodeURIComponent(dockerUser)}:` +
  `${encodeURIComponent(dockerPassword)}@` +
  `${dockerHost}:${dockerPort}/${dockerDatabase}`;

if (!supabaseUrl) {
  throw new Error('❌ DATABASE_URL chưa được cấu hình trong file .env');
}

if (!dockerPassword) {
  throw new Error('❌ DB_PASSWORD chưa được cấu hình trong file .env');
}


// Danh sách các bảng theo thứ tự ràng buộc khóa ngoại (Foreign Key)
const tables = [
  { name: 'roles', pk: 'role_id' },
  { name: 'subjects', pk: 'subject_id' },
  { name: 'users', pk: 'user_id' },
  { name: 'courses', pk: 'course_id' },
  { name: 'sections', pk: 'section_id' },
  { name: 'lessons', pk: 'lesson_id' },
  { name: 'user_progress', pk: 'progress_id' },
  { name: 'quizzes', pk: 'quiz_id' },
  { name: 'questions', pk: 'question_id' },
  { name: 'quiz_attempts', pk: 'attempt_id' },
  { name: 'ai_chat', pk: 'ai_chat' },
  { name: 'user_token_limits', pk: 'token_limit_id' },
];

// Hàm tự động phát hiện và đồng bộ hóa cột còn thiếu giữa hai DB
async function syncColumns(tableName, supabase, docker) {
  const supColsRes = await supabase.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
  `, [tableName]);

  const dockColsRes = await docker.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
  `, [tableName]);

  const dockCols = new Map(dockColsRes.rows.map(r => [r.column_name, r]));

  for (const supCol of supColsRes.rows) {

    let typeStr = supCol.data_type;

    // Chuẩn hóa kiểu dữ liệu
    if (supCol.character_maximum_length) {
      typeStr = `varchar(${supCol.character_maximum_length})`;
    }
    else if (typeStr === 'character varying') {
      typeStr = 'varchar';
    }


    // Trường hợp Docker thiếu cột
    if (!dockCols.has(supCol.column_name)) {

      console.log(
        `   🛠️ Thêm cột thiếu: ${tableName}.${supCol.column_name} ${typeStr}`
      );


      await docker.query(`
      ALTER TABLE "${tableName}"
      ADD COLUMN "${supCol.column_name}" ${typeStr}
    `);

    }


    // Trường hợp Docker có cột nhưng sai kiểu dữ liệu
    else {

      const dockerCol = dockCols.get(supCol.column_name);


      if (dockerCol.data_type !== supCol.data_type) {

        console.log(
          `   Sai kiểu dữ liệu: ${tableName}.${supCol.column_name}`
        );

        console.log(
          `   Docker: ${dockerCol.data_type}`
        );

        console.log(
          `   Supabase: ${supCol.data_type}`
        );


        await docker.query(`
        ALTER TABLE "${tableName}"
        ALTER COLUMN "${supCol.column_name}"
        TYPE ${typeStr}
      `);


        console.log(
          `  Đã sửa kiểu ${supCol.column_name} thành ${typeStr}`
        );

      }

    }
  }
}

async function migrate() {
  const supabase = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  const docker = new Client({
    connectionString: dockerUrl
  });

  try {
    console.log('🚀 Đang kết nối tới Supabase...');
    await supabase.connect();
    console.log('✅ Đã kết nối thành công tới Supabase!');

    console.log('🚀 Đang kết nối tới Docker PostgreSQL...');
    await docker.connect();
    console.log('✅ Đã kết nối thành công tới Docker DB!');

    // 1. Đồng bộ cấu trúc cột (Schema Sync) trước khi xóa dữ liệu để tránh lỗi ràng buộc
    console.log('\n🔄 Đang đồng bộ hóa cấu trúc cột giữa Supabase và Docker...');
    for (const table of tables) {
      await syncColumns(table.name, supabase, docker);
    }
    console.log('✅ Cấu trúc cơ sở dữ liệu đã khớp hoàn toàn!');

    // 2. Xóa dữ liệu cũ trong Docker (Xóa ngược thứ tự để tránh lỗi khóa ngoại)
    console.log('\n🧹 Đang xóa dữ liệu tạm trong Docker...');
    for (const table of [...tables].reverse()) {
      await docker.query(`TRUNCATE TABLE "${table.name}" RESTART IDENTITY CASCADE`);
    }
    console.log('✅ Đã dọn dẹp sạch các bảng trong Docker.');

    // 3. Copy dữ liệu từ Supabase sang Docker
    console.log('\n📦 Bắt đầu sao chép dữ liệu...');
    for (const table of tables) {
      console.log(`\n👉 Đang sao chép bảng: "${table.name}"`);
      const srcData = await supabase.query(`SELECT * FROM "${table.name}"`);
      console.log(`   Tìm thấy ${srcData.rows.length} dòng dữ liệu.`);

      if (srcData.rows.length === 0) {
        console.log(`   (Bỏ qua do bảng trống)`);
        continue;
      }

      const columns = Object.keys(srcData.rows[0]);
      const columnsList = columns.map(c => `"${c}"`).join(', ');

      let insertedCount = 0;
      for (const row of srcData.rows) {
        const valuePlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = columns.map(col => {
          const val = row[col];
          // Tự động chuyển đổi JavaScript Object/Array thành chuỗi JSON khi insert vào các cột JSON/JSONB
          if (val !== null && typeof val === 'object') {
            return JSON.stringify(val);
          }
          return val;
        });

        await docker.query(
          `INSERT INTO "${table.name}" (${columnsList}) VALUES (${valuePlaceholders})`,
          values
        );
        insertedCount++;
      }
      console.log(`   ✅ Đã sao chép xong ${insertedCount}/${srcData.rows.length} dòng.`);

      // 4. Reset các chuỗi SEQUENCE tăng tự động (SERIAL) để không bị lỗi trùng ID sau này
      try {
        await docker.query(`
          SELECT setval(
            pg_get_serial_sequence('${table.name}', '${table.pk}'), 
            coalesce(max("${table.pk}"), 1)
          ) FROM "${table.name}"
        `);
        console.log(`   🔄 Đã reset ID sequence cho bảng "${table.name}".`);
      } catch (seqError) {
        // Một số bảng không sử dụng chuỗi tự tăng chuẩn sẽ ghi nhận cảnh báo nhỏ nhưng vẫn chạy tiếp
        console.log(`   ⚠️ Cảnh báo Sequence: ${seqError.message}`);
      }
    }

    console.log('\n🎉 ========================================================');
    console.log('🎉 HOÀN THÀNH: Đã chuyển toàn bộ dữ liệu từ Supabase vào Docker!');
    console.log('🎉 ========================================================');
  } catch (err) {
    console.error('❌ Lỗi di chuyển dữ liệu:', err);
  } finally {
    await supabase.end();
    await docker.end();
  }
}

migrate();
