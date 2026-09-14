import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getInstructorDiscussions = vi.fn();
const getInstructorAnnouncements = vi.fn();

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 9, roleId: 2 } })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

vi.mock('../src/modules/discussions/services/discussions.service', () => ({
  createCourseAnnouncement: vi.fn(),
  discussionApiErrorMessage: (_error, fallback) => fallback,
  getInstructorAnnouncements: (...args) => getInstructorAnnouncements(...args),
  getInstructorDiscussions: (...args) => getInstructorDiscussions(...args),
  markDiscussionRead: vi.fn().mockResolvedValue({}),
  replyToDiscussion: vi.fn(),
  updateDiscussionStatus: vi.fn()
}));

import InstructorInteractionHub, {
  buildDiscussionTimestampPath
} from '../src/modules/discussions/components/InstructorInteractionHub';

const discussion = {
  id: 44,
  courseId: '7',
  courseName: 'IELTS Course',
  lessonId: '27',
  lessonTitle: 'IELTS Listening',
  student: { id: 33, name: 'Học viên An' },
  title: 'Câu hỏi bài học',
  content: 'Em chưa hiểu đoạn này.',
  timestampSeconds: 95,
  timestampFormatted: '01:35',
  status: 'pending',
  unread: false,
  createdAt: '14/09/2026 10:00',
  replies: [{
    id: 45,
    isInstructor: false,
    author: { name: 'Học viên An' },
    content: 'Cụ thể là câu này ạ.',
    timestampSeconds: 125,
    timestampFormatted: '02:05',
    createdAt: '14/09/2026 10:01'
  }, {
    id: 46,
    isInstructor: true,
    author: { name: 'Giảng viên Minh Huyền' },
    content: 'Em xem lại đoạn cô đã đánh dấu nhé.',
    timestampSeconds: null,
    timestampFormatted: null,
    createdAt: '14/09/2026 10:02'
  }]
};

describe('Instructor discussion timestamp navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInstructorDiscussions.mockResolvedValue([discussion]);
    getInstructorAnnouncements.mockResolvedValue([]);
  });

  it('builds a destination with the exact course, lesson and timestamp', () => {
    expect(buildDiscussionTimestampPath(discussion, 95)).toBe(
      '/lessons/27?courseId=7&seek=95'
    );
  });

  it('renders clickable destinations for both the first message and later student messages', async () => {
    render(
      <MemoryRouter>
        <InstructorInteractionHub courses={[{ course_id: 7, course_name: 'IELTS Course' }]} />
      </MemoryRouter>
    );

    expect(await screen.findByRole('link', { name: 'Mở bài học tại 01:35' })).toHaveAttribute(
      'href',
      '/lessons/27?courseId=7&seek=95'
    );
    expect(screen.getByRole('link', { name: 'Mở bài học tại 02:05' })).toHaveAttribute(
      'href',
      '/lessons/27?courseId=7&seek=125'
    );
    expect(screen.getByText('Giảng viên Minh Huyền')).toBeInTheDocument();
    expect(screen.queryByText(/Mốc bài giảng/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Bạn (Giảng viên)')).not.toBeInTheDocument();
  });
});
