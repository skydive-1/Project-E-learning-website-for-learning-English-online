/**
 * Chatbot Service - Tích hợp RAG AI (Pinecone & Gemini)
 */

// Đổi chỗ các biến tạm để tránh lỗi ReferenceError khi chưa cấu hình đầy đủ API Key
const pinecone = {
  search: async (question) => {
    console.log(`[Pinecone] Đang tìm kiếm tài liệu cho câu hỏi: "${question}"`);
    return "Đây là tài liệu học tiếng Anh mẫu từ database vector Pinecone.";
  }
};

const gemini = {
  ask: async (question, context) => {
    console.log(`[Gemini] Đang phản hồi câu hỏi dựa trên ngữ cảnh: "${context}"`);
    return `Chào bạn, chatbot RAG đã nhận câu hỏi: "${question}". Đây là phản hồi giả lập dựa trên tài liệu học tập.`;
  }
};

async function askChatbot(question) {
  try {
    // 1. Search vectors từ Pinecone
    const context = await pinecone.search(question);

    // 2. Generate response từ Gemini
    const response = await gemini.ask(question, context);

    return response;
  } catch (error) {
    console.error('Chatbot error:', error);

    // 3. Không throw, return error response
    return {
      error: true,
      message: 'Chatbot hiện tạm thời không khả dụng',
      fallback: 'Vui lòng thử lại sau hoặc liên hệ support'
    };
  }
}

module.exports = {
  askChatbot
};
