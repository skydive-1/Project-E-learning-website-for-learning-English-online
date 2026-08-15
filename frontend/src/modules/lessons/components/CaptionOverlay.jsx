/**
 * CaptionOverlay Component - Hiển thị Phụ đề Tùy biến trên Video Player
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Lead)
 */

import React, { useMemo } from 'react';

export default function CaptionOverlay({ cues = [], currentTime = 0, mode = 'bilingual' }) {
  if (mode === 'off' || !cues || cues.length === 0) return null;

  // Tìm câu subtitle tương ứng với thời gian phát hiện tại của video
  const activeCue = useMemo(() => {
    return cues.find(cue => currentTime >= cue.start && currentTime <= cue.end);
  }, [cues, currentTime]);

  if (!activeCue) return null;

  return (
    <div className="absolute bottom-12 inset-x-0 flex justify-center items-center pointer-events-none z-20 px-4">
      <div className="max-w-[90%] sm:max-w-[80%] bg-black/75 backdrop-blur-md border border-white/10 text-center py-2 px-4 sm:px-6 rounded-2xl shadow-2xl transition-all duration-150 animate-fade-in select-none">
        {(mode === 'en' || mode === 'bilingual') && (
          <p className="text-white font-semibold text-sm sm:text-base md:text-lg leading-snug drop-shadow-md tracking-wide">
            {activeCue.en}
          </p>
        )}
        {(mode === 'vi' || mode === 'bilingual') && (
          <p className={`font-normal text-xs sm:text-sm text-amber-300/90 leading-snug drop-shadow ${mode === 'bilingual' ? 'mt-1 pt-1 border-t border-white/10' : ''}`}>
            {activeCue.vi}
          </p>
        )}
      </div>
    </div>
  );
}
