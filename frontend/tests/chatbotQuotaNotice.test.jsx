import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MessageList from '../src/modules/chatbot/components/MessageList';

describe('Chatbot quota notice', () => {
  it('renders the daily quota message as an accessible in-chat status', () => {
    render(
      <MessageList
        messages={[{
          id: 'quota-message',
          sender: 'ai',
          text: 'Bạn đã dùng hết 10 câu hỏi AI trong 24 giờ.',
          isError: true,
          errorCode: 'AI_QUESTION_LIMIT_REACHED'
        }]}
        isHistoryLoading={false}
        quizStates={{}}
        setQuizStates={vi.fn()}
        onSeekVideo={vi.fn()}
        onNavigate={vi.fn()}
        lessonId={1}
        messagesEndRef={{ current: null }}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Hạn mức trợ lý AI');
    expect(screen.getByText(/dùng hết 10 câu hỏi AI/i)).toBeInTheDocument();
  });
});
