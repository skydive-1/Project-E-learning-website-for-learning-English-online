import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiTool,
  FiUploadCloud
} from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';
import {
  getCourseTranscriptHealth,
  recoverPendingTranscripts
} from '../services/courseTranscriptAdmin.service';

const formatAge = (seconds = 0) => {
  const minutes = Math.max(0, Math.floor(Number(seconds) / 60));
  if (minutes < 1) return 'dưới 1 phút';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`;
};

const getCourseTone = (counts = {}) => {
  if (Number(counts.failed) > 0) return 'failed';
  if (Number(counts.pending) > 0 || Number(counts.processing) > 0) return 'pending';
  if (Number(counts.missing) > 0) return 'missing';
  return 'ready';
};

const getFailureGuidance = (lessons = []) => {
  const failedLessons = lessons.filter(lesson => lesson.transcriptStatus === 'failed');
  if (failedLessons.length === 0) return null;
  const confirmedMissing = failedLessons.filter(lesson => lesson.mediaMissingSource);
  if (confirmedMissing.length > 0) {
    return {
      title: 'File media đã mất khỏi storage',
      detail: 'Hệ thống đã dò MP4 gốc, audio DRM, tên file cũ và thư mục cũ theo UUID nhưng không tìm thấy. Cần mở khóa học và tải lại video cho các bài được liệt kê.',
      lessonIds: confirmedMissing.map(lesson => lesson.lessonId),
      requiresReupload: true
    };
  }
  const storageMissing = failedLessons.filter(lesson => (
    lesson.errorCode === 'TRANSCRIPT_MEDIA_SOURCE_MISSING'
    || /HTTP 404|không tìm thấy.*(?:video|MP4|audio)/i.test(lesson.errorMessage || '')
  ));
  if (storageMissing.length > 0) {
    return {
      title: 'Không truy cập được file media nguồn',
      detail: 'Bấm “Thử tự khôi phục” một lần: hệ thống sẽ dò MP4 gốc, audio DRM, tên file cũ và vị trí cũ theo UUID.',
      lessonIds: storageMissing.map(lesson => lesson.lessonId),
      requiresReupload: false
    };
  }
  const firstMessage = failedLessons.find(lesson => lesson.errorMessage)?.errorMessage;
  return {
    title: 'Pipeline tạo transcript đã thất bại',
    detail: firstMessage || 'Hãy thử lại. Nếu lỗi tiếp diễn, kiểm tra quota AI và nguồn video.',
    lessonIds: failedLessons.map(lesson => lesson.lessonId),
    requiresReupload: false
  };
};

const CourseTranscriptHealthPanel = () => {
  const showToast = useToast();
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [recoveringKey, setRecoveringKey] = useState(null);

  const loadHealth = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setIsLoading(true);
    setError('');
    try {
      setSnapshot(await getCourseTranscriptHealth());
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || 'Không thể tải sức khỏe transcript.');
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    const hasActiveWork = Number(snapshot?.summary?.pending) > 0 || Number(snapshot?.summary?.processing) > 0;
    if (!hasActiveWork) return undefined;
    const timer = window.setInterval(() => loadHealth({ quiet: true }), 15000);
    return () => window.clearInterval(timer);
  }, [snapshot?.summary?.pending, snapshot?.summary?.processing, loadHealth]);

  const affectedCourses = useMemo(
    () => (snapshot?.courses || []).filter(course => course.affectedLessons?.length > 0),
    [snapshot?.courses]
  );

  const handleRecover = async (course = null) => {
    const key = course ? String(course.courseId) : 'all';
    setRecoveringKey(key);
    try {
      const response = await recoverPendingTranscripts({
        courseId: course?.courseId || null,
        limit: Math.min(
          20,
          Math.max(1, Number(course?.counts?.pending) + Number(course?.counts?.failed) || 10)
        ),
        includeFailed: true
      });
      const scheduled = Number(response.data?.scheduled) || 0;
      const active = Number(response.data?.alreadyActive) || 0;
      showToast(
        scheduled > 0
          ? `Đã đưa ${scheduled} transcript vào worker xử lý ngay.`
          : (active > 0 ? `${active} transcript đã ở trong worker.` : response.message),
        scheduled > 0 || active > 0 ? 'success' : 'info'
      );
      await loadHealth({ quiet: true });
    } catch (requestError) {
      showToast(
        requestError?.response?.data?.message || 'Không thể khôi phục hàng đợi transcript.',
        'error'
      );
    } finally {
      setRecoveringKey(null);
    }
  };

  if (isLoading) {
    return (
      <section className="transcript-health-panel is-loading" aria-label="Sức khỏe transcript" aria-busy="true">
        <FiRefreshCw className="is-spinning" aria-hidden="true" />
        <span>Đang đọc trạng thái transcript từ PostgreSQL…</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="transcript-health-panel is-error" aria-label="Sức khỏe transcript" role="alert">
        <FiAlertTriangle aria-hidden="true" />
        <div>
          <strong>Không thể tải trạng thái transcript</strong>
          <span>{error}</span>
        </div>
        <button type="button" onClick={() => loadHealth()}>Thử lại</button>
      </section>
    );
  }

  const summary = snapshot?.summary || {};
  const pendingCount = Number(summary.pending) || 0;
  const failedCount = Number(summary.failed) || 0;
  const actionableCount = summary.recoverable === undefined
    ? Math.max(0, pendingCount + failedCount - (Number(summary.mediaMissing) || 0))
    : (Number(summary.recoverable) || 0);
  const allFailureGuidance = getFailureGuidance(
    affectedCourses.flatMap(course => course.affectedLessons || [])
  );
  const generatedAt = snapshot?.generatedAt
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(snapshot.generatedAt))
    : '—';

  return (
    <section className="transcript-health-panel" aria-labelledby="transcript-health-title">
      <div className="transcript-health-panel__header">
        <div>
          <h3 id="transcript-health-title">Sức khỏe transcript</h3>
          <p>
            Dữ liệu quan sát từ {snapshot?.source || 'PostgreSQL'}. Làm mới lúc {generatedAt}.
          </p>
        </div>
        <div className="transcript-health-panel__actions">
          <button type="button" className="is-secondary" onClick={() => loadHealth()} disabled={Boolean(recoveringKey)}>
            <FiRefreshCw aria-hidden="true" /> Làm mới
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => handleRecover()}
            disabled={actionableCount === 0 || Boolean(recoveringKey)}
          >
            {recoveringKey === 'all'
              ? <><FiRefreshCw className="is-spinning" aria-hidden="true" /> Đang đưa vào worker…</>
              : <><FiTool aria-hidden="true" /> {failedCount > 0 ? 'Thử tự khôi phục tối đa 10 bài' : 'Xử lý ngay tối đa 10 bài chờ'}</>}
          </button>
        </div>
      </div>

      {allFailureGuidance && (
        <div className="transcript-health-panel__guidance" role="status">
          <FiAlertTriangle aria-hidden="true" />
          <div>
            <strong>{failedCount} bài đã chạy nhưng thất bại — {allFailureGuidance.title}</strong>
            <span>{allFailureGuidance.detail}</span>
            <span>
              {allFailureGuidance.requiresReupload
                ? 'Bước tiếp theo: bấm “Tải lại video” ở từng khóa, thay video cho đúng lesson ID đang báo lỗi rồi lưu khóa học.'
                : 'Bước tiếp theo: bấm “Thử tự khôi phục” ở từng khóa hoặc nút màu xanh phía trên. Mỗi lượt tối đa 10 bài; bảng tự cập nhật mỗi 15 giây.'}
            </span>
          </div>
        </div>
      )}

      <div className="transcript-health-panel__metrics" aria-label="Tổng quan trạng thái transcript">
        <div><strong>{Number(summary.ready) || 0}</strong><span>Sẵn sàng / {Number(summary.total) || 0} video</span></div>
        <div className={pendingCount ? 'has-warning' : ''}><strong>{pendingCount}</strong><span>Đang chờ</span></div>
        <div className={Number(summary.processing) ? 'has-warning' : ''}><strong>{Number(summary.processing) || 0}</strong><span>Đang xử lý</span></div>
        <div className={Number(summary.failed) ? 'has-error' : ''}>
          <strong>{Number(summary.failed) || 0}</strong>
          <span>Thất bại · {Number(summary.mediaMissing) || 0} mất file nguồn</span>
        </div>
        <div><strong>{Number(summary.missing) || 0}</strong><span>Chưa có dữ liệu</span></div>
        <div className={Number(summary.sourceMismatch) ? 'has-error' : ''}><strong>{Number(summary.sourceMismatch) || 0}</strong><span>Lệch nguồn media</span></div>
      </div>

      {affectedCourses.length === 0 ? (
        <div className="transcript-health-panel__healthy" role="status">
          <FiCheckCircle aria-hidden="true" />
          <span>Tất cả transcript video hiện đều sẵn sàng.</span>
        </div>
      ) : (
        <div className="transcript-health-list">
          {affectedCourses.map(course => {
            const pendingLessons = course.affectedLessons.filter(lesson => lesson.transcriptStatus === 'pending');
            const oldestPending = Math.max(0, ...pendingLessons.map(lesson => lesson.statusAgeSeconds));
            const tone = getCourseTone(course.counts);
            const actionableCourseCount = course.counts.retryable === undefined
              ? Math.max(
                0,
                Number(course.counts.pending) + Number(course.counts.failed) - (Number(course.counts.mediaMissing) || 0)
              )
              : (Number(course.counts.retryable) || 0);
            const requiresReupload = Number(course.counts.mediaMissing) > 0 && actionableCourseCount === 0;
            const missingLessonId = course.affectedLessons.find(lesson => lesson.mediaMissingSource)?.lessonId;
            const failureGuidance = getFailureGuidance(course.affectedLessons);
            const courseActionLabel = course.counts.failed > 0 && course.counts.pending > 0
              ? `Xử lý ${actionableCourseCount} bài`
              : (course.counts.failed > 0
                  ? `Thử tự khôi phục ${actionableCourseCount} bài`
                  : `Xử lý ${course.counts.pending} bài chờ`);
            return (
              <div className={`transcript-health-row is-${tone}`} key={course.courseId}>
                <div className="transcript-health-row__identity">
                  <strong>{course.courseName}</strong>
                  <span>Course #{course.courseId}</span>
                </div>
                <div className="transcript-health-row__detail">
                  <span>
                    Đang chờ: {course.counts.pending} · Đang xử lý: {course.counts.processing} · Thất bại: {course.counts.failed}
                  </span>
                  <span>
                    Bài: {course.affectedLessons.map(lesson => `#${lesson.lessonId}`).join(', ')}
                  </span>
                  {oldestPending > 0 && (
                    <span className="transcript-health-row__age">
                      <FiClock aria-hidden="true" /> Cũ nhất: {formatAge(oldestPending)}
                    </span>
                  )}
                  {failureGuidance && (
                    <span className="transcript-health-row__failure">
                      <strong>{failureGuidance.title}</strong>
                      {failureGuidance.detail}
                    </span>
                  )}
                </div>
                <div className="transcript-health-row__status">
                  <span>{course.counts.sourceMismatch} lệch nguồn</span>
                  <span>{course.counts.ready}/{course.counts.total} sẵn sàng</span>
                </div>
                {requiresReupload ? (
                  <a href={`/instructor/edit-course/${course.courseId}?tab=curriculum&lessonId=${missingLessonId}&issue=missing-media-source`}>
                    <FiUploadCloud aria-hidden="true" /> Tải lại video
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRecover(course)}
                    disabled={actionableCourseCount === 0 || Boolean(recoveringKey)}
                  >
                    {recoveringKey === String(course.courseId)
                    ? <><FiRefreshCw className="is-spinning" aria-hidden="true" /> Đang đưa vào worker…</>
                    : <><FiTool aria-hidden="true" /> {courseActionLabel}</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="transcript-health-panel__note">
        Tự khôi phục chỉ chạy cho bài còn khả năng xử lý. Bài đã xác nhận mất file sẽ không bị retry vô hạn và phải tải lại video. Worker chạy tuần tự để bảo vệ quota Gemini miễn phí.
      </p>
    </section>
  );
};

export default CourseTranscriptHealthPanel;
