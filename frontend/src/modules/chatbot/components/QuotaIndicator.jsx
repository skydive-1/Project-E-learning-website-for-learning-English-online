import React from 'react';
import { FiAlertCircle, FiInfo, FiClock } from 'react-icons/fi';

/**
 * QuotaIndicator - Hiển thị trạng hạn mức AI còn lại
 * Props:
 *   quota: { usedQuestions, remainingQuestions, resetAt, isUnlimited, limit }
 *   compact: boolean - hiển thị dạng nhỏ gọn cho header
 *   onClick: function - callback khi click để xem chi tiết
 */
const QuotaIndicator = ({ quota, compact = false, onClick, className = '' }) => {
  if (!quota) return null;

  const { 
    usedQuestions = 0, 
    remainingQuestions = 0, 
    limit = 20, 
    resetAt, 
    isUnlimited = false 
  } = quota;

  const isLow = !isUnlimited && remainingQuestions <= 3;
  const isCritical = !isUnlimited && remainingQuestions <= 0;
  const percentage = isUnlimited ? 100 : Math.round((usedQuestions / limit) * 100);

  const formatResetTime = (resetAt) => {
    if (!resetAt) return '';
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diffMs = resetDate - now;
    if (diffMs <= 0) return 'Đã reset';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours} giờ ${minutes} phút`;
    return `${minutes} phút`;
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all ${
          isCritical 
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
            : isLow 
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        } ${className}`}
        title={isUnlimited ? 'Hạn mức không giới hạn' : `Còn ${remainingQuestions}/${limit} câu hỏi AI. Reset sau ${formatResetTime(resetAt)}`}
        aria-label={isUnlimited ? 'Hạn mức AI không giới hạn' : `Còn ${remainingQuestions} câu hỏi AI`}
      >
        <span className="text-xs font-bold flex items-center gap-1">
          {isUnlimited ? '∞' : remainingQuestions}
          <span className="text-[10px] opacity-70">/ {limit}</span>
        </span>
        {!isUnlimited && (
          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                isCritical ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </button>
    );
  }

  return (
    <div 
      className={`p-4 rounded-2xl border transition-all ${
        isCritical 
          ? 'bg-rose-500/10 border-rose-500/30' 
          : isLow 
            ? 'bg-amber-500/10 border-amber-500/30' 
            : 'bg-emerald-500/10 border-emerald-500/30'
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${
            isCritical ? 'bg-rose-500/20 text-rose-500' : 
            isLow ? 'bg-amber-500/20 text-amber-500' : 
            'bg-emerald-500/20 text-emerald-500'
          }`}>
            {isCritical ? <FiAlertCircle className="w-5 h-5" /> : 
             isLow ? <FiAlertCircle className="w-5 h-5" /> : 
             <FiInfo className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isUnlimited ? 'Hạn mức AI: Không giới hạn' : 'Hạn mức câu hỏi AI'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isUnlimited 
                ? 'Bạn có thể hỏi AI không giới hạn' 
                : `Đã dùng: ${usedQuestions}/${limit} • Còn lại: ${remainingQuestions}`}
            </p>
          </div>
        </div>
        
        {!isUnlimited && (
          <div className="flex flex-col items-end gap-1 min-w-[100px]">
            <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  isCritical ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Reset sau: {formatResetTime(resetAt)}
            </p>
          </div>
        )}
      </div>

      {isCritical && !isUnlimited && (
        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
            <FiAlertCircle className="w-3.5 h-3.5" />
            Bạn đã hết hạn mức câu hỏi AI. Hãy đợi đến lúc reset hoặc nâng cấp gói để tiếp tục sử dụng tính năng AI.
          </p>
        </div>
      )}

      {isLow && !isCritical && !isUnlimited && (
        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <FiClock className="w-3.5 h-3.5" />
            Sắp hết hạn mức ({remainingQuestions} câu còn lại). Hãy sử dụng tiết kiệm hoặc chờ reset sau {formatResetTime(resetAt)}.
          </p>
        </div>
      )}
    </div>
  );
};

export default QuotaIndicator;