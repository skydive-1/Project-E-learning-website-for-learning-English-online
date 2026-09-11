const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getConfig } = require('../src/utils/r2Storage');
const { pool } = require('../src/config/database');

async function main() {
  const config = getConfig();
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });

  let allObjects = [];
  let token = undefined;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: config.bucket,
      ContinuationToken: token
    }));
    if (res.Contents) allObjects.push(...res.Contents);
    token = res.NextContinuationToken;
  } while (token);

  console.log('====================================================');
  console.log('THỐNG KÊ THỰC TẾ TRÊN CLOUDFLARE R2 (REAL-TIME S3 QUERY)');
  console.log('====================================================');
  console.log(`- Tổng số tệp thực tế trong Bucket: ${allObjects.length} tệp`);
  const totalBytes = allObjects.reduce((sum, o) => sum + (o.Size || 0), 0);
  const totalMB = totalBytes / (1024 * 1024);
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  console.log(`- Tổng dung lượng thực tế: ${totalGB.toFixed(3)} GB (~${totalMB.toFixed(2)} MB)\n`);

  // Group by lesson
  const lessonsRes = await pool.query('SELECT lesson_id, title, storage_key FROM lessons ORDER BY lesson_id');
  console.log('--- CHI TIẾT TỪNG BÀI HỌC CỦA KHÓA HỌC HIỆN TẠI (11 BÀI HỌC) ---');

  for (const lesson of lessonsRes.rows) {
    const key = lesson.storage_key || '';
    const folder = key.substring(0, key.lastIndexOf('/'));
    const lessonFiles = allObjects.filter(o => o.Key.startsWith(folder));
    const lessonBytes = lessonFiles.reduce((s, o) => s + (o.Size || 0), 0);
    console.log(`\n• Bài học ${lesson.lesson_id}: "${lesson.title}"`);
    console.log(`  Tổng dung lượng: ${(lessonBytes / (1024 * 1024)).toFixed(2)} MB (${lessonFiles.length} tệp)`);
    for (const f of lessonFiles) {
      const fileName = f.Key.split('/').pop();
      console.log(`    ├── ${fileName} (${(f.Size / (1024 * 1024)).toFixed(2)} MB)`);
    }
  }

  const accountedKeys = new Set();
  for (const l of lessonsRes.rows) {
    const folder = (l.storage_key || '').substring(0, (l.storage_key || '').lastIndexOf('/'));
    for (const o of allObjects) {
      if (o.Key.startsWith(folder)) accountedKeys.add(o.Key);
    }
  }

  const extraFiles = allObjects.filter(o => !accountedKeys.has(o.Key));
  console.log('\n----------------------------------------------------');
  console.log(`TỆP NGOÀI DANH SÁCH 11 BÀI HỌC TRÊN: ${extraFiles.length} tệp`);
  if (extraFiles.length > 0) {
    for (const f of extraFiles) {
      console.log(`  - ${f.Key}: ${(f.Size / (1024 * 1024)).toFixed(2)} MB`);
    }
  } else {
    console.log('  (Không có tệp nào khác ngoài 11 bài học này!)');
  }
  console.log('====================================================\n');

  await pool.end();
}

main().catch(err => {
  console.error('Lỗi đo dung lượng:', err);
  process.exit(1);
});
