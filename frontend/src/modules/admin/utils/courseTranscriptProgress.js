export const COURSE_TRANSCRIPT_POLL_INTERVAL_MS = 8000;

const toCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

export const getCourseTranscriptProgress = (course = {}) => {
  const summary = course.transcript_summary || {};
  const total = toCount(
    summary.total_video_lessons ?? summary.total ?? course.total_media_lessons
  );
  const ready = Math.min(
    total,
    toCount(summary.ready_transcripts ?? summary.ready ?? course.ready_transcripts)
  );
  const processing = toCount(
    summary.processing_transcripts ?? summary.processing ?? course.processing_transcripts
  );
  const failed = toCount(
    summary.failed_transcripts ?? summary.failed ?? course.failed_transcripts
  );
  const missing = toCount(
    summary.missing_transcripts ?? summary.missing ?? course.missing_transcripts
  );
  const percent = total > 0 ? Math.round((ready / total) * 100) : 0;

  if (total === 0) {
    return { total, ready, processing, failed, missing, percent, state: 'empty', label: 'Không có video' };
  }
  if (ready === total) {
    return { total, ready, processing, failed, missing, percent, state: 'complete', label: 'Hoàn tất' };
  }
  if (failed > 0) {
    return { total, ready, processing, failed, missing, percent, state: 'error', label: `${failed} bài cần kiểm tra` };
  }
  if (processing > 0) {
    return { total, ready, processing, failed, missing, percent, state: 'active', label: `${processing} bài đang chờ/xử lý` };
  }

  return {
    total,
    ready,
    processing,
    failed,
    missing,
    percent,
    state: 'waiting',
    label: `${Math.max(missing, total - ready)} bài chưa xử lý`
  };
};

export const hasActiveTranscriptWork = (courses = []) => courses.some(
  (course) => getCourseTranscriptProgress(course).processing > 0
);
