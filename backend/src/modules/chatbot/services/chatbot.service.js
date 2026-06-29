/**
 * Chatbot Service - Thực hiện quy trình nghiệp vụ RAG
 */

const { geminiModel, embeddingModel, pineconeIndex } = require("../../../utils/ai-clients");

/**
 * Xử lý logic RAG Chat: tạo vector embedding, tìm kiếm ngữ cảnh với bộ lọc lesson_id, và sinh câu trả lời bằng Gemini
 */
const handleRagChat = async (userId, lessonId, question) => {
  try {
    if (!question) {
      return { success: false, reply: "Vui lòng nhập câu hỏi." };
    }

    // 1. Tạo vector embedding từ câu hỏi
    const embeddingResult = await embeddingModel.embedContent({
      content: { parts: [{ text: question }] },
      outputDimensionality: 768
    });
    const queryVector = embeddingResult.embedding?.values;

    if (!queryVector) {
      throw new Error("Không thể tạo vector embedding từ câu hỏi.");
    }

    const queryOptions = {
      vector: queryVector,
      topK: 2,
      includeMetadata: true
    };

    const parsedLessonId = Number(lessonId);
    if (lessonId !== undefined && lessonId !== null && !isNaN(parsedLessonId)) {
      queryOptions.filter = { lesson_id: { $eq: parsedLessonId } };
    }

    // 2. Truy vấn Pinecone
    const queryResponse = await pineconeIndex.query(queryOptions);

    // 3. Trích xuất text từ kết quả trả về của Pinecone
    const matches = queryResponse.matches || [];
    let contextText = matches
      .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
      .filter(Boolean)
      .join("\n");

    // 4. Tạo cấu trúc Prompt Engineering gửi cho Gemini
    const systemPrompt = `Bạn là trợ lý ảo học tiếng Anh LingoMate. Dựa vào ngữ cảnh dưới đây để trả lời câu hỏi ngắn gọn.\nNGỮ CẢNH:\n${contextText || "Không có tài liệu cụ thể nào liên quan trực tiếp đến bài học này."}\nCÂU HỎI:\n"${question}"`;
    const result = await geminiModel.generateContent(systemPrompt);

    return { success: true, reply: result.response.text() };
  } catch (error) {
    console.error("Lỗi xảy ra tại handleRagChat:", error);
    throw new Error("Hệ thống AI Assistant đang bận.");
  }
};

const db = require("../../../config/database");

/**
 * Đối tượng service tương thích với các API hiện tại
 */
class ChatbotService {
  async ask(question, lessonId, userId = null) {
    try {
      const result = await handleRagChat(userId, lessonId, question);
      return result.reply;
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.ask:", error);

      const chatbotError = new Error(error.message || "Dịch vụ Chatbot AI tạm thời gặp sự cố");
      chatbotError.name = "ChatbotError";
      chatbotError.status = 503;
      throw chatbotError;
    }
  }

  async saveHistory(userId, lessonId, question, answer) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lưu câu hỏi của học viên (sender = 'user')
      const userInsertQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING ai_chat
      `;
      const userRes = await client.query(userInsertQuery, [userId, lessonId, question, 'user']);

      // 2. Lưu câu trả lời của Bot (sender = 'bot')
      // Thêm 1 mili giây offset để đảm bảo thứ tự chính xác khi sắp xếp theo thời gian
      const botInsertQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 millisecond')
        RETURNING ai_chat
      `;
      const botRes = await client.query(botInsertQuery, [userId, lessonId, answer, 'bot']);

      await client.query('COMMIT');
      return {
        userChatId: userRes.rows[0].ai_chat,
        botChatId: botRes.rows[0].ai_chat
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Lỗi xảy ra tại ChatbotService.saveHistory:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getHistory(userId, lessonId) {
    try {
      const queryText = `
        SELECT ai_chat, sender_type, title, created_at
        FROM ai_chat
        WHERE student_id = $1 AND lesson_id = $2
        ORDER BY created_at ASC, ai_chat ASC
      `;
      const result = await db.query(queryText, [userId, lessonId]);
      
      return result.rows.map(row => ({
        chat_id: row.ai_chat,
        sender: row.sender_type,
        message: row.title
      }));
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.getHistory:", error);
      throw error;
    }
  }
}

const serviceInstance = new ChatbotService();

module.exports = {
  ask: (question, lessonId, userId) => serviceInstance.ask(question, lessonId, userId),
  saveHistory: (userId, lessonId, question, answer) => serviceInstance.saveHistory(userId, lessonId, question, answer),
  getHistory: (userId, lessonId) => serviceInstance.getHistory(userId, lessonId),
  handleRagChat
};

