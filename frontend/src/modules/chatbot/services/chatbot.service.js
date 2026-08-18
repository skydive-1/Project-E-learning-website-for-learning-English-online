import apiClient from '../../../config/api.config';

/**
 * Gửi câu hỏi của học viên đến API RAG Chatbot của backend
 */
export const askChatbot = async (question, lessonId, scope = 'lesson', currentTime = null, quickAction = null) => {
  try {
    const payload = { question, lessonId, scope };
    if (currentTime !== null && currentTime !== undefined && !isNaN(Number(currentTime))) {
      payload.currentTime = Number(currentTime);
    }
    if (quickAction) {
      payload.quickAction = quickAction;
    }
    const response = await apiClient.post('/chatbot/ask', payload);
    if (response.data && response.data.success) {
      return response.data;
    }
    throw new Error('API response invalid structure');
  } catch (error) {
    if (error.response && (error.response.status === 429 || error.response.status === 403)) {
      throw new Error(error.response.data?.message || "Xin lỗi, bạn đã hết hạn mức sử dụng AI trong ngày hôm nay. Vui lòng quay lại vào ngày mai nhé!");
    }
    console.error('⚠️ Lỗi kết nối tới API Chatbot:', error.message);
    throw error;
  }
};

/**
 * Gửi câu hỏi của học viên đến API RAG Chatbot của backend dạng SSE Stream.
 */
export const askChatbotStream = async (question, lessonId, onChunk, scope = 'lesson', currentTime = null, quickAction = null) => {
  const token = localStorage.getItem('token');
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const baseUrl = envUrl.replace(/\/+$/, '');

  const payload = { question, lessonId, scope };
  if (currentTime !== null && currentTime !== undefined && !isNaN(Number(currentTime))) {
    payload.currentTime = Number(currentTime);
  }
  if (quickAction) {
    payload.quickAction = quickAction;
  }

  const response = await fetch(`${baseUrl}/chatbot/ask-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 429 || response.status === 403) {
      const errJson = await response.json().catch(() => ({}));
      const limitMsg = errJson.message || "Xin lỗi, bạn đã hết hạn mức sử dụng AI trong ngày hôm nay. Vui lòng quay lại vào ngày mai nhé!";
      throw new Error(limitMsg);
    }
    throw new Error(`HTTP Error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let fullText = '';
  let metadata = null;
  let sources = [];
  let actions = [];
  let buffer = '';

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // giữ lại phần chưa hoàn thành

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') {
          done = true;
          break;
        }
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'metadata') {
            metadata = parsed;
          } else if (parsed.type === 'sources') {
            const rawSources = Array.isArray(parsed.sources) ? parsed.sources : [];
            const seenIds = new Set();
            const dedupedSources = [];
            for (const s of rawSources) {
              if (s && s.lessonId && !seenIds.has(s.lessonId)) {
                seenIds.add(s.lessonId);
                dedupedSources.push(s);
              }
            }
            sources = dedupedSources;
            actions = Array.isArray(parsed.actions) ? parsed.actions : [];
          } else if (parsed.type === 'token' || parsed.text) {
            const tokenText = parsed.text || '';
            fullText += tokenText;
            if (onChunk) onChunk(fullText, { sources, actions, metadata });
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) {
            throw e;
          }
        }
      }
    }
  }

  if (fullText) {
    return {
      reply: fullText,
      sources,
      actions,
      metadata
    };
  }
  throw new Error('Empty response from stream');
};

/**
 * Sinh câu hỏi trắc nghiệm tự động từ AI theo bài học
 */
export const generateChatbotQuiz = async (lessonId) => {
  try {
    const response = await apiClient.post('/chatbot/generate-quiz', { lessonId });
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Không thể tạo quiz');
  } catch (error) {
    console.error('⚠️ Lỗi API generateChatbotQuiz:', error.message);
    throw error;
  }
};

/**
 * Lấy lịch sử đoạn chat của học viên
 */
export const getChatHistory = async (userId, lessonId) => {
  try {
    const response = await apiClient.get(`/chatbot/history/${userId}/${lessonId}`);
    return response.data || [];
  } catch (error) {
    console.warn('⚠️ Lỗi tải lịch sử chat:', error.message);
    return [];
  }
};

/**
 * Lưu lịch sử chat của học viên kèm structured sources
 */
export const saveChatHistory = async (userId, lessonId, question, answer, sources = [], actions = []) => {
  try {
    const response = await apiClient.post('/chatbot/history', {
      user_id: userId,
      lesson_id: lessonId,
      question,
      answer,
      sources,
      actions
    });
    return response.data;
  } catch (error) {
    console.warn('⚠️ Lỗi lưu lịch sử chat:', error.message);
    return null;
  }
};

/**
 * Xóa sạch lịch sử trò chuyện AI theo lessonId (hoặc toàn bộ)
 */
export const clearChatHistory = async (lessonId = null) => {
  try {
    const url = (lessonId !== undefined && lessonId !== null)
      ? `/chatbot/history/${lessonId}`
      : '/chatbot/history';
    const response = await apiClient.delete(url);
    return response.data;
  } catch (error) {
    console.error('⚠️ Lỗi xóa lịch sử chat:', error.message);
    throw error;
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
    console.error('⚠️ Lỗi kết nối tới API Chatbot Audio:', error.message);
    const words = targetText ? targetText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/).filter(Boolean).map(w => ({
      word: w,
      correct: false,
      feedback: "Không thể kết nối máy chủ để chấm điểm."
    })) : [];

    return {
      success: false,
      score: 0,
      pronunciation_accuracy: "0%",
      transcription: "Không nhận diện được giọng nói",
      grammarFeedback: "Không thể kết nối tới máy chủ AI để chấm điểm.",
      pronunciationFeedback: "Không thể kết nối tới máy chủ AI để chấm điểm. Vui lòng kiểm tra lại đường truyền mạng.",
      detailed_feedback: "Đã xảy ra lỗi khi kết nối máy chủ AI để chấm điểm bài nói. Vui lòng thử lại sau.",
      reply: "Đã xảy ra lỗi khi kết nối máy chủ AI để chấm điểm bài nói. Vui lòng thử lại sau.",
      suggestion: targetText || "",
      words: words,
      errors: ["Lỗi kết nối máy chủ AI"]
    };
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
    console.warn('⚠️ Lỗi gọi API ví token từ backend:', error.message);
    return null;
  }
};


