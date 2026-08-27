import React, { useEffect, useState } from 'react';

const chevron = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return (column + Math.abs(row - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, index) => {
  const position = ORBIT_ORDER.indexOf(index);
  return position === -1 ? null : position * 110;
});

const PATTERNS = {
  Drive: { delays: chevron, duration: 650, round: false },
  Dots: { delays: chevron, duration: 650, round: true },
  Orbit: { delays: orbit, duration: 950, round: false }
};

const LoaderGrid = ({ delays, duration, round }) => (
  <span
    aria-hidden="true"
    className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px] text-smart-indigo dark:text-indigo-400"
  >
    {delays.map((delay, index) => (
      <span
        key={index}
        data-pixel-cell
        className={`chatbot-thinking-pixel size-[4px] ${round ? 'rounded-full' : 'rounded-[1px]'}`}
        style={{
          backgroundColor: 'currentColor',
          opacity: delay === null ? 0.07 : 0.15,
          animation: delay === null
            ? 'none'
            : `chatbot-pixel-on ${duration}ms ease-in-out ${delay}ms infinite`
        }}
      />
    ))}
  </span>
);

const formatElapsed = (deciseconds) => {
  const totalSeconds = deciseconds / 10;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  return `${Math.floor(totalSeconds / 60)}m ${(totalSeconds % 60).toFixed(1)}s`;
};

const AiThinkingState = ({
  label = 'AI đang tra cứu tài liệu & suy nghĩ...',
  variant = 'Drive'
}) => {
  const [deciseconds, setDeciseconds] = useState(0);
  const pattern = PATTERNS[variant] || PATTERNS.Drive;

  useEffect(() => {
    const timerId = setInterval(() => {
      setDeciseconds(current => current + 1);
    }, 100);

    return () => clearInterval(timerId);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="chatbot-thinking-state flex w-fit items-center gap-2.5 py-0.5"
    >
      <LoaderGrid {...pattern} />
      <span className="chatbot-thinking-label text-[12px] sm:text-[12.5px] font-medium">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums"
      >
        {formatElapsed(deciseconds)}
      </span>
    </div>
  );
};

export default AiThinkingState;
