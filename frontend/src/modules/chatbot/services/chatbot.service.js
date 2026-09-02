import apiClient from '../../../config/api.config';

export const createChatbotApiError = (message, options = {}) => {
  const error = new Error(message || 'Dịch vụ AI hiện không thể xử lý yêu cầu.');
  error.name = 'ChatbotApiError';
  error.code = options.code || 'CHATBOT_API_ERROR';
  error.status = options.status || null;
  error.quota = options.quota || null;
  return error;
};

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
    if (error.response) {
      throw createChatbotApiError(
        error.response.data?.message || 'Dịch vụ AI hiện không thể xử lý yêu cầu.',
        {
          code: error.response.data?.code,
          status: error.response.status,
          quota: error.response.data?.quota
        }
      );
    }
    console.error('⚠️ Lỗi kết nối tới API Chatbot:', error.message);
    throw error;
  }
};
export const CHATBOT_STREAM_PACING = Object.freeze({
  minimumThinkingMs: 550,
  frameMs: 16,
  normalCharactersPerSecond: 52,
  mediumCharactersPerSecond: 68,
  maximumCharactersPerSecond: 84,
  mediumBacklog: 180,
  largeBacklog: 700,
  maximumCharactersPerFrame: 2
});

export const getChatbotStreamRate = (remainingCharacters) => {
  if (remainingCharacters > CHATBOT_STREAM_PACING.largeBacklog) {
    return CHATBOT_STREAM_PACING.maximumCharactersPerSecond;
  }
  if (remainingCharacters > CHATBOT_STREAM_PACING.mediumBacklog) {
    return CHATBOT_STREAM_PACING.mediumCharactersPerSecond;
  }
  return CHATBOT_STREAM_PACING.normalCharactersPerSecond;
};

/**
 * Gửi câu hỏi đến API RAG dạng SSE, nhận dữ liệu mạng ở tốc độ tối đa nhưng
 * hiển thị qua một hàng đợi có giới hạn rõ ràng. Câu trả lời dài chỉ tăng tốc
 * trong một biên độ nhỏ, không còn nhảy hàng chục ký tự trong một khung hình.
 */
