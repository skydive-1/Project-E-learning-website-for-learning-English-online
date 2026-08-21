/**
 * Lesson RAG Auto-Ingestion Service
 * Tu dong nap noi dung bai hoc vao Pinecone RAG khi giang vien gan video/PDF,
 * KHONG phu thuoc vao viec nguoi dung bam "Tao Phu De AI".
 *
 * Pipeline 2 Phase:
 *   Phase 1 (~50ms): Nap metadata bai hoc (title, mo ta, ten khoa hoc) ngay lap tuc
 *   Phase 2 (async): Download video -> FFmpeg trich audio -> Gemini transcribe -> Pinecone
 *
 * Phu trach:
 *   NGUYEN THANH LIEM (Backend & Security Developer)
 *   LE DINH CHUONG (Database Administrator & Infrastructure Specialist)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const db = require('../../../config/database');
const { ingestLessonTranscript } = require('./ragIngestion.service');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function downloadToTemp(url, lessonId) {
  const uniqueId = crypto.randomUUID();
  const tempPath = path.join(os.tmpdir(), `rag_video_${lessonId}_${uniqueId}.mp4`);
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http;
    const fileStream = fs.createWriteStream(tempPath);
    const req = protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        fileStream.close();
        fs.unlink(tempPath, () => {});
        return reject(new Error(`HTTP ${res.statusCode} khi tai video RAG`));
      }
      res.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(tempPath); });
    });
    req.on('error', (err) => { fileStream.close(); fs.unlink(tempPath, () => {}); reject(err); });
    req.setTimeout(600000, () => {
      req.destroy(); fileStream.close(); fs.unlink(tempPath, () => {});
      reject(new Error('Timeout tai video RAG (>10 phut)'));
    });
  });
}

async function transcribeForRag(audioPath, timeOffset) {
  const { geminiModel } = require('../../../utils/ai-clients');
  const audioBuffer = fs.readFileSync(audioPath);
  const base64Audio = audioBuffer.toString('base64');
  const sizeMb = Math.round(audioBuffer.length / (1024 * 1024) * 10) / 10;
  console.log(`[LessonRAG] Transcribe audio ${sizeMb}MB (offset ${timeOffset}s)...`);

  const prompt = `Transcribe audio bai giang tieng Anh. Tra ve JSON duy nhat:
{"cues":[{"id":1,"start":0.0,"end":3.5,"en":"Hello everyone.","vi":"Xin chao moi nguoi."}]}
Quy tac: start/end tinh bang giay. JSON phai dong hoan chinh.`;

  const response = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [
      { text: prompt },
      { inlineData: { mimeType: 'audio/mp3', data: base64Audio } }
    ]}],
    generationConfig: { temperature: 0.1, maxOutputTokens: 65536, responseMimeType: 'application/json' }
  });

  const raw = response?.response?.text() || '';
  const clean = raw.replace(/^```json\s*/, '').replace(/```$/, '').trim();
  let cues = [];
  try { cues = JSON.parse(clean).cues || []; } catch (_) {
    const re = /\{\s*"id"\s*:\s*\d+\s*,\s*"start"\s*:\s*([\d.]+)\s*,\s*"end"\s*:\s*([\d.]+)\s*,\s*"en"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"vi"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    let m; while ((m = re.exec(clean)) !== null) cues.push({ start: parseFloat(m[1]), end: parseFloat(m[2]), en: m[3], vi: m[4] });
  }
  return cues.map((c, i) => ({ id: i + 1, start: Number(c.start || 0) + timeOffset, end: Number(c.end || 0) + timeOffset, en: c.en || '', vi: c.vi || '' }));
}

// ─── Phase 1: Metadata ────────────────────────────────────────────────────────

async function ingestLessonMetadata(lessonId) {
  try {
    const res = await db.query(`
      SELECT l.lesson_id, l.title, s.title AS section_title, c.course_name, c.description AS course_description
      FROM lessons l
      JOIN sections s ON l.section_id = s.section_id
      JOIN courses  c ON s.course_id  = c.course_id
      WHERE l.lesson_id = $1
    `, [Number(lessonId)]);
    if (res.rows.length === 0) return;
    const row = res.rows[0];
    const metaText = [
      `Bai hoc: ${row.title}`,
      `Chuong: ${row.section_title}`,
      `Khoa hoc: ${row.course_name}`,
      row.course_description ? `Mo ta khoa hoc: ${row.course_description}` : null
    ].filter(Boolean).join('\n');
    await ingestLessonTranscript(lessonId, metaText, { source: 'lesson-metadata' });
    console.log(`[LessonRAG] Phase 1 OK lessonId=${lessonId} ("${row.title}")`);
  } catch (err) {
    console.warn(`[LessonRAG] Phase 1 FAIL lessonId=${lessonId}:`, err.message);
  }
}

// ─── Phase 2: Video Transcript (background) ──────────────────────────────────

async function ingestVideoTranscript(lessonId, rawStorageKey) {
  let tempVideoPath = null;
  try {
    console.log(`[LessonRAG] Phase 2 start: lessonId=${lessonId}`);
    const { generateSignedUrl } = require('../../../utils/supabaseStorage');
    const signedUrl = await generateSignedUrl(rawStorageKey, 'videos', 7200);
    if (!signedUrl) throw new Error(`Khong tao duoc Signed URL: ${rawStorageKey}`);

    tempVideoPath = await downloadToTemp(signedUrl, lessonId);
    const sizeMb = Math.round(fs.statSync(tempVideoPath).size / (1024 * 1024));
    console.log(`[LessonRAG] Downloaded ${sizeMb}MB -> ${tempVideoPath}`);

    const subtitlesService = require('./subtitles.service');
    let totalDuration = 0;
    try { totalDuration = await subtitlesService.getVideoDuration(tempVideoPath); } catch (_) {}

    const allCues = [];
    const CHUNK = 500;
    const ffmpeg = require('fluent-ffmpeg');
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);

    if (totalDuration <= CHUNK || totalDuration === 0) {
      const tempAudio = path.join(os.tmpdir(), `rag_audio_${lessonId}_${Date.now()}.mp3`);
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(tempVideoPath).noVideo().audioFrequency(16000).audioChannels(1).audioBitrate('64k').format('mp3')
            .on('end', resolve).on('error', reject).save(tempAudio);
        });
        const cues = await transcribeForRag(tempAudio, 0);
        allCues.push(...cues);
      } finally {
        if (fs.existsSync(tempAudio)) try { fs.unlinkSync(tempAudio); } catch (_) {}
      }
    } else {
      const numChunks = Math.ceil(totalDuration / CHUNK);
      console.log(`[LessonRAG] Video dai ${totalDuration.toFixed(1)}s -> ${numChunks} chunks`);
      for (let i = 0; i < numChunks; i++) {
        const seek = i * CHUNK;
        const duration = Math.min(CHUNK, totalDuration - seek);
        const chunkPath = path.join(os.tmpdir(), `rag_chunk_${lessonId}_${i}_${Date.now()}.mp3`);
        try {
          await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath).noVideo().setStartTime(seek).setDuration(duration)
              .audioFrequency(16000).audioChannels(1).audioBitrate('64k').format('mp3')
              .on('end', resolve).on('error', reject).save(chunkPath);
          });
          const cues = await transcribeForRag(chunkPath, seek);
          allCues.push(...cues);
          console.log(`[LessonRAG] Chunk ${i + 1}/${numChunks}: ${cues.length} cues`);
        } catch (chunkErr) {
          console.warn(`[LessonRAG] Chunk ${i + 1} FAIL:`, chunkErr.message);
        } finally {
          if (fs.existsSync(chunkPath)) try { fs.unlinkSync(chunkPath); } catch (_) {}
        }
      }
    }

    if (allCues.length === 0) { console.warn(`[LessonRAG] Phase 2: 0 cues lessonId=${lessonId}`); return; }
    await ingestLessonTranscript(lessonId, allCues, { source: 'video-transcript' });
    console.log(`[LessonRAG] Phase 2 OK: ${allCues.length} cues -> Pinecone (lessonId=${lessonId})`);
  } catch (err) {
    console.error(`[LessonRAG] Phase 2 FAIL lessonId=${lessonId}:`, err.message);
  } finally {
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      try { fs.unlinkSync(tempVideoPath); } catch (_) {}
      console.log(`[LessonRAG] Cleaned up temp video lessonId=${lessonId}`);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Trigger auto-RAG ingestion cho bai hoc. LUON non-blocking.
 * @param {number|string} lessonId
 * @param {string|null} rawStorageKey - Supabase storage key hoac null neu chi ingest metadata
 * @param {string} triggerReason - Log label (vd: 'video-assigned', 'lesson-created')
 */
async function triggerLessonRagIngestion(lessonId, rawStorageKey, triggerReason) {
  try {
    const reason = triggerReason || 'unknown';
    console.log(`[LessonRAG] Trigger (reason: ${reason}) lessonId=${lessonId}`);
    await ingestLessonMetadata(lessonId);
    if (rawStorageKey && typeof rawStorageKey === 'string' && !rawStorageKey.startsWith('/uploads/') && !rawStorageKey.startsWith('http')) {
      ingestVideoTranscript(lessonId, rawStorageKey).catch((err) => {
        console.error(`[LessonRAG] Background Phase 2 error lessonId=${lessonId}:`, err.message);
      });
      console.log(`[LessonRAG] Phase 2 kicked off background (lessonId=${lessonId})`);
    } else if (!rawStorageKey) {
      console.log(`[LessonRAG] No storage key -> metadata only (lessonId=${lessonId})`);
    }
  } catch (err) {
    console.error(`[LessonRAG] triggerLessonRagIngestion error lessonId=${lessonId}:`, err.message);
  }
}

module.exports = { triggerLessonRagIngestion };
