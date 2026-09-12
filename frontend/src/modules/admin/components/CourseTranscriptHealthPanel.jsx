import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiTool
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
        limit: Math.min(20, Math.max(1, Number(course?.counts?.pending) || 10))
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
            disabled={pendingCount === 0 || Boolean(recoveringKey)}
          >
            {recoveringKey === 'all'
              ? <><FiRefreshCw className="is-spinning" aria-hidden="true" /> Đang đưa vào worker…</>
              : <><FiTool aria-hidden="true" /> Khôi phục ngay tối đa 10 bài</>}
          </button>
        </div>
      </div>

      <div className="transcript-health-panel__metrics" aria-label="Tổng quan trạng thái transcript">
        <div><strong>{Number(summary.ready) || 0}</strong><span>Sẵn sàng / {Number(summary.total) || 0} video</span></div>
        <div className={pendingCount ? 'has-warning' : ''}><strong>{pendingCount}</strong><span>Đang chờ</span></div>
        <div className={Number(summary.processing) ? 'has-warning' : ''}><strong>{Number(summary.processing) || 0}</strong><span>Đang xử lý</span></div>
        <div className={Number(summary.failed) ? 'has-error' : ''}><strong>{Number(summary.failed) || 0}</strong><span>Thất bại</span></div>
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
            return (
              <div className={`transcript-health-row is-${tone}`} key={course.courseId}>
                <div className="transcript-health-row__identity">
                  <strong>{course.courseName}</strong>
                  <span>Course #{course.courseId}</span>
                </div>
                <div className="transcript-health-row__detail">
                  <span>
                    {course.counts.pending} pending · {course.counts.processing} processing · {course.counts.failed} failed
                  </span>
                  <span>
                    Lesson: {course.affectedLessons.map(lesson => `#${lesson.lessonId}`).join(', ')}
                  </span>
                  {oldestPending > 0 && (
                    <span className="transcript-health-row__age">
                      <FiClock aria-hidden="true" /> Cũ nhất: {formatAge(oldestPending)}
                    </span>
                  )}
                </div>
                <div className="transcript-health-row__status">
                  <span>{course.counts.sourceMismatch} lệch nguồn</span>
                  <span>{course.counts.ready}/{course.counts.total} sẵn sàng</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRecover(course)}
                  disabled={course.counts.pending === 0 || Boolean(recoveringKey)}
                >
                  {recoveringKey === String(course.courseId)
                    ? <><FiRefreshCw className="is-spinning" aria-hidden="true" /> Đang khôi phục…</>
                    : <><FiTool aria-hidden="true" /> Khôi phục khóa này</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="transcript-health-panel__note">
        Khôi phục ngay chỉ bỏ thời gian chờ watchdog. Worker vẫn bóc băng tuần tự để bảo vệ quota Gemini miễn phí và tự dừng khi nhà cung cấp giới hạn.
      </p>
    </section>
  );
};

export default CourseTranscriptHealthPanel;
