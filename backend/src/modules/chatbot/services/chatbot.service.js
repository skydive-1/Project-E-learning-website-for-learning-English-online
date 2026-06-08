/**
 * Chatbot Service - Thực hiện quy trình nghiệp vụ RAG
 */

const { pineconeClient, geminiClient } = require('../../../utils/ai-clients');

class ChatbotService {
  async ask(question) {
    try {
      // 1. Tìm kiếm tài liệu liên quan từ Pinecone
      const context = await pineconeClient.search(question);

      // 2. Sinh câu trả lời từ Gemini
      const response = await geminiClient.generateResponse(question, context);

      return response;
    } catch (error) {
      console.error('Lỗi xảy ra tại ChatbotService:', error);
      
      // Không nuốt lỗi trả về 200, ném lỗi ra ngoài để Global Error Handler bắt được
      const chatbotError = new Error('Dịch vụ Chatbot AI tạm thời gặp sự cố');
      chatbotError.name = 'ChatbotError';
      chatbotError.status = 503;
      throw chatbotError;
    }
  }
}

module.exports = new ChatbotService();
