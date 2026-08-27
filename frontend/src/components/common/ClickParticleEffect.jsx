import React, { useEffect, useRef } from 'react';

/**
 * ClickParticleEffect - Global subtle click/tap particle interaction
 * Prompt Requirement: "Add a subtle click-particle interaction across the page: 
 * small dark particles briefly radiate outward from the pointer/tap position."
 */
const ClickParticleEffect = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Respect user's motion preferences
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let particles = [];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const isDarkMode = () => {
      return (
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark')
      );
    };

    const spawnParticles = (x, y) => {
      const dark = isDarkMode();
      const count = 7 + Math.floor(Math.random() * 3); // 7 to 9 particles

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
        const speed = 1.4 + Math.random() * 1.8;
        const radius = 2.2 + Math.random() * 1.6;
        const maxLife = 24 + Math.floor(Math.random() * 10); // ~400-500ms at 60fps

        // Color based on theme
        const color = dark
          ? (Math.random() > 0.4 ? 'rgba(56, 189, 248, ' : 'rgba(226, 232, 240, ')
          : (Math.random() > 0.4 ? 'rgba(15, 23, 42, ' : 'rgba(71, 85, 105, ');

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius,
          life: 0,
          maxLife,
          color,
          friction: 0.94,
          gravity: 0.04
        });
      }
    };

    const handlePointerDown = (e) => {
      // Avoid firing on scrollbars
      if (e.clientX > window.innerWidth - 10) return;
      spawnParticles(e.clientX, e.clientY);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (particles.length > 0) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= p.friction;
          p.vy = p.vy * p.friction + p.gravity;
          p.life++;

          const progress = p.life / p.maxLife;
          const alpha = Math.max(0, 1 - progress);
          const currentRadius = Math.max(0.5, p.radius * (1 - progress * 0.4));

          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${alpha * 0.85})`;
          ctx.fill();

          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
        userSelect: 'none'
      }}
      aria-hidden="true"
    />
  );
};

export default ClickParticleEffect;
