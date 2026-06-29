import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiCpu, FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { askChatbot, getChatHistory, saveChatHistory } from '../services/chatbot.service';
import { useAuth } from '../../../context/AuthContext';

const ChatBox = ({ lessonId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Tải lịch sử chat cũ khi lessonId hoặc user thay đổi (Xử lý Race Conditions và Loading)
  useEffect(() => {
    let isCurrent = true;
    const fetchHistory = async () => {
      if (!user?.userId || !lessonId) {
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
            setMessages([
              {
                id: "msg-welcome",
                sender: "ai",
                text: "Hello! Tôi là Trợ lý ảo RAG AI học tập của bạn. Tôi đã đọc qua bài học này. Bạn có câu hỏi nào cần giải đáp về ngữ pháp, từ vựng hay muốn luyện phản xạ nói không?",
                timestamp: new Date()
              }
            ]);
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

    // Reset input
    if (!textToSend) setInputText("");

    // Thêm câu hỏi của user vào danh sách ngay lập tức
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    setIsLoading(true);

    try {
      // 1. Gọi API hỏi AI từ backend/gemini
      const aiReply = await askChatbot(text, lessonId);
      
      const aiMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: "ai",
        text: aiReply,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

      // 2. Lưu hội thoại ngầm (Auto-Save) vào CSDL
      if (user?.userId && lessonId) {
        saveChatHistory(user.userId, lessonId, text, aiReply).catch(err => {
          console.warn('⚠️ Lỗi tự động lưu hội thoại ngầm:', err.message);
        });
      }
    } catch (error) {
      const errorMessage = {
        id: `msg-${Date.now()}-err`,
        sender: "ai",
        text: "Dịch vụ AI đang gặp sự cố kết nối. Hãy thử lại sau ít phút hoặc đặt câu hỏi khác.",
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
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
      setMessages([
        {
          id: "msg-welcome-new",
          sender: "ai",
          text: "Cuộc hội thoại đã được đặt lại. Tôi có thể giúp gì thêm cho bạn trong bài học này?",
          timestamp: new Date()
        }
      ]);
    }
  };

  // Các gợi ý câu hỏi nhanh
  const quickPrompts = [
    { label: "Giải thích ngữ pháp bài này", text: "Giải thích ngữ pháp trọng tâm trong video bài học này" },
    { label: "Cho ví dụ từ vựng", text: "Cho tôi 3 từ vựng mới trong bài học này kèm câu ví dụ cụ thể" },
    { label: "Tạo một bài tập nhỏ", text: "Tạo cho tôi một bài tập trắc nghiệm nhỏ để kiểm tra kiến thức bài học này" }
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
            <h3 className="font-semibold text-sm tracking-wide">AI Assistant</h3>
            <span className="text-[10.5px] opacity-80">RAG-powered Tutor</span>
          </div>
        </div>
        <button 
          onClick={handleClearChat}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/90 hover:text-white"
          title="Xóa lịch sử chat"
        >
          <FiTrash2 className="text-sm" />
        </button>
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
                  className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.sender === 'user' 
                      ? 'bg-smart-indigo text-white rounded-tr-none' 
                      : msg.isError 
                        ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900 rounded-tl-none'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-100 dark:border-slate-650 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing Animation */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start max-w-[85%]">
              <div className="w-7 h-7 rounded-full bg-smart-indigo/10 dark:bg-smart-indigo/20 text-smart-indigo dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mr-2 border border-smart-indigo/10 dark:border-smart-indigo/20">
                AI
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-650 shadow-sm flex items-center space-x-1 h-[34px]">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
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

      {/* Input Bottom Form */}
      <form 
        onSubmit={handleSubmit}
        className="px-3 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center space-x-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask a question..."
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
      </form>
    </div>
  );
};

export default ChatBox;
