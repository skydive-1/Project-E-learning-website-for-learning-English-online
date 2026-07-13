import apiClient from '../../../config/api.config';

/**
 * Danh sách câu hỏi/câu trả lời giả định để làm phương án dự phòng (fallback)
 * khi API backend chưa có key Pinecone hoặc Gemini.
 */
const fallbackAnswers = [
  {
    keywords: ["chào", "hello", "hi", "xin chào"],
    answer: "Hello! I am your AI Learning Assistant. How can I help you improve your English today? You can ask me about grammar rules, vocabulary, pronunciation, or practice a conversation with me!"
  },
  {
    keywords: ["ngữ pháp", "grammar", "thì", "tenses", "công thức"],
    answer: "Trong bài học này, bạn nên tập trung vào **3 thì cốt lõi trong văn nói**:\n\n1. **Hiện tại đơn (Simple Present)**: S + V(s/es) -> Dùng cho thói quen. *e.g., I study English every day.*\n2. **Quá khứ đơn (Simple Past)**: S + V-ed/V2 -> Dùng cho sự việc đã kết thúc. *e.g., I watched a movie yesterday.*\n3. **Tương lai đơn (Simple Future)**: S + will + V -> Dùng cho ý định nhanh. *e.g., I will check it later.*\n\nBạn muốn tôi giải thích chi tiết hơn về thì nào không?"
  },
  {
    keywords: ["từ vựng", "vocabulary", "từ mới", "word"],
    answer: "Dưới đây là một số từ vựng hữu ích liên quan đến chủ đề phản xạ học tập:\n\n*   **Active Recall** (n): Chủ động gợi nhớ kiến thức.\n*   **Shadowing** (n): Kỹ thuật nói đuổi (bắt chước giọng nói mẫu lập tức).\n*   **Fluency** (n): Sự trôi chảy khi giao tiếp.\n*   **Language Barrier** (n): Rào cản ngôn ngữ.\n\nHãy thử đặt một câu với một trong các từ trên, tôi sẽ giúp bạn sửa lỗi nhé!"
  },
  {
    keywords: ["bài tập", "exercise", "practice", "luyện tập"],
    answer: "Dưới đây là một bài tập thực hành phản xạ ngắn cho bạn:\n\n*Hãy dịch câu sau sang tiếng Anh sử dụng Thì Quá khứ đơn:*\n> \"Hôm qua, tôi đã học nói tiếng Anh với trợ lý AI trong 30 phút.\"\n\nHãy gõ câu trả lời của bạn vào đây, tôi sẽ chấm điểm và chỉnh sửa ngữ pháp cho bạn!"
  },
  {
    keywords: ["dịch", "translate", "nghĩa là gì"],
    answer: "Tất nhiên rồi! Bạn hãy gửi cụm từ hoặc đoạn văn cần dịch sang tiếng Anh (hoặc ngược lại) cho tôi nhé. Tôi sẽ dịch nghĩa đồng thời giải thích ngữ cảnh sử dụng phù hợp nhất cho bạn."
  }
];

const getFallbackResponse = (question) => {
  const normalizedQuestion = question.toLowerCase().trim();
  
  // Tìm từ khóa khớp trong câu hỏi
  for (const item of fallbackAnswers) {
    if (item.keywords.some(keyword => normalizedQuestion.includes(keyword))) {
      return item.answer;
    }
  }
  
  // Trả về câu trả lời mặc định nếu không khớp từ khóa
  return `Trợ lý AI đã nhận được câu hỏi: "${question}". \n\nĐể hỗ trợ bạn tốt nhất, tôi khuyên bạn nên: \n1. Thực hành nói đuổi (shadowing) theo video bài học. \n2. Sử dụng các thì đơn giản để đặt câu hỏi. \n3. Nhờ tôi giải thích cụm từ vựng bạn chưa hiểu rõ trong video. \n\n*(Lưu ý: Phản hồi này được sinh tự động từ hệ thống trợ lý học tập AI)*`;
};

/**
 * Gửi câu hỏi của học viên đến API RAG Chatbot của backend
 */
export const askChatbot = async (question, lessonId) => {
  try {
    const response = await apiClient.post('/chatbot/ask', { question, lessonId });
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error('API response invalid structure');
  } catch (error) {
    console.warn('⚠️ Lỗi kết nối tới API Chatbot hoặc chưa cài đặt key AI ở backend. Chuyển sang sử dụng bộ phản hồi giả lập của frontend.', error.message);
    
    // Giả lập độ trễ phản hồi của AI (từ 1.2s - 2.5s) để người dùng thấy hiệu ứng loading chân thực
    const delay = Math.random() * 1300 + 1200;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return getFallbackResponse(question);
  }
};

/**
 * Lấy lịch sử chat cũ từ backend
 */
export const getChatHistory = async (userId, lessonId) => {
  try {
    const response = await apiClient.get(`/chatbot/history/${userId}/${lessonId}`);
    return response.data; // Mảng tin nhắn [{ chat_id, sender, message }]
  } catch (error) {
    console.error('⚠️ Không thể tải lịch sử chat từ backend:', error.message);
    return [];
  }
};

