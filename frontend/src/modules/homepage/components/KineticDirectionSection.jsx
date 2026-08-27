import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, useSpring } from 'motion/react';

/**
 * KineticDirectionSection - 100% Exact Alignment with Div Block Above
 * Initial video width matches 100% of the comparison block above (spanning the full container width).
 * On scroll, it collapses into a one-pixel divider as "Get solid" and "direction" merge.
 */
const KineticDirectionSection = () => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Track scroll progression (0 -> 1) through the 200vh sticky track
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  });

  // Smooth spring physics for Apple-like tactile scrubbing
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.6,
    restDelta: 0.0001
  });

  // Crop on the compositor instead of animating width and forcing layout every frame.
  const videoClipPath = useTransform(
    smoothProgress,
    [0, 0.42, 0.88],
    [
      'inset(0% 0% round 16px)',
      'inset(0% 0% round 16px)',
      'inset(0% 49.96% round 0px)'
    ]
  );

  const leftWordX = useTransform(
    smoothProgress,
    [0, 0.42, 0.88],
    ['-50cqw', '-50cqw', '0cqw']
  );

  const rightWordX = useTransform(
    smoothProgress,
    [0, 0.42, 0.88],
    ['50cqw', '50cqw', '0cqw']
  );

  const videoFrameStyle = shouldReduceMotion
    ? { clipPath: 'inset(0% 0% round 16px)' }
    : { clipPath: videoClipPath };

  const leftWordStyle = shouldReduceMotion ? undefined : { x: leftWordX };
  const rightWordStyle = shouldReduceMotion ? undefined : { x: rightWordX };

  useEffect(() => {
    const section = containerRef.current;
    const video = videoRef.current;

    if (!section || !video || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    let isNearViewport = false;
    const syncPlayback = () => {
      if (isNearViewport && document.visibilityState === 'visible') {
        const playPromise = video.play();
        playPromise?.catch(() => {});
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      isNearViewport = entry.isIntersecting;
      syncPlayback();
    }, { rootMargin: '200px 0px' });

    observer.observe(section);
    document.addEventListener('visibilitychange', syncPlayback);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      video.pause();
    };
  }, []);

  return (
    <div
      id="kinetic-direction"
      ref={containerRef}
      className={`apple-kinetic-scroll-container${shouldReduceMotion ? ' is-reduced-motion' : ''}`}
      aria-label="Get solid direction"
    >
      {/* 100vh Sticky Viewport Stage */}
      <div className="apple-kinetic-sticky-stage">
        <div className="container kinetic-full-container">
          <div className="kinetic-stage-content">
            {/* Left Word Segment: "Get solid" */}
            <motion.span className="apple-kinetic-word word-left" style={leftWordStyle}>
              Get solid
            </motion.span>

            {/* Fixed-size video: the compositor crops it as the page scrolls. */}
            <motion.div 
              className="apple-kinetic-video-frame"
              style={videoFrameStyle}
            >
              <video 
                ref={videoRef}
                className="apple-inline-video"
                src="/videos/girl_typing.mp4"
                loop
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
                tabIndex={-1}
              />
            </motion.div>

            {/* Right Word Segment: "direction" */}
            <motion.span className="apple-kinetic-word word-right" style={rightWordStyle}>
              direction
            </motion.span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KineticDirectionSection;
