import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  askChatbotStream, 
  getChatHistory, 
  saveChatHistory, 
  askChatbotAudio, 
  generateChatbotQuiz, 
  clearChatHistory 
} from '../services/chatbot.service';
import { getAiQuotaStatus } from '../services/quota.service';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { useAudioRecorder } from '../../../hooks/useAudioRecorder';

import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import EmptyState from './EmptyState';
import Composer from './Composer';
import DeleteConfirmModal from './DeleteConfirmModal';
import QuotaIndicator from './QuotaIndicator';

const AI_QUOTA_ERROR_CODES = new Set([
  'AI_QUESTION_LIMIT_REACHED',
  'GEMINI_QUOTA_EXHAUSTED'
]);

/**
 * ChatBox Component (Udemy-like AI Assistant Panel)
 * - Đảm nhận toàn bộ điều phối luồng hội thoại RAG AI
 * - Phân rã mô-đun hóa: ChatHeader, MessageList, EmptyState, Composer, DeleteConfirmModal
 * - Hỗ trợ Custom Delete Confirmation (Zero window.confirm / Zero window.alert)
 * - Hỗ trợ Click-to-Seek video, trắc nghiệm tương tác, voice recording
 */
const ChatBox = ({ 
  lessonId = 0, 
  lessonTitle = '',
  currentTime = null, 
  onSeekVideo = null, 
  onClose = null,
  onAskInstructor = null
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const showToast = useToast();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [quizStates, setQuizStates] = useState({});
  const [aiQuota, setAiQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  // Custom Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeAiMessageIdRef = useRef(null);
  const isMountedRef = useRef(true);
  const { isRecording, recordingTime, startRecording, stopRecording } = useAudioRecorder({
    onError: (message) => showToast(message, 'error')
  });

  // Lifecycle theo dõi mount/unmount để dọn dẹp các luồng stream & timer
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, []);

  // Helper gõ chữ từng từ mượt mà (dành cho tin nhắn chào mừng hoặc kết quả Audio)
  const streamTextWordByWord = async (aiMessageId, fullText, extraProps = {}, signal = null) => {
    if (!isMountedRef.current) return;
    if (!fullText) {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: '', isStreaming: false, ...extraProps } : m));
      return;
    }

    setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: '', isStreaming: true, ...extraProps } : m));
    await new Promise(r => setTimeout(r, 200));

    let currentAccumulated = '';
    const words = fullText.split(/(\s+)/);
    for (let i = 0; i < words.length; i++) {
      if (!isMountedRef.current) return;
      if (signal?.aborted) {
        setMessages(prev => prev.map(m => m.id === aiMessageId ? {
          ...m,
          text: currentAccumulated,
          isStreaming: false,
          isStopped: true,
          ...extraProps
        } : m));
        return;
      }

      currentAccumulated += words[i];

      // Khi người dùng chuyển tab (Alt+Tab), xả trực tiếp toàn bộ text còn lại để không bị timer throttling
      if (typeof document !== 'undefined' && document.hidden) {
        setMessages(prev => prev.map(m => m.id === aiMessageId ? {
          ...m,
          text: fullText,
          isStreaming: false,
          ...extraProps
        } : m));
        return;
      }

      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: currentAccumulated, isStreaming: true, ...extraProps } : m));
      await new Promise(r => setTimeout(r, Math.random() * 10 + 12));
    }

    if (isMountedRef.current) {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullText, isStreaming: false, ...extraProps } : m));
    }
  };

  const handleStartAudioRecording = async () => {
    try {
      await startRecording();
      recordingTimeoutRef.current = setTimeout(() => {
        handleStopAudioRecording();
      }, 60000);
    } catch (err) {
      console.error("Ghi âm thất bại:", err);
    }
  };

  const handleStopAudioRecording = async () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    const audioBlob = await stopRecording();
    if (!audioBlob) return;

    const audioMessageId = `msg-${Date.now()}-user-audio`;
    const userAudioMessage = {
      id: audioMessageId,
      sender: "user",
      text: "🎤 [Ghi âm giọng nói]",
      timestamp: new Date()
    };

    const aiMessageId = `msg-${Date.now()}-ai`;
    const aiSkeletonMessage = {
      id: aiMessageId,
      sender: "ai",
      text: "",
      isStreaming: true,
      timestamp: new Date()
    };
    activeAiMessageIdRef.current = aiMessageId;

    setMessages(prev => [...prev, userAudioMessage, aiSkeletonMessage]);
    setIsLoading(true);

    try {
      const result = await askChatbotAudio(audioBlob, lessonId);
      await streamTextWordByWord(aiMessageId, result.reply);

      if (user?.userId && (lessonId !== undefined && lessonId !== null)) {
        saveChatHistory(user.userId, lessonId, "[Ghi âm giọng nói]", result.reply).catch(err => {
          console.warn('⚠️ Lỗi tự động lưu hội thoại:', err.message);
        });
      }
    } catch (error) {
      const errorCode = error.code || error.response?.data?.code || 'CHATBOT_AUDIO_ERROR';
      const isQuotaError = AI_QUOTA_ERROR_CODES.has(errorCode);
      setMessages(prev => prev.map(m => m.id === aiMessageId ? {
        ...m,
        text: isQuotaError
          ? error.message
          : "Không thể nhận diện đoạn ghi âm. Vui lòng thử lại hoặc gõ câu hỏi.",
        isStreaming: false,
        isError: true,
        errorCode
      } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAudioRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    stopRecording();
  };

  // Quản lý trạng thái tự động cuộn thông minh (User Scroll Detection)
  const isAutoScrollEnabledRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = (behavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    isAutoScrollEnabledRef.current = true;
    setShowScrollBottomBtn(false);
  };

  const handleScrollPosition = useCallback((isAtBottom) => {
    isAutoScrollEnabledRef.current = isAtBottom;
    setShowScrollBottomBtn(!isAtBottom);
  }, []);

  // Nạp lịch sử hội thoại
  useEffect(() => {
    let isCurrent = true;
    const fetchHistory = async () => {
      if (!user?.userId || (lessonId === undefined || lessonId === null)) {
        setIsHistoryLoading(false);
        return;
      }

      setIsHistoryLoading(true);
      try {
        // Fetch chat history and quota in parallel
        const [historyData, quotaData] = await Promise.all([
          getChatHistory(user.userId, lessonId),
          getAiQuotaStatus()
        ]);
        
        if (isCurrent) {
          setAiQuota(quotaData);
          setQuotaLoading(false);
          
          if (historyData && historyData.length > 0) {
            const mappedMessages = historyData
              .sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt))
              .map(msg => ({
                id: `msg-db-${msg.chat_id}`,
                sender: msg.sender === 'bot' ? 'ai' : 'user',
                text: msg.message,
                sources: msg.sources || [],
                actions: msg.actions || [],
                timestamp: new Date(msg.created_at || msg.createdAt)
              }));
            setMessages(mappedMessages);
          } else {
            // No history - show welcome message only once
            const welcomeText = (lessonId === 0 || lessonId === '0' || !lessonId)
              ? "Xin chào! Tôi là Trợ lý học tiếng Anh AI của bạn. Tôi có thể hỗ trợ giải thích ngữ pháp, từ vựng, tra cứu khóa học hoặc tạo bài tập ôn luyện. Bạn muốn tìm hiểu gì hôm nay?"
              : "Xin chào! Tôi là Trợ lý AI đồng hành cùng bạn trong bài học này. Bạn có câu hỏi nào về nội dung video, từ vựng hay cấu trúc câu cần giải thích không?";

            const welcomeMsgId = "msg-welcome";
            setMessages([
              {
                id: welcomeMsgId,
                sender: "ai",
                text: "",
                isStreaming: true,
                timestamp: new Date()
              }
            ]);
            streamTextWordByWord(welcomeMsgId, welcomeText);
          }
        }
      } catch (err) {
        console.error('⚠️ Lỗi tải lịch sử chat:', err);
      } finally {
        if (isCurrent) {
          setIsHistoryLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      isCurrent = false;
    };
  }, [user?.userId, lessonId]);

  // Poll quota every 30 seconds when chat is active
  useEffect(() => {
    if (!user?.userId) return;
    
    const pollQuota = async () => {
      try {
        const quotaData = await getAiQuotaStatus();
        setAiQuota(quotaData);
      } catch (err) {
        console.warn('Quota poll failed:', err);
      }
    };

    const interval = setInterval(pollQuota, 30000);
    return () => clearInterval(interval);
  }, [user?.userId]);

  useEffect(() => {
    if (isAutoScrollEnabledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isLoading, isHistoryLoading]);

  const handleSendMessage = async (textToSend = null, quickAction = null) => {
    const text = (textToSend !== null ? textToSend : inputText).trim();
    if (!text || isLoading) return;

    if (textToSend === null) setInputText("");

    // Hủy bỏ request stream trước đó nếu có (chống race-condition)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const currentAbortController = new AbortController();
    abortControllerRef.current = currentAbortController;

    const userMessage = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: text,
      timestamp: new Date()
    };

    const aiMessageId = `msg-${Date.now()}-ai`;
    const aiSkeletonMessage = {
      id: aiMessageId,
      sender: "ai",
      text: "",
      isStreaming: true,
      timestamp: new Date()
    };

    // Đánh dấu message ID đang hoạt động để nút Stop có thể dừng chính xác
    activeAiMessageIdRef.current = aiMessageId;

    // Reset tự động cuộn xuống đáy cho câu hỏi mới
    isAutoScrollEnabledRef.current = true;
    setShowScrollBottomBtn(false);

    setMessages(prev => [...prev, userMessage, aiSkeletonMessage]);
    setIsLoading(true);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      if (quickAction === 'LESSON_QUICK_QUIZ' || /^(tạo bài tập ôn nhanh|quick quiz|làm bài tập ôn|tạo bài tập trắc nghiệm)/i.test(text.trim())) {
        const quizIntro = "Dưới đây là bài tập trắc nghiệm nhanh để bạn ôn tập kiến thức bài học này:";
        const quizData = await generateChatbotQuiz(lessonId);
        if (currentAbortController.signal.aborted) return;
        await streamTextWordByWord(aiMessageId, quizIntro, { quizData }, currentAbortController.signal);
      } else {
        let finalSources = [];
        let finalActions = [];

        const validCurrentTime = (currentTime !== null && currentTime !== undefined && !isNaN(Number(currentTime)) && Number(currentTime) >= 0)
          ? Number(currentTime)
          : null;

        const streamRes = await askChatbotStream(
          text,
          lessonId,
          (accumulatedText, eventPayload) => {
            if (!isMountedRef.current) return;

            if (eventPayload?.type === 'quiz' && eventPayload?.quizData) {
              setMessages(prev => prev.map(m => m.id === aiMessageId ? {
                ...m,
                text: "Dưới đây là bài tập trắc nghiệm nhanh để bạn ôn tập kiến thức bài học này:",
                quizData: eventPayload.quizData,
                isStreaming: false
              } : m));
              return;
            }

            if (eventPayload?.sources && eventPayload.sources.length > 0) {
              finalSources = eventPayload.sources;
              finalActions = eventPayload.actions || [];
            }
            setMessages(prev => prev.map(m => m.id === aiMessageId ? {
              ...m,
              text: accumulatedText,
              isStreaming: true,
              sources: finalSources,
              actions: finalActions
            } : m));
          },
          'lesson',
          validCurrentTime,
          quickAction,
          { signal: currentAbortController.signal }
        );

        if (!isMountedRef.current) return;

        const finalAnswerText = typeof streamRes === 'string' ? streamRes : (streamRes.reply || '');
        if (streamRes && streamRes.sources) {
          finalSources = streamRes.sources;
          finalActions = streamRes.actions || [];
        }

        setMessages(prev => prev.map(m => m.id === aiMessageId ? {
          ...m,
          text: finalAnswerText,
          isStreaming: false,
          sources: finalSources,
          actions: finalActions
        } : m));

        if (user?.userId && (lessonId !== undefined && lessonId !== null)) {
          saveChatHistory(user.userId, lessonId, text, finalAnswerText, finalSources, finalActions).catch(err => {
            console.warn('⚠️ Lỗi tự động lưu hội thoại ngầm:', err.message);
          });
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Luồng stream bị hủy chủ động do nút Stop hoặc chuyển câu hỏi -> Giữ nguyên text đã sinh và tắt trạng thái streaming
        if (isMountedRef.current) {
          setMessages(prev => prev.map(m => m.id === aiMessageId ? {
            ...m,
            isStreaming: false,
            isStopped: true
          } : m));
        }
        return;
      }

      console.error('⚠️ Lỗi phản hồi chatbot:', error);
      let errorMsg = "Dịch vụ AI đang gặp sự cố kết nối. Hãy thử lại sau ít phút hoặc đặt câu hỏi khác.";
      const errorCode = error.code || error.response?.data?.code || 'CHATBOT_REQUEST_ERROR';
      const isQuotaError = AI_QUOTA_ERROR_CODES.has(errorCode);

      if (isQuotaError) {
        errorMsg = error.message;
      } else if (error instanceof ReferenceError || error instanceof TypeError) {
        errorMsg = `Lỗi thực thi giao diện: ${error.message}`;
      } else if (error.message && (error.message.includes("hết hạn mức") || error.message.includes("429") || error.message.includes("403"))) {
        errorMsg = error.message;
      } else if (error.message && error.message.includes("trắc nghiệm")) {
        errorMsg = "Không thể tạo bài tập trắc nghiệm lúc này, vui lòng thử lại sau ít phút.";
      } else if (error.message && (error.message.includes("NetworkError") || error.message.includes("Failed to fetch") || error.message.includes("ERR_CONNECTION"))) {
        errorMsg = "Lỗi kết nối mạng: Không thể kết nối tới máy chủ AI.";
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message && error.message.length > 0 && !error.message.includes("status code")) {
        errorMsg = error.message;
      }

      if (isMountedRef.current) {
        setMessages(prev => prev.map(m => m.id === aiMessageId ? {
          ...m,
          text: errorMsg,
          isStreaming: false,
          isError: true,
          errorCode,
          quota: error.quota || null
        } : m));
      }
    } finally {
      const ownsActiveRequest = abortControllerRef.current === currentAbortController
        || activeAiMessageIdRef.current === aiMessageId;

      if (abortControllerRef.current === currentAbortController) {
        abortControllerRef.current = null;
      }
      if (activeAiMessageIdRef.current === aiMessageId) {
        activeAiMessageIdRef.current = null;
      }
      if (isMountedRef.current && ownsActiveRequest) {
        setIsLoading(false);
      }
    }
  };

  const handleStopResponse = () => {
    const activeMessageId = activeAiMessageIdRef.current;
    const activeController = abortControllerRef.current;

    if (activeController) {
      try {
        activeController.abort();
      } catch (_) {}
      abortControllerRef.current = null;
    }

    if (activeMessageId) {
      setMessages(prev => prev.map(message => message.id === activeMessageId ? {
        ...message,
        isStreaming: false,
        isStopped: true
      } : message));
      activeAiMessageIdRef.current = null;
    }

    setIsLoading(false);
  };

  // Mở Custom Delete Confirmation Modal (thay thế hoàn toàn window.confirm)
  const handleRequestClearChat = () => {
    setDeleteErrorMessage(null);
    setIsDeleteModalOpen(true);
  };

  // Thực thi xóa lịch sử chat an toàn (Zero native alert/confirm)
  const handleConfirmClearChat = async () => {
    if (isDeletingChat) return;

    setIsDeletingChat(true);
    setDeleteErrorMessage(null);

    try {
      if (user?.userId && (lessonId !== undefined && lessonId !== null)) {
        await clearChatHistory(lessonId);
      }

      const resetText = (lessonId === 0 || lessonId === '0' || !lessonId)
        ? "Cuộc hội thoại đã được đặt lại. Tôi có thể giúp gì thêm cho bạn?"
        : "Cuộc hội thoại đã được đặt lại. Tôi có thể giúp gì thêm cho bạn trong bài học này?";

      setMessages([
        {
          id: "msg-welcome-new",
          sender: "ai",
          text: resetText,
          timestamp: new Date()
        }
      ]);

      setIsDeleteModalOpen(false);
      showToast("Đã xóa lịch sử trò chuyện thành công.", 'success');
    } catch (err) {
      console.error('⚠️ Lỗi khi xóa lịch sử chat:', err);
      setDeleteErrorMessage("Không thể xóa lịch sử lúc này. Vui lòng thử lại sau.");
    } finally {
      setIsDeletingChat(false);
    }
  };

  const handleNavigateLesson = (targetLessonId, targetSeek) => {
    const targetUrl = targetSeek !== null && targetSeek !== undefined
      ? `/lessons/${targetLessonId}?seek=${targetSeek}`
      : `/lessons/${targetLessonId}`;
    navigate(targetUrl);
    if (onClose) onClose();
  };

  // Chưa đăng nhập: Màn hình yêu cầu đăng nhập trang nhã
  if (!user) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs justify-center items-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-smart-indigo dark:text-indigo-400 flex items-center justify-center mb-3.5 border border-indigo-100 dark:border-indigo-900/40">
          <span className="text-2xl">✨</span>
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1.5">Trợ Lý AI Khóa Học</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] leading-relaxed mb-5">
          Vui lòng đăng nhập để trao đổi cùng trợ lý AI và lưu lại tiến độ học tập.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-5 py-2.5 bg-smart-indigo hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-sm relative transition-all duration-300">
      {/* 1. Header Area */}
      <ChatHeader
        lessonId={lessonId}
        onClearChat={handleRequestClearChat}
        onClose={onClose}
        isLoading={isLoading}
        t={t}
        quota={aiQuota}
        quotaLoading={quotaLoading}
      />

      {/* 2. Main Conversation Area / Empty State */}
      {messages.length === 1 && !isLoading && !isHistoryLoading ? (
        <div className="flex-1 overflow-y-auto p-3.5 flex flex-col justify-end pb-4">
          <EmptyState
            lessonId={lessonId}
            lessonTitle={lessonTitle}
            onSelectPrompt={(promptText, action) => handleSendMessage(promptText, action)}
          />
        </div>
      ) : (
        <MessageList
          messages={messages}
          isHistoryLoading={isHistoryLoading}
          quizStates={quizStates}
          setQuizStates={setQuizStates}
          onSeekVideo={onSeekVideo}
          onNavigate={handleNavigateLesson}
          lessonId={lessonId}
          messagesEndRef={messagesEndRef}
          onScrollPosition={handleScrollPosition}
          showScrollBottomBtn={showScrollBottomBtn}
          onScrollToBottom={() => scrollToBottom("smooth")}
          onAskInstructor={onAskInstructor}
        />
      )}

      {/* 3. Composer / Input Area */}
      <Composer
        inputText={inputText}
        setInputText={setInputText}
        onSubmit={() => handleSendMessage()}
        onStopResponse={handleStopResponse}
        isLoading={isLoading}
        isRecording={isRecording}
        recordingTime={recordingTime}
        onStartRecord={handleStartAudioRecording}
        onStopRecord={handleStopAudioRecording}
        onCancelRecord={handleCancelAudioRecording}
        placeholder={Number(lessonId) === 0 ? "Đặt câu hỏi cho Trợ lý AI..." : "Hỏi trợ lý AI về bài học này..."}
        quota={aiQuota}
      />

      {/* 4. Custom Delete Chat Confirmation Modal (Panel Overlay) */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeletingChat) setIsDeleteModalOpen(false);
        }}
        onConfirm={handleConfirmClearChat}
        isDeleting={isDeletingChat}
        errorMessage={deleteErrorMessage}
      />
    </div>
  );
};

export default ChatBox;