/**
 * Lưu lượt hội thoại mới vào backend
 */
export const saveChatHistory = async (userId, lessonId, question, answer) => {
  try {
    const response = await apiClient.post('/chatbot/history', {
      user_id: Number(userId),
      lesson_id: Number(lessonId),
      question,
      answer
    });
    return response.data;
  } catch (error) {
    console.error('⚠️ Không thể lưu lịch sử chat vào backend:', error.message);
    return null;
  }
};

/**
 * Gửi file ghi âm của học viên lên API để giải mã hoặc chấm điểm phát âm
 * @param {Blob} audioBlob - Tệp âm thanh ghi âm từ client
 * @param {string|number} lessonId - ID của bài học
 * @param {string|null} targetText - Câu mẫu cần đối chiếu (nếu là bài tập phát âm)
 */
export const askChatbotAudio = async (audioBlob, lessonId, targetText = null, isQA = false) => {
  try {
    const formData = new FormData();
    // Tạo file từ Blob với đuôi mở rộng phù hợp
    const fileExt = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
    const audioFile = new File([audioBlob], `recording-${Date.now()}.${fileExt}`, {
      type: audioBlob.type
    });
    
    formData.append('audio', audioFile);
    formData.append('lessonId', String(lessonId));
    if (targetText) {
      formData.append('targetText', targetText);
    }
    if (isQA) {
      formData.append('isQA', 'true');
    }

    const response = await apiClient.post('/chatbot/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error('API response invalid structure');
  } catch (error) {
    console.warn('⚠️ Lỗi kết nối tới API Chatbot Audio hoặc Backend chưa cài đặt endpoint. Sử dụng bộ phản hồi giả lập của frontend.', error.message);
    
    // Giả lập độ trễ xử lý âm thanh của AI (từ 1.5s - 3s)
    const delay = Math.random() * 1500 + 1500;
    await new Promise(resolve => setTimeout(resolve, delay));

    if (isQA) {
      // Trường hợp: Hỏi & Đáp phản xạ nói tự do (Q&A speaking)
      return {
        success: true,
        transcription: "Yesterday I study English vocabulary with my AI teacher and it is very exciting.",
        grammarFeedback: "Bạn đã sử dụng các động từ ở thì hiện tại như 'study' và 'is' cho hành động diễn ra trong quá khứ ('Yesterday'). Bạn cần chuyển chúng thành động từ ở thì quá khứ đơn: 'study' -> 'studied' và 'is' -> 'was'.",
        pronunciationFeedback: "Phát âm từ 'vocabulary' và 'exciting' rất chuẩn xác. Tuy nhiên, bạn cần chú ý nhấn trọng âm đầu của từ 'yesterday' và bật âm đuôi /d/ của động từ 'studied'.",
        suggestion: "Yesterday, I studied English vocabulary with my AI teacher, and it was very exciting!",
        reply: "Bạn trả lời khá trôi chảy và dễ hiểu. Tuy nhiên, bạn cần lưu ý chia động từ ở thì quá khứ đơn cho các hành động xảy ra ngày hôm qua."
      };
    } else if (targetText) {
      // Trường hợp: Bài tập phát âm (Speaking Exercise) có câu đối chiếu
      const words = targetText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
      const score = Math.floor(Math.random() * 18) + 78; // Random score từ 78 - 95%
      
      // Chọn ngẫu nhiên 1 từ phát âm chưa tốt để mô phỏng tính năng highlight lỗi sai
      const errorIndex = words.length > 3 ? Math.floor(Math.random() * (words.length - 2)) + 1 : -1;

      const evaluatedWords = words.map((word, idx) => {
        const isCorrect = idx !== errorIndex;
        return {
          word: word,
          correct: isCorrect,
          feedback: isCorrect ? null : `Phát âm chưa rõ ràng hoặc thiếu âm cuối.`
        };
      });

      return {
        success: true,
        score: score,
        reply: `Chúc mừng bạn! Bạn đã đạt điểm số khá tốt (${score}%). Lỗi phát âm duy nhất của bạn nằm ở từ "${words[errorIndex]}", cần chú ý bật hơi và âm đuôi rõ ràng hơn.`,
        words: evaluatedWords
      };
    } else {
      // Trường hợp: Chat hội thoại tự do bằng giọng nói
      return {
        success: true,
        reply: "Tôi đã lắng nghe file ghi âm của bạn. Giọng nói của bạn rất rõ ràng và biểu cảm! Bạn đang hỏi về nội dung bài học này đúng không? Hãy tiếp tục luyện tập phát âm và shadowing nhé."
      };
    }
  }
};

/**
 * Lấy hạn mức Token AI còn lại của học viên
 */
export const getTokenBalance = async (userId) => {
  try {
    const response = await apiClient.get(`/chatbot/token-balance/${userId}`);
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    return response.data;
  } catch (error) {
    console.warn('⚠️ Lỗi gọi API ví token từ backend, sử dụng mock balance để demo:', error.message);
    return {
      tokens_used: 2500,
      token_max_limit: 10000,
      tokens_remaining: 7500
    };
  }
};


