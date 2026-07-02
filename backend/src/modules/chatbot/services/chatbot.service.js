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

    // 4. Tạo cấu trúc Prompt Engineering gửi cho Gemini (Đã tối ưu hóa tính tự nhiên và loại bỏ thương hiệu LingoMate)
    const systemPrompt = `Bạn là một Trợ lý ảo học tiếng Anh thân thiện và nhiệt tình. Hãy đóng vai một giáo viên hướng dẫn tiếng Anh để trả lời câu hỏi của học viên một cách tự nhiên, sinh động và dễ hiểu.

HƯỚNG DẪN TRẢ LỜI:
- Trả lời một cách trực tiếp, tự nhiên và thân thiện (sử dụng xưng hô như "Chào bạn", "Mình", "Tôi").
- TUYỆT ĐỐI KHÔNG sử dụng các cụm từ máy móc như: "dựa vào ngữ cảnh", "theo tài liệu cung cấp", "không có tài liệu cụ thể nào", "trong ngữ cảnh này", v.v. Học viên không cần biết về hệ thống tài liệu phía sau.
- Nếu NGỮ CẢNH dưới đây có chứa thông tin liên quan đến câu hỏi, hãy ưu tiên sử dụng nó để trả lời.
- Nếu NGỮ CẢNH trống hoặc không liên quan trực tiếp (ví dụ học viên hỏi ngữ pháp chung, chào hỏi, hoặc yêu cầu từ vựng), hãy sử dụng kiến thức tiếng Anh chuẩn của bạn để trả lời học viên một cách chính xác nhất.
- Khi cung cấp từ vựng, hãy kèm theo phiên âm chuẩn (IPA), nghĩa tiếng Việt và ví dụ đặt câu rõ ràng.

NGỮ CẢNH BÀI HỌC (Nếu có):
${contextText || "(Không có tài liệu bổ trợ cụ thể)"}

CÂU HỎI CỦA HỌC VIÊN:
"${question}"`;

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
    try {
      // 1. Lưu câu hỏi của user
      const insertUserQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'user', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const userResult = await db.query(insertUserQuery, [userId, lessonId, question]);

      // 2. Lưu câu trả lời của bot/ai
      const insertBotQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'bot', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const botResult = await db.query(insertBotQuery, [userId, lessonId, answer]);

      return {
        userMessage: userResult.rows[0],
        botMessage: botResult.rows[0]
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.saveHistory:", error);
      throw error;
    }
  }

  async getHistory(userId, lessonId) {
    try {
      // 2. Truy vấn bảng ai_chat và trả về danh sách hội thoại cũ theo thứ tự thời gian tăng dần
      const queryText = `
        SELECT ai_chat, sender_type, title, created_at AS created_date
        FROM ai_chat
        WHERE student_id = $1 AND lesson_id = $2
        ORDER BY created_date ASC
      `;
      const result = await db.query(queryText, [userId, lessonId]);
      
      return result.rows.map(row => ({
        chat_id: row.ai_chat,
        sender: row.sender_type,
        message: row.title,
        created_date: row.created_date
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

