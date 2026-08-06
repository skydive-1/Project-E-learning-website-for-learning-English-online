import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiCpu, FiMessageSquare, FiTrash2, FiMic, FiCheck, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { askChatbot, askChatbotStream, getChatHistory, saveChatHistory, askChatbotAudio, getTokenBalance } from '../services/chatbot.service';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useAudioRecorder } from '../../../hooks/useAudioRecorder';

// Hàm helper để sinh câu hỏi trắc nghiệm tương tác tùy theo bài học (lessonId)
const getLessonSpecificQuiz = (lessonId) => {
  const cleanId = String(lessonId).replace('quiz-', '');
  
  const quizzes = {
    "1": [
      {
        question: "Phương pháp 'Active Recall' trong học tập có nghĩa là gì?",
        options: [
          "Đọc đi đọc lại bài học một cách thụ động",
          "Chủ động kiểm tra trí nhớ để truy xuất thông tin",
          "Dịch từng từ tiếng Anh sang tiếng Việt trong đầu",
          "Chỉ nghe nhạc tiếng Anh trong lúc làm việc khác"
        ],
        correctAnswer: 1,
        explanation: "'Active recall' là phương pháp chủ động gợi nhớ bằng cách tự kiểm tra hoặc đặt câu hỏi để truy xuất thông tin từ bộ nhớ, thay vì đọc lại thụ động."
      },
      {
        question: "Đâu là cách thiết lập mục tiêu luyện nói tiếng Anh hàng ngày hiệu quả?",
        options: [
          "Học thuộc lòng toàn bộ cuốn từ điển dày",
          "Dành ra thời gian cố định mỗi ngày để nói/chat",
          "Chỉ học công thức ngữ pháp chứ không nói",
          "Đợi đến khi phát âm thật hoàn hảo mới bắt đầu nói"
        ],
        correctAnswer: 1,
        explanation: "Thiết lập thói quen nhỏ đều đặn hàng ngày là chìa khóa để cải thiện phản xạ giao tiếp tiếng Anh tốt nhất."
      }
    ],
    "2": [
      {
        question: "Làm thế nào để hạn chế thói quen dịch nhẩm từ Việt sang Anh?",
        options: [
          "Luôn luôn suy nghĩ nghĩa tiếng Việt trước",
          "Liên kết từ tiếng Anh trực tiếp với hình ảnh/khái niệm",
          "Nói thật chậm để kiểm tra từng quy tắc ngữ pháp",
          "Tránh sử dụng tiếng Anh trong giao tiếp hàng ngày"
        ],
        correctAnswer: 1,
        explanation: "Hãy liên kết từ vựng trực tiếp với khái niệm thực tế (ví dụ: nghĩ 'apple' -> hình ảnh quả táo, thay vì dịch 'apple' -> 'quả táo' -> hình ảnh)."
      },
      {
        question: "Thái độ đúng đắn nhất đối với các lỗi sai ngữ pháp khi bắt đầu luyện nói là gì?",
        options: [
          "Sợ hãi và không dám nói tiếp để tránh sai lầm",
          "Chấp nhận lỗi sai như một phần tự nhiên của quá trình học",
          "Học hết tất cả ngữ pháp trước khi thử mở miệng nói",
          "Luôn xin lỗi và lo lắng quá mức vì đã nói sai"
        ],
        correctAnswer: 1,
        explanation: "Mắc lỗi là hoàn toàn bình thường. Bạn cần vượt qua nỗi sợ sai để giao tiếp tự nhiên và trôi chảy hơn ở giai đoạn đầu."
      }
    ],
    "3": [
      {
        question: "She usually ______ to the gym after work. (Chọn đáp án đúng)",
        options: ["go", "goes", "went", "going"],
        correctAnswer: 1,
        explanation: "Chủ ngữ là 'She' (ngôi thứ 3 số ít), trạng từ chỉ tần suất 'usually' chỉ thì Hiện tại đơn -> Động từ chia thêm -s/es thành 'goes'."
      },
      {
        question: "Yesterday, I ______ English vocabulary with my AI teacher. (Chọn đáp án đúng)",
        options: ["study", "studies", "studied", "studying"],
        correctAnswer: 2,
        explanation: "Dấu hiệu thời gian là 'Yesterday' (hôm qua) chỉ hành động đã xảy ra trong quá khứ -> Dùng động từ quá khứ đơn (V-ed): 'studied'."
      }
    ],
    "4": [
      {
        question: "Chọn câu hỏi đuôi chính xác: 'You are a student, ______?'",
        options: ["are you", "aren't you", "don't you", "do you"],
        correctAnswer: 1,
        explanation: "Vế trước là thể khẳng định của to be ('are') -> Phần câu hỏi đuôi tương ứng dùng phủ định phủ nhận: 'aren't you'."
      },
      {
        question: "Đối với câu hỏi nghi vấn dạng 'Yes/No', ngữ điệu cuối câu nên như thế nào?",
        options: [
          "Lên giọng ở cuối câu",
          "Xuống giọng ở cuối câu",
          "Giữ giọng điệu phẳng lặng",
          "Nói thầm từ cuối cùng"
        ],
        correctAnswer: 0,
        explanation: "Theo quy tắc ngữ điệu tiếng Anh chuẩn, câu hỏi dạng Yes/No (ví dụ: Do you like coffee? ↗) cần lên giọng ở cuối câu."
      }
    ],
    "5": [
      {
        question: "Phương pháp 'Shadowing' (Nói đuổi) yêu cầu người học phải làm gì?",
        options: [
          "Nghe một đoạn hội thoại dài rồi tóm tắt lại",
          "Bắt chước lặp lại ngay lập tức theo ngữ điệu người nói mẫu",
          "Dịch thầm câu nói trong đầu trước khi lặp lại",
          "Đọc to văn bản dịch sẵn trên giấy"
        ],
        correctAnswer: 1,
        explanation: "'Shadowing' yêu cầu học viên nghe và lặp lại ngay lập tức (như một cái bóng) theo sát cách nhấn âm, nối âm và ngữ điệu của người nói bản xứ."
      },
      {
        question: "Tại sao nên ghi âm lại giọng nói của chính mình khi shadowing?",
        options: [
          "Để đăng lên mạng xã hội giải trí ngay lập tức",
          "Để nghe lại, đối chiếu lỗi sai với giọng đọc mẫu và tự sửa",
          "Để kiểm tra chất lượng phần cứng microphone của máy",
          "Để chắc chắn rằng giọng mình càng to càng tốt"
        ],
        correctAnswer: 1,
        explanation: "Ghi âm giúp bạn nghe lại giọng mình một cách khách quan, so sánh trực tiếp với câu mẫu bản xứ để phát hiện các âm phát âm lỗi và sửa chữa kịp thời."
      }
    ]
  };
  
  return quizzes[cleanId] || quizzes["3"]; // Mặc định trả về bộ câu hỏi ngữ pháp (Bài 3)
};

