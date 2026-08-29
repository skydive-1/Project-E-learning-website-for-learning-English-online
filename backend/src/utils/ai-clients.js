/**
 * AI Clients Wrapper (Pinecone & Google Gemini API)
 * - Tách biệt kết nối hạ tầng AI khỏi Business Service.
 * - Tuân thủ nguyên tắc Single Responsibility.
 * - Sử dụng Google AI Studio (Gemini Developer API) MIỄN PHÍ 100% (Không cần Billing/Thẻ).
 * 
 * Phụ trách hạ tầng:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { GoogleGenAI } = require("@google/genai");
const { Pinecone } = require("@pinecone-database/pinecone");
const dotenv = require("dotenv");
dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY;
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || "elearning-rag";
const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
const DEFAULT_GEMINI_SPEAKING_MODEL = DEFAULT_GEMINI_MODEL;
const DEFAULT_GEMINI_FALLBACK_MODELS = ["gemini-3.6-flash"];

function getGeminiFallbackModels(preferredModel) {
  const configuredFallbacks = String(process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);
  return [
    preferredModel,
    DEFAULT_GEMINI_MODEL,
    ...configuredFallbacks,
    ...DEFAULT_GEMINI_FALLBACK_MODELS
  ];
}

const isGeminiQuotaError = (error) => {
  const message = String(error?.message || '');
  return error?.status === 429
    || error?.code === 429
    || error?.code === 'RESOURCE_EXHAUSTED'
    || /\b429\b|resource[_ ]exhausted|quota exceeded|rate limit exceeded/i.test(message);
};

const normalizeGeminiError = (error) => {
  if (!isGeminiQuotaError(error)) return error;

  const quotaError = new Error(
    'Gemini 3.7 Flash hiện đã hết hạn mức sử dụng của hệ thống. Vui lòng thử lại sau khi Google tự động đặt lại hạn mức.'
  );
  quotaError.name = 'GeminiQuotaError';
  quotaError.status = 503;
  quotaError.code = 'GEMINI_QUOTA_EXHAUSTED';
  quotaError.cause = error;
  return quotaError;
};

// Khởi tạo Google Gen AI client theo chế độ Gemini Developer API (100% Miễn phí qua Google AI Studio)
let ai = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey
  });
  console.log(`[AI Infrastructure] ✅ Đã kết nối Google Gemini API (Chế độ Miễn phí 100% qua Google AI Studio)`);
} else {
  console.warn(`[AI Infrastructure Warning] ⚠️ Chưa cấu hình GEMINI_API_KEY trong file .env. Vui lòng lấy key miễn phí tại: https://aistudio.google.com/app/apikey`);
}

function getAiClient() {
  if (ai) return ai;
  const currentKey = process.env.GEMINI_API_KEY;
  if (currentKey) {
    ai = new GoogleGenAI({
      apiKey: currentKey
    });
    return ai;
  }
  throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env. Vui lòng lấy key miễn phí từ https://aistudio.google.com/app/apikey và dán vào backend/.env");
}

/**
 * Helper chuẩn hóa tham số đầu vào cho @google/genai
 */
function normalizeRequest(request) {
  let contents;
  let config = {};
  let model;

  if (typeof request === "string") {
    contents = request;
  } else if (typeof request === "object" && request !== null) {
    model = request.model;
    if (request.contents) {
      contents = request.contents;
    } else if (request.prompt) {
      contents = request.prompt;
    } else {
      contents = request;
    }

    const srcConfig = request.generationConfig || request.config || {};
    if (srcConfig.responseMimeType) config.responseMimeType = srcConfig.responseMimeType;
    if (srcConfig.maxOutputTokens !== undefined) config.maxOutputTokens = srcConfig.maxOutputTokens;
  }

  return { contents, config: Object.keys(config).length > 0 ? config : undefined, model };
}

/**
 * Helper gọi generateContent có fallback tự động giữa các model Flash
 */
async function executeGenerate(client, contents, config, modelOverride = null) {
  const preferredModel = modelOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const fallbackModels = getGeminiFallbackModels(preferredModel);
  const triedModels = new Set();
  let lastError = null;

  for (const model of fallbackModels) {
    if (triedModels.has(model)) continue;
    triedModels.add(model);
    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config
      });
      return response;
    } catch (err) {
      lastError = err;
      const errMsg = err.message || "";
      if (
        errMsg.includes("not found") ||
        errMsg.includes("no longer available") ||
        errMsg.includes("503") ||
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("Quota exceeded") ||
        err.status === 404 ||
        err.status === 503 ||
        err.status === 429
      ) {
        continue;
      }
      throw err;
    }
  }
  throw normalizeGeminiError(lastError || new Error("Không thể kết nối đến mô hình Gemini Flash khả dụng."));
}

