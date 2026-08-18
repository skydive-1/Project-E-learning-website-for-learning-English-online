/**
 * Upsert Metadata V2 Vectors directly to Pinecone Production Index
 * - Đảm bảo Pinecone Live Index 'elearning-rag' chứa 100% vector V2
 * - Kiểm tra thống kê describeIndexStats() và xác minh trạng thái Production
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/database');
const { embeddingModel, pineconeIndex } = require('../src/utils/ai-clients');
const { chunkText } = require('../src/modules/lessons/services/ragIngestion.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function upsertPineconeProduction() {
  console.log("==========================================================================");
  console.log("🚀 BẮT ĐẦU UPSERT VECTOR METADATA V2 TRỰC TIẾP VÀO PINECONE PRODUCTION");
  console.log("==========================================================================\n");

  if (!pineconeIndex) {
    throw new Error("Không thể kết nối tới Pinecone Vector Index!");
  }

  // 1. Lấy toàn bộ dữ liệu từ PostgreSQL
  const query = `
    SELECT 
      l.lesson_id, 
      l.title as lesson_title,
      s.section_id,
      s.title as section_title,
      s.course_id,
      c.course_name,
      ls.cues
    FROM lessons l
    JOIN sections s ON l.section_id = s.section_id
    JOIN courses c ON s.course_id = c.course_id
    LEFT JOIN lesson_subtitles ls ON ls.lesson_id = l.lesson_id
    ORDER BY s.course_id ASC, l.lesson_id ASC;
  `;

  const { rows } = await db.query(query);
  console.log(`📋 Quét được ${rows.length} bài học từ PostgreSQL để nạp vào Pinecone.`);

  let totalUpserted = 0;
  const allV2Vectors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let cues = [];
    if (row.cues) {
      try {
        cues = typeof row.cues === 'string' ? JSON.parse(row.cues) : row.cues;
      } catch (e) {
        cues = [];
      }
    }

    let fullText = row.lesson_title || '';
    if (Array.isArray(cues) && cues.length > 0) {
      const cuesText = cues.map(c => c.en).filter(Boolean).join(' ');
      fullText += ' ' + cuesText;
    }

    if (!fullText.trim() || fullText.length < 10) continue;

    const chunks = chunkText(fullText, 900, 150);

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunkTextContent = chunks[cIdx];
      const embedRes = await embeddingModel.embedContent({
        content: { parts: [{ text: chunkTextContent }] },
        outputDimensionality: 768
      });

      const vector = embedRes.embedding?.values || embedRes.embeddings?.[0]?.values;
      if (!vector || vector.length === 0) continue;

      let startTime = null;
      let endTime = null;
      if (Array.isArray(cues) && cues.length > 0) {
        const cueIndex = Math.min(cues.length - 1, Math.floor((cIdx / chunks.length) * cues.length));
        const endCueIndex = Math.min(cues.length - 1, Math.floor(((cIdx + 1) / chunks.length) * cues.length));
        if (cues[cueIndex] && cues[cueIndex].start !== undefined) startTime = Number(cues[cueIndex].start);
        if (cues[endCueIndex] && cues[endCueIndex].end !== undefined) endTime = Number(cues[endCueIndex].end);
      }

      const chunkId = `lesson-${row.lesson_id}-v2-transcript-chunk-${cIdx}`;

      const metadata = {
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
      };

      if (startTime !== null) metadata.start_time = startTime;
      if (endTime !== null) metadata.end_time = endTime;

      allV2Vectors.push({
        id: chunkId,
        values: vector,
        metadata: metadata
      });

      await sleep(60);
    }
  }

  console.log(`\n⏳ Đang thực hiện batch upsert ${allV2Vectors.length} vector V2 vào Pinecone live index...`);

  // Batch upsert (mỗi batch 20 records)
  for (let b = 0; b < allV2Vectors.length; b += 20) {
    const batch = allV2Vectors.slice(b, b + 20);
    try {
      await pineconeIndex.upsert(batch);
    } catch (upsertErr) {
      if (upsertErr.message && upsertErr.message.includes('Must pass in at least 1 record')) {
        await pineconeIndex.upsert({ records: batch });
      } else {
        throw upsertErr;
      }
    }
    totalUpserted += batch.length;
    console.log(`  -> Đã upsert ${totalUpserted}/${allV2Vectors.length} vectors vào Pinecone...`);
  }

  // 3. Kiểm tra thống kê Index
  console.log("\n📊 Kiểm tra Pinecone Index Stats:");
  try {
    const stats = await pineconeIndex.describeIndexStats();
    console.log(JSON.stringify(stats, null, 2));
  } catch (statsErr) {
    console.log("Index describeIndexStats info:", statsErr.message);
  }

  console.log("\n==========================================================================");
  console.log(`✅ HOÀN TẤT UPSERT PINECONE LIVE PRODUCTION! (Tổng: ${totalUpserted} vectors)`);
  console.log("==========================================================================\n");

  process.exit(0);
}

upsertPineconeProduction().catch(err => {
  console.error("❌ Lỗi Upsert Pinecone:", err);
  process.exit(1);
});
