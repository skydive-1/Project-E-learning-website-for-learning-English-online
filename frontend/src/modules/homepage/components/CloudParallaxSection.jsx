import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';

/**
 * CloudParallaxSection
 * Multi-layered Horizontal Parallax Cloud Horizon with Scroll-triggered Animation
 * Placed directly beneath the Hero section to transition seamlessly into the page.
 */
const CloudParallaxSection = () => {
  const containerRef = useRef(null);

  // Track scroll progression as this section enters and leaves viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  // Spring physics for ultra-smooth buttery inertia
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Layer 1: Background distant clouds (Slow horizontal drift to the right)
  const x1 = useTransform(smoothProgress, [0, 1], [-80, 80]);
  const y1 = useTransform(smoothProgress, [0, 1], [0, -25]);

  // Layer 2: Midground fluffy clouds (Medium horizontal drift to the left)
  const x2 = useTransform(smoothProgress, [0, 1], [110, -110]);
  const y2 = useTransform(smoothProgress, [0, 1], [10, -40]);

  // Layer 3: Foreground large puffy clouds (Fast horizontal drift to the right)
  const x3 = useTransform(smoothProgress, [0, 1], [-160, 160]);
  const y3 = useTransform(smoothProgress, [0, 1], [20, -55]);

  return (
    <div ref={containerRef} className="cloud-parallax-wrapper" aria-hidden="true">
      {/* Sky Blue Top Transition Gradient */}
      <div className="sky-fade-top" />

      {/* Layer 1: Background Clouds (Soft & Distant) */}
      <motion.div 
        className="cloud-layer layer-back"
        style={{ x: x1, y: y1 }}
      >
        <svg className="cloud-svg" viewBox="0 0 1600 240" fill="none" preserveAspectRatio="none">
          <path 
            d="M0,240 L1600,240 L1600,160 C1520,130 1440,110 1360,140 C1260,90 1140,85 1040,130 C940,95 820,90 740,135 C640,80 500,85 400,130 C300,90 180,105 100,145 C50,135 0,150 0,160 Z" 
            fill="currentColor"
          />
        </svg>
      </motion.div>

      {/* Layer 2: Midground Clouds (Billowy Cumulus Formation) */}
      <motion.div 
        className="cloud-layer layer-mid"
        style={{ x: x2, y: y2 }}
      >
        <svg className="cloud-svg" viewBox="0 0 1600 280" fill="none" preserveAspectRatio="none">
          <path 
            d="M0,280 L1600,280 L1600,180 C1540,120 1420,110 1320,150 C1220,90 1080,80 980,135 C880,85 720,70 620,120 C500,65 360,75 260,130 C180,95 80,110 0,160 Z" 
            fill="currentColor"
          />
        </svg>
      </motion.div>

      {/* Layer 3: Foreground Clouds (Crisp Large Puffy Cloud Heads) */}
      <motion.div 
        className="cloud-layer layer-front"
        style={{ x: x3, y: y3 }}
      >
        <svg className="cloud-svg" viewBox="0 0 1600 320" fill="none" preserveAspectRatio="none">
          <path 
            d="M0,320 L1600,320 L1600,200 C1500,130 1380,120 1280,170 C1160,90 1000,85 880,145 C760,75 600,70 480,130 C360,60 200,65 100,140 C50,115 0,135 0,170 Z" 
            fill="currentColor"
          />
        </svg>
      </motion.div>

      {/* Feathered Bottom Mist Gradient into Content */}
      <div className="bottom-mist-blend" />
    </div>
  );
};

export default CloudParallaxSection;
