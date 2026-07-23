import React, { useState, useEffect, useRef, useCallback } from 'react';

const GLYPHS = '!@#$%^&*()_+{}:"<>?[];\',./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const ScrambleText = ({ text, className = '' }) => {
  const [displayText, setDisplayText] = useState(text);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const animationFrameRef = useRef(null);

  // Check for prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const listener = (e) => {
      setIsReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const runScramble = useCallback(() => {
    if (isReducedMotion) {
      setDisplayText(text);
      return;
    }

    const length = text.length;
    const revealDelay = 50; // ms per character delay before locking
    const fps = 30;
    const frameInterval = 1000 / fps;

    let start = null;
    let lastTime = 0;

    const tick = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;

      if (timestamp - lastTime >= frameInterval) {
        lastTime = timestamp;

        let output = '';
        let isDone = true;

        for (let i = 0; i < length; i++) {
          const char = text[i];
          if (char === ' ') {
            output += ' ';
            continue;
          }

          // Each character has a specific settle deadline
          const settleDeadline = i * revealDelay;

          if (elapsed >= settleDeadline) {
            output += char;
          } else {
            // Cycle random glyphs
            const randomChar = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            output += randomChar;
            isDone = false;
          }
        }

        setDisplayText(output);

        if (isDone) {
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  }, [text, isReducedMotion]);

  useEffect(() => {
    runScramble();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [runScramble]);

  const handleMouseEnter = () => {
    runScramble();
  };

  if (isReducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      aria-label={text}
      className={className}
      onMouseEnter={handleMouseEnter}
      style={{ display: 'inline-block' }}
    >
      <span
        aria-hidden="true"
        className="scramble-churning"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontVariantNumeric: 'tabular-nums',
          display: 'inline-block',
          whiteSpace: 'pre'
        }}
      >
        {displayText}
      </span>
    </span>
  );
};

export default ScrambleText;
