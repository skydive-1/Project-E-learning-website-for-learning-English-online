require('dotenv').config();
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

  // 1. Fetch all objects from R2
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

  console.log(`[R2] Total objects: ${allObjects.length}`);

  // 2. Fetch all referenced keys from DB
  const lessonRows = (await pool.query('SELECT storage_key FROM lessons WHERE storage_key IS NOT NULL')).rows;
  const materialRows = (await pool.query('SELECT storage_key FROM lesson_materials WHERE storage_key IS NOT NULL')).rows;
  const mediaAssetRows = (await pool.query("SELECT object_key, status FROM media_assets WHERE status != 'DELETED'")).rows;

  const activeKeys = new Set();
  for (const r of lessonRows) activeKeys.add(r.storage_key);
  for (const r of materialRows) activeKeys.add(r.storage_key);
  for (const r of mediaAssetRows) activeKeys.add(r.object_key);

  console.log(`[DB] Total active referenced keys in DB: ${activeKeys.size}`);

  // 3. Classify R2 objects
  const activeObjects = [];
  const orphanObjects = [];

  for (const obj of allObjects) {
    const key = obj.Key;
    let isActive = false;

    // Direct active key check
    if (activeKeys.has(key)) {
      isActive = true;
    } else {
      // For DASH / HLS videos, audio.mp4, video.mp4, source.mp4 share the same folder
      const folder = key.substring(0, key.lastIndexOf('/'));
      for (const activeKey of activeKeys) {
        const activeFolder = activeKey.substring(0, activeKey.lastIndexOf('/'));
        if (activeFolder && folder === activeFolder) {
          isActive = true;
          break;
        }
      }
      // Or if key belongs to course 41 (the only active course)
      if (key.startsWith('courses/tieng-anh-co-ban-41/')) {
        isActive = true;
      }
    }

    if (isActive) {
      activeObjects.push(obj);
    } else {
      orphanObjects.push(obj);
    }
  }

  console.log('\n=========================================');
  console.log(`ACTIVE OBJECTS (Khóa học 41 - Tiếng Anh cơ bản): ${activeObjects.length} files (~${(activeObjects.reduce((a, b) => a + b.Size, 0) / (1024*1024)).toFixed(2)} MB)`);
  console.log(`ORPHAN OBJECTS (File rác từ các khóa cũ & archive): ${orphanObjects.length} files (~${(orphanObjects.reduce((a, b) => a + b.Size, 0) / (1024*1024)).toFixed(2)} MB)`);
  console.log('=========================================\n');

  const orphanGroups = {};
  for (const o of orphanObjects) {
    const prefix = o.Key.split('/').slice(0, 2).join('/');
    if (!orphanGroups[prefix]) orphanGroups[prefix] = { count: 0, sizeMB: 0 };
    orphanGroups[prefix].count++;
    orphanGroups[prefix].sizeMB += o.Size / (1024 * 1024);
  }

  console.log('CHI TIẾT FILE RÁC THEO TỪNG NHÓM:');
  for (const [pfx, data] of Object.entries(orphanGroups)) {
    console.log(`- ${pfx}: ${data.count} files (~${data.sizeMB.toFixed(2)} MB)`);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
