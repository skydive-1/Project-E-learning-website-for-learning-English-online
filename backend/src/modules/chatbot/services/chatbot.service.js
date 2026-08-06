/**
 * Chatbot Service - Thực hiện quy trình nghiệp vụ RAG
 */

const { geminiModel, embeddingModel, pineconeIndex } = require("../../../utils/ai-clients");
const db = require("../../../config/database");

// Helper lấy ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam (UTC+7)
const getVietnamDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

/**
 * Xử lý logic RAG Chat: tạo vector embedding, tìm kiếm ngữ cảnh với bộ lọc lesson_id, và sinh câu trả lời bằng Gemini
 */
const handleRagChat = async (userId, lessonId, question) => {
  try {
    if (!question) {
      return { success: false, reply: "Vui lòng nhập câu hỏi." };
    }

    // Kiểm tra an toàn (Guardrails) ngăn chặn lạm dụng AI để tìm cách hack hệ thống / gỡ bảo mật
    const checkSafety = question.toLowerCase();
    const toxicKeywords = ['hack', 'bypass', 'bẻ khóa', 'gỡ bảo mật', 'quocanh26012004', 'super admin', 'superadmin', 'cướp quyền', 'lạm quyền', 'user_token_limits', 'tokenlimit', 'reset-token'];
    if (toxicKeywords.some(keyword => checkSafety.includes(keyword))) {
      return {
        success: true,
        reply: "Xin lỗi, tôi là trợ lý học tiếng Anh ảo của E-Learn Academy. Tôi không được phép cung cấp thông tin hoặc hướng dẫn liên quan đến cấu trúc bảo mật hệ thống, cơ sở dữ liệu, mã nguồn, hoặc thay đổi quyền quản trị. Chúng ta hãy quay lại các chủ đề luyện tập tiếng Anh nhé!"
      };
    }

    const isGlobalChat = !lessonId || Number(lessonId) === 0;
    let contextText = "";

    if (isGlobalChat) {
      // 1. Đối với Chatbot toàn cục: Lấy dữ liệu khóa học thật từ DB để AI trả lời đúng trọng tâm thông tin hệ thống
      try {
        const coursesResult = await db.query(`
          SELECT course_name, description 
          FROM courses 
          ORDER BY course_id ASC
        `);
        const coursesList = coursesResult.rows;
        if (coursesList.length > 0) {
          contextText = "Dưới đây là danh sách các khóa học thực tế đang hoạt động trên hệ thống E-Learn Academy:\n" +
            coursesList.map((c, idx) => `${idx + 1}. Khóa học: "${c.course_name}" - Mô tả: ${c.description || "Không có mô tả"}`).join("\n");
        } else {
          contextText = "Hiện tại chưa có khóa học nào được đăng tải trên hệ thống.";
        }
      } catch (dbErr) {
        console.error("Lỗi lấy danh sách khóa học cho chatbot:", dbErr);
        contextText = "Không thể tải danh sách khóa học thực tế từ hệ thống.";
      }
    } else {
      // 2. Đối với AI Assistant trong bài học: Sử dụng RAG Pinecone để lấy ngữ cảnh từ transcript video bài giảng
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
      if (!isNaN(parsedLessonId)) {
        queryOptions.filter = { lesson_id: { $eq: parsedLessonId } };
      }

      const queryResponse = await pineconeIndex.query(queryOptions);

      const matches = queryResponse.matches || [];
      contextText = matches
        .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
        .filter(Boolean)
        .join("\n");
    }

    // 3. Tạo Prompt Engineering gửi cho Gemini (Đã tối ưu hóa tính tự nhiên)
    const systemPrompt = isGlobalChat
      ? `Bạn là Trợ lý ảo học tiếng Anh của E-Learn Academy. E-Learn Academy là một nền tảng học tiếng Anh trực tuyến thông minh với các tính năng chính: Học từ vựng, ngữ pháp, luyện nghe qua video bảo mật, luyện phát âm/nói (Speaking) chấm điểm bằng AI, và làm bài trắc nghiệm (Quiz).
  
HƯỚNG DẪN TRẢ LỜI:
- Hãy trả lời một cách tự nhiên, thân thiện và trực tiếp (sử dụng xưng hô như "Chào bạn", "Mình", "Tôi").
- Nếu học viên hỏi về các khóa học, chương trình học hoặc giới thiệu website, hãy sử dụng NGỮ CẢNH HỆ THỐNG dưới đây để cung cấp thông tin chính xác về các khóa học thực tế đang hoạt động trên trang web. Hãy giới thiệu tự nhiên và hấp dẫn.
- Nếu học viên hỏi các câu hỏi tiếng Anh chung (ví dụ: giải thích ngữ pháp, từ vựng, giao tiếp tự do, dịch thuật), hãy sử dụng kiến thức tiếng Anh chuẩn của bạn để giảng dạy và hỗ trợ họ một cách chuyên nghiệp. Khi cung cấp từ vựng/câu mẫu tiếng Anh, hãy kèm theo phiên âm chuẩn (IPA), nghĩa tiếng Việt và ví dụ đặt câu rõ ràng.
- Tuyệt đối không nhắc đến các cụm từ kỹ thuật như "dựa vào ngữ cảnh cung cấp", "theo tài liệu".

NGỮ CẢNH HỆ THỐNG:
${contextText}

CÂU HỎI CỦA HỌC VIÊN:
"${question}"`
      : `Bạn là một Trợ lý ảo học tiếng Anh thân thiện và nhiệt tình. Hãy đóng vai một giáo viên hướng dẫn tiếng Anh để trả lời câu hỏi của học viên một cách tự nhiên, sinh động và dễ hiểu.

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

/**
 * Xử lý RAG Chat dạng Stream (Trả về async generator / stream chunks từ Gemini)
 */
const handleRagChatStream = async (userId, lessonId, question, onChunk) => {
  try {
    if (!question) {
      if (onChunk) onChunk("Vui lòng nhập câu hỏi.");
      return "Vui lòng nhập câu hỏi.";
    }

    // Kiểm tra an toàn Guardrails
    const checkSafety = question.toLowerCase();
    const toxicKeywords = ['hack', 'bypass', 'bẻ khóa', 'gỡ bảo mật', 'quocanh26012004', 'super admin', 'superadmin', 'cướp quyền', 'lạm quyền', 'user_token_limits', 'tokenlimit', 'reset-token'];
    if (toxicKeywords.some(keyword => checkSafety.includes(keyword))) {
      const safeReply = "Xin lỗi, tôi là trợ lý học tiếng Anh ảo của E-Learn Academy. Tôi không được phép cung cấp thông tin hoặc hướng dẫn liên quan đến cấu trúc bảo mật hệ thống, cơ sở dữ liệu, mã nguồn, hoặc thay đổi quyền quản trị. Chúng ta hãy quay lại các chủ đề luyện tập tiếng Anh nhé!";
      if (onChunk) onChunk(safeReply);
      return safeReply;
    }

    const isGlobalChat = !lessonId || Number(lessonId) === 0;
    let contextText = "";

    if (isGlobalChat) {
      try {
        const coursesResult = await db.query(`
          SELECT course_name, description 
          FROM courses 
          ORDER BY course_id ASC
        `);
        const coursesList = coursesResult.rows;
        if (coursesList.length > 0) {
          contextText = "Dưới đây là danh sách các khóa học thực tế đang hoạt động trên hệ thống E-Learn Academy:\n" +
            coursesList.map((c, idx) => `${idx + 1}. Khóa học: "${c.course_name}" - Mô tả: ${c.description || "Không có mô tả"}`).join("\n");
        } else {
          contextText = "Hiện tại chưa có khóa học nào được đăng tải trên hệ thống.";
        }
      } catch (dbErr) {
        console.error("Lỗi lấy danh sách khóa học cho chatbot:", dbErr);
        contextText = "Không thể tải danh sách khóa học thực tế từ hệ thống.";
      }
    } else {
      const embeddingResult = await embeddingModel.embedContent({
        content: { parts: [{ text: question }] },
        outputDimensionality: 768
      });
      const queryVector = embeddingResult.embedding?.values;

      if (queryVector) {
        const queryOptions = {
          vector: queryVector,
          topK: 2,
          includeMetadata: true
        };

        const parsedLessonId = Number(lessonId);
        if (!isNaN(parsedLessonId)) {
          queryOptions.filter = { lesson_id: { $eq: parsedLessonId } };
        }

        const queryResponse = await pineconeIndex.query(queryOptions);
        const matches = queryResponse.matches || [];
        contextText = matches
          .map(match => match.metadata?.text || match.metadata?.content || match.metadata?.context || "")
          .filter(Boolean)
          .join("\n");
      }
    }

    const systemPrompt = isGlobalChat
      ? `Bạn là Trợ lý ảo học tiếng Anh của E-Learn Academy. E-Learn Academy là một nền tảng học tiếng Anh trực tuyến thông minh với các tính năng chính: Học từ vựng, ngữ pháp, luyện nghe qua video bảo mật, luyện phát âm/nói (Speaking) chấm điểm bằng AI, và làm bài trắc nghiệm (Quiz).
  
HƯỚNG DẪN TRẢ LỜI:
- Hãy trả lời một cách tự nhiên, thân thiện và trực tiếp (sử dụng xưng hô như "Chào bạn", "Mình", "Tôi").
- Nếu học viên hỏi về các khóa học, chương trình học hoặc giới thiệu website, hãy sử dụng NGỮ CẢNH HỆ THỐNG dưới đây để cung cấp thông tin chính xác về các khóa học thực tế đang hoạt động trên trang web. Hãy giới thiệu tự nhiên và hấp dẫn.
- Nếu học viên hỏi các câu hỏi tiếng Anh chung (ví dụ: giải thích ngữ pháp, từ vựng, giao tiếp tự do, dịch thuật), hãy sử dụng kiến thức tiếng Anh chuẩn của bạn để giảng dạy và hỗ trợ họ một cách chuyên nghiệp. Khi cung cấp từ vựng/câu mẫu tiếng Anh, hãy kèm theo phiên âm chuẩn (IPA), nghĩa tiếng Việt và ví dụ đặt câu rõ ràng.
- Tuyệt đối không nhắc đến các cụm từ kỹ thuật như "dựa vào ngữ cảnh cung cấp", "theo tài liệu".

NGỮ CẢNH HỆ THỐNG:
${contextText}

CÂU HỎI CỦA HỌC VIÊN:
"${question}"`
      : `Bạn là một Trợ lý ảo học tiếng Anh thân thiện và nhiệt tình. Hãy đóng vai một giáo viên hướng dẫn tiếng Anh để trả lời câu hỏi của học viên một cách tự nhiên, sinh động và dễ hiểu.

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

    const resultStream = await geminiModel.generateContentStream(systemPrompt);
    let fullText = "";

    for await (const chunk of resultStream.stream) {
      const text = chunk.text();
      fullText += text;
      if (onChunk) {
        onChunk(text);
      }
    }

    return fullText;
  } catch (error) {
    console.error("Lỗi xảy ra tại handleRagChatStream:", error);
    throw new Error("Hệ thống AI Assistant đang bận.");
  }
};

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

  async askStream(question, lessonId, userId, onChunk) {
    try {
      return await handleRagChatStream(userId, lessonId, question, onChunk);
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.askStream:", error);
      throw error;
    }
  }

  async saveHistory(userId, lessonId, question, answer) {
    try {
      const finalLessonId = (lessonId === 0 || lessonId === '0' || lessonId === null || lessonId === undefined || lessonId === 'null') ? null : lessonId;

      // 1. Lưu câu hỏi của user
      const insertUserQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'user', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const userResult = await db.query(insertUserQuery, [userId, finalLessonId, question]);

      // 2. Lưu câu trả lời của bot/ai
      const insertBotQuery = `
        INSERT INTO ai_chat (student_id, lesson_id, title, sender_type, created_at)
        VALUES ($1, $2, $3, 'bot', NOW())
        RETURNING ai_chat, student_id, lesson_id, title, sender_type, created_at AS created_date
      `;
      const botResult = await db.query(insertBotQuery, [userId, finalLessonId, answer]);

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
      const hasLesson = lessonId && lessonId !== 'null' && lessonId !== 'undefined' && Number(lessonId) !== 0;

      // Tự động dọn dẹp các bản ghi cũ trước 00:00 giờ Việt Nam (UTC+7)
      try {
        await db.query(`
          DELETE FROM ai_chat 
          WHERE created_at < (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AT TIME ZONE 'Asia/Ho_Chi_Minh'
        `);
      } catch (cleanErr) {
        console.warn('⚠️ Cảnh báo dọn dẹp tin nhắn AI cũ:', cleanErr.message);
      }

      const queryText = hasLesson
        ? `
          SELECT ai_chat, sender_type, title, created_at AS created_date
          FROM ai_chat
          WHERE student_id = $1 
            AND lesson_id = $2 
            AND created_at >= (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AT TIME ZONE 'Asia/Ho_Chi_Minh'
          ORDER BY created_date ASC
        `
        : `
          SELECT ai_chat, sender_type, title, created_at AS created_date
          FROM ai_chat
          WHERE student_id = $1 
            AND lesson_id IS NULL 
            AND created_at >= (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AT TIME ZONE 'Asia/Ho_Chi_Minh'
          ORDER BY created_date ASC
        `;

      const params = hasLesson ? [userId, lessonId] : [userId];
      const result = await db.query(queryText, params);

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

  async clearHistory(userId) {
    try {
      await db.query('DELETE FROM ai_chat WHERE student_id = $1', [userId]);
      return { success: true, message: 'Đã xóa toàn bộ lịch sử trò chuyện AI' };
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.clearHistory:", error);
      throw error;
    }
  }

  async evaluateAudio(filePathOrBuffer, mimetype, targetText = null, isQA = false) {
    try {
      let audioBase64;
      if (Buffer.isBuffer(filePathOrBuffer)) {
        audioBase64 = filePathOrBuffer.toString("base64");
      } else if (typeof filePathOrBuffer === 'string') {
        const fs = require('fs');
        const audioData = fs.readFileSync(filePathOrBuffer);
        audioBase64 = audioData.toString("base64");
      } else {
        throw new Error("Dữ liệu âm thanh không hợp lệ.");
      }

      const prompt = `You are a professional English language and pronunciation tutor.
Analyze the user's spoken audio.
${targetText ? `The user was trying to read the following target sentence: "${targetText}". Compare their pronunciation against it.` : ''}
${isQA ? `The user was responding to a conversational English practice prompt. Evaluate their response for grammar, vocabulary, pronunciation, and flow.` : ''}

Format the response as a JSON object containing EXACTLY these keys:
1. "score": (number) An overall score from 0 to 100 based on their pronunciation, rhythm, grammar, and coherence.
2. "pronunciation_accuracy": (string) An accuracy percentage of their pronunciation (e.g., "85%").
3. "detailed_feedback": (string) Constructive, encouraging feedback in friendly Vietnamese pointing out any errors or areas of improvement.
4. "improved_sentence": (string) A corrected, natural, native-like English alternative or transcription of what they said.
${targetText ? `5. "words": (array) A word-by-word evaluation of the target sentence. An array of objects, where each object has:
   - "word": (string) the word from the target text.
   - "correct": (boolean) whether it was pronounced correctly.
   - "feedback": (string or null) brief feedback on how to improve if pronounced incorrectly.` : ''}

Ensure the response contains ONLY the valid JSON object, without any markdown formatting or backticks.`;

      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: audioBase64,
                  mimeType: mimetype || "audio/mp3"
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      let responseText = result.response.text();
      // Clean up markdown block if present
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsed = JSON.parse(responseText);

      // Fallback for words array if targetText is present but words is missing
      if (targetText && (!parsed.words || !Array.isArray(parsed.words))) {
        parsed.words = targetText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/).filter(Boolean).map(w => ({
          word: w,
          correct: parsed.score >= 50,
          feedback: parsed.score >= 50 ? null : "Cần phát âm rõ ràng hơn."
        }));
      }

      // Map to frontend compatibility keys
      return {
        success: true,
        // Required keys
        score: parsed.score !== undefined ? Number(parsed.score) : 0,
        pronunciation_accuracy: parsed.pronunciation_accuracy || "0%",
        detailed_feedback: parsed.detailed_feedback || "",
        improved_sentence: parsed.improved_sentence || "",

        // Mapped keys for frontend compatibility
        feedback: parsed.detailed_feedback || "",
        reply: parsed.detailed_feedback || "",
        suggestedText: parsed.improved_sentence || "",
        suggestion: parsed.improved_sentence || "",
        errors: parsed.score < 70 ? [parsed.detailed_feedback] : [],
        transcription: parsed.improved_sentence || "",
        grammarFeedback: parsed.detailed_feedback || "",
        pronunciationFeedback: parsed.detailed_feedback || "",
        words: parsed.words || []
      };
    } catch (error) {
      console.error("Lỗi xảy ra tại ChatbotService.evaluateAudio:", error);
      throw new Error("Lỗi hệ thống khi AI xử lý nhận diện và đánh giá âm thanh: " + error.message);
    }
  }
  async getTokenBalance(userId) {
    try {
      // 1. Lấy role của user
      const userRes = await db.query('SELECT role_id FROM users WHERE user_id = $1', [userId]);
      if (userRes.rows.length === 0) {
        throw new Error('Người dùng không tồn tại');
      }

      const roleId = userRes.rows[0].role_id;
      let limit = 6000; // Học viên
      if (roleId === 1) limit = 999999999; // Admin
      else if (roleId === 2) limit = 7000; // Giảng viên

      const today = getVietnamDateString();

      // 2. Lấy thông tin ví token từ bảng user_token_limits
      const usageRes = await db.query(
        'SELECT max_tokens, used_tokens, remaining_tokens, reset_date FROM user_token_limits WHERE user_id = $1',
        [userId]
      );

      let tokens_used = 0;
      let tokens_remaining = limit;

      if (usageRes.rows.length > 0) {
        const record = usageRes.rows[0];
        const recordResetDate = record.reset_date ? new Date(record.reset_date).toISOString().split('T')[0] : '';

        if (recordResetDate !== today) {
          // Ngày mới: tự động reset hiển thị về 0/đầy
          tokens_used = 0;
          tokens_remaining = limit;
        } else {
          tokens_used = record.used_tokens;
          limit = record.max_tokens;
          tokens_remaining = record.remaining_tokens !== null && record.remaining_tokens !== undefined
            ? record.remaining_tokens
            : Math.max(0, limit - tokens_used);
        }
      }

      return {
        tokens_used,
        token_max_limit: limit,
        tokens_remaining
      };
    } catch (error) {
      console.error('Lỗi tại ChatbotService.getTokenBalance:', error);
      throw error;
    }
  }
}

const serviceInstance = new ChatbotService();

module.exports = {
  ask: (question, lessonId, userId) => serviceInstance.ask(question, lessonId, userId),
  askStream: (question, lessonId, userId, onChunk) => serviceInstance.askStream(question, lessonId, userId, onChunk),
  saveHistory: (userId, lessonId, question, answer) => serviceInstance.saveHistory(userId, lessonId, question, answer),
  getHistory: (userId, lessonId) => serviceInstance.getHistory(userId, lessonId),
  clearHistory: (userId) => serviceInstance.clearHistory(userId),
  evaluateAudio: (filePath, mimetype, targetText, isQA) => serviceInstance.evaluateAudio(filePath, mimetype, targetText, isQA),
  getTokenBalance: (userId) => serviceInstance.getTokenBalance(userId),
  handleRagChat
};

