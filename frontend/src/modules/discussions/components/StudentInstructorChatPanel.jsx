import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiSend, FiClock, FiPlay, FiCheck, FiCheckCircle,
  FiRotateCcw, FiX
} from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';
import {
  markDiscussionRead,
  sendStudentMessage,
  discussionApiErrorMessage
} from '../services/discussions.service';

/**
 * Format số giây thành định dạng mm:ss
 */
const formatSeconds = (sec) => {
  if (!sec && sec !== 0) return '00:00';
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * StudentInstructorChatPanel Component
 * - Thiết kế theo phong cách khung chat trực tiếp Messenger / Instagram Direct Message
 * - Đơn giản, tinh tế, không rườm rà (loại bỏ forum, bộ lọc phức tạp, form đặt câu hỏi riêng)
 * - Hỗ trợ đính kèm mốc video hiện tại (click-to-seek video 2 chiều)
 * - Tự động đồng bộ và hiển thị tin nhắn chuyển từ AI Chat ("Hỏi giảng viên")
 */
const StudentInstructorChatPanel = ({
  lessonId = '1',
  instructorName = 'Giảng viên khóa học',
  currentTime = 0,
  onSeekVideo = null,
  discussions = [],
  setDiscussions = () => {},
  isLoading = false,
  error = '',
  onRefresh = null,
  userRole = 3
}) => {
  const showToast = useToast();

  const [inputText, setInputText] = useState('');
  const [isAttachingTime, setIsAttachingTime] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Local message thread state (phục vụ hiển thị mượt mà như Messenger/Instagram)
  const [messages, setMessages] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Khởi tạo và đồng bộ tin nhắn từ discussions props (hoặc tạo tin nhắn khởi đầu)
  useEffect(() => {
    // Nếu có discussions được truyền vào từ backend hoặc AI Chat:
    if (discussions && discussions.length > 0) {
      const flattened = [];
      discussions.forEach((disc) => {
        // Tin nhắn hỏi của học viên
        flattened.push({
          id: `disc-${disc.id}-q`,
          discussionId: disc.id,
          sender: 'student',
          text: disc.content || disc.title,
          title: disc.title,
          aiResponse: disc.aiResponse,
          timestampSeconds: disc.timestampSeconds,
          timestampFormatted: disc.timestampFormatted,
          timeStr: disc.createdAt || 'Vừa xong',
          createdAtRaw: disc.createdAtRaw
        });

        // Danh sách phản hồi
        if (disc.replies && Array.isArray(disc.replies)) {
          disc.replies.forEach((rep) => {
            flattened.push({
              id: `rep-${rep.id}`,
              discussionId: disc.id,
              sender: rep.isInstructor ? 'instructor' : 'student',
              authorName: rep.author?.name || (rep.isInstructor ? instructorName : 'Học viên'),
              text: rep.content,
              aiResponse: rep.aiResponse,
              timestampSeconds: rep.timestampSeconds,
              timestampFormatted: rep.timestampFormatted,
              timeStr: rep.createdAt || 'Vừa xong',
              createdAtRaw: rep.createdAtRaw
            });
          });
        }
      });
      flattened.sort((left, right) => {
        const leftTime = new Date(left.createdAtRaw || 0).getTime();
        const rightTime = new Date(right.createdAtRaw || 0).getTime();
        return leftTime - rightTime;
      });
      setMessages(flattened);
    } else {
      setMessages([]);
    }
  }, [discussions, instructorName]);

  useEffect(() => {
    const unreadIds = discussions.filter((item) => item.unread).map((item) => item.id);
    if (unreadIds.length === 0) return;

    Promise.allSettled(unreadIds.map((id) => markDiscussionRead(id))).then((results) => {
      const readIds = unreadIds.filter((_, index) => results[index]?.status === 'fulfilled');
      if (readIds.length === 0) return;
      setDiscussions((previous) => previous.map((item) => (
        readIds.some((id) => String(id) === String(item.id))
          ? { ...item, unread: false }
          : item
      )));
    });
  }, [discussions, setDiscussions]);

  // Tự động cuộn mượt mà xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Xử lý gửi tin nhắn của học viên
   */
  const handleSendMessage = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || isSending) return;

    const currentStamp = isAttachingTime ? Math.floor(currentTime || 0) : null;
    setIsSending(true);

    try {
      const updated = await sendStudentMessage({
        lessonId,
        content: textToSend,
        timestampSeconds: currentStamp
      });
      setDiscussions((previous) => [
        updated,
        ...previous.filter((item) => String(item.id) !== String(updated.id))
      ]);
      setInputText('');
      setIsAttachingTime(false);
      showToast('Đã gửi tin nhắn cho giảng viên.', 'success');
    } catch (err) {
      showToast(discussionApiErrorMessage(err, 'Không thể gửi tin nhắn lúc này.'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Làm mới cuộc trò chuyện
   */
  const handleRefreshChat = () => {
    onRefresh?.();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs relative select-text transition-colors">
      {/* Thông báo điều hướng cho Giảng viên / Quản trị viên */}
      {(userRole === 1 || userRole === 2) && (
        <div className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs shrink-0">
          <span className="text-smart-indigo dark:text-blue-300 font-semibold flex items-center gap-1.5">
            <span>👨‍🏫</span> Bạn đang xem với vai trò Giảng viên
          </span>
          <Link
            to="/instructor/dashboard?tab=interaction"
            className="text-[11px] font-bold text-smart-indigo dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Mở Hộp thư tương tác đầy đủ →
          </Link>
        </div>
      )}

      {/* 1. HEADER (Kiểu Messenger / Instagram Direct Message) */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center space-x-2.5 min-w-0">
          {/* Avatar giảng viên với Online Indicator */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-2xs">
              <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center font-bold text-sm text-smart-indigo dark:text-indigo-400">
                👩‍🏫
              </div>
            </div>
            {/* Green Active Dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-400 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-2xs"
              title="Hệ thống chưa hiển thị trạng thái trực tuyến"
            />
          </div>

          {/* Tên giảng viên & Trạng thái */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-[13px] sm:text-[13.5px] text-slate-800 dark:text-slate-100 truncate tracking-tight">
                {instructorName}
              </h3>
              <FiCheckCircle className="text-blue-500 text-xs shrink-0" title="Giảng viên đã xác thực" />
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <span>Trao đổi qua tin nhắn</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>Giảng viên khóa học</span>
            </p>
          </div>
        </div>

        {/* Nút thao tác nhanh bên phải */}
        <div className="flex items-center gap-1">
          {currentTime > 5 && (
            <button
              type="button"
              onClick={() => setIsAttachingTime((prev) => !prev)}
              className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                isAttachingTime
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-smart-indigo dark:text-blue-400 border border-indigo-200 dark:border-indigo-800'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Gắn mốc bài giảng hiện tại"
            >
              <FiClock className="text-[11px]" />
              <span>{formatSeconds(currentTime)}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefreshChat}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tải lại tin nhắn"
            aria-label="Tải lại tin nhắn"
          >
            <FiRotateCcw className="text-xs" />
          </button>
        </div>
      </div>

      {/* 2. BODY KHUNG CHAT (Scrollable Feed) */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-slate-50/40 dark:bg-slate-950/30">
        {/* Instagram Profile Introduction Card (Đầu khung chat) */}
        <div className="flex flex-col items-center text-center pt-2 pb-3 space-y-2 border-b border-slate-200/60 dark:border-slate-800/60 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-sm">
            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-2xl">
              👩‍🏫
            </div>
          </div>
          <div>
            <h4 className="font-bold text-[14px] text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1">
              <span>{instructorName}</span>
              <FiCheckCircle className="text-blue-500 text-xs" />
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Giảng viên Tiếng Anh tại E-Learn Academy
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800 max-w-[340px] text-left shadow-2xs">
            <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
              Tin nhắn tại đây được gửi trực tiếp đến giảng viên phụ trách. Giảng viên sẽ phản hồi bằng tài khoản của họ khi xem được câu hỏi của bạn.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" role="alert">
            {error}
          </div>
        )}

        {isLoading && messages.length === 0 && (
          <p className="py-3 text-center text-[11px] text-slate-400">Đang tải tin nhắn...</p>
        )}

        {/* 3. STREAM DANH SÁCH TIN NHẮN (MESSENGER / INSTAGRAM BUBBLES) */}
        {messages.map((msg) => {
          const isStudent = msg.sender === 'student';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isStudent ? 'items-end' : 'items-start'} space-y-1 animate-fade-in`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                {!isStudent && (
                  <span className="font-semibold text-smart-indigo dark:text-blue-400">
                    {msg.authorName || instructorName}
                  </span>
                )}
                <span>{msg.timeStr}</span>
              </div>

              <div
                className={`max-w-[86%] sm:max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[12.5px] sm:text-[13px] leading-relaxed whitespace-pre-wrap transition-all shadow-2xs ${
                  isStudent
                    ? 'bg-smart-indigo text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-bl-xs'
                }`}
              >
                {/* Trích dẫn phản hồi AI (nếu được chuyển từ AI Chat) */}
                {msg.aiResponse && (
                  <div className="mb-2 p-2 rounded-xl bg-black/10 dark:bg-black/30 border border-white/20 text-[11px] space-y-0.5">
                    <p className="font-bold flex items-center gap-1 text-white/90">
                      <span>✨</span> Phản hồi từ AI Chat được đính kèm:
                    </p>
                    <p className="line-clamp-3 italic opacity-90">{msg.aiResponse}</p>
                  </div>
                )}

                {/* Nội dung câu hỏi/tin nhắn */}
                <p>{msg.text}</p>

                {/* Mốc video kèm theo */}
                {msg.timestampFormatted && (
                  <div className={`mt-2 pt-1.5 border-t flex items-center gap-1 text-[11px] ${
                    isStudent ? 'border-white/20 text-white/90' : 'border-slate-100 dark:border-slate-700/60 text-slate-500 dark:text-slate-400'
                  }`}>
                    <span>Mốc bài giảng:</span>
                    <button
                      type="button"
                      onClick={() => onSeekVideo && onSeekVideo(msg.timestampSeconds)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[10px] cursor-pointer transition-colors ${
                        isStudent
                          ? 'bg-white/20 hover:bg-white/30 text-white'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-smart-indigo dark:text-blue-400 hover:bg-blue-100'
                      }`}
                      title={`Tua video đến ${msg.timestampFormatted}`}
                    >
                      <FiPlay className="text-[9px]" />
                      <span>{msg.timestampFormatted}</span>
                    </button>
                  </div>
                )}
              </div>

              {isStudent && (
                <div className="flex items-center gap-1 text-[9.5px] text-slate-400 pr-1">
                  <FiCheck className="text-emerald-500" />
                  <span>Đã gửi</span>
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. COMPOSER NHẬP TIN NHẮN (Kiểu Messenger / Instagram) */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
        {/* Tag hiển thị mốc video đang đính kèm nếu bật */}
        {isAttachingTime && (
          <div className="mb-2 flex items-center justify-between px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-smart-indigo dark:text-blue-400 animate-fade-in">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold">
              <FiClock className="text-xs" />
              Đính kèm mốc bài giảng: {formatSeconds(currentTime)}
            </span>
            <button
              type="button"
              onClick={() => setIsAttachingTime(false)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Gỡ đính kèm"
            >
              <FiX className="text-xs" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-1.5"
        >
          {/* Nút bật/tắt đính kèm mốc thời gian */}
          <button
            type="button"
            onClick={() => setIsAttachingTime((prev) => !prev)}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
              isAttachingTime
                ? 'bg-indigo-100 dark:bg-indigo-950 text-smart-indigo dark:text-blue-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Đính kèm mốc video hiện tại"
            aria-label="Đính kèm mốc video hiện tại"
          >
            <FiClock className="text-[15px]" />
          </button>

          {/* Ô nhập tin nhắn */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập tin nhắn cho giảng viên..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-[13px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-smart-indigo dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-smart-indigo/10 transition-all"
            />
          </div>

          {/* Nút gửi tin nhắn */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              inputText.trim()
                ? 'bg-smart-indigo hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-500/20 active:scale-95'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
            title="Gửi tin nhắn"
            aria-label="Gửi tin nhắn"
          >
            <FiSend className="text-[15px]" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentInstructorChatPanel;
