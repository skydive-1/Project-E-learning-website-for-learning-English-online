/**
 * AI Clients Wrapper (Pinecone & Google Cloud Vertex AI / Gemini 2.5)
 * - Tách biệt kết nối hạ tầng AI khỏi Business Service.
 * - Tuân thủ nguyên tắc Single Responsibility.
 * - Xác thực bảo mật: Hỗ trợ Google Cloud Vertex AI qua Application Default Credentials (ADC)
 *   hoặc Service Account Key, không hard-code credentials, tương thích Organization Policy.
 * 
 * Phụ trách hạ tầng:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { GoogleGenAI } = require("@google/genai");
const { Pinecone } = require("@pinecone-database/pinecone");
const dotenv = require("dotenv");
dotenv.config();

const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT;
const gcpLocation = process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || "us-central1";
const geminiApiKey = process.env.GEMINI_API_KEY;

const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || "elearning-rag";

// Khởi tạo Google Gen AI client theo chế độ bảo mật:
// Ưu tiên 1: Vertex AI với Application Default Credentials (ADC) / Service Account Key
// Dự phòng 2: API Key (nếu có trong biến môi trường)
let ai = null;
let initError = null;

try {
  if (gcpProject) {
    ai = new GoogleGenAI({
      vertexai: true,
      project: gcpProject,
      location: gcpLocation
    });
    console.log(`[AI Infrastructure] ✅ Đã kết nối Google Cloud Vertex AI (Project: ${gcpProject}, Location: ${gcpLocation}) qua ADC / IAM.`);
  } else if (geminiApiKey) {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey
    });
    console.log(`[AI Infrastructure] ℹ️ Đã khởi tạo Gemini Client qua API Key.`);
  } else {
    // Khởi tạo với placeholder để tránh crash server startup nếu chưa điền project id
    console.warn(`[AI Infrastructure Warning] ⚠️ Chưa cấu hình GOOGLE_CLOUD_PROJECT trong .env. AI Assistant sẽ yêu cầu cấu hình project ID để thực hiện truy vấn.`);
  }
} catch (err) {
  initError = err;
  console.error(`[AI Infrastructure Init Error]:`, err.message);
}

function getAiClient() {
  if (ai) return ai;
  if (gcpProject) {
    ai = new GoogleGenAI({
      vertexai: true,
      project: gcpProject,
      location: gcpLocation
    });
    return ai;
  }
  if (geminiApiKey) {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey
    });
    return ai;
  }
  throw new Error("Chưa thiết lập xác thực Google Cloud. Vui lòng cấu hình GOOGLE_CLOUD_PROJECT trong file .env và đăng nhập ADC qua: 'gcloud auth application-default login'");
}

/**
 * Helper chuẩn hóa tham số đầu vào cho @google/genai
 */
function normalizeRequest(request) {
  let contents;
  let config = {};

  if (typeof request === "string") {
    contents = request;
  } else if (typeof request === "object" && request !== null) {
    if (request.contents) {
      contents = request.contents;
    } else if (request.prompt) {
      contents = request.prompt;
    } else {
      contents = request;
    }

    const srcConfig = request.generationConfig || request.config || {};
    if (srcConfig.responseMimeType) config.responseMimeType = srcConfig.responseMimeType;
    if (srcConfig.temperature !== undefined) config.temperature = srcConfig.temperature;
    if (srcConfig.maxOutputTokens !== undefined) config.maxOutputTokens = srcConfig.maxOutputTokens;
    if (srcConfig.topP !== undefined) config.topP = srcConfig.topP;
    if (srcConfig.topK !== undefined) config.topK = srcConfig.topK;
  }

  return { contents, config: Object.keys(config).length > 0 ? config : undefined };
}

/**
 * Adapter cho mô hình Generative Gemini 2.5 Flash
 * Cung cấp đầy đủ interface: generateContent, generateContentStream, countTokens
 * Tương thích 100% với toàn bộ 6 file nghiệp vụ gọi Gemini.
 */