export const askChatbotStream = async (
  question,
  lessonId,
  onChunk,
  scope = 'lesson',
  currentTime = null,
  quickAction = null,
  options = {}
) => {
  const requestStartedAt = Date.now();
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
    body: JSON.stringify(payload),
    signal: options.signal
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw createChatbotApiError(
      errJson.message || `Dịch vụ AI phản hồi lỗi HTTP ${response.status}.`,
      {
        code: errJson.code,
        status: response.status,
        quota: errJson.quota
      }
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  // --- Client-Side Buffer Queue & Display Ticker State ---
  let rawFullText = '';       // Toàn bộ text đã nhận được từ server
  let displayedText = '';     // Text đã hiển thị ra UI
  let metadata = null;
  let sources = [];
  let actions = [];
  let isNetworkDone = false;  // Server đã gửi xong ([DONE] hoặc stream closed)
  let networkError = null;    // Lỗi xảy ra trong quá trình đọc stream (nếu có)
  let displayTimerId = null;
  let charactersBudget = 0;
  let lastFrameAt = Date.now();
  let isSettled = false;
  let abortHandler = null;

  // Trả về Promise hoàn tất khi toàn bộ dữ liệu đã được hiển thị hết ra UI
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (displayTimerId !== null) {
        clearTimeout(displayTimerId);
        displayTimerId = null;
      }
      if (options.signal && abortHandler) {
        options.signal.removeEventListener('abort', abortHandler);
        abortHandler = null;
      }
    };

    const finishWithError = (error) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(error);
    };

    const finishSuccessfully = () => {
      if (isSettled) return;
      isSettled = true;
      cleanup();

      if (onChunk) {
        onChunk(displayedText, {
          sources,
          actions,
          metadata,
          isTyping: false,
          isComplete: true
        });
      }

      resolve({
        reply: displayedText,
        sources,
        actions,
        metadata
      });
    };

    // Hỗ trợ AbortSignal hủy luồng stream & ticker khi component unmount hoặc gửi câu hỏi mới
    if (options.signal) {
      if (options.signal.aborted) {
        cleanup();
        try { reader.cancel(); } catch (_) {}
        return finishWithError(new DOMException('Aborted', 'AbortError'));
      }
      abortHandler = () => {
        try { reader.cancel(); } catch (_) {}
        finishWithError(new DOMException('Aborted', 'AbortError'));
      };
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    // DISPLAY LOOP: nhịp 16 ms, có ngân sách ký tự theo thời gian và trần 2 ký tự/frame.
    // Bộ đệm mạng lớn không thể gây ra một lần render hàng chục ký tự nữa.
    const runDisplayFrame = () => {
      if (isSettled) return;

      if (networkError && displayedText.length === 0) {
        finishWithError(networkError);
        return;
      }

      const now = Date.now();
      const revealAfter = requestStartedAt + CHATBOT_STREAM_PACING.minimumThinkingMs;
      const remainingChars = rawFullText.length - displayedText.length;

      if (now < revealAfter) {
        // Không cộng dồn ngân sách trong thời gian suy nghĩ để tránh xả chữ ở frame đầu.
        lastFrameAt = now;
      } else if (remainingChars > 0) {
        const elapsedMs = Math.max(0, Math.min(now - lastFrameAt, 100));
        const charactersPerSecond = getChatbotStreamRate(remainingChars);
        charactersBudget += (elapsedMs / 1000) * charactersPerSecond;

        const step = Math.min(
          Math.floor(charactersBudget),
          CHATBOT_STREAM_PACING.maximumCharactersPerFrame,
          remainingChars
        );

        if (step > 0) {
          charactersBudget -= step;
          displayedText = rawFullText.slice(0, displayedText.length + step);

          if (onChunk) {
            onChunk(displayedText, {
              sources,
              actions,
              metadata,
              isTyping: true,
              isComplete: false
            });
          }
        }
        lastFrameAt = now;
      } else {
        lastFrameAt = now;
      }

      if (isNetworkDone && displayedText.length >= rawFullText.length) {
        if (networkError) {
          finishWithError(networkError);
          return;
        }

        if (!displayedText && !rawFullText) {
          finishWithError(new Error('Empty response from stream'));
          return;
        }

        finishSuccessfully();
        return;
      }

      displayTimerId = setTimeout(runDisplayFrame, CHATBOT_STREAM_PACING.frameMs);
    };

    displayTimerId = setTimeout(runDisplayFrame, CHATBOT_STREAM_PACING.frameMs);

    // 2. NETWORK READER LOOP (Đọc dữ liệu từ Server ở tốc độ mạng tối đa không bị chặn)
    (async () => {
      let buffer = '';
      try {
        while (!isNetworkDone) {
          const { value, done: doneReading } = await reader.read();
          if (doneReading) {
            isNetworkDone = true;
            break;
          }

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Giữ lại phần dòng chưa hoàn chỉnh

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.replace(/^data:\s*/, '');
              if (dataStr === '[DONE]') {
                isNetworkDone = true;
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
                } else if (parsed.type === 'quiz' && parsed.quizData) {
                  // Sự kiện Quick Quiz: gửi thẳng lên callback UI
                  if (onChunk) {
                    onChunk('', {
                      type: 'quiz',
                      quizData: parsed.quizData,
                      title: parsed.title,
                      sources,
                      actions,
                      metadata
                    });
                  }
                } else if (parsed.type === 'token' || parsed.text) {
                  const tokenText = parsed.text || '';
                  rawFullText += tokenText;
                  // Đẩy vào rawFullText, KHÔNG gọi onChunk ngay lập tức ở đây
                  // Display Ticker Loop sẽ nhả mượt từng chữ!
                } else if (parsed.error) {
                  throw createChatbotApiError(parsed.error, {
                    code: parsed.code,
                    status: parsed.status,
                    quota: parsed.quota
                  });
                }
              } catch (e) {
                if (e.message && !e.message.includes('JSON')) {
                  throw e;
                }
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          networkError = err;
        }
        isNetworkDone = true;
      }
    })();
  });
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
    if (error.response) {
      throw createChatbotApiError(
        error.response.data?.message || 'Không thể tạo bài tập trắc nghiệm lúc này.',
        {
          code: error.response.data?.code,
          status: error.response.status,
          quota: error.response.data?.quota
        }
      );
    }
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
    throw error;
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
    throw error;
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
/**
 * Gửi Audio lên Backend để nhận diện / đánh giá phát âm
 * Hỗ trợ 2 kiểu gọi:
 * 1. (Mới - Speaking V2): askChatbotAudio({ audioBlob, lessonId, mode, targetText, questionText, questionId })
 * 2. (Legacy - ChatBox & cũ): askChatbotAudio(audioBlob, lessonId, targetText, isQA)
 */