/**
 * Helper gọi generateContentStream có fallback tự động
 */
async function executeGenerateStream(client, contents, config, modelOverride = null) {
  const preferredModel = modelOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const fallbackModels = getGeminiFallbackModels(preferredModel);
  const triedModels = new Set();
  let lastError = null;

  for (const model of fallbackModels) {
    if (triedModels.has(model)) continue;
    triedModels.add(model);
    try {
      const responseStream = await client.models.generateContentStream({
        model,
        contents,
        config
      });
      return responseStream;
    } catch (err) {
      lastError = err;
      const errMsg = err.message || "";
      if (
        errMsg.includes("not found") ||
        errMsg.includes("no longer available") ||
        errMsg.includes("503") ||
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("Quota exceeded") ||
        err.status === 404 ||
        err.status === 503 ||
        err.status === 429
      ) {
        continue;
      }
      throw err;
    }
  }
  throw normalizeGeminiError(lastError || new Error("Không thể kết nối đến mô hình Gemini Flash Stream khả dụng."));
}

/**
 * Adapter cho mô hình Generative Gemini Flash
 * Cung cấp đầy đủ interface: generateContent, generateContentStream, countTokens
 * Tương thích 100% với toàn bộ 6 file nghiệp vụ gọi Gemini.
 */
const geminiModel = {
  async generateContent(request) {
    const client = getAiClient();
    const { contents, config, model } = normalizeRequest(request);

    try {
      const response = await executeGenerate(client, contents, config, model);
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
      console.error(`[Gemini Model Error] Lỗi khi gọi generateContent:`, error.message);
      throw error;
    }
  },

  async generateContentStream(request) {
    const client = getAiClient();
    const { contents, config, model } = normalizeRequest(request);

    try {
      const responseStream = await executeGenerateStream(client, contents, config, model);

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
      console.error(`[Gemini Model Error] Lỗi khi gọi generateContentStream:`, error.message);
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

    try {
      const client = getAiClient();
      const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
      const response = await client.models.countTokens({
        model: modelName,
        contents
      });

      return {
        totalTokens: response.totalTokens !== undefined ? response.totalTokens : 0
      };
    } catch (error) {
      // Fallback an toàn ước lượng token (1 token ~ 4 ký tự)
      const strLength = typeof contents === "string" ? contents.length : JSON.stringify(contents).length;
      return { totalTokens: Math.max(1, Math.ceil(strLength / 4)) };
    }
  }
};

/**
 * Adapter cho mô hình Embedding Vector (gemini-embedding-001)
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

      // Hỗ trợ cả 2 định dạng response từ SDK (@google/genai: embeddings[0].values hoặc embedding.values)
      const values = response.embeddings?.[0]?.values || response.embedding?.values || [];
      return {
        embedding: {
          values
        }
      };
    } catch (error) {
      console.error(`[Embedding Model Error] Lỗi khi tạo vector từ ${modelName}:`, error.message);
      throw normalizeGeminiError(error);
    }
  }
};

// Khởi tạo Pinecone Client (chỉ khởi tạo khi có PINECONE_API_KEY hợp lệ để tránh lỗi 401 spam console)
let pc = null;
let pineconeIndex = null;

if (pineconeApiKey && pineconeApiKey !== 'dummy-pinecone-key' && pineconeApiKey.trim() !== '') {
  try {
    pc = new Pinecone({ apiKey: pineconeApiKey });
    pineconeIndex = pc.index(pineconeIndexName);
  } catch (err) {
    console.warn(`[Pinecone Init Warning] Không thể kết nối Pinecone Index: ${err.message}`);
  }
}

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

function getSpeakingModelName() {
  return process.env.GEMINI_SPEAKING_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_SPEAKING_MODEL;
}

// Log an toàn khi khởi động (không lộ key)
console.log(`[AI Speaking] Model configured: ${getSpeakingModelName()}`);

const geminiSpeakingModel = {
  async evaluateSpeaking({ contents, responseMimeType = "application/json" }) {
    const client = getAiClient();
    const model = getSpeakingModelName();
    const config = {
      responseMimeType
    };

    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config
      });

      const responseText = response.text || "";
      return {
        text: () => responseText,
        responseText,
        modelUsed: model
      };
    } catch (error) {
      console.error(`[Gemini Speaking Model Error] (${model}):`, error.message);
      // Không âm thầm fallback sang model khác để bảo đảm tính nhất quán của chuẩn chấm điểm
      throw normalizeGeminiError(error);
    }
  }
};

module.exports = {
  ai,
  getAiClient,
  getSpeakingModelName,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_SPEAKING_MODEL,
  isGeminiQuotaError,
  normalizeGeminiError,
  geminiModel,
  geminiSpeakingModel,
  embeddingModel,
  pc,
  pineconeIndex,
  pineconeClient,
  geminiClient
};