const ChatBox = ({ lessonId = 0, onClose = null }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [quizStates, setQuizStates] = useState({}); // Lưu trạng thái tương tác trắc nghiệm { [messageId]: { currentIdx, selectedOption, isAnswered, score } }
  const [tokenBalance, setTokenBalance] = useState({
    tokens_used: 0,
    token_max_limit: 6000,
    tokens_remaining: 6000
  });
  
  const messagesEndRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const { isRecording, recordingTime, startRecording, stopRecording } = useAudioRecorder();

  const handleStartAudioRecording = async () => {
    try {
      await startRecording();
      recordingTimeoutRef.current = setTimeout(() => {
        handleStopAudioRecording();
      }, 60000); // Tự động ngắt sau 60s
    } catch (err) {
      console.error("Ghi âm thất bại:", err);
    }
  };

  // Helper gõ chữ từng từ từng câu với Skeleton Loading chuẩn cho TOÀN BỘ ROLE (Student, Instructor, Admin)
  const streamTextWordByWord = async (aiMessageId, fullText, extraProps = {}) => {
    if (!fullText) {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: '', isStreaming: false, ...extraProps } : m));
      return;
    }

    // Hiển thị Skeleton Loading trong 350ms để tạo cảm giác AI đang đọc/suy nghĩ
    setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: '', isStreaming: true, ...extraProps } : m));
    await new Promise(r => setTimeout(r, 350));

    let currentAccumulated = '';
    const words = fullText.split(/(\s+)/);
    for (let i = 0; i < words.length; i++) {
      currentAccumulated += words[i];
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: currentAccumulated, isStreaming: true, ...extraProps } : m));
      // Tốc độ nhịp gõ 15ms - 28ms tự nhiên chuẩn phản xạ
      await new Promise(r => setTimeout(r, Math.random() * 13 + 15));
    }

    setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullText, isStreaming: false, ...extraProps } : m));
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
      text: "🎤 [Đoạn ghi âm]",
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

    setMessages(prev => [...prev, userAudioMessage, aiSkeletonMessage]);
    setIsLoading(true);

    try {
      const result = await askChatbotAudio(audioBlob, lessonId);
      await streamTextWordByWord(aiMessageId, result.reply);
      fetchBalance();

      if (user?.userId && (lessonId !== undefined && lessonId !== null)) {
        saveChatHistory(user.userId, lessonId, "[Ghi âm giọng nói]", result.reply).catch(err => {
          console.warn('⚠️ Lỗi tự động lưu hội thoại ngầm:', err.message);
        });
      }
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? {
        ...m,
        text: "Không thể xử lý đoạn ghi âm. Hãy thử lại hoặc chuyển sang nhập văn bản.",
        isStreaming: false,
        isError: true
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

  const fetchBalance = async () => {
    if (user?.userId || user?.id) {
      const uId = user.userId || user.id;
      const balance = await getTokenBalance(uId);
      if (balance) {
        setTokenBalance(balance);
      }
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [user?.userId, user?.id]);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Tải lịch sử chat cũ khi lessonId hoặc user thay đổi (Xử lý Race Conditions và Loading)
  useEffect(() => {
    let isCurrent = true;
    const fetchHistory = async () => {
      if (!user?.userId || (lessonId === undefined || lessonId === null)) {
        setIsHistoryLoading(false);
        return;
      }
      
      setIsHistoryLoading(true);
      try {
        const historyData = await getChatHistory(user.userId, lessonId);
        if (isCurrent) {
          if (historyData && historyData.length > 0) {
            const mappedMessages = historyData.map(msg => ({
              id: `msg-db-${msg.chat_id}`,
              sender: msg.sender === 'bot' ? 'ai' : 'user',
              text: msg.message,
              timestamp: new Date()
            }));
            setMessages(mappedMessages);
          } else {
            const welcomeText = (lessonId === 0 || lessonId === '0' || !lessonId)
              ? "Hello! Tôi là Trợ lý học tiếng Anh AI của bạn. Tôi có thể hỗ trợ giải thích ngữ pháp, từ vựng, luyện viết hoặc chat tiếng Anh cùng bạn để nâng cao phản xạ. Hôm nay bạn muốn học gì nào?"
              : "Hello! Tôi là Trợ lý ảo RAG AI học tập của bạn. Tôi đã đọc qua bài học này. Bạn có câu hỏi nào cần giải đáp về ngữ pháp, từ vựng hay muốn luyện phản xạ nói không?";
            
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

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    if (!textToSend) setInputText("");

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

    setMessages(prev => [...prev, userMessage, aiSkeletonMessage]);
    setIsLoading(true);

    try {
      const isQuizRequest = text.toLowerCase().includes("trắc nghiệm") || 
                            text.toLowerCase().includes("quizzes") || 
                            text.toLowerCase().includes("quizz") || 
                            text.toLowerCase().includes("bài tập nhỏ") ||
                            text.toLowerCase().includes("bài tập trắc nghiệm");

      if (isQuizRequest) {
        const quizIntro = "Tôi đã tạo cho bạn 2 câu hỏi trắc nghiệm nhanh dưới đây để kiểm tra kiến thức về bài học này:";
        const quizData = getLessonSpecificQuiz(lessonId);
        await streamTextWordByWord(aiMessageId, quizIntro, { quizData });
      } else {
        const finalAnswer = await askChatbotStream(text, lessonId, (accumulatedText) => {
          setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText, isStreaming: true } : m));
        });

        await streamTextWordByWord(aiMessageId, finalAnswer);
        fetchBalance();

        if (user?.userId && (lessonId !== undefined && lessonId !== null)) {
          saveChatHistory(user.userId, lessonId, text, finalAnswer).catch(err => {
            console.warn('⚠️ Lỗi tự động lưu hội thoại ngầm:', err.message);
          });
        }
      }
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? {
        ...m,
        text: "Dịch vụ AI đang gặp sự cố kết nối. Hãy thử lại sau ít phút hoặc đặt câu hỏi khác.",
        isStreaming: false,
        isError: true
      } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };


  const handleClearChat = () => {
    if (window.confirm("Bạn có muốn xóa cuộc hội thoại này không?")) {
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
    }
  };

  // Các gợi ý câu hỏi nhanh (Thay đổi động theo chế độ bài học hoặc toàn cục)
  const quickPrompts = (lessonId === 0 || lessonId === '0' || !lessonId)
    ? [
        { label: "🌐 Giới thiệu ngắn về trang", text: "Cho tôi tóm tắt ngắn về trang E-Learn Academy và các chức năng chính." },
        { label: "📚 Khóa học có sẵn", text: "Danh sách các khóa học hiện có; có khóa cho người mới bắt đầu không?" },
        { label: "🧭 Lộ trình học", text: "Mô tả ngắn lộ trình học giao tiếp phù hợp cho người mới." }
      ]
    : [
        { label: "Giải thích ngữ pháp", text: "Giải thích ngắn những điểm ngữ pháp chính trong bài này." },
        { label: "Ví dụ từ vựng", text: "Cho 3 từ vựng quan trọng trong bài và ví dụ câu." },
        { label: "Tạo bài tập", text: "Tạo 2 câu trắc nghiệm ngắn để ôn bài này." }
      ];

  // Trạng thái chưa đăng nhập: Hiển thị giao diện khóa sang trọng
  if (!user) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm relative justify-center items-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-smart-indigo/10 text-smart-indigo flex items-center justify-center mb-4 border border-smart-indigo/10 dark:border-smart-indigo/20">
          <FiCpu className="text-3xl animate-pulse" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-2">Trợ Lý Ảo AI</h3>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed mb-6">
          Vui lòng đăng nhập để bắt đầu trò chuyện cùng Trợ lý ảo và tự động lưu trữ tiến độ hội thoại theo bài học.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-5 py-2.5 bg-smart-indigo hover:bg-indigo-700 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform active:scale-95 cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm relative transition-colors duration-300">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-smart-indigo to-blue-600 text-white shadow-sm shrink-0">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <FiCpu className="text-xl animate-pulse" />
            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white"></span>
          </div>
          <div>
            <h3 className="font-semibold text-sm tracking-wide">
              {Number(lessonId) === 0 ? t('aiAssistantTitle') : "AI Assistant"}
            </h3>
            <span className="text-[10.5px] opacity-80">
              {Number(lessonId) === 0 ? t('aiAssistantSub') : "RAG-powered Tutor"}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={handleClearChat}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/90 hover:text-white"
            title={t('clearChatHistory')}
          >
            <FiTrash2 className="text-sm" />
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/90 hover:text-white"
              title="Đóng cửa sổ chat"
            >
              <FiX className="text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* Message Area with Custom Scrollbar */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
        {isHistoryLoading ? (
          <div className="space-y-4">
            {/* User skeleton message */}
            <div className="flex justify-end">
              <div className="w-[60%] h-10 bg-slate-200/80 dark:bg-slate-700/80 rounded-2xl rounded-tr-none animate-pulse"></div>
            </div>
            {/* AI skeleton message */}
            <div className="flex justify-start items-start">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mr-2"></div>
              <div className="w-[70%] h-16 bg-slate-200/80 dark:bg-slate-700/80 rounded-2xl rounded-tl-none animate-pulse"></div>
            </div>
            {/* User skeleton message 2 */}
            <div className="flex justify-end">
              <div className="w-[45%] h-10 bg-slate-200/80 dark:bg-slate-700/80 rounded-2xl rounded-tr-none animate-pulse"></div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* AI Avatar */}
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-smart-indigo/10 dark:bg-smart-indigo/20 text-smart-indigo dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mr-2 border border-smart-indigo/10 dark:border-smart-indigo/20">
                    AI
                  </div>
                )}
                
                {/* Message Bubble */}
                <div 
                  className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm ${
                    msg.sender === 'user' 
                      ? 'bg-smart-indigo text-white rounded-tr-none whitespace-pre-wrap' 
                      : msg.isError 
                        ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900 rounded-tl-none whitespace-pre-wrap'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-100 dark:border-slate-650 rounded-tl-none'
                  }`}
                >
                  {msg.quizData ? (
                    <div className="space-y-3 p-0.5 animate-fade" style={{ minWidth: '220px' }}>
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        📝 Bài tập trắc nghiệm nhanh
                      </p>
                      
                      {(() => {
                        const qState = quizStates[msg.id] || { currentIdx: 0, selectedOption: null, isAnswered: false, score: 0 };
                        const currentIdx = qState.currentIdx;
                        const total = msg.quizData.length;
                        
                        if (currentIdx >= total) {
                          return (
                            <div className="text-center py-2 space-y-2">
                              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-450">
                                🎉 Hoàn thành bài tập!
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-350">
                                Kết quả của bạn: <strong>{qState.score}/{total}</strong> câu đúng.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuizStates(prev => ({
                                    ...prev,
                                    [msg.id]: { currentIdx: 0, selectedOption: null, isAnswered: false, score: 0 }
                                  }));
                                }}
                                className="mt-2 text-[10.5px] px-3 py-1.5 bg-smart-indigo hover:bg-indigo-650 text-white font-bold rounded-lg cursor-pointer transition-colors"
                              >
                                Làm lại
                              </button>
                            </div>
                          );
                        }
                        
                        const currentQuestion = msg.quizData[currentIdx];
                        
                        return (
                          <div className="space-y-3">
                            {/* Question progress */}
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <span>Câu hỏi {currentIdx + 1}/{total}</span>
                              {qState.isAnswered && (
                                <span className={qState.selectedOption === currentQuestion.correctAnswer ? 'text-emerald-500 font-extrabold' : 'text-red-500 font-extrabold'}>
                                  {qState.selectedOption === currentQuestion.correctAnswer ? 'Chính xác!' : 'Chưa đúng!'}
                                </span>
                              )}
                            </div>
                            
                            {/* Question text */}
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed whitespace-normal">
                              {currentQuestion.question}
                            </p>
                            
                            {/* Option buttons */}
                            <div className="flex flex-col gap-1.5">
                              {currentQuestion.options.map((opt, oIdx) => {
                                let btnStyle = "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300";
                                
                                if (qState.isAnswered) {
                                  if (oIdx === currentQuestion.correctAnswer) {
                                    btnStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-350 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold";
                                  } else if (oIdx === qState.selectedOption) {
                                    btnStyle = "bg-red-50 dark:bg-red-950/40 border-red-350 dark:border-red-800 text-red-700 dark:text-red-400";
                                  } else {
                                    btnStyle = "bg-slate-55 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700/50 text-slate-400 dark:text-slate-500 opacity-60";
                                  }
                                }
                                
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    disabled={qState.isAnswered}
                                    onClick={() => {
                                      const isCorrect = oIdx === currentQuestion.correctAnswer;
                                      setQuizStates(prev => ({
                                        ...prev,
                                        [msg.id]: {
                                          ...qState,
                                          selectedOption: oIdx,
                                          isAnswered: true,
                                          score: qState.score + (isCorrect ? 1 : 0)
                                        }
                                      }));
                                    }}
                                    className={`text-left text-xs px-3.5 py-2.5 rounded-xl border transition-all ${btnStyle} ${!qState.isAnswered && 'cursor-pointer'}`}
                                  >
                                    <span className="font-bold mr-1.5">{['A', 'B', 'C', 'D'][oIdx]}.</span> {opt}
                                  </button>
                                );
                              })}
                            </div>
                            
                            {/* Explanation box */}
                            {qState.isAnswered && (
                              <div className="p-3 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 animate-fade">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Giải thích chi tiết:</p>
                                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-350 font-medium whitespace-normal">
                                  {currentQuestion.explanation}
                                </p>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuizStates(prev => ({
                                      ...prev,
                                      [msg.id]: {
                                        ...qState,
                                        currentIdx: currentIdx + 1,
                                        selectedOption: null,
                                        isAnswered: false
                                      }
                                    }));
                                  }}
                                  className="w-full mt-2.5 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg text-xs cursor-pointer transition-colors text-center border-0"
                                >
                                  {currentIdx + 1 < total ? 'Câu tiếp theo' : 'Xem kết quả'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : msg.isStreaming && !msg.text ? (
                    <div className="flex items-center space-x-2 py-1 px-1 min-w-[140px]">
                      <span className="text-xs text-slate-400 dark:text-slate-300 font-semibold animate-pulse flex items-center gap-1.5">
                        <FiCpu className="text-smart-indigo dark:text-indigo-400 text-sm animate-spin" />
                        <span>AI đang soạn câu trả lời...</span>
                      </span>
                      <span className="flex space-x-1 items-center ml-1.5">
                        <span className="w-1.5 h-1.5 bg-smart-indigo dark:bg-indigo-400 rounded-full animate-ping"></span>
                        <span className="w-1.5 h-1.5 bg-smart-indigo dark:bg-indigo-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></span>
                        <span className="w-1.5 h-1.5 bg-smart-indigo dark:bg-indigo-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></span>
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="whitespace-pre-wrap">{msg.text}</span>
                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-smart-indigo dark:bg-indigo-400 animate-pulse align-middle rounded-xs"></span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 shrink-0 border-t border-slate-100 dark:border-slate-750">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Gợi ý nhanh cho bạn:</p>
          <div className="flex flex-col space-y-1.5">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt.text)}
                className="text-left text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-smart-indigo dark:hover:border-indigo-400 hover:text-smart-indigo dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 rounded-xl transition-all shadow-sm truncate"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Token Balance Progress Bar */}
      {user && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-750 bg-slate-50/50 dark:bg-slate-900/30 shrink-0">
          <div className="flex justify-between items-center mb-1 text-[11px] font-bold">
            <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span>{t('tokenLimitLabel')}</span>
            </div>
            <span className="text-indigo-650 dark:text-indigo-400">
              {((tokenBalance.tokens_remaining ?? (tokenBalance.token_max_limit - tokenBalance.tokens_used)) || 0).toLocaleString()} / {(tokenBalance.token_max_limit || 6000).toLocaleString()} Tokens
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full transition-all duration-500 ease-out"
              style={{ 
                width: `${Math.min(100, Math.max(0, 
                  (tokenBalance.token_max_limit || 6000) > 0 
                    ? ((tokenBalance.tokens_remaining ?? (tokenBalance.token_max_limit - tokenBalance.tokens_used)) / (tokenBalance.token_max_limit || 6000)) * 100 
                    : 0
                ))}%` 
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Input Bottom Form */}
      <form 
        onSubmit={handleSubmit}
        className="px-3 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center space-x-2 shrink-0 animate-fade"
      >
        {isRecording ? (
          <div className="flex-1 flex items-center space-x-3 bg-red-50 dark:bg-red-950/20 px-3.5 py-2 rounded-xl border border-red-100 dark:border-red-900">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Đang thu âm... {recordingTime}s
            </span>
            <div className="flex-1 flex justify-center space-x-1">
              <span className="w-1 h-3 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
              <span className="w-1 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              <span className="w-1 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              <span className="w-1 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></span>
            </div>
            <button
              type="button"
              onClick={handleStopAudioRecording}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Gửi
            </button>
            <button
              type="button"
              onClick={handleCancelAudioRecording}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold"
            >
              Hủy
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleStartAudioRecording}
              disabled={isLoading}
              className={`p-2.5 rounded-xl border transition-all ${
                isLoading 
                  ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 border-slate-100 dark:border-slate-750 cursor-not-allowed'
                  : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-smart-indigo dark:hover:text-indigo-400 shadow-sm'
              }`}
              title="Ghi âm câu hỏi"
            >
              <FiMic className="text-sm" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('askInputPlaceholder')}
              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-smart-indigo focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-100"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className={`p-2.5 rounded-xl transition-all ${
                inputText.trim() && !isLoading
                  ? 'bg-smart-indigo text-white hover:bg-smart-indigo-hover shadow-md hover:shadow-indigo-100'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <FiSend className="text-sm" />
            </button>
          </>
        )}
      </form>
    </div>
  );
};

export default ChatBox;
