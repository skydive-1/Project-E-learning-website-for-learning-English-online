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
    expect(screen.getByText('Bài: #131, #132, #133, #134, #135')).toBeInTheDocument();
    expect(screen.getByText('28', { selector: '.has-error strong' })).toBeInTheDocument();
  });

  it('recovers one course immediately and reports the scheduled batch', async () => {
    render(<CourseTranscriptHealthPanel />);
    const button = await screen.findByRole('button', { name: /Xử lý 5 bài chờ/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mocks.recover).toHaveBeenCalledWith({ courseId: 43, limit: 5, includeFailed: true });
      expect(mocks.toast).toHaveBeenCalledWith('Đã đưa 5 transcript vào worker xử lý ngay.', 'success');
    });
  });

  it('explains storage failures and lets the admin retry failed lessons', async () => {
    mocks.getHealth.mockResolvedValue({
      ...snapshot,
      summary: { ...snapshot.summary, pending: 0, failed: 5, sourceMismatch: 0 },
      courses: [{
        ...snapshot.courses[0],
        counts: { ...snapshot.courses[0].counts, pending: 0, failed: 5, sourceMismatch: 0 },
        affectedLessons: snapshot.courses[0].affectedLessons.map(lesson => ({
          ...lesson,
          transcriptStatus: 'failed',
          sourceMismatch: false,
          errorCode: 'SUBTITLE_PIPELINE_FAILED',
          errorMessage: 'Tải video từ Supabase thất bại: HTTP 404'
        }))
      }]
    });

    render(<CourseTranscriptHealthPanel />);

    expect(await screen.findByText(/5 bài đã chạy nhưng thất bại/)).toBeInTheDocument();
    expect(screen.getAllByText('Không truy cập được file media nguồn').length).toBeGreaterThan(0);
    const retry = screen.getByRole('button', { name: 'Thử tự khôi phục 5 bài' });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);

    await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith({
      courseId: 43,
      limit: 5,
      includeFailed: true
    }));
  });

  it('sends confirmed missing media directly to the affected lesson in Course Editor', async () => {
    mocks.getHealth.mockResolvedValue({
      ...snapshot,
      summary: {
        ...snapshot.summary,
        pending: 0,
        failed: 5,
        mediaMissing: 5,
        recoverable: 0,
        sourceMismatch: 0
      },
      courses: [{
        ...snapshot.courses[0],
        counts: {
          ...snapshot.courses[0].counts,
          pending: 0,
          failed: 5,
          mediaMissing: 5,
          retryable: 0,
          sourceMismatch: 0
        },
        affectedLessons: snapshot.courses[0].affectedLessons.map(lesson => ({
          ...lesson,
          transcriptStatus: 'failed',
          mediaMissingSource: true,
          retryable: false,
          errorCode: 'TRANSCRIPT_MEDIA_SOURCE_MISSING',
          errorMessage: 'Không tìm thấy media nguồn'
        }))
      }]
    });

    render(<CourseTranscriptHealthPanel />);

    const reupload = await screen.findByRole('link', { name: 'Tải lại video' });
    expect(reupload).toHaveAttribute(
      'href',
      '/instructor/edit-course/43?tab=curriculum&lessonId=131&issue=missing-media-source'
    );
    expect(screen.getAllByText('File media đã mất khỏi storage').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Thử tự khôi phục 5 bài/ })).not.toBeInTheDocument();
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
