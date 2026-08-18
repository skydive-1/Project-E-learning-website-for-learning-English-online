/**
 * RAG Metadata v2 Migration & Reindexing Script
 * - Nạp lại toàn bộ vector với Schema Metadata v2 chuẩn hóa (PostgreSQL as Source of Truth)
 * - Đảm bảo tính Idempotency, không làm mất dữ liệu cũ (Safe Non-Destructive Migration)
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const { GoogleGenAI } = require('@google/genai');
const { chunkText } = require('../src/modules/lessons/services/ragIngestion.service');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getEmbedding(text) {
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return res.embedding?.values || res.embeddings?.[0]?.values || [];
}

async function runMigration() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU REINDEX & MIGRATION TOÀN BỘ DỮ LIỆU RAG SANG METADATA SCHEMA V2");
  console.log("==========================================================================\n");

  // 1. Kiểm tra kết nối CSDL
  const isDbOk = await db.testConnection();
  if (!isDbOk) {
    throw new Error("Không thể kết nối đến cơ sở dữ liệu PostgreSQL.");
  }

  // 2. Truy vấn toàn bộ dữ liệu bài học kèm thông tin Section & Course từ PostgreSQL (Source of Truth)
  const query = `
    SELECT 
      l.lesson_id, 
      l.title as lesson_title,
      s.section_id,
      s.title as section_title,
      s.course_id,
      c.course_name,
      ls.cues,
      (SELECT COUNT(*) FROM lesson_materials lm WHERE lm.lesson_id = l.lesson_id) as material_count
    FROM lessons l
    JOIN sections s ON l.section_id = s.section_id
    JOIN courses c ON s.course_id = c.course_id
    LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
    ORDER BY s.course_id ASC, l.lesson_id ASC;
  `;

  const { rows } = await db.query(query);
  console.log(`📋 Tìm thấy tổng cộng ${rows.length} bài học thực tế từ ${new Set(rows.map(r => r.course_id)).size} khóa học trong CSDL.\n`);

  const v2VectorRecords = [];
  let totalSubtitlesProcessed = 0;
  let skippedCount = 0;

  // 3. Phân tách và lập chỉ mục Vector Metadata v2
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let cues = [];
    if (row.cues) {
      try {
        cues = typeof row.cues === 'string' ? JSON.parse(row.cues) : row.cues;
      } catch (parseErr) {
        cues = [];
      }
    }

    let fullText = row.lesson_title || '';
    let cuesText = '';
    if (Array.isArray(cues) && cues.length > 0) {
      cuesText = cues.map(c => c.en).filter(Boolean).join(' ');
      fullText += ' ' + cuesText;
    }

    if (!fullText.trim() || fullText.length < 10) {
      skippedCount++;
      continue;
    }

    const chunks = chunkText(fullText, 900, 150);
    console.log(`[Migration v2] (${i + 1}/${rows.length}) Lesson #${row.lesson_id} ("${row.lesson_title}") -> Course #${row.course_id} ("${row.course_name}"): ${chunks.length} chunks.`);

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunkTextContent = chunks[cIdx];
      const vectorValues = await getEmbedding(chunkTextContent);

      let startTime = null;
      let endTime = null;
      if (Array.isArray(cues) && cues.length > 0) {
        const cueIndex = Math.min(cues.length - 1, Math.floor((cIdx / chunks.length) * cues.length));
        const endCueIndex = Math.min(cues.length - 1, Math.floor(((cIdx + 1) / chunks.length) * cues.length));
        if (cues[cueIndex] && cues[cueIndex].start !== undefined) startTime = Number(cues[cueIndex].start);
        if (cues[endCueIndex] && cues[endCueIndex].end !== undefined) endTime = Number(cues[endCueIndex].end);
      }

      const v2Record = {
        id: `lesson-${row.lesson_id}-v2-transcript-chunk-${cIdx}`,
        values: vectorValues,
        metadata: {
          course_id: Number(row.course_id),
          course_name: String(row.course_name || ''),
          section_id: Number(row.section_id),
          section_title: String(row.section_title || ''),
          lesson_id: Number(row.lesson_id),
          lesson_title: String(row.lesson_title || ''),
          chunk_index: Number(cIdx),
          content_type: 'transcript',
          source: 'auto-subtitle-transcript',
          schema_version: 'v2',
          text: chunkTextContent
        }
      };

      if (startTime !== null) v2Record.metadata.start_time = startTime;
      if (endTime !== null) v2Record.metadata.end_time = endTime;

      v2VectorRecords.push(v2Record);
      await sleep(60); // Ngăn ngừa rate limit
    }
    totalSubtitlesProcessed++;
  }

  console.log("\n==========================================================================");
  console.log(`🎉 HOÀN THÀNH TẠO VECTOR METADATA V2!`);
  console.log(`✅ Tổng số bài học đã nạp: ${totalSubtitlesProcessed}/${rows.length}`);
  console.log(`✅ Tổng số vector V2 được sinh ra: ${v2VectorRecords.length} vectors`);
  console.log("==========================================================================\n");

  // 4. Lưu bản snapshot vector metadata v2 vào file JSON để làm Vector Repository phục vụ evaluation & backup
  const v2SnapshotPath = path.resolve(__dirname, '../../rag_v2_vector_store.json');
  const fs = require('fs');
  fs.writeFileSync(v2SnapshotPath, JSON.stringify({
    schema_version: 'v2',
    timestamp: new Date().toISOString(),
    total_vectors: v2VectorRecords.length,
    courses_covered: Array.from(new Set(v2VectorRecords.map(r => r.metadata.course_id))),
    records: v2VectorRecords
  }, null, 2), 'utf-8');

  console.log(`💾 Đã lưu snapshot Vector Metadata v2 vào: ${v2SnapshotPath}`);
  process.exit(0);
}

runMigration().catch(err => {
  console.error("❌ Lỗi Migration Metadata v2:", err);
  process.exit(1);
});
