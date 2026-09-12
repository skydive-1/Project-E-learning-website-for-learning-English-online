import React, { useEffect, useRef, useState } from 'react';

/**
 * AnimatedStatNumber - Hiệu ứng nhảy số / count-up mượt mà 60fps chuẩn BoardUI
 * - Hoạt động bằng requestAnimationFrame với đường cong easeOutExpo
 * - Tự động nhảy số lại khi giá trị "value" thay đổi (từ giá trị cũ sang giá trị mới)
 * - Hỗ trợ số thập phân (decimals), tiền tệ ($0.6138), định dạng quốc tế (Intl/locale)
 * - Tôn trọng prefers-reduced-motion và môi trường test (hiển thị ngay giá trị đích)
 * - Tối ưu font-variant-numeric: tabular-nums để giữ layout ổn định khi số nhảy
 */
const AnimatedStatNumber = ({
  value,
  duration = 900,
  suffix = '',
  prefix = '',
  decimals = 0,
  formatter = null,
  className = ''
}) => {
  const elementRef = useRef(null);
  const frameRef = useRef(null);
  const prevValueRef = useRef(0);
  const hasAnimatedRef = useRef(false);

  const numericTarget = Number.isFinite(Number(value)) ? Number(value) : 0;

  const isTestOrReducedMotion = () => {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return true;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  };

  const [displayValue, setDisplayValue] = useState(() => {
    return isTestOrReducedMotion() ? numericTarget : 0;
  });

  useEffect(() => {
    if (isTestOrReducedMotion()) {
      setDisplayValue(numericTarget);
      prevValueRef.current = numericTarget;
      return undefined;
    }

    const node = elementRef.current;
    if (!node) return undefined;

    const startValue = hasAnimatedRef.current ? prevValueRef.current : 0;
    hasAnimatedRef.current = true;

    if (startValue === numericTarget) {
      setDisplayValue(numericTarget);
      prevValueRef.current = numericTarget;
      return undefined;
    }

    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo cho cảm giác số nhảy mạnh mẽ lúc đầu rồi hãm phanh mượt mà
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startValue + (numericTarget - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(numericTarget);
        prevValueRef.current = numericTarget;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [numericTarget, duration]);

  const formatNumber = (val) => {
    if (formatter) return formatter(val);
    if (decimals > 0) {
      return val.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }
    return Math.round(val).toLocaleString('vi-VN');
  };

  return (
    <span ref={elementRef} className={`tabular-nums ${className}`.trim()}>
      {prefix}{formatNumber(displayValue)}{suffix}
    </span>
  );
};

export default AnimatedStatNumber;