const geminiModel = {
  async generateContent(request) {
    const client = getAiClient();
    const { contents, config } = normalizeRequest(request);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents,
        config
      });

      const responseText = response.text || "";

      // Trả về cấu trúc tương thích cả SDK mới và cú pháp cũ (result.response.text())
      return {
        text: () => responseText,
        response: {
          text: () => responseText,
          candidates: response.candidates || []
        },
        candidates: response.candidates || []
      };
    } catch (error) {
      console.error(`[Gemini Model Error] Lỗi khi gọi generateContent (${modelName}):`, error.message);
      throw error;
    }
  },

  async generateContentStream(request) {
    const client = getAiClient();
    const { contents, config } = normalizeRequest(request);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    try {
      const responseStream = await client.models.generateContentStream({
        model: modelName,
        contents,
        config
      });

      // Tạo Async Generator bọc các chunk để đảm bảo hàm chunk.text() hoạt động chuẩn xác
      async function* wrapStream() {
        for await (const chunk of responseStream) {
          const chunkText = typeof chunk.text === "function" ? chunk.text() : (chunk.text || "");
          yield {
            text: () => chunkText,
            candidates: chunk.candidates || []
          };
        }
      }

      const streamIterable = wrapStream();

      return {
        stream: streamIterable,
        [Symbol.asyncIterator]() {
          return streamIterable[Symbol.asyncIterator]();
        }
      };
    } catch (error) {
      console.error(`[Gemini Model Error] Lỗi khi gọi generateContentStream (${modelName}):`, error.message);
      throw error;
    }
  },

  async countTokens(request) {
    let contents;
    if (typeof request === "string") {
      contents = request;
    } else if (request && request.contents) {
      contents = request.contents;
    } else {
      contents = request || "";
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    try {
      const client = getAiClient();
      const response = await client.models.countTokens({
        model: modelName,
        contents
      });

      return {
        totalTokens: response.totalTokens !== undefined ? response.totalTokens : 0
      };
    } catch (error) {
      // Fallback an toàn ước lượng token (1 token ~ 4 ký tự) nếu chưa có client
      const strLength = typeof contents === "string" ? contents.length : JSON.stringify(contents).length;
      return { totalTokens: Math.max(1, Math.ceil(strLength / 4)) };
    }
  }
};

/**
 * Adapter cho mô hình Embedding Vector (gemini-embedding-001 / text-embedding-004)
 * Tạo vector 768 chiều khớp với Pinecone Index elearning-rag
 */
const embeddingModel = {
  async embedContent({ content, outputDimensionality = 768 }) {
    const client = getAiClient();
    let textToEmbed = "";
    if (typeof content === "string") {
      textToEmbed = content;
    } else if (content && content.parts && Array.isArray(content.parts) && content.parts.length > 0) {
      textToEmbed = content.parts[0].text || "";
    } else if (typeof content === "object") {
      textToEmbed = JSON.stringify(content);
    }

    const modelName = process.env.EMBEDDING_MODEL || "gemini-embedding-001";

    try {
      const response = await client.models.embedContent({
        model: modelName,
        contents: textToEmbed,
        config: {
          outputDimensionality: outputDimensionality || 768
        }
      });

      const values = response.embedding?.values || [];
      return {
        embedding: {
          values
        }
      };
    } catch (error) {
      console.error(`[Embedding Model Error] Lỗi khi tạo vector từ ${modelName}:`, error.message);
      throw error;
    }
  }
};

// Khởi tạo Pinecone Client
const pc = new Pinecone({ apiKey: pineconeApiKey || "dummy-pinecone-key" });
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

      if (!embeddingValues || embeddingValues.length === 0) {
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
  },
  async generateStreamResponse(prompt) {
    console.log(`[Gemini Client] Gửi content stream prompt lên Gemini Model...`);
    try {
      const result = await geminiModel.generateContentStream(prompt);
      return result.stream;
    } catch (error) {
      console.error("[Gemini Client Stream Error]:", error);
      throw error;
    }
  }
};

module.exports = {
  ai,
  getAiClient,
  geminiModel,
  embeddingModel,
  pc,
  pineconeIndex,
  pineconeClient,
  geminiClient
};
