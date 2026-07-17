/**
 * AI Clients Wrapper (Pinecone & Gemini)
 * - Tách biệt kết nối hạ tầng AI khỏi Business Service.
 * - Tuân thủ nguyên tắc Single Responsibility.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require("@pinecone-database/pinecone");
const dotenv = require("dotenv");
dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY;
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX;

// Khởi tạo các client AI thực tế bằng API Key từ môi trường
const ai = new GoogleGenerativeAI(geminiApiKey);
const geminiModel = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
const embeddingModel = ai.getGenerativeModel({ model: "gemini-embedding-001" });

const pc = new Pinecone({ apiKey: pineconeApiKey });
const pineconeIndex = pc.index(pineconeIndexName);

const pineconeClient = {
  async search(question, lessonId) {
    console.log(`[Pinecone Client] Đang tìm kiếm vector cho câu hỏi: "${question}" (lessonId: ${lessonId})`);
    try {
      if (!question) {
        return "";
      }

      // 1. Tạo embedding cho câu hỏi
      const embeddingResult = await embeddingModel.embedContent({
        content: { parts: [{ text: question }] },
        outputDimensionality: 768
      });
      const embeddingValues = embeddingResult.embedding?.values;

      if (!embeddingValues) {
        throw new Error("Không thể tạo vector embedding từ câu hỏi.");
      }

      // 2. Thiết lập query options
      const queryOptions = {
        vector: embeddingValues,
        topK: 5,
        includeMetadata: true,
      };

      // Thêm bộ lọc lesson_id nếu được cung cấp
      if (lessonId) {
        queryOptions.filter = {
          lesson_id: { $eq: Number(lessonId) }
        };
      }

      // 3. Thực hiện truy vấn trên Pinecone Index
      const queryResponse = await pineconeIndex.query(queryOptions);

      const matches = queryResponse.matches || [];
      if (matches.length === 0) {
        console.log("[Pinecone Client] Không tìm thấy tài liệu phù hợp trong vector database.");
        return "";
      }

      // 4. Trích xuất text/context từ metadata của các kết quả khớp
      const context = matches
        .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
        .filter(Boolean)
        .join("\n\n");

      return context;
    } catch (error) {
      console.error("[Pinecone Client Error]:", error);
      throw error;
    }
  }
};

const geminiClient = {
  async generateResponse(question, context) {
    console.log(`[Gemini Client] Gửi prompt lên Gemini Model...`);
    try {
      const prompt = `Bạn là một trợ lý giảng dạy tiếng Anh thông minh của hệ thống E-learning. 
Hãy trả lời câu hỏi của học viên dựa trên tài liệu học tập được cung cấp dưới đây. 
Nếu tài liệu học tập không chứa câu trả lời hoặc không liên quan, hãy trả lời một cách chính xác nhất dựa trên kiến thức tiếng Anh của bạn và lưu ý nhỏ với học viên là bạn đang giải thích thêm ngoài tài liệu bài học.

Tài liệu học tập bổ trợ (Context):
${context || "Không tìm thấy tài liệu cụ thể nào liên quan trực tiếp đến bài học này."}

Câu hỏi của học viên:
"${question}"

Hãy trả lời một cách tự nhiên, dễ hiểu, định dạng markdown đẹp mắt:`;

      const result = await geminiModel.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("[Gemini Client Error]:", error);
      throw error;
    }
  }
};

module.exports = {
  geminiModel,
  embeddingModel,
  pc,
  pineconeIndex,
  pineconeClient,
  geminiClient
};
