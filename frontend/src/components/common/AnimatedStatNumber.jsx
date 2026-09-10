import React, { useEffect, useRef, useState } from 'react';

/**
 * Hiệu ứng đếm số khi phần tử xuất hiện trong khung nhìn (kiểu stat section
 * của các trang SaaS mượt như reflexai.com), nhưng cài đặt tối giản:
 * - Kích hoạt bằng IntersectionObserver (rẻ, không lắng nghe scroll liên tục).
 * - Chỉ chạy đúng 1 lần cho mỗi lần giá trị "value" đổi (không lặp lại mỗi
 *   khi phần tử vào/ra khung nhìn, tránh gây xao nhãng khi cuộn qua lại).
 * - Tôn trọng prefers-reduced-motion: hiển thị thẳng giá trị cuối, không đếm.
 * - Không dùng thư viện ngoài, không tạo thêm bundle.
 *
 * value: số nguyên hoặc số thực cần hiển thị (đích đến của phép đếm)
 * duration: thời gian đếm (ms), mặc định 900ms
 * suffix / prefix: chuỗi thêm trước/sau số (vd: "%", "+")
 * formatter: hàm tuỳ biến cách hiển thị số (mặc định Math.round + toLocaleString)
 */
const AnimatedStatNumber = ({
  value,
  duration = 900,
  suffix = '',
  prefix = '',
  formatter = null,
  className = ''
}) => {
  const elementRef = useRef(null);
  const frameRef = useRef(null);
  const hasAnimatedRef = useRef(false);
  const [displayValue, setDisplayValue] = useState(0);

  const targetValue = Number.isFinite(value) ? value : 0;

  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValue(targetValue);
      return undefined;
    }

    const node = elementRef.current;
    if (!node) return undefined;

    const runCountUp = () => {
      if (hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;

      const startTime = performance.now();
      const startValue = 0;

      const tick = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic — chậm dần về cuối, đúng cảm giác "chốt số" thay vì
        // chạy đều đều máy móc.
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(startValue + (targetValue - startValue) * eased);

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayValue(targetValue);
        }
      };

      frameRef.current = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === 'undefined') {
      runCountUp();
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) runCountUp();
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetValue, duration]);

  const formatted = formatter
    ? formatter(displayValue)
    : Math.round(displayValue).toLocaleString('vi-VN');

  return (
    <span ref={elementRef} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
};

export default AnimatedStatNumber;
