const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getConfig } = require('../src/utils/r2Storage');
const { pool } = require('../src/config/database');
const { generateLessonDrmKeys } = require('../src/utils/drm.util');

async function main() {
  console.log('1. Đảm bảo cột drm_key_ref tồn tại...');
  await pool.query('ALTER TABLE lessons ADD COLUMN IF NOT EXISTS drm_key_ref VARCHAR(100)');
  await pool.query('ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS drm_key_ref VARCHAR(100)');
  console.log('   -> Cột drm_key_ref đã sẵn sàng.');

  const config = getConfig();
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });

  const lessons = (await pool.query("SELECT * FROM lessons WHERE storage_key LIKE '%.mpd' ORDER BY lesson_id")).rows;
  console.log(`\n2. Quét và đồng bộ drm_key_ref cho ${lessons.length} bài học DASH...`);

  for (const l of lessons) {
    const res = await client.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: l.storage_key
    }));
    const text = await res.Body.transformToString();
    const kidMatch = text.match(/default_KID="([^"]+)"/);
    const manifestKid = kidMatch ? kidMatch[1].replace(/-/g, '').toLowerCase() : '';

    // Tìm candidate trong media_assets
    const assets = (await pool.query('SELECT * FROM media_assets WHERE checksum_sha256 = $1 ORDER BY created_at ASC', [l.checksum_sha256])).rows;
    let matchedUuid = null;

    for (const a of assets) {
      const uuidInPath = a.object_key.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\//i)?.[1];
      if (uuidInPath && generateLessonDrmKeys(uuidInPath).keyId.toLowerCase() === manifestKid) {
        matchedUuid = uuidInPath;
        break;
      }
    }

    // Kiểm tra thêm path hiện tại hoặc lesson_id
    if (!matchedUuid) {
      const curUuid = l.storage_key.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\//i)?.[1];
      if (curUuid && generateLessonDrmKeys(curUuid).keyId.toLowerCase() === manifestKid) matchedUuid = curUuid;
      else if (generateLessonDrmKeys(l.lesson_id).keyId.toLowerCase() === manifestKid) matchedUuid = String(l.lesson_id);
    }

    if (matchedUuid) {
      await pool.query('UPDATE lessons SET drm_key_ref = $1 WHERE lesson_id = $2', [matchedUuid, l.lesson_id]);
      if (l.media_asset_id) {
        await pool.query('UPDATE media_assets SET drm_key_ref = $1 WHERE media_id = $2', [matchedUuid, l.media_asset_id]);
      }
      console.log(`   ✅ Bài ${l.lesson_id} [${l.title}]: Đã gán drm_key_ref = ${matchedUuid} (Khớp KID ${manifestKid})`);
    } else {
      console.warn(`   ⚠️ Bài ${l.lesson_id} [${l.title}]: Không tìm thấy UUID khớp KID ${manifestKid}`);
    }
  }

  console.log('\nHoàn tất đồng bộ drm_key_ref!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
