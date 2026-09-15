import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CourseAnnouncementsModal from '../src/modules/courses/components/CourseAnnouncementsModal';
import * as discussionsService from '../src/modules/discussions/services/discussions.service';

vi.mock('../src/modules/discussions/services/discussions.service', () => ({
  getUserAnnouncements: vi.fn(),
  markAnnouncementRead: vi.fn(),
  discussionApiErrorMessage: vi.fn((err, fallback) => fallback)
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

describe('CourseAnnouncementsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders announcements list fetched for user', async () => {
    discussionsService.getUserAnnouncements.mockResolvedValue([
      {
        id: 101,
        courseId: '5',
        courseName: 'Khóa học IELTS theo chủ đề',
        instructorName: 'Quốc Anh',
        title: 'Thông báo nghỉ học',
        content: 'Do hôm nay có việc đột xuất nên tiết học hôm nay hủy',
        createdAt: '18:58 14/09/2026',
        viewsCount: 1,
        isRead: false
      }
    ]);

    render(<CourseAnnouncementsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Thông báo từ Giảng viên/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Thông báo nghỉ học')).toBeInTheDocument();
      expect(screen.getByText(/Do hôm nay có việc đột xuất/i)).toBeInTheDocument();
      expect(screen.getByText(/Quốc Anh/i)).toBeInTheDocument();
    });
  });

  it('filters unread announcements when unread tab is active', async () => {
    discussionsService.getUserAnnouncements.mockResolvedValue([
      {
        id: 101,
        courseId: '5',
        courseName: 'Khóa học A',
        instructorName: 'GV 1',
        title: 'Tin mới chưa đọc',
        content: 'Nội dung chưa đọc',
        createdAt: '19:00',
        viewsCount: 0,
        isRead: false
      },
      {
        id: 102,
        courseId: '5',
        courseName: 'Khóa học A',
        instructorName: 'GV 1',
        title: 'Tin cũ đã đọc',
        content: 'Nội dung đã đọc',
        createdAt: '18:00',
        viewsCount: 5,
        isRead: true
      }
    ]);

    render(<CourseAnnouncementsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tin mới chưa đọc')).toBeInTheDocument();
      expect(screen.getByText('Tin cũ đã đọc')).toBeInTheDocument();
    });

    const unreadTab = screen.getByRole('button', { name: /chưa đọc/i });
    fireEvent.click(unreadTab);

    expect(screen.getByText('Tin mới chưa đọc')).toBeInTheDocument();
    expect(screen.queryByText('Tin cũ đã đọc')).not.toBeInTheDocument();
  });

  it('keeps retry failures handled and lets the user try again', async () => {
    discussionsService.getUserAnnouncements
      .mockRejectedValueOnce(new Error('Backend unavailable'))
      .mockResolvedValueOnce([]);

    render(<CourseAnnouncementsModal isOpen={true} onClose={vi.fn()} />);

    const retryButton = await screen.findByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(discussionsService.getUserAnnouncements).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Chưa có thông báo nào')).toBeInTheDocument();
    });
  });
});
