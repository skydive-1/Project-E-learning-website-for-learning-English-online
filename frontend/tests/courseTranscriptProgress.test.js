import { describe, expect, it } from 'vitest';
import {
  getCourseTranscriptProgress,
  hasActiveTranscriptWork
} from '../src/modules/admin/utils/courseTranscriptProgress';

describe('course transcript progress', () => {
  it('calculates readiness from real ready and total lesson counts', () => {
    expect(getCourseTranscriptProgress({
      transcript_summary: {
        total_video_lessons: 3,
        ready_transcripts: 1,
        processing_transcripts: 2
      }
    })).toMatchObject({
      total: 3,
      ready: 1,
      percent: 33,
      state: 'active',
      label: '2 bài đang chờ/xử lý'
    });
  });

  it('does not present missing transcripts as active work', () => {
    expect(getCourseTranscriptProgress({
      transcript_summary: {
        total: 4,
        ready: 2,
        missing: 2
      }
    })).toMatchObject({
      percent: 50,
      state: 'waiting',
      label: '2 bài chưa xử lý'
    });
  });

  it('surfaces failed transcripts before a generic processing state', () => {
    expect(getCourseTranscriptProgress({
      transcript_summary: {
        total: 5,
        ready: 3,
        processing: 1,
        failed: 1
      }
    })).toMatchObject({
      state: 'error',
      label: '1 bài cần kiểm tra'
    });
  });

  it('treats a course without video lessons as empty instead of 100 percent complete', () => {
    expect(getCourseTranscriptProgress({ transcript_summary: { total: 0 } })).toMatchObject({
      total: 0,
      percent: 0,
      state: 'empty',
      label: 'Không có video'
    });
  });

  it('polls only while at least one course has pending or processing transcripts', () => {
    expect(hasActiveTranscriptWork([
      { transcript_summary: { total: 3, ready: 1, processing: 2 } }
    ])).toBe(true);
    expect(hasActiveTranscriptWork([
      { transcript_summary: { total: 3, ready: 1, missing: 2 } },
      { transcript_summary: { total: 2, ready: 2 } }
    ])).toBe(false);
  });
});