export const askChatbotAudio = async (arg1, arg2, arg3 = null, arg4 = false) => {
  let audioBlob, lessonId, mode, targetText, questionText, questionId;

  if (arg1 && typeof arg1 === 'object' && !(arg1 instanceof Blob)) {
    // Kiểu gọi object V2
    audioBlob = arg1.audioBlob;
    lessonId = arg1.lessonId;
    mode = arg1.mode || (arg1.targetText ? 'read_aloud' : (arg1.questionText ? 'qa' : 'chat'));
    targetText = arg1.targetText || null;
    questionText = arg1.questionText || null;
    questionId = arg1.questionId || null;
  } else {
    // Kiểu gọi positional legacy
    audioBlob = arg1;
    lessonId = arg2;
    targetText = arg3;
    const isQA = Boolean(arg4);

    if (isQA) {
      mode = 'qa';
      questionText = targetText || null;
      targetText = null;
    } else if (targetText && targetText.trim()) {
      mode = 'read_aloud';
    } else {
      mode = 'chat';
    }
  }

  if (!audioBlob) {
    throw new Error('Không có dữ liệu âm thanh để gửi lên máy chủ.');
  }

  const formData = new FormData();
  const fileExt = (audioBlob.type && audioBlob.type.includes('ogg')) ? 'ogg' : 'webm';
  const audioFile = new File([audioBlob], `recording-${Date.now()}.${fileExt}`, {
    type: audioBlob.type || 'audio/webm'
  });

  formData.append('audio', audioFile);
  if (lessonId !== null && lessonId !== undefined) {
    formData.append('lessonId', String(lessonId));
  }
  if (mode) {
    formData.append('mode', mode);
  }
  if (targetText) {
    formData.append('targetText', targetText);
  }
  if (questionText) {
    formData.append('questionText', questionText);
  }
  if (questionId) {
    formData.append('questionId', String(questionId));
  }

  try {
    const response = await apiClient.post('/chatbot/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    if (response.data && response.data.data) {
      return response.data.data;
    }
    throw new Error('Cấu trúc phản hồi từ máy chủ không hợp lệ.');
  } catch (error) {
    console.error('⚠️ Lỗi kết nối tới API Chatbot Audio:', error.message);
    const backendMsg = error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ AI để chấm điểm.';
    const enhancedErr = new Error(backendMsg);
    enhancedErr.status = error.response?.status || 500;
    enhancedErr.code = error.response?.data?.code || error.code || 'CHATBOT_AUDIO_ERROR';
    enhancedErr.quota = error.response?.data?.quota || null;
    enhancedErr.originalError = error;
    throw enhancedErr;
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
    throw error;
  }
};

/**
 * Lấy 4 câu hỏi gợi ý cho bài học (Udemy-like AI Assistant Feature)
 * @param {number|string} lessonId
 * @returns {Promise<Array<string>>}
 */
export const getSuggestedQuestions = async (lessonId) => {
  if (!lessonId || Number(lessonId) <= 0) return [];
  try {
    const response = await apiClient.get(`/chatbot/suggested-questions/${lessonId}`);
    if (response.data && response.data.success && Array.isArray(response.data.questions)) {
      return response.data.questions;
    }
    throw new Error('Phản hồi câu hỏi gợi ý từ máy chủ không đúng định dạng.');
  } catch (error) {
    console.warn(`⚠️ Lỗi lấy câu hỏi gợi ý cho lessonId=${lessonId}:`, error.message);
    throw error;
  }
};



