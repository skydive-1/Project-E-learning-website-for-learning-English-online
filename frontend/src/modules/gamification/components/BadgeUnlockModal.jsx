import React from 'react';
import { FiCheck, FiShare2, FiX } from 'react-icons/fi';
import { useGamification } from '../../../context/GamificationContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';

const BadgeUnlockModal = () => {
  const { activeBadgePopup, closeBadgePopup } = useGamification();
  const showToast = useToast();
  const { language } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';

  if (!activeBadgePopup) return null;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Tôi vừa nhận được Huy hiệu "${activeBadgePopup.title}"!`,
        text: `Tôi vừa mở khóa huy hiệu "${activeBadgePopup.title}" trên E-Learn Academy!`,
        url: window.location.href,
      }).catch(err => console.warn("Share error:", err));
    } else {
      showToast(`Đã sao chép liên kết chia sẻ huy hiệu "${activeBadgePopup.title}" vào bộ nhớ tạm!`, 'success');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-modal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md select-none transition-opacity duration-200"
    >
      {/* Modal Surface with BoardUI Dark Discipline */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/95 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
        
        {/* Ambient Subtle Warm Backlight (Centered, Single Aura instead of random blobs) */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeBadgePopup}
          aria-label="Đóng cửa sổ huy hiệu"
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <FiX className="text-base" />
        </button>

        {/* Dignified Subtitle - No scream caps, clear information */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-400/90">
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span>Chứng nhận thành tích học tập</span>
        </div>

        {/* The Crest Symbol with Intentional Spring Pop & Single Aura Impulse */}
        <div className="relative my-6 mx-auto flex size-28 items-center justify-center">
          {/* Single expanding impulse ring on unlock (runs once, stops) */}
          <div className="badge-aura-impulse absolute inset-0 rounded-full border border-amber-400/30 bg-amber-400/10 pointer-events-none" />

          {/* Crest Insignia */}
          <div className="badge-crest-pop relative flex size-24 items-center justify-center rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 text-5xl shadow-xl shadow-amber-950/50 ring-4 ring-amber-400/10">
            <span role="img" aria-label={activeBadgePopup.title}>
              {activeBadgePopup.icon || '🏆'}
            </span>
          </div>
        </div>

        {/* Badge Info */}
        <div className="space-y-2">
          <h2 id="badge-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            {activeBadgePopup.title}
          </h2>
          <p className="mx-auto max-w-xs text-xs sm:text-sm leading-relaxed text-slate-400">
            {activeBadgePopup.description}
          </p>
        </div>

        {/* Date Unlocked Badge */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] font-mono text-slate-400 tabular-nums">
          <span className="text-slate-500">Mốc đạt:</span>
          <span className="font-semibold text-slate-300">
            {activeBadgePopup.unlockedAt || new Date().toLocaleDateString(locale)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={closeBadgePopup}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] py-2.5 px-5 text-xs font-semibold text-slate-950 shadow-md shadow-amber-950/40 transition-all cursor-pointer"
          >
            <FiCheck className="text-sm" />
            <span>Nhận huy hiệu</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 active:scale-[0.98] py-2.5 px-4 text-xs font-medium text-slate-200 transition-all cursor-pointer"
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
