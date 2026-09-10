import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const sendStudentMessage = vi.fn();

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

vi.mock('../src/modules/discussions/services/discussions.service', () => ({
  sendStudentMessage: (...args) => sendStudentMessage(...args),
  markDiscussionRead: vi.fn(() => Promise.resolve()),
  discussionApiErrorMessage: (error, fallback) => error?.message || fallback
}));

import StudentInstructorChatPanel from '../src/modules/discussions/components/StudentInstructorChatPanel';

describe('StudentInstructorChatPanel real messaging boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('persists a student message and never fabricates an instructor reply', async () => {
    const setDiscussions = vi.fn();
    sendStudentMessage.mockResolvedValue({
      id: 7,
      lessonId: '27',
      content: 'Em chưa hiểu cách chọn keywords.',
      createdAt: '09/09/2026 11:30',
      replies: []
    });

    render(
      <StudentInstructorChatPanel
        lessonId="27"
        instructorName="Giảng viên Minh Huyền"
        discussions={[]}
        setDiscussions={setDiscussions}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn cho giảng viên...'), {
      target: { value: 'Em chưa hiểu cách chọn keywords.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    await waitFor(() => expect(sendStudentMessage).toHaveBeenCalledWith({
      lessonId: '27',
      content: 'Em chưa hiểu cách chọn keywords.',
      timestampSeconds: null
    }));
    expect(setDiscussions).toHaveBeenCalledTimes(1);

    await new Promise(resolve => window.setTimeout(resolve, 1300));
    expect(screen.queryByText(/Mình đã nhận được tin nhắn/i)).not.toBeInTheDocument();
  });

});
