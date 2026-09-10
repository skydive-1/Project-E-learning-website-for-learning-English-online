import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const motionState = vi.hoisted(() => ({
  transforms: []
}));

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');
  const MotionDiv = ReactModule.forwardRef(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>{children}</div>
  ));
  const MotionSpan = ReactModule.forwardRef(({ children, ...props }, ref) => (
    <span ref={ref} {...props}>{children}</span>
  ));

  return {
    motion: { div: MotionDiv, span: MotionSpan },
    useReducedMotion: () => false,
    useScroll: () => ({ scrollYProgress: {} }),
    useSpring: (value) => value,
    useTransform: (_value, inputRange, outputRange) => {
      motionState.transforms.push({ inputRange, outputRange });
      return outputRange[0];
    }
  };
});

vi.mock('../src/services/protectedVideo.service', () => ({
  ensurePublicVideoTicket: vi.fn().mockResolvedValue({ success: true, expiresIn: 60 }),
  getProtectedPublicVideoUrl: (assetId) => `http://localhost:5000/api/media/video/stream/${assetId}`
}));

import KineticDirectionSection from '../src/modules/homepage/components/KineticDirectionSection';

describe('KineticDirectionSection', () => {
  it('uses compositor-friendly cropping and transforms for the scroll effect', async () => {
    const { container } = render(<KineticDirectionSection />);

    const section = container.querySelector('#kinetic-direction');
    const frame = container.querySelector('.apple-kinetic-video-frame');
    await waitFor(() => {
      expect(container.querySelector('video')?.src).toContain('/api/media/video/stream/girl-typing');
    });
    const video = container.querySelector('video');

    expect(section).toBeInTheDocument();
    expect(frame).toHaveStyle({ clipPath: 'inset(0% 0% round 16px)' });
    expect(video).toHaveAttribute('loop');
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).toHaveAttribute('data-idm-prevent-download', 'true');
    expect(video).toHaveAttribute('controlslist', 'nodownload noremoteplayback');
    expect(video).toHaveAttribute('crossorigin', 'use-credentials');

    expect(motionState.transforms).toContainEqual({
      inputRange: [0, 0.42, 0.94],
      outputRange: [
        'inset(0% 0% round 16px)',
        'inset(0% 0% round 16px)',
        'inset(0% 49.96% round 0px)'
      ]
    });
    expect(motionState.transforms).toContainEqual({
      inputRange: [0, 0.42, 0.94],
      outputRange: ['-50cqw', '-50cqw', '0cqw']
    });
    expect(motionState.transforms).toContainEqual({
      inputRange: [0, 0.42, 0.94],
      outputRange: ['50cqw', '50cqw', '0cqw']
    });
  });
});
