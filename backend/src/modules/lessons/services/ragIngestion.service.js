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
 * @param {Array<{en: string, vi?: string, start?: number, end?: number}>} cues Danh sách phụ đề
 */
async function ingestLessonTranscript(lessonId, cues) {
  try {
    if (!cues || !Array.isArray(cues) || cues.length === 0) {
      console.log(`[RAG Ingestion] lessonId=${lessonId}: Không có cues phụ đề hợp lệ để ingest.`);
      return;
    }

    const fullText = cues.map(c => c.en).filter(Boolean).join(' ');
    if (!fullText.trim()) {
      console.log(`[RAG Ingestion] lessonId=${lessonId}: Transcript tiếng Anh rỗng, bỏ qua.`);
      return;
    }

    const chunks = chunkText(fullText);
    console.log(`[RAG Ingestion] lessonId=${lessonId}: Phân tách thành ${chunks.length} chunks (tổng độ dài ${fullText.length} ký tự).`);

    // 1. Xóa các vector cũ của bài học này để tránh dư thừa khi sinh/sửa lại phụ đề
    try {
      if (pineconeIndex && typeof pineconeIndex.deleteMany === 'function') {
        await pineconeIndex.deleteMany({
          filter: {
            lesson_id: { $eq: Number(lessonId) },
            source: { $eq: 'auto-subtitle-transcript' }
          }
        });
        console.log(`[RAG Ingestion] lessonId=${lessonId}: Đã xóa vector cũ thuộc nguồn 'auto-subtitle-transcript'.`);
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

        if (pineconeIndex) {
          try {
            await pineconeIndex.upsert([
              {
                id: `lesson-${lessonId}-chunk-${i}`,
                values: vector,
                metadata: {
                  lesson_id: Number(lessonId),
                  text: chunks[i],
                  source: 'auto-subtitle-transcript'
                }
              }
            ]);
          } catch (upsertErr) {
            // Thử fallback định dạng object records cho một số version SDK
            if (upsertErr.message && upsertErr.message.includes('Must pass in at least 1 record')) {
              await pineconeIndex.upsert({
                records: [
                  {
                    id: `lesson-${lessonId}-chunk-${i}`,
                    values: vector,
                    metadata: {
                      lesson_id: Number(lessonId),
                      text: chunks[i],
                      source: 'auto-subtitle-transcript'
                    }
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

    console.log(`[RAG Ingestion] ✅ lessonId=${lessonId}: Đã nạp thành công ${successCount}/${chunks.length} chunks vào Pinecone Vector DB!`);
  } catch (error) {
    console.error(`[RAG Ingestion] ❌ Lỗi tổng quát khi ingest transcript cho lessonId=${lessonId}:`, error.message);
    // Lưu ý: Không throw lỗi ra ngoài để tránh làm hỏng luồng lưu trữ phụ đề chính
  }
}

module.exports = {
  chunkText,
  ingestLessonTranscript
};
