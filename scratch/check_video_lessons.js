const db = require('./backend/src/config/database');

(async () => {
  try {
    const res = await db.query(
      'SELECT l.lesson_id, l.title, l.content_type, l.content_url, l.media_status, l.storage_provider, l.storage_key FROM lessons l WHERE l.content_type = $1 ORDER BY l.lesson_id LIMIT 20',
      ['video']
    );
    console.log('Video lessons in DB:');
    res.rows.forEach(r => {
      console.log(JSON.stringify({
        id: r.lesson_id,
        title: r.title ? r.title.substring(0, 40) : null,
        content_url: r.content_url ? r.content_url.substring(0, 70) : null,
        media_status: r.media_status,
        storage_provider: r.storage_provider,
        storage_key: r.storage_key ? r.storage_key.substring(0, 60) : null
      }));
    });
    process.exit(0);
  } catch(e) {
    console.error('DB Error:', e.message);
    process.exit(1);
  }
})();
