/**
 * RAG Ingestion Service
 * - Tự động chunking và nạp transcript phụ đề vào Vector Database Pinecone
 * - Cung cấp ngữ cảnh phong phú cho AI Assistant (Chatbot & RAG Engine)
 * 
 * Phụ trách:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { embeddingModel, pineconeIndex } = require('../../../utils/ai-clients');
const { getRagIndex } = require('../../../utils/ragIndex.util');

/**
 * Cắt văn bản thành các chunk nhỏ có overlap để giữ tính liên tục của ngữ cảnh
 * @param {string} text Văn bản cần chia nhỏ
 * @param {number} chunkSize Kích thước mỗi chunk (ký tự)
 * @param {number} overlap Độ gối đầu giữa 2 chunk liên tiếp (ký tự)
 * @returns {string[]} Danh sách các đoạn văn bản chunk
 */
function chunkText(text, chunkSize = 900, overlap = 150) {
  if (!text || typeof text !== 'string') return [];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks.filter(c => c.trim().length > 30);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let embeddingQueue = Promise.resolve();
let lastEmbeddingStartedAt = 0;
let embeddingCooldownUntil = 0;

function isEmbeddingQuotaError(error) {
  let current = error;
  for (let depth = 0; current && depth < 6; depth++) {
    const message = String(current.message || '');
    if (current.status === 429 || current.code === 429 || current.code === 'RESOURCE_EXHAUSTED'
      || current.code === 'GEMINI_QUOTA_EXHAUSTED' || /resource[_ ]exhausted|quota exceeded|\b429\b/i.test(message)) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

function getProviderRetryDelayMs(error) {
  let current = error;
  for (let depth = 0; current && depth < 6; depth++) {
    if (Number.isFinite(Number(current.retryAfterMs)) && Number(current.retryAfterMs) > 0) {
      return Number(current.retryAfterMs);
    }
    const message = String(current.message || '');
    const match = message.match(/retry(?:Delay)?[\\"'\s:=]+(\d+(?:\.\d+)?)s/i)
      || message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    if (match) return Math.ceil(Number(match[1]) * 1000);
    current = current.cause;
  }
  return 0;
}

function scheduleEmbedding(task) {
  const configuredInterval = Number(process.env.RAG_EMBEDDING_MIN_INTERVAL_MS);
  const minimumIntervalMs = Number.isFinite(configuredInterval) && configuredInterval >= 0
    ? configuredInterval
    : 1000; // ~60 RPM, chừa khoảng trống cho traffic chatbot dưới free-tier 100 RPM.

  const run = embeddingQueue.then(async () => {
    const now = Date.now();
    const waitUntil = Math.max(lastEmbeddingStartedAt + minimumIntervalMs, embeddingCooldownUntil);
    if (waitUntil > now) await sleep(waitUntil - now);
    lastEmbeddingStartedAt = Date.now();
    return task();
  });
  embeddingQueue = run.catch(() => undefined);
  return run;
}

async function createEmbeddingWithRetry(text, lessonId, chunkIndex, totalChunks) {
  const configuredRetries = Number(process.env.RAG_EMBEDDING_MAX_RETRIES);
  const maxRetries = Number.isInteger(configuredRetries) && configuredRetries >= 0 ? configuredRetries : 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await scheduleEmbedding(() => embeddingModel.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
        purpose: 'rag_ingestion_embedding'
      }));
    } catch (error) {
      if (!isEmbeddingQuotaError(error) || attempt === maxRetries) throw error;
      const providerDelay = getProviderRetryDelayMs(error);
      const retryDelay = Math.min(60_000, Math.max(providerDelay + 1000, 10_000 * (attempt + 1)));
      embeddingCooldownUntil = Math.max(embeddingCooldownUntil, Date.now() + retryDelay);
      console.warn(
        `[RAG Ingestion] Gemini Embedding chạm giới hạn tại lessonId=${lessonId}, chunk ${chunkIndex + 1}/${totalChunks}. `
        + `Chờ ${Math.ceil(retryDelay / 1000)}s rồi thử lại (${attempt + 1}/${maxRetries}).`
      );
    }
  }
  throw new Error('Không thể tạo embedding sau số lần retry cho phép.');
}

/**
 * Tự động phân tách transcript phụ đề bài học thành các vector embedding và upsert vào Pinecone
 * @param {number|string} lessonId ID của bài học
 * @param {Array<{en: string, vi?: string, start?: number, end?: number}>|string} cues Danh sách phụ đề hoặc chuỗi text
 * @param {Object} options Tùy chọn nguồn nạp dữ liệu (source, materialId, fileName)
 */
async function ingestLessonTranscript(lessonId, cues, options = {}) {
  try {
    const source = options.source || 'auto-subtitle-transcript';
    const targetIndex = getRagIndex(pineconeIndex);
    if (!targetIndex) throw new Error('Pinecone index chưa được cấu hình.');
    let fullText = '';

    if (typeof cues === 'string') {
      fullText = cues;
    } else if (Array.isArray(cues) && cues.length > 0) {
      fullText = cues.map(c => c.en || c.vi || c.text || '').filter(Boolean).join(' ');
    } else {
      console.log(`[RAG Ingestion] lessonId=${lessonId}: Không có dữ liệu transcript hợp lệ để ingest.`);
      await deleteLessonVectors(lessonId, source, options.materialId);
      return { success: true, chunks: 0 };
    }

    if (!fullText.trim()) {
      console.log(`[RAG Ingestion] lessonId=${lessonId}: Nội dung văn bản rỗng, bỏ qua.`);
      await deleteLessonVectors(lessonId, source, options.materialId);
      return { success: true, chunks: 0 };
    }

    const chunks = chunkText(fullText);
    console.log(`[RAG Ingestion] lessonId=${lessonId} [source: ${source}]: Phân tách thành ${chunks.length} chunks (tổng độ dài ${fullText.length} ký tự).`);

    // 1. Lấy thông tin phân cấp thực tế từ PostgreSQL (lesson -> section -> course) làm Source of Truth
    let hierarchyMeta = {};
    try {
      const db = require('../../../config/database');
      const metaRes = await db.query(`
        SELECT l.lesson_id, l.title as lesson_title, s.section_id, s.title as section_title, s.course_id, c.course_name
        FROM lessons l
        JOIN sections s ON l.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE l.lesson_id = $1
        LIMIT 1;
      `, [Number(lessonId)]);
      if (metaRes.rows.length > 0) {
        hierarchyMeta = metaRes.rows[0];
      }
    } catch (metaErr) {
      console.warn(`[RAG Ingestion] ⚠️ Cảnh báo lấy metadata phân cấp cho lessonId=${lessonId}:`, metaErr.message);
    }

    // 2. Tạo đủ embedding trước khi xóa dữ liệu cũ. Quota tạm thời sẽ không làm mất index đang dùng.
    const records = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedResult = await createEmbeddingWithRetry(chunks[i], lessonId, i, chunks.length);

        const vector = embedResult?.embedding?.values || embedResult?.embedding;

        if (!vector || !Array.isArray(vector) || vector.length === 0) {
          throw new Error('Vector embedding trả về rỗng từ mô hình.');
        }

        const chunkId = options.materialId
          ? `lesson-${lessonId}-v2-material-${options.materialId}-chunk-${i}`
          : source === 'lesson-metadata'
            ? `lesson-${lessonId}-v2-metadata-chunk-${i}`
            : `lesson-${lessonId}-v2-transcript-chunk-${i}`;

        let startTime = null;
        let endTime = null;
        if (Array.isArray(cues) && cues.length > 0) {
          const cueIndex = Math.min(cues.length - 1, Math.floor((i / chunks.length) * cues.length));
          const endCueIndex = Math.min(cues.length - 1, Math.floor(((i + 1) / chunks.length) * cues.length));
          if (cues[cueIndex] && cues[cueIndex].start !== undefined) startTime = Number(cues[cueIndex].start);
          if (cues[endCueIndex] && cues[endCueIndex].end !== undefined) endTime = Number(cues[endCueIndex].end);
        }

        const metadata = {
          course_id: hierarchyMeta.course_id ? Number(hierarchyMeta.course_id) : 0,
          course_name: String(hierarchyMeta.course_name || ''),
          section_id: hierarchyMeta.section_id ? Number(hierarchyMeta.section_id) : 0,
          section_title: String(hierarchyMeta.section_title || ''),
          lesson_id: Number(lessonId),
          lesson_title: String(hierarchyMeta.lesson_title || ''),
          chunk_index: Number(i),
          content_type: options.materialId ? 'pdf_material' : source === 'lesson-metadata' ? 'lesson_metadata' : 'transcript',
          source: source,
          schema_version: 'v2',
          text: chunks[i]
        };

        if (startTime !== null) metadata.start_time = startTime;
        if (endTime !== null) metadata.end_time = endTime;
        if (options.materialId) metadata.material_id = Number(options.materialId);
        if (options.fileName) metadata.file_name = String(options.fileName);

        records.push({ id: chunkId, values: vector, metadata });
      } catch (chunkErr) {
        console.error(`[RAG Ingestion] ❌ Lỗi ở chunk ${i + 1}/${chunks.length} của lessonId=${lessonId}:`, chunkErr.message);
        throw chunkErr;
      }
    }

    // 3. Chỉ thay thế vector cũ sau khi toàn bộ embedding đã sẵn sàng.
    await deleteLessonVectors(lessonId, source, options.materialId);
    console.log(`[RAG Ingestion] lessonId=${lessonId}: Đã dọn dẹp vector cũ thuộc nguồn '${source}'.`);

    try {
      await targetIndex.upsert(records);
    } catch (upsertErr) {
      if (upsertErr.message && upsertErr.message.includes('Must pass in at least 1 record')) {
        await targetIndex.upsert({ records });
      } else {
        try {
          await deleteLessonVectors(lessonId, source, options.materialId);
        } catch (cleanupErr) {
          console.error(`[RAG Ingestion] Không thể dọn batch upsert lỗi lessonId=${lessonId}:`, cleanupErr.message);
        }
        throw upsertErr;
      }
    }

    console.log(`[RAG Ingestion] ✅ lessonId=${lessonId} [source: ${source}]: Đã nạp thành công ${records.length}/${chunks.length} chunks vào Pinecone Vector DB!`);
    return { success: true, chunks: records.length };
  } catch (error) {
    console.error(`[RAG Ingestion] ❌ Lỗi tổng quát khi ingest transcript cho lessonId=${lessonId}:`, error.message);
    throw error;
  }
}

