import React, { useRef } from 'react';
import { FiAlertTriangle, FiClock, FiCpu, FiArrowDown, FiUserCheck } from 'react-icons/fi';
import LessonCard from './LessonCard';
import AiThinkingState from './AiThinkingState';

/**
 * MessageList Component (Udemy AI Assistant direction)
 * - Tối ưu tỷ lệ giãn dòng (line-height: 1.6), kích thước font dễ đọc
 * - Phân biệt trực quan rõ ràng giữa User Bubble và AI Bubble
 * - Tự do cuộn chuột mượt mà khi AI đang stream, không bị giật nảy
 * - Nút nổi "Cuộn xuống dưới" khi người dùng cuộn lên trên
 */
const MessageList = ({
  messages,
  isHistoryLoading,
  quizStates,
  setQuizStates,
  onSeekVideo,
  onNavigate,
  lessonId,
  messagesEndRef,
  onScrollPosition,
  showScrollBottomBtn,
  onScrollToBottom,
  onAskInstructor = null
}) => {
  const containerRef = useRef(null);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distanceToBottom <= 80;
    if (onScrollPosition) {
      onScrollPosition(isAtBottom);
    }
  };

  if (isHistoryLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/40">
        {/* User Skeleton */}
        <div className="flex justify-end animate-pulse">
          <div className="w-[65%] h-11 bg-slate-200 dark:bg-slate-700/70 rounded-2xl rounded-tr-xs"></div>
        </div>
        {/* AI Skeleton */}
        <div className="flex items-start gap-2.5 animate-pulse">
          <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0"></div>
          <div className="w-[75%] space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700/70 rounded-md w-full"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700/70 rounded-md w-[85%]"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700/70 rounded-md w-[60%]"></div>
          </div>
        </div>
        {/* User Skeleton 2 */}
        <div className="flex justify-end animate-pulse">
          <div className="w-[50%] h-10 bg-slate-200 dark:bg-slate-700/70 rounded-2xl rounded-tr-xs"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/40 dark:bg-slate-900/40"
      >
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';
        const isError = msg.isError;
        const isQuotaNotice = msg.errorCode === 'AI_QUESTION_LIMIT_REACHED'
          || msg.errorCode === 'GEMINI_QUOTA_EXHAUSTED';

        return (
          <div
            key={msg.id}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`flex items-start gap-2.5 max-w-[92%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* AI Avatar */}
              {!isUser && (
                <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900/50 text-smart-indigo dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                  <FiCpu className="text-xs" />
                </div>
              )}

              {/* Message Bubble Container */}
              <div
                className={`px-4 py-3 rounded-2xl text-[13px] sm:text-[13.5px] leading-[1.65] transition-all ${
                  isUser
                    ? 'bg-smart-indigo text-white rounded-tr-xs shadow-sm shadow-indigo-600/10'
                    : isQuotaNotice
                    ? 'bg-amber-50 dark:bg-amber-950/25 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 rounded-tl-xs'
                    : isError
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded-tl-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-750 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 rounded-tl-xs shadow-2xs'
                }`}
                role={isError ? 'status' : undefined}
                aria-live={isError ? 'polite' : undefined}
              >
                {/* Interactive Quiz Mode */}
                {msg.quizData ? (
                  <div className="space-y-3 min-w-[240px]">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700/60 pb-2">
                      <span>📝</span>
                      <span>Bài tập trắc nghiệm nhanh</span>
                    </div>

                    {(() => {
                      const qState = quizStates[msg.id] || { currentIdx: 0, selectedOption: null, isAnswered: false, score: 0 };
                      const currentIdx = qState.currentIdx;
                      const total = msg.quizData.length;

                      if (currentIdx >= total) {
                        return (
                          <div className="text-center py-2.5 space-y-2">
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              🎉 Bạn đã hoàn thành bài tập!
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              Điểm số: <strong className="text-emerald-600 dark:text-emerald-400">{qState.score}/{total}</strong> câu đúng.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setQuizStates(prev => ({
                                  ...prev,
                                  [msg.id]: { currentIdx: 0, selectedOption: null, isAnswered: false, score: 0 }
                                }));
                              }}
                              className="mt-2 text-xs px-3.5 py-1.5 bg-smart-indigo hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Làm lại
                            </button>
                          </div>
                        );
                      }

                      const currentQuestion = msg.quizData[currentIdx];

                      return (
                        <div className="space-y-3">
                          {/* Progress counter */}
                          <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-bold uppercase tracking-wider">
                            <span>Câu hỏi {currentIdx + 1}/{total}</span>
                            {qState.isAnswered && (
                              <span className={qState.selectedOption === currentQuestion.correctAnswer ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                                {qState.selectedOption === currentQuestion.correctAnswer ? '✓ Chính xác!' : '✗ Chưa chính xác'}
                              </span>
                            )}
                          </div>

                          {/* Question text */}
                          <p className="text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                            {currentQuestion.question}
                          </p>

                          {/* Options */}
                          <div className="flex flex-col gap-1.5">
                            {currentQuestion.options.map((opt, oIdx) => {
                              let btnStyle = "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-smart-indigo";

                              if (qState.isAnswered) {
                                if (oIdx === currentQuestion.correctAnswer) {
                                  btnStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold";
                                } else if (oIdx === qState.selectedOption) {
                                  btnStyle = "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-700 dark:text-red-300";
                                } else {
                                  btnStyle = "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 text-slate-400 opacity-50";
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

                          {/* Explanation */}
                          {qState.isAnswered && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giải thích chi tiết:</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
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
                                className="w-full mt-2 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 font-bold rounded-lg text-xs cursor-pointer transition-colors"
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
                  /* Initial AI Thinking State */
                  <AiThinkingState />
                ) : (
                  /* Standard AI / User Text Response */
                  <>
                    {isError && !isUser && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em]">
                        {isQuotaNotice ? <FiClock aria-hidden="true" /> : <FiAlertTriangle aria-hidden="true" />}
                        <span>{isQuotaNotice ? 'Hạn mức trợ lý AI' : 'Không thể xử lý yêu cầu'}</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap selection:bg-indigo-100 selection:text-indigo-900">
                      {msg.text}
                    </div>

                    {/* Streaming Cursor */}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-smart-indigo dark:bg-indigo-400 animate-pulse align-middle rounded-2xs"></span>
                    )}

                    {msg.isStopped && (
                      <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Đã dừng phản hồi
                      </div>
                    )}

                    {/* Verified Lesson Cards (Udemy-like Recommendation Cards) */}
                    {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                      <div className="ai-lesson-cards-container">
                        {msg.sources.map((source, sIdx) => (
                          <LessonCard
                            key={`src-${msg.id}-${sIdx}-${source.lessonId}`}
                            source={source}
                            action={msg.actions?.[sIdx]}
                            currentLessonId={lessonId}
                            onSeekVideo={onSeekVideo}
                            onNavigate={onNavigate}
                          />
                        ))}
                      </div>
                    )}
                    {/* Action Hỏi giảng viên cho phản hồi AI đã hoàn tất */}
                    {!isUser && !msg.isStreaming && !isError && !isQuotaNotice && msg.text?.trim() && onAskInstructor && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const msgIndex = messages.findIndex((m) => m.id === msg.id);
                            let userPrompt = '';
                            for (let i = msgIndex - 1; i >= 0; i--) {
                              if (messages[i].sender === 'user') {
                                userPrompt = messages[i].text;
                                break;
                              }
                            }
                            onAskInstructor({
                              question: userPrompt,
                              aiResponse: msg.text
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-smart-indigo dark:text-slate-400 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all cursor-pointer"
                          title="Gửi câu hỏi này đến Giảng viên để được giải thích thêm"
                          aria-label="Hỏi giảng viên về phản hồi này"
                        >
                          <FiUserCheck className="text-xs" />
                          <span>Hỏi giảng viên</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
      </div>

      {/* Nút nổi cuộn xuống đáy thông minh khi người dùng cuộn lên đọc tin cũ */}
      {showScrollBottomBtn && (
        <div className="absolute bottom-3 right-4 z-20 animate-fade-in">
          <button
            type="button"
            onClick={onScrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg rounded-full text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-smart-indigo dark:hover:text-indigo-400 transition-all duration-200 cursor-pointer backdrop-blur-xs active:scale-95"
            title="Cuộn xuống tin nhắn mới nhất"
            aria-label="Cuộn xuống tin nhắn mới nhất"
          >
            <FiArrowDown className="text-xs animate-bounce" />
            <span>Cuộn xuống dưới</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageList;
