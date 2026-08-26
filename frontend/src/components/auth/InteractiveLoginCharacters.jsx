import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * InteractiveLoginCharacters - Uốn cong, lượn lách bẻ cong di chuyển tự do vào hàng (Organic Slithering & Spline Bending)
 * 
 * 1. Khối Tím (A): Uốn lượn chữ S lượn lách bẻ cong thân hình dẻo quẹo từ trái khung div vào hàng.
 * 2. Khối Đen (B): Uốn cong bẻ người lượn lách từ bên phải khung div vào hàng.
 * 3. Khối Cam (D): Rơi lượn sóng zic-zac bẻ cong trái phải từ trên trần rơi xuống nhún nảy dẻo.
 * 4. Khối Vàng (C): Nhảy uốn éo bẻ cong thân mình lượn lách từng nhịp từ bên phải qua.
 * 5. Sau khi vào hàng: Tracking chuột 0ms tức thì và biểu cảm né tránh khi nhập/xem mật khẩu.
 */

const InteractiveLoginCharacters = ({
  showPassword = false,
  isPasswordFocused = false,
  isEmailFocused = false,
  className = ''
}) => {
  const containerRef = useRef(null);
  const eyesRef = useRef({});
  const animationFrameRef = useRef(null);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isEntranceDone, setIsEntranceDone] = useState(false);

  // Chu kỳ animation uốn lượn bẻ cong (~1.45s)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEntranceDone(true);
    }, 1450);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const handleChange = (e) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isReducedMotion || isPasswordFocused || showPassword || !containerRef.current) {
      return;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      Object.entries(eyesRef.current).forEach(([key, el]) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;

        const deltaX = mouseX - eyeCenterX;
        const deltaY = mouseY - eyeCenterY;
        const angle = Math.atan2(deltaY, deltaX);
        const distance = Math.hypot(deltaX, deltaY);

        const maxRadius = key.startsWith('charB') ? 4.5 : 3.5;
        const radius = Math.min(distance / 50, maxRadius);

        const targetX = Math.cos(angle) * radius;
        const targetY = Math.sin(angle) * radius;

        el.style.transform = `translate(${targetX}px, ${targetY}px)`;
      });
    });
  }, [isReducedMotion, isPasswordFocused, showPassword]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleMouseMove]);

  const isAvoiding = isPasswordFocused || showPassword;

  return (
    <div className={`relative flex items-center justify-center w-full h-full select-none overflow-hidden ${className}`}>
      {/* Định nghĩa CSS Keyframes Animation uốn cong, lượn lách bẻ cong */}
      <style>{`
        @keyframes bendRollLeft {
          0% {
            transform: translate(-420px, 80px) rotate(-100deg) skewX(-45deg) skewY(22deg) scale(0.55, 1.45);
            opacity: 0;
          }
          25% {
            transform: translate(-230px, -45px) rotate(-40deg) skewX(38deg) skewY(-18deg) scale(1.15, 0.88);
            opacity: 1;
          }
          50% {
            transform: translate(-95px, 45px) rotate(28deg) skewX(-32deg) skewY(14deg) scale(0.85, 1.25);
          }
          70% {
            transform: translate(32px, -18px) rotate(-16deg) skewX(22deg) skewY(-10deg) scale(1.12, 0.9);
          }
          85% {
            transform: translate(-12px, 10px) rotate(8deg) skewX(-12deg) skewY(5deg) scale(0.94, 1.06);
          }
          93% {
            transform: translate(4px, -3px) rotate(-3deg) skewX(4deg) skewY(-2deg) scale(1.02, 0.98);
          }
          100% {
            transform: translate(0, 0) rotate(0deg) skewX(0deg) skewY(0deg) scale(1, 1);
            opacity: 1;
          }
        }

        @keyframes bendRollRight {
          0% {
            transform: translate(420px, 80px) rotate(100deg) skewX(45deg) skewY(-22deg) scale(0.55, 1.45);
            opacity: 0;
          }
          25% {
            transform: translate(230px, -45px) rotate(40deg) skewX(-38deg) skewY(18deg) scale(1.15, 0.88);
            opacity: 1;
          }
          50% {
            transform: translate(95px, 45px) rotate(-28deg) skewX(32deg) skewY(-14deg) scale(0.85, 1.25);
          }
          70% {
            transform: translate(-32px, -18px) rotate(16deg) skewX(-22deg) skewY(10deg) scale(1.12, 0.9);
          }
          85% {
            transform: translate(12px, 10px) rotate(-8deg) skewX(12deg) skewY(-5deg) scale(0.94, 1.06);
          }
          93% {
            transform: translate(-4px, -3px) rotate(3deg) skewX(-4deg) skewY(2deg) scale(1.02, 0.98);
          }
          100% {
            transform: translate(0, 0) rotate(0deg) skewX(0deg) skewY(0deg) scale(1, 1);
            opacity: 1;
          }
        }

        @keyframes waveFallTop {
          0% {
            transform: translate(-130px, -500px) rotate(-40deg) skewX(-35deg) scale(0.55, 1.5);
            opacity: 0;
          }
          28% {
            transform: translate(100px, -290px) rotate(30deg) skewX(28deg) scale(1.25, 0.8);
            opacity: 1;
          }
          52% {
            transform: translate(-65px, -110px) rotate(-22deg) skewX(-22deg) scale(0.82, 1.28);
          }
          72% {
            transform: translate(28px, 22px) rotate(12deg) skewX(16deg) scale(1.45, 0.58);
          }
          86% {
            transform: translate(-12px, -26px) rotate(-7deg) skewX(-9deg) scale(0.86, 1.18);
          }
          94% {
            transform: translate(4px, 6px) rotate(2.5deg) skewX(3deg) scale(1.06, 0.95);
          }
          100% {
            transform: translate(0, 0) rotate(0deg) skewX(0deg) scale(1, 1);
            opacity: 1;
          }
        }

        @keyframes bendHopRight {
          0% {
            transform: translate(440px, -160px) rotate(65deg) skewX(42deg) skewY(22deg) scale(0.48, 1.55);
            opacity: 0;
          }
          25% {
            transform: translate(280px, 32px) rotate(28deg) skewX(-28deg) skewY(-16deg) scale(1.4, 0.62);
            opacity: 1;
          }
          48% {
            transform: translate(155px, -85px) rotate(-28deg) skewX(32deg) skewY(16deg) scale(0.72, 1.38);
          }
          68% {
            transform: translate(32px, 22px) rotate(16deg) skewX(-20deg) skewY(-12deg) scale(1.28, 0.72);
          }
          84% {
            transform: translate(-16px, -28px) rotate(-9deg) skewX(12deg) skewY(7deg) scale(0.88, 1.16);
          }
          93% {
            transform: translate(5px, 6px) rotate(3deg) skewX(-4deg) skewY(-2deg) scale(1.06, 0.95);
          }
          100% {
            transform: translate(0, 0) rotate(0deg) skewX(0deg) skewY(0deg) scale(1, 1);
            opacity: 1;
          }
        }
      `}</style>

      <div
        ref={containerRef}
        className="relative w-full max-w-[420px] aspect-[400/360] flex items-center justify-center"
        aria-label="Interactive Characters"
      >
        <svg
          viewBox="0 0 400 360"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ========================================================
              1. KHỐI TÍM (NHÂN VẬT A) - Uốn cong lượn lách từ bên trái vào hàng
             ======================================================== */}
          <g
            style={
              !isEntranceDone
                ? {
                    animation: isReducedMotion
                      ? 'none'
                      : 'bendRollLeft 1.25s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                    transformOrigin: 'bottom center'
                  }
                : {
                    transform: isAvoiding ? 'rotate(-20deg) translate(-26px, -10px)' : 'none',
                    transformOrigin: 'bottom center',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }
            }
          >
            {/* Thân tím chữ nhật phẳng góc vuông */}
            <rect
              x="105"
              y="70"
              width="112"
              height="290"
              fill="#6047EC"
            />

            {/* Sống mũi là vạch dọc màu đen ở giữa */}
            <rect
              x="167"
              y="88"
              width="5.5"
              height="30"
              fill="#18181B"
            />

            {/* Mắt trái A */}
            <g transform="translate(152, 94)">
              <circle cx="0" cy="0" r="4.5" fill="#FFFFFF" />
              <g
                ref={(el) => (eyesRef.current['charA_left'] = el)}
                style={{
                  transform: isAvoiding ? 'translate(-2.5px, -2px)' : 'none',
                  transition: isAvoiding ? 'transform 0.3s ease' : 'none'
                }}
              >
                <circle cx="0" cy="0" r="2.2" fill="#18181B" />
              </g>
            </g>

            {/* Mắt phải A */}
            <g transform="translate(186, 94)">
              <circle cx="0" cy="0" r="4.5" fill="#FFFFFF" />
              <g
                ref={(el) => (eyesRef.current['charA_right'] = el)}
                style={{
                  transform: isAvoiding ? 'translate(-2.5px, -2px)' : 'none',
                  transition: isAvoiding ? 'transform 0.3s ease' : 'none'
                }}
              >
                <circle cx="0" cy="0" r="2.2" fill="#18181B" />
              </g>
            </g>
          </g>

          {/* ========================================================
              2. KHỐI ĐEN (NHÂN VẬT B) - Uốn cong lượn lách từ bên phải vào hàng
             ======================================================== */}
          <g
            style={
              !isEntranceDone
                ? {
                    animation: isReducedMotion
                      ? 'none'
                      : 'bendRollRight 1.25s cubic-bezier(0.22, 1, 0.36, 1) 0.08s forwards',
                    transformOrigin: 'bottom center',
                    opacity: isReducedMotion ? 1 : 0
                  }
                : {
                    transform: isAvoiding ? 'rotate(-8deg) translate(-10px, -4px)' : 'none',
                    transformOrigin: 'bottom center',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }
            }
          >
            {/* Thân chữ nhật đen */}
            <rect
              x="185"
              y="155"
              width="78"
              height="205"
              fill="#18181B"
            />

            {/* Mắt trái B (To tròn) */}
            <g transform="translate(236, 185)">
              <circle cx="0" cy="0" r="7" fill="#FFFFFF" />
              <g
                ref={(el) => (eyesRef.current['charB_left'] = el)}
                style={{
                  transform: isAvoiding ? 'translate(0px, -3.5px)' : 'none',
                  transition: isAvoiding ? 'transform 0.3s ease' : 'none'
                }}
              >
                <circle cx="0" cy="0" r="3.5" fill="#18181B" />
              </g>
            </g>

            {/* Mắt phải B (To tròn sát mép phải) */}
            <g transform="translate(252, 185)">
              <circle cx="0" cy="0" r="7" fill="#FFFFFF" />
              <g
                ref={(el) => (eyesRef.current['charB_right'] = el)}
                style={{
                  transform: isAvoiding ? 'translate(0px, -3.5px)' : 'none',
                  transition: isAvoiding ? 'transform 0.3s ease' : 'none'
                }}
              >
                <circle cx="0" cy="0" r="3.5" fill="#18181B" />
              </g>
            </g>
          </g>

          {/* ========================================================
              3. KHỐI VÀNG (NHÂN VẬT C) - Nhảy uốn éo bẻ cong từ bên phải qua
             ======================================================== */}
          <g
            style={
              !isEntranceDone
                ? {
                    animation: isReducedMotion
                      ? 'none'
                      : 'bendHopRight 1.35s cubic-bezier(0.22, 1, 0.36, 1) 0.12s forwards',
                    transformOrigin: 'bottom center',
                    opacity: isReducedMotion ? 1 : 0
                  }
                : {
                    transform: isAvoiding ? 'rotate(8deg) translate(8px, 4px)' : 'none',
                    transformOrigin: 'bottom center',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }
            }
          >
            {/* Thân vòm bo tròn đỉnh */}
            <path
              d="M 235 360 L 235 258 A 42.5 42.5 0 0 1 320 258 L 320 360 Z"
              fill="#F3C623"
            />

            {/* 1 Mắt chấm đen (Cyclops) */}
            <g transform="translate(268, 252)">
              <g
                ref={(el) => (eyesRef.current['charC_single'] = el)}
                style={{
                  transform: isAvoiding ? 'translate(-2px, -2.5px)' : 'none',
                  transition: isAvoiding ? 'transform 0.3s ease' : 'none'
                }}
              >
                <circle cx="0" cy="0" r="4" fill="#18181B" />
              </g>
            </g>

            {/* Miệng vạch ngang đen dài nhô hẳn ra ngoài mép phải */}
            <line
              x1="282"
              y1={isAvoiding ? '278' : '268'}
              x2="338"
              y2={isAvoiding ? '260' : '268'}
              stroke="#18181B"
              strokeWidth="6"
              strokeLinecap="square"
              style={{ transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </g>

          {/* ========================================================
              4. KHỐI CAM (NHÂN VẬT D) - Rơi lượn sóng zic-zac bẻ cong từ trên trần xuống
             ======================================================== */}
          <g
            style={
              !isEntranceDone
                ? {
                    animation: isReducedMotion
                      ? 'none'
                      : 'waveFallTop 1.3s cubic-bezier(0.22, 1, 0.36, 1) 0.18s forwards',
                    transformOrigin: 'bottom center',
                    opacity: isReducedMotion ? 1 : 0
                  }
                : {
                    transform: isAvoiding ? 'translate(0px, 4px)' : 'none',
                    transformOrigin: 'bottom center',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }
            }
          >
            {/* Thân bán nguyệt lớn tiền cảnh đè lên chân các khối khác */}
            <path
              d="M 30 360 A 105 105 0 0 1 240 360 Z"
              fill="#FF7043"
            />

            {/* Mắt trái D */}
            <g transform="translate(126, 312)">
              <g
                ref={(el) => (eyesRef.current['charD_left'] = el)}
                style={{
                  transform: isAvoiding ? 'translate(-2px, -1.5px)' : 'none',
                  transition: isAvoiding ? 'transform 0.3s ease' : 'none'
                }}
              >
                <circle cx="0" cy="0" r="4.5" fill="#18181B" />
              </g>
            </g>

            {/* Mắt phải D */}
            <g transform="translate(168, 312)">
              <g
                ref={(el) => (eyesRef.current['charD_right'] = el)}
                style={{
                  transform: isAvoiding ? 'translate(-2px, -1.5px)' : 'none',
                  transition: isAvoiding ? 'transform 0.3s ease' : 'none'
                }}
              >
                <circle cx="0" cy="0" r="4.5" fill="#18181B" />
              </g>
            </g>

            {/* Miệng: Cười cong <-> Mếu cong xuống khi nhập password */}
            <path
              d={isAvoiding ? 'M 138 332 Q 147 322 156 332' : 'M 140 324 Q 147 336 154 324'}
              fill={isAvoiding ? 'none' : '#18181B'}
              stroke="#18181B"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default InteractiveLoginCharacters;
