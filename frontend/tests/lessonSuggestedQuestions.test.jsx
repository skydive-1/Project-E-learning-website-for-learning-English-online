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

  it('shows a loading state instead of ungrounded client prompts while the API is pending', () => {
    getSuggestedQuestionsMock.mockReturnValue(new Promise(() => {}));

    render(<EmptyState lessonId={49} onSelectPrompt={vi.fn()} />);

    const list = screen.getByLabelText('Câu hỏi gợi ý cho bài học');
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    expect(within(list).getByRole('status')).toHaveTextContent('Đang lấy câu hỏi từ nội dung bài học');
    expect(screen.queryByText(/Mục đích và nội dung chính/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hành động nhanh/i)).not.toBeInTheDocument();
    expect(screen.getByText('Các gợi ý chỉ dựa trên nội dung xuất hiện trong bài.')).toBeInTheDocument();
  });

  it('shows short server questions and sends the selected prompt', async () => {
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

  it('surfaces invalid server suggestions instead of substituting client sample prompts', async () => {
    getSuggestedQuestionsMock.mockResolvedValue([
      'Mục đích và nội dung chính của bài này là gì?',
      'A'.repeat(120),
      'Câu hợp lệ thứ ba?',
      'Câu hợp lệ thứ tư?'
    ]);

    render(<EmptyState lessonId={49} onSelectPrompt={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải câu hỏi gợi ý'));
    expect(screen.getByRole('button', { name: 'Thử tải lại' })).toBeInTheDocument();
    expect(screen.queryByText(/Mục đích và nội dung chính/i)).not.toBeInTheDocument();
  });

  it('surfaces API failures and retries on demand', async () => {
    getSuggestedQuestionsMock
      .mockRejectedValueOnce(new Error('Backend unavailable'))
      .mockResolvedValueOnce([
        'Câu hỏi một từ bài học?',
        'Câu hỏi hai từ bài học?',
        'Câu hỏi ba từ bài học?',
        'Câu hỏi bốn từ bài học?'
      ]);

    render(<EmptyState lessonId={49} onSelectPrompt={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Câu hỏi một từ bài học?' })).toBeInTheDocument());
    expect(getSuggestedQuestionsMock).toHaveBeenCalledTimes(2);
  });

  it('allows user to manually refresh suggested questions with forceRefresh', async () => {
    const questionsSet1 = [
      'Câu hỏi 1 set A?',
      'Câu hỏi 2 set A?',
      'Câu hỏi 3 set A?',
      'Câu hỏi 4 set A?'
    ];
    const questionsSet2 = [
      'Câu hỏi 1 set B?',
      'Câu hỏi 2 set B?',
      'Câu hỏi 3 set B?',
      'Câu hỏi 4 set B?'
    ];
    getSuggestedQuestionsMock
      .mockResolvedValueOnce(questionsSet1)
      .mockResolvedValueOnce(questionsSet2);

    render(<EmptyState lessonId={49} onSelectPrompt={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: questionsSet1[0] })).toBeInTheDocument());
    expect(getSuggestedQuestionsMock).toHaveBeenCalledWith(49, false);

    const refreshBtn = screen.getByTitle('Làm mới câu hỏi gợi ý từ AI');
    fireEvent.click(refreshBtn);

    await waitFor(() => expect(screen.getByRole('button', { name: questionsSet2[0] })).toBeInTheDocument());
    expect(getSuggestedQuestionsMock).toHaveBeenCalledWith(49, true);
  });
});
