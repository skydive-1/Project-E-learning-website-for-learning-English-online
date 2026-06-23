
/**
 * AI Clients Wrapper (Pinecone & Gemini)
 * - Tách biệt kết nối hạ tầng AI khỏi Business Service.
 * - Tuân thủ nguyên tắc Single Responsibility.
 */

const pineconeClient = {
  async search(question, lessonId) {
    // TODO: Tích hợp Pinecone Client thực tế bằng API Key
    console.log(`[Pinecone Client] Đang tìm kiếm vector cho câu hỏi: "${question}" (lessonId: ${lessonId})`);

    // Giả lập trả về context
    return "Đây là tài liệu học tiếng Anh mẫu từ database vector Pinecone.";
  }
};

const geminiClient = {
  async generateResponse(question, context) {
    // TODO: Tích hợp @google/generative-ai thực tế
    console.log(`[Gemini Client] Gửi prompt lên Gemini Model...`);

    // Giả lập sinh phản hồi
    return `Chào bạn, chatbot RAG đã nhận câu hỏi: "${question}". Đây là phản hồi giả lập dựa trên tài liệu học tập.`;
  }
};

module.exports = {
  pineconeClient,
  geminiClient
};
