#!/usr/bin/env node
'use strict';

require('dotenv').config();
const db = require('../src/config/database');

const VIETNAMESE_DIACRITICS_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

function pad(num, size = 2) {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

function formatVttTimestamp(seconds) {
  const totalMs = Math.round(Number(seconds || 0) * 1000);
  const hrs = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

function buildVtt(cues, type = 'bilingual') {
  let vtt = 'WEBVTT\n\n';
  (cues || []).forEach((cue, index) => {
    const startStr = cue.startFormatted || formatVttTimestamp(cue.start);
    const endStr = cue.endFormatted || formatVttTimestamp(cue.end);
    vtt += `${index + 1}\n`;
    vtt += `${startStr} --> ${endStr}\n`;
    const enText = String(cue.en || '').trim();
    const viText = String(cue.vi || '').trim();
    if (type === 'en') {
      vtt += `${enText || viText}\n\n`;
    } else if (type === 'vi') {
      vtt += `${viText || enText}\n\n`;
    } else {
      const lines = [enText, viText].filter(Boolean);
      vtt += `${lines.join('\n')}\n\n`;
    }
  });
  return vtt;
}

async function repairSubtitles() {
  console.log('=== [Subtitles Repair Tool] Bắt đầu quét phụ đề bị lỗi ===\n');

  try {
    const { rows } = await db.query(`
      SELECT ls.lesson_id, l.title, l.content_type, ls.cues, ls.subtitle_status
      FROM lesson_subtitles ls
      JOIN lessons l ON l.lesson_id = ls.lesson_id
      ORDER BY ls.lesson_id;
    `);

    let swappedFixedCount = 0;
    let requeuedCount = 0;

    for (const row of rows) {
      const cues = typeof row.cues === 'string' ? JSON.parse(row.cues) : (row.cues || []);
      if (!Array.isArray(cues) || cues.length === 0) continue;

      // 1. Kiểm tra lộn ngược: cue.en chứa tiếng Việt trong khi cue.vi chứa tiếng Anh
      let isSwapped = false;
      for (const c of cues) {
        const enHasViDiacritics = VIETNAMESE_DIACRITICS_REGEX.test(c.en || '');
        const viHasViDiacritics = VIETNAMESE_DIACRITICS_REGEX.test(c.vi || '');
        if (enHasViDiacritics && !viHasViDiacritics && (c.vi || '').length > 3) {
          isSwapped = true;
          break;
        }
      }

      // 2. Kiểm tra cue bị đứng im: cả video dài chỉ có <= 3 cues hoặc có cue kéo dài > 30 giây
      const hasExcessiveDurationCue = cues.some(c => (Number(c.end) - Number(c.start)) > 30);
      const isStuckWithFewCues = cues.length <= 3 && hasExcessiveDurationCue;

      if (isSwapped && !isStuckWithFewCues) {
        // Đảo ngược lại đúng vị trí en và vi
        const fixedCues = cues.map(c => {
          const enHasViDiacritics = VIETNAMESE_DIACRITICS_REGEX.test(c.en || '');
          const viHasViDiacritics = VIETNAMESE_DIACRITICS_REGEX.test(c.vi || '');
          if (enHasViDiacritics && !viHasViDiacritics) {
            return {
              ...c,
              en: c.vi,
              vi: c.en
            };
          }
          return c;
        });

        const enVtt = buildVtt(fixedCues, 'en');
        const viVtt = buildVtt(fixedCues, 'vi');
        const bilingualVtt = buildVtt(fixedCues, 'bilingual');

        await db.query(`
          UPDATE lesson_subtitles
          SET cues = $1::jsonb, en_vtt = $2, vi_vtt = $3, bilingual_vtt = $4, updated_at = NOW()
          WHERE lesson_id = $5;
        `, [JSON.stringify(fixedCues), enVtt, viVtt, bilingualVtt, row.lesson_id]);

        console.log(`✅ [Đã sửa đổi vị trí EN/VI] Bài học ${row.lesson_id}: "${row.title}" (${cues.length} cues)`);
        swappedFixedCount++;
      } else if (isStuckWithFewCues) {
        // Đưa vào trạng thái pending để hàng đợi bóc băng tự động chạy lại bằng pipeline mới
        await db.query(`
          UPDATE lesson_subtitles
          SET subtitle_status = 'pending', updated_at = NOW()
          WHERE lesson_id = $1;
        `, [row.lesson_id]);

        console.log(`🔄 [Đã đưa vào hàng đợi tái tạo] Bài học ${row.lesson_id}: "${row.title}" (Chỉ có ${cues.length} cue kéo dài > 30s)`);
        requeuedCount++;
      }
    }

    console.log(`\n=== Tổng kết ===`);
    console.log(`- Đã sửa lỗi đảo ngược EN/VI: ${swappedFixedCount} bài học`);
    console.log(`- Đã đưa vào hàng đợi chạy lại (do cue quá dài/đứng im): ${requeuedCount} bài học`);
    console.log(`Hoàn tất thành công!`);

    process.exit(0);
  } catch (err) {
    console.error('Lỗi khi sửa phụ đề:', err);
    process.exit(1);
  }
}

repairSubtitles();
