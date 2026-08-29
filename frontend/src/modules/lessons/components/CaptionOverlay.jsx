/**
 * CaptionOverlay Component - Hiển thị Phụ đề Tùy biến Mượt mà trên Video Player (60 FPS Smooth Sync)
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Lead)
 */

import React, { useMemo } from 'react';
import { getCaptionVisualStyles } from '../utils/captionSettings';

export default function CaptionOverlay({ cues = [], currentTime = 0, mode = 'bilingual', settings }) {
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

  const visualStyles = useMemo(() => getCaptionVisualStyles(settings), [settings]);

  if (mode === 'off' || !activeCue) return null;

  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-14 z-20 flex items-center justify-center px-4 pointer-events-none">
      <div
        className="max-w-[94%] select-none rounded-xl px-3 py-2 text-center leading-relaxed sm:max-w-[86%] sm:px-5 md:max-w-[76%]"
        style={visualStyles.window}
      >
        {(mode === 'en' || mode === 'bilingual') && (
          <p className="text-[1em] font-semibold">
            <span className="box-decoration-clone px-1.5 py-0.5" style={visualStyles.line}>
              {activeCue.en}
            </span>
          </p>
        )}
        {(mode === 'vi' || mode === 'bilingual') && (
          <p className={`text-[0.84em] font-normal ${mode === 'bilingual' ? 'mt-1.5' : ''}`}>
            <span className="box-decoration-clone px-1.5 py-0.5" style={visualStyles.line}>
              {activeCue.vi}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
