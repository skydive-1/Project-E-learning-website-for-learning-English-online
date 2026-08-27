import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSuggestedQuestionsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/modules/chatbot/services/chatbot.service', () => ({
  getSuggestedQuestions: getSuggestedQuestionsMock
}));

import EmptyState from '../src/modules/chatbot/components/EmptyState';

describe('Lesson suggested questions', () => {
  beforeEach(() => {
    getSuggestedQuestionsMock.mockReset();
  });

  it('shows four concise lesson-only prompts immediately without legacy templates', () => {
    getSuggestedQuestionsMock.mockReturnValue(new Promise(() => {}));

    render(<EmptyState lessonId={49} onSelectPrompt={vi.fn()} />);

    const list = screen.getByLabelText('Câu hỏi gợi ý cho bài học');
    const buttons = within(list).getAllByRole('button');

    expect(buttons).toHaveLength(4);
    buttons.forEach((button) => expect(button.textContent.length).toBeLessThanOrEqual(92));
    expect(screen.queryByText(/Mục đích và nội dung chính/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hành động nhanh/i)).not.toBeInTheDocument();
    expect(screen.getByText('Các gợi ý chỉ dựa trên nội dung xuất hiện trong bài.')).toBeInTheDocument();
  });

  it('replaces fallbacks with short server questions and sends the selected prompt', async () => {
    const onSelectPrompt = vi.fn();
    const groundedQuestions = [
      '“small talk” được dùng khi nào?',
      '“How are you?” nên đáp lại thế nào?',
      'Cụm “nice to meet you” dùng lúc nào?',
      '“See you later” khác “goodbye” thế nào?'
    ];
    getSuggestedQuestionsMock.mockResolvedValue(groundedQuestions);

    render(<EmptyState lessonId={49} onSelectPrompt={onSelectPrompt} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: groundedQuestions[0] })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: groundedQuestions[0] }));
    expect(onSelectPrompt).toHaveBeenCalledWith(groundedQuestions[0], null);
  });

  it('rejects legacy or oversized server suggestions', async () => {
    getSuggestedQuestionsMock.mockResolvedValue([
      'Mục đích và nội dung chính của bài này là gì?',
      'A'.repeat(120),
      'Câu hợp lệ thứ ba?',
      'Câu hợp lệ thứ tư?'
    ]);

    render(<EmptyState lessonId={49} onSelectPrompt={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Câu hỏi gợi ý cho bài học')).toHaveAttribute('aria-busy', 'false'));
    expect(screen.getByRole('button', { name: 'Bài này có những ý chính nào?' })).toBeInTheDocument();
    expect(screen.queryByText(/Mục đích và nội dung chính/i)).not.toBeInTheDocument();
  });
});
