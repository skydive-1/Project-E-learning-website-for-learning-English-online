import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiThinkingState, { LoadingState } from '../src/modules/chatbot/components/AiThinkingState';

describe('AI thinking state (LoadingState pixel-grid loader)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the pixel grid and updates the elapsed timer', () => {
    const { container } = render(<AiThinkingState />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Đang soạn câu trả lời...')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-pixel-cell]')).toHaveLength(9);
    expect(screen.getByText('0.0s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });

  it('supports custom label and different variants (Dots, Orbit, Surfer)', () => {
    const { rerender, container } = render(
      <LoadingState label="AI đang suy nghĩ..." variant="Dots" />
    );

    expect(screen.getByText('AI đang suy nghĩ...')).toBeInTheDocument();
    expect(container.querySelectorAll('.rounded-full')).toHaveLength(9);

    // Orbit variant
    rerender(<LoadingState label="Orbiting" variant="Orbit" />);
    expect(screen.getByText('Orbiting')).toBeInTheDocument();

    // Surfer variant with meme video container
    rerender(<LoadingState variant="Surfer" />);
    expect(screen.getByText('Subway surfing')).toBeInTheDocument();
    expect(container.querySelector('video')).toBeInTheDocument();
  });
});