/**
 * Tự động phân tách nội dung tài liệu PDF và nạp vào Pinecone Vector DB
 * @param {number|string} lessonId ID bài học
 * @param {number|string} materialId ID của tài liệu trong bảng lesson_materials
 * @param {string} fileName Tên file
 * @param {string} textContent Toàn bộ nội dung text trích xuất từ PDF
 */
async function ingestPdfDocument(lessonId, materialId, fileName, textContent) {
  return ingestLessonTranscript(lessonId, textContent, {
    source: 'lesson-material-pdf',
    materialId: Number(materialId),
    fileName: fileName
  });
}

/**
 * Xóa toàn bộ vector của một tài liệu đính kèm khi tài liệu bị xóa khỏi bài học
 * @param {number|string} materialId ID tài liệu
 */
async function deleteMaterialVectors(materialId) {
  try {
    const targetIndex = getRagIndex(pineconeIndex);
    if (targetIndex && typeof targetIndex.deleteMany === 'function') {
      await targetIndex.deleteMany({
        filter: {
          material_id: { $eq: Number(materialId) }
        }
      });
      console.log(`[RAG Ingestion] ✅ Đã xóa toàn bộ vector của materialId=${materialId} khỏi Pinecone.`);
    }
  } catch (err) {
    if (err.status === 404 || /404|not found/i.test(err.message)) {
      console.log(`[RAG Ingestion] ℹ️ Không có vector cũ cho materialId=${materialId} (Pinecone 404), tiếp tục.`);
      return;
    }
    console.warn(`[RAG Ingestion] Cảnh báo xóa vector của materialId=${materialId}:`, err.message);
    throw err;
  }
}

async function deleteLessonVectors(lessonId, source = null, materialId = null) {
  const targetIndex = getRagIndex(pineconeIndex);
  if (!targetIndex || typeof targetIndex.deleteMany !== 'function') return false;
  const filter = { lesson_id: { $eq: Number(lessonId) } };
  if (source) filter.source = { $eq: source };
  if (materialId) filter.material_id = { $eq: Number(materialId) };
  try {
    await targetIndex.deleteMany({ filter });
  } catch (err) {
    if (err.status === 404 || /404|not found/i.test(err.message)) {
      console.log(`[RAG Ingestion] ℹ️ Không có vector cũ cho lessonId=${lessonId} (Pinecone 404), bỏ qua dọn dẹp và tiếp tục upsert mới.`);
      return false;
    }
    throw err;
  }
  return true;
}

module.exports = {
  chunkText,
  ingestLessonTranscript,
  ingestPdfDocument,
  deleteMaterialVectors,
  deleteLessonVectors
};
