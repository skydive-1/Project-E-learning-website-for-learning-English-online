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
 * 
 * 💡 THIẾT KẾ KIẾN TRÚC CLIENT-SIDE RENDERING THROTTLE:
 * Cơ chế này áp dụng "Client-side character buffer queue & adaptive throttle loop" 
 * để mô phỏng hiệu ứng gõ chữ (typing effect) mượt mà như Claude / ChatGPT.
 * Đây là giải pháp phân tách độc lập giữa "Tốc độ nhận dữ liệu từ mạng" và "Tốc độ hiển thị UI":
 * - Luồng mạng (Network Reader) đọc dữ liệu từ server ở tốc độ tối đa không bị chặn.
 * - Luồng hiển thị (Display Ticker) lấy từng cụm ký tự nhỏ từ hàng đợi đệm và gọi onChunk đều đặn.
 * - Thuật toán Adaptive Catch-up tự động tăng tốc độ nhả chữ khi hàng đợi bị tồn đọng nhiều ký tự,
 *   đảm bảo câu trả lời dài không bị kéo dài tổng thời gian hoàn tất.
 * - KHÔNG PHẢI thay đổi cách AI sinh văn bản hay làm chậm tiến trình xử lý của backend.
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
    if (response.status === 429 || response.status === 403) {
      const errJson = await response.json().catch(() => ({}));
      const limitMsg = errJson.message || "Xin lỗi, bạn đã hết hạn mức sử dụng AI trong ngày hôm nay. Vui lòng quay lại vào ngày mai nhé!";
      throw new Error(limitMsg);
    }
    throw new Error(`HTTP Error ${response.status}`);
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
  let tickerIntervalId = null;

  // Trả về Promise hoàn tất khi toàn bộ dữ liệu đã được hiển thị hết ra UI
  return new Promise((resolve, reject) => {
    // Helper dọn dẹp ticker
    const cleanup = () => {
      if (tickerIntervalId) {
        clearInterval(tickerIntervalId);
        tickerIntervalId = null;
      }
    };

    // Hỗ trợ AbortSignal hủy luồng stream & ticker khi component unmount hoặc gửi câu hỏi mới
    if (options.signal) {
      if (options.signal.aborted) {
        cleanup();
        try { reader.cancel(); } catch (_) {}
        return reject(new DOMException('Aborted', 'AbortError'));
      }
      options.signal.addEventListener('abort', () => {
        cleanup();
        try { reader.cancel(); } catch (_) {}
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    // 1. DISPLAY TICKER LOOP (Chạy độc lập mỗi 18-20ms để cập nhật UI mượt mà)
    const TICK_MS = 20; // ~50 fps
    tickerIntervalId = setInterval(() => {
      // Nếu có lỗi từ mạng và chưa kịp hiển thị gì
      if (networkError && displayedText.length === 0) {
        cleanup();
        return reject(networkError);
      }

      const remainingChars = rawFullText.length - displayedText.length;

      if (remainingChars > 0) {
        // Thuật toán Adaptive Speed (Điều chỉnh số ký tự hiển thị mỗi tick dựa trên độ dài hàng đợi đệm):
        // - Khi hàng đợi ít: nhả 1-2 ký tự/tick để tạo cảm giác gõ chữ tự nhiên, mượt mà.
        // - Khi hàng đợi tồn đọng nhiều: tự động tăng tốc tỷ lệ thuận để không bị trễ thời gian tổng thể.
        let step = 1;
        if (remainingChars > 300) {
          step = Math.ceil(remainingChars / 10); // ~30+ ký tự/tick
        } else if (remainingChars > 150) {
          step = Math.ceil(remainingChars / 15); // ~10-20 ký tự/tick
        } else if (remainingChars > 60) {
          step = Math.ceil(remainingChars / 20); // ~3-7 ký tự/tick
        } else if (remainingChars > 20) {
          step = 2;
        } else {
          // 1 đến 2 ký tự ngẫu nhiên nhẹ nhàng
          step = Math.random() > 0.4 ? 2 : 1;
        }

        step = Math.min(step, remainingChars);
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

      // Kiểm tra điều kiện hoàn tất thực sự:
      // Server đã gửi xong toàn bộ ([DONE]) VÀ toàn bộ text trong hàng đợi đã được hiển thị hết
      if (isNetworkDone && displayedText.length >= rawFullText.length) {
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

        if (networkError) {
          return reject(networkError);
        }

        if (!displayedText && !rawFullText) {
          return reject(new Error('Empty response from stream'));
        }

        return resolve({
          reply: displayedText,
          sources,
          actions,
          metadata
        });
      }
    }, TICK_MS);

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
    return null;
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
    return [];
  } catch (error) {
    console.warn(`⚠️ Lỗi lấy câu hỏi gợi ý cho lessonId=${lessonId}:`, error.message);
    return [];
  }
};



