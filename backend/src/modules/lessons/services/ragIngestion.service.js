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

/**
 * Tự động phân tách transcript phụ đề bài học thành các vector embedding và upsert vào Pinecone
 * @param {number|string} lessonId ID của bài học
 * @param {Array<{en: string, vi?: string, start?: number, end?: number}>|string} cues Danh sách phụ đề hoặc chuỗi text
 * @param {Object} options Tùy chọn nguồn nạp dữ liệu (source, materialId, fileName)
 */
async function ingestLessonTranscript(lessonId, cues, options = {}) {
  try {
    const source = options.source || 'auto-subtitle-transcript';
    let fullText = '';

    if (typeof cues === 'string') {
      fullText = cues;
    } else if (Array.isArray(cues) && cues.length > 0) {
      fullText = cues.map(c => c.en).filter(Boolean).join(' ');
    } else {
      console.log(`[RAG Ingestion] lessonId=${lessonId}: Không có dữ liệu transcript hợp lệ để ingest.`);
      return;
    }

    if (!fullText.trim()) {
      console.log(`[RAG Ingestion] lessonId=${lessonId}: Nội dung văn bản rỗng, bỏ qua.`);
      return;
    }

    const chunks = chunkText(fullText);
    console.log(`[RAG Ingestion] lessonId=${lessonId} [source: ${source}]: Phân tách thành ${chunks.length} chunks (tổng độ dài ${fullText.length} ký tự).`);

    // 1. Xóa các vector cũ của bài học này theo ĐÚNG nguồn (source) để tránh xóa nhầm dữ liệu PDF/phụ đề khác
    try {
      if (pineconeIndex && typeof pineconeIndex.deleteMany === 'function') {
        const deleteFilter = {
          lesson_id: { $eq: Number(lessonId) },
          source: { $eq: source }
        };
        if (options.materialId) {
          deleteFilter.material_id = { $eq: Number(options.materialId) };
        }
        await pineconeIndex.deleteMany({ filter: deleteFilter });
        console.log(`[RAG Ingestion] lessonId=${lessonId}: Đã dọn dẹp vector cũ thuộc nguồn '${source}'.`);
      }
    } catch (delErr) {
      console.warn(`[RAG Ingestion] Cảnh báo xóa vector cũ lessonId=${lessonId} (có thể chưa tồn tại):`, delErr.message);
    }

    // 2. Tạo Vector Embedding và Upsert tuần tự từng chunk vào Pinecone
    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedResult = await embeddingModel.embedContent({
          content: { parts: [{ text: chunks[i] }] },
          outputDimensionality: 768
        });

        const vector = embedResult?.embedding?.values || embedResult?.embedding;

        if (!vector || !Array.isArray(vector) || vector.length === 0) {
          throw new Error('Vector embedding trả về rỗng từ mô hình.');
        }

        const chunkId = options.materialId
          ? `material-${options.materialId}-chunk-${i}`
          : `lesson-${lessonId}-chunk-${i}`;

        const metadata = {
          lesson_id: Number(lessonId),
          text: chunks[i],
          source: source
        };

        if (options.materialId) metadata.material_id = Number(options.materialId);
        if (options.fileName) metadata.file_name = String(options.fileName);

        if (pineconeIndex) {
          try {
            await pineconeIndex.upsert([
              {
                id: chunkId,
                values: vector,
                metadata: metadata
              }
            ]);
          } catch (upsertErr) {
            // Thử fallback định dạng object records cho một số version SDK
            if (upsertErr.message && upsertErr.message.includes('Must pass in at least 1 record')) {
              await pineconeIndex.upsert({
                records: [
                  {
                    id: chunkId,
                    values: vector,
                    metadata: metadata
                  }
                ]
              });
            } else {
              throw upsertErr;
            }
          }
        }

        successCount++;
      } catch (chunkErr) {
        console.error(`[RAG Ingestion] ❌ Lỗi ở chunk ${i + 1}/${chunks.length} của lessonId=${lessonId}:`, chunkErr.message);
      }
    }

    console.log(`[RAG Ingestion] ✅ lessonId=${lessonId} [source: ${source}]: Đã nạp thành công ${successCount}/${chunks.length} chunks vào Pinecone Vector DB!`);
  } catch (error) {
    console.error(`[RAG Ingestion] ❌ Lỗi tổng quát khi ingest transcript cho lessonId=${lessonId}:`, error.message);
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
    if (pineconeIndex && typeof pineconeIndex.deleteMany === 'function') {
      await pineconeIndex.deleteMany({
        filter: {
          material_id: { $eq: Number(materialId) }
        }
      });
      console.log(`[RAG Ingestion] ✅ Đã xóa toàn bộ vector của materialId=${materialId} khỏi Pinecone.`);
    }
  } catch (err) {
    console.warn(`[RAG Ingestion] Cảnh báo xóa vector của materialId=${materialId}:`, err.message);
  }
}

module.exports = {
  chunkText,
  ingestLessonTranscript,
  ingestPdfDocument,
  deleteMaterialVectors
};
