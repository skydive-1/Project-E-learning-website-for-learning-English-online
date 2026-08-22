require('dotenv').config();
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const lessonIdArg = args.find(a => a.startsWith('--lesson-id='));
const targetLessonId = lessonIdArg ? parseInt(lessonIdArg.split('=')[1], 10) : null;
const db = require(require('path').resolve(__dirname, '../src/config/database'));
const { triggerLessonRagIngestion } = require(require('path').resolve(__dirname, '../src/modules/lessons/services/lessonRagIngestion.service'));
const DELAY_MS = 3000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('='.repeat(60));
  console.log('[RAG Backfill] Bat dau backfill Pinecone cho bai hoc co video');
  if (isDryRun) console.log('[RAG Backfill] CHE DO DRY-RUN: Chi liet ke, khong trigger thuc su');
  if (targetLessonId) console.log('[RAG Backfill] Chi chay cho lessonId=' + targetLessonId);
  console.log('='.repeat(60));

  try {
    let query, params;
    if (targetLessonId) {
      query = 'SELECT l.lesson_id, l.title, l.content_url, l.content_type, s.title AS section_title, c.course_name FROM lessons l JOIN sections s ON l.section_id = s.section_id JOIN courses c ON s.course_id = c.course_id WHERE l.lesson_id = \ AND l.content_url IS NOT NULL AND l.content_url != \$\$\$\$';
      params = [targetLessonId];
    } else {
      query = 'SELECT l.lesson_id, l.title, l.content_url, l.content_type, s.title AS section_title, c.course_name FROM lessons l JOIN sections s ON l.section_id = s.section_id JOIN courses c ON s.course_id = c.course_id WHERE l.content_url IS NOT NULL AND l.content_url != \$\$\$\$ ORDER BY c.course_id, s.section_id, l.order_index, l.lesson_id';
      params = [];
    }

    const result = await db.query(query, params);
    const lessons = result.rows;

    console.log('[RAG Backfill] Tim thay ' + lessons.length + ' bai hoc co content_url');

    const supabaseLessons = lessons.filter(l => typeof l.content_url === 'string' && !l.content_url.startsWith('/uploads/') && !l.content_url.startsWith('http'));
    const legacyLessons = lessons.filter(l => typeof l.content_url === 'string' && l.content_url.startsWith('/uploads/'));
    const httpLessons = lessons.filter(l => typeof l.content_url === 'string' && l.content_url.startsWith('http'));

    console.log('  - Supabase key (metadata + video transcript): ' + supabaseLessons.length);
    console.log('  - Legacy /uploads/ (chi metadata):           ' + legacyLessons.length);
    console.log('  - HTTP URL (chi metadata):                   ' + httpLessons.length);
    console.log('');

    if (isDryRun) {
      console.log('[DRY-RUN] Danh sach se duoc trigger:');
      for (const l of lessons) {
        const isSupabase = !l.content_url.startsWith('/uploads/') && !l.content_url.startsWith('http');
        console.log('  [' + l.lesson_id + '] ' + JSON.stringify(l.title) + ' | ' + l.course_name + ' | ' + (isSupabase ? 'FULL' : 'metadata-only'));
      }
      console.log('');
      console.log('[DRY-RUN] Chay lai khong co --dry-run de thuc su trigger.');
      await db.pool.end();
      process.exit(0);
    }

    let successCount = 0, errorCount = 0;
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const isSupabaseKey = typeof lesson.content_url === 'string' && !lesson.content_url.startsWith('/uploads/') && !lesson.content_url.startsWith('http');
      const storageKey = isSupabaseKey ? lesson.content_url : null;
      const progress = '[' + (i + 1) + '/' + lessons.length + ']';
      try {
        console.log(progress + ' lessonId=' + lesson.lesson_id + ' ' + JSON.stringify(lesson.title));
        await triggerLessonRagIngestion(lesson.lesson_id, storageKey, 'backfill');
        successCount++;
        console.log(progress + ' -> OK');
      } catch (err) {
        errorCount++;
        console.error(progress + ' -> FAIL: ' + err.message);
      }
      if (i < lessons.length - 1) await sleep(DELAY_MS);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('[RAG Backfill] HOAN TAT: ' + successCount + ' OK / ' + errorCount + ' LOI / ' + lessons.length + ' TONG');
    console.log('[RAG Backfill] Phase 1 metadata da nap. Phase 2 video transcript dang chay background.');
    console.log('='.repeat(60));
    console.log('[RAG Backfill] Cho 15s de Phase 2 khoi dong truoc khi thoat...');
    await sleep(15000);

  } catch (err) {
    console.error('[RAG Backfill] LOI NGHIEM TRONG:', err.message);
    process.exit(1);
  } finally {
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  }
}

main();

