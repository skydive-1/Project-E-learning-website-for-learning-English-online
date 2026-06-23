import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiCpu, FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import { askChatbot } from '../services/chatbot.service';

const ChatBox = ({ lessonId }) => {
  const [messages, setMessages] = useState([
    {
      id: "msg-welcome",
      sender: "ai",
      text: "Hello! Tôi là Trợ lý ảo RAG AI học tập của bạn. Tôi đã đọc qua bài học này. Bạn có câu hỏi nào cần giải đáp về ngữ pháp, từ vựng hay muốn luyện phản xạ nói không?",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    // Reset input
    if (!textToSend) setInputText("");

    // Add user message
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Set loading state
    setIsLoading(true);

    try {
      // Gọi API gửi lên backend/gemini
      const aiReply = await askChatbot(text, lessonId);
      
      const aiMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: "ai",
        text: aiReply,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
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

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative">
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* AI Avatar */}
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-full bg-smart-indigo/10 text-smart-indigo flex items-center justify-center font-bold text-xs shrink-0 mr-2 border border-smart-indigo/10">
                  AI
                </div>
              )}
              
              {/* Message Bubble */}
              <div 
                className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                  msg.sender === 'user' 
                    ? 'bg-smart-indigo text-white rounded-tr-none' 
                    : msg.isError 
                      ? 'bg-red-50 text-red-700 border border-red-100 rounded-tl-none'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Animation */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start max-w-[85%]">
              <div className="w-7 h-7 rounded-full bg-smart-indigo/10 text-smart-indigo flex items-center justify-center font-bold text-xs shrink-0 mr-2 border border-smart-indigo/10">
                AI
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-white text-slate-500 border border-slate-100 shadow-sm flex items-center space-x-1 h-[34px]">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 py-2 bg-slate-50 shrink-0 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Gợi ý nhanh cho bạn:</p>
          <div className="flex flex-col space-y-1.5">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt.text)}
                className="text-left text-xs px-3 py-1.5 bg-white border border-slate-200 hover:border-smart-indigo hover:text-smart-indigo text-slate-600 rounded-xl transition-all shadow-sm truncate"
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
        className="px-3 py-3 border-t border-slate-200 bg-white flex items-center space-x-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-smart-indigo focus:bg-white transition-all text-slate-800"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className={`p-2.5 rounded-xl transition-all ${
            inputText.trim() && !isLoading
              ? 'bg-smart-indigo text-white hover:bg-smart-indigo-hover shadow-md hover:shadow-indigo-100'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <FiSend className="text-sm" />
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
