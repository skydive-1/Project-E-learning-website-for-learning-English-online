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

  it('sends the attached current video timestamp', async () => {
    sendStudentMessage.mockResolvedValue({
      id: 8,
      lessonId: '27',
      content: 'Em chưa hiểu đoạn này.',
      timestampSeconds: 95,
      timestampFormatted: '01:35',
      replies: []
    });

    render(
      <StudentInstructorChatPanel
        lessonId="27"
        currentTime={95.8}
        discussions={[]}
        setDiscussions={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Gắn mốc bài giảng hiện tại'));
    fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn cho giảng viên...'), {
      target: { value: 'Em chưa hiểu đoạn này.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    await waitFor(() => expect(sendStudentMessage).toHaveBeenCalledWith({
      lessonId: '27',
      content: 'Em chưa hiểu đoạn này.',
      timestampSeconds: 95
    }));
  });

  it('seeks the current lesson when the student clicks a message timestamp', async () => {
    const onSeekVideo = vi.fn();
    render(
      <StudentInstructorChatPanel
        lessonId="27"
        onSeekVideo={onSeekVideo}
        discussions={[{
          id: 8,
          lessonId: '27',
          content: 'Xem lại đoạn này.',
          timestampSeconds: 95,
          timestampFormatted: '01:35',
          createdAt: '14/09/2026 10:00',
          replies: []
        }]}
        setDiscussions={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: '01:35' }));
    expect(onSeekVideo).toHaveBeenCalledWith(95);
    expect(screen.queryByText(/Mốc bài giảng/i)).not.toBeInTheDocument();
  });

});
