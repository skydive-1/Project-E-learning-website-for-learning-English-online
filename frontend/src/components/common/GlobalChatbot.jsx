import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FiBookOpen, FiX } from 'react-icons/fi';
import ChatBox from '../../modules/chatbot/components/ChatBox';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import './GlobalChatbot.css';

const GlobalChatbot = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // Tự động hiển thị gợi ý bong bóng chào mừng sau 3 giây khi load trang lần đầu
  useEffect(() => {
    if (!user || location.pathname.startsWith('/lessons')) {
      return;
    }

    const timer = setTimeout(() => {
      // Chỉ hiện thông báo nếu chatbot đang đóng
      if (!isOpen) {
        setShowNotification(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isOpen, user, location.pathname]);

  // Không hiển thị trên trang bài học (/lessons) hoặc khi người dùng chưa đăng nhập
  // (Đặt ở đây sau toàn bộ khai báo Hooks để tránh vi phạm Rules of Hooks của React)
  if (!user || location.pathname.startsWith('/lessons')) {
    return null;
  }

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setShowNotification(false);
  };

  return (
    <div className="global-chatbot-container">
      {/* Bong bóng thông báo chào mừng nhỏ */}
      {showNotification && !isOpen && (
        <div className="chatbot-notification-bubble animate-bounce-subtle" onClick={handleToggle}>
          <div className="bubble-close-btn" onClick={(e) => {
            e.stopPropagation();
            setShowNotification(false);
          }}>
            <FiX size={10} />
          </div>
          <p className="bubble-text">{t('Hi! Cần trợ giúp học tiếng Anh? Chat với mình nhé! 👋')}</p>
        </div>
      )}

      {/* Nút kích hoạt Chatbot nổi (Sử dụng Icon cuốn tập FiBookOpen) */}
      <button 
        className={`chatbot-floating-trigger ${isOpen ? 'active-open' : ''}`}
        onClick={handleToggle}
        title={t('Trò chuyện với trợ lý học tiếng Anh AI')}
      >
        <span className="chatbot-trigger-icon-wrapper">
          {isOpen ? <FiX className="trigger-icon" /> : <FiBookOpen className="trigger-icon" />}
        </span>
        
        {/* Radar sóng xung quanh nút khi chưa mở */}
        {!isOpen && <span className="radar-pulse"></span>}
      </button>

      {/* Cửa sổ Chatbot dạng Popover */}
      {isOpen && (
        <div className="chatbot-floating-window animate-slide-up">
          <div className="chatbot-window-body">
            {/* Sử dụng duy nhất header của ChatBox bằng cách truyền onClose */}
            <ChatBox lessonId={0} onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalChatbot;
