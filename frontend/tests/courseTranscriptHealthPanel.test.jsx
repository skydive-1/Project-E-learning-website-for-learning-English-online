import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  recover: vi.fn(),
  toast: vi.fn()
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => mocks.toast
}));

vi.mock('../src/modules/admin/services/courseTranscriptAdmin.service', () => ({
  getCourseTranscriptHealth: mocks.getHealth,
  recoverPendingTranscripts: mocks.recover
}));

import CourseTranscriptHealthPanel from '../src/modules/admin/components/CourseTranscriptHealthPanel';

const snapshot = {
  generatedAt: '2026-09-12T11:08:46.372Z',
  source: 'PostgreSQL · lessons + lesson_subtitles',
  summary: {
    total: 40,
    ready: 12,
    pending: 28,
    processing: 0,
    failed: 0,
    missing: 0,
    sourceMismatch: 28,
    affectedCourses: 7
  },
  courses: [{
    courseId: 43,
    courseName: 'Basic English - P3',
    counts: {
      total: 5,
      ready: 0,
      pending: 5,
      processing: 0,
      failed: 0,
      missing: 0,
      sourceMismatch: 5
    },
    affectedLessons: [131, 132, 133, 134, 135].map(lessonId => ({
      lessonId,
      transcriptStatus: 'pending',
      statusAgeSeconds: 5400,
      sourceMismatch: true
    }))
  }]
};

describe('CourseTranscriptHealthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHealth.mockResolvedValue(snapshot);
    mocks.recover.mockResolvedValue({
      success: true,
      message: 'Đã đưa 5 transcript vào worker xử lý ngay.',
      data: { scheduled: 5, alreadyActive: 0 }
    });
  });

  it('renders observed transcript counts, source and affected lesson ids', async () => {
    render(<CourseTranscriptHealthPanel />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sức khỏe transcript' })).toBeInTheDocument());
    expect(screen.getByText(/PostgreSQL · lessons \+ lesson_subtitles/)).toBeInTheDocument();
    expect(screen.getAllByText('28', { selector: 'strong' })).toHaveLength(2);
    expect(screen.getByText('Basic English - P3')).toBeInTheDocument();
    expect(screen.getByText('Lesson: #131, #132, #133, #134, #135')).toBeInTheDocument();
    expect(screen.getByText('28', { selector: '.has-error strong' })).toBeInTheDocument();
  });

  it('recovers one course immediately and reports the scheduled batch', async () => {
    render(<CourseTranscriptHealthPanel />);
    const button = await screen.findByRole('button', { name: /Khôi phục khóa này/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mocks.recover).toHaveBeenCalledWith({ courseId: 43, limit: 5 });
      expect(mocks.toast).toHaveBeenCalledWith('Đã đưa 5 transcript vào worker xử lý ngay.', 'success');
    });
  });

  it('keeps a retry action available when the health endpoint fails', async () => {
    mocks.getHealth.mockRejectedValueOnce(new Error('Database unavailable'));
    render(<CourseTranscriptHealthPanel />);

    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    expect(screen.getByRole('alert')).toHaveTextContent('Database unavailable');
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sức khỏe transcript' })).toBeInTheDocument());
    expect(mocks.getHealth).toHaveBeenCalledTimes(2);
  });
});
