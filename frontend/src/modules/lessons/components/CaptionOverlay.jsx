/**
 * CaptionOverlay Component - Hiển thị Phụ đề Tùy biến Mượt mà trên Video Player (60 FPS Smooth Sync)
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Lead)
 */

import React, { useMemo } from 'react';

export default function CaptionOverlay({ cues = [], currentTime = 0, mode = 'bilingual' }) {
  if (mode === 'off' || !cues || cues.length === 0) return null;

  // Tìm câu subtitle tương ứng với thời gian phát hiện tại của video (kèm cơ chế chuyển câu mượt mà không khựng)
  const activeCue = useMemo(() => {
    if (!cues || cues.length === 0) return null;

    // 1. Khớp câu thoại chính xác với dung sai tự nhiên (+0.5s sau khi câu kết thúc)
    const exact = cues.find(cue => currentTime >= (cue.start - 0.1) && currentTime <= (cue.end + 0.5));
    if (exact) return exact;

    // 2. Cầu nối chuyển tiếp giữa 2 câu (Tránh phụ đề bị giật tắt / nhấp nháy khi có khoảng lặng ngắn < 1.0s)
    for (let i = 0; i < cues.length - 1; i++) {
      const cur = cues[i];
      const next = cues[i + 1];
      if (currentTime > cur.end && currentTime < next.start) {
        if (currentTime - cur.end <= 1.0) {
          return cur;
        }
      }
    }

    return null;
  }, [cues, currentTime]);

  if (!activeCue) return null;

  return (
    <div className="absolute bottom-14 inset-x-0 flex justify-center items-center pointer-events-none z-20 px-4 transition-all duration-200 ease-out">
      <div className="max-w-[92%] sm:max-w-[85%] md:max-w-[75%] bg-slate-950/85 backdrop-blur-md border border-white/15 text-center py-2.5 px-5 sm:px-7 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.6)] transition-all duration-200 select-none">
        {(mode === 'en' || mode === 'bilingual') && (
          <p className="text-white font-semibold text-sm sm:text-base md:text-lg leading-relaxed drop-shadow-md tracking-wide">
            {activeCue.en}
          </p>
        )}
        {(mode === 'vi' || mode === 'bilingual') && (
          <p className={`font-normal text-xs sm:text-sm md:text-[15px] text-amber-300/95 leading-relaxed drop-shadow ${mode === 'bilingual' ? 'mt-1 pt-1.5 border-t border-white/10' : ''}`}>
            {activeCue.vi}
          </p>
        )}
      </div>
    </div>
  );
}
