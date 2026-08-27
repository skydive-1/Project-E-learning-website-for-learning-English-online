import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Composer from '../src/modules/chatbot/components/Composer';

const baseProps = {
  inputText: '',
  setInputText: vi.fn(),
  onSubmit: vi.fn(),
  onStopResponse: vi.fn(),
  isRecording: false,
  recordingTime: 0,
  onStartRecord: vi.fn(),
  onStopRecord: vi.fn(),
  onCancelRecord: vi.fn()
};

describe('Chatbot composer response controls', () => {
  it('replaces the send action with an accessible stop action while AI is responding', () => {
    const onStopResponse = vi.fn();

    render(
      <Composer
        {...baseProps}
        isLoading
        onStopResponse={onStopResponse}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dừng phản hồi' }));

    expect(onStopResponse).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Gửi câu hỏi' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
