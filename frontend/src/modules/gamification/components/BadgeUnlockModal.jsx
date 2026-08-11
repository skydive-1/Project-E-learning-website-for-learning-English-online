import React from 'react';
import { FiAward, FiCheck, FiShare2, FiX } from 'react-icons/fi';
import { useGamification } from '../../../context/GamificationContext';

const BadgeUnlockModal = () => {
  const { activeBadgePopup, closeBadgePopup } = useGamification();

  if (!activeBadgePopup) return null;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Tôi vừa nhận được Huy hiệu "${activeBadgePopup.title}"!`,
        text: `Tôi vừa mở khóa huy hiệu "${activeBadgePopup.title}" trên E-Learn Academy!`,
        url: window.location.href,
      }).catch(err => console.warn("Share error:", err));
    } else {
      alert(`Đã sao chép liên kết chia sẻ huy hiệu "${activeBadgePopup.title}" vào bộ nhớ tạm!`);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade select-none">
      
      {/* Modal Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden animate-scaleUp">
        
        {/* Decorative Glowing Backdrop Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={closeBadgePopup}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
        >
          <FiX className="text-lg" />
        </button>

        {/* Badge Header Tag */}
        <div>
          <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-indigo-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-black uppercase tracking-widest inline-block shadow-sm">
            ✨ HUY HIỆU THÀNH TÍCH MỚI
          </span>
        </div>

        {/* Glowing Badge Icon Container */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 opacity-30 blur-lg animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 border-4 border-amber-300 shadow-xl flex items-center justify-center text-5xl transform hover:scale-105 transition-transform">
            {activeBadgePopup.icon || '🏆'}
          </div>
        </div>

        {/* Badge Info */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {activeBadgePopup.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-xs mx-auto">
            {activeBadgePopup.description}
          </p>
        </div>

        {/* Date Unlocked Badge */}
        <div className="inline-block px-4 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-extrabold font-mono">
          📅 Mở khóa lúc: {activeBadgePopup.unlockedAt || new Date().toLocaleDateString('vi-VN')}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={closeBadgePopup}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <FiCheck className="text-base" />
            <span>Nhận Huy Hiệu</span>
          </button>

          <button
            onClick={handleShare}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <FiShare2 className="text-sm" />
            <span>Chia sẻ</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default BadgeUnlockModal;
