import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiThinkingState from '../src/modules/chatbot/components/AiThinkingState';

describe('AI thinking state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the pixel wave and updates the elapsed timer', () => {
    const { container } = render(<AiThinkingState />);

    expect(screen.getByRole('status')).toHaveTextContent('AI đang tra cứu tài liệu & suy nghĩ...');
    expect(container.querySelectorAll('[data-pixel-cell]')).toHaveLength(9);
    expect(screen.getByText('0.0s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });
});
