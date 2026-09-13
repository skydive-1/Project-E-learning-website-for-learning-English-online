import React, { useCallback, useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiRefreshCw,
  FiX,
  FiFilm,
  FiCpu,
  FiDatabase,
  FiHelpCircle,
  FiCheck,
  FiCornerDownLeft,
  FiArrowRight,
  FiPlayCircle,
  FiLayers,
  FiZap
} from 'react-icons/fi';
import apiClient from '../../../config/api.config';
import { useToast } from '../../../context/ToastContext';

const STAGE_ICONS = {
  media_dash: FiFilm,
  ai_transcription: FiCpu,
  rag_ingestion: FiDatabase,
  suggested_questions: FiHelpCircle
};

const CourseTranscriptPipelineModal = ({ courseId, onClose, onCourseUpdated }) => {
  const showToast = useToast();
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null); // 'approve' | 'reject' | 'recover'
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const fetchPipeline = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await apiClient.get(`/admin/courses/${courseId}/transcript-pipeline`);
      if (response.data && response.data.success) {
        setPipelineData(response.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu pipeline:', err);
      setError(err.response?.data?.message || 'Không thể tải tiến trình tự động hóa của khóa học.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  // Auto-polling nếu đang có bài học ở trạng thái processing hoặc pending
  useEffect(() => {
    const hasActiveWork = (pipelineData?.summary?.processingTranscripts || 0) > 0 ||
                          (pipelineData?.summary?.mediaReadyCount || 0) < (pipelineData?.summary?.totalMediaLessons || 0);
    if (!hasActiveWork) return undefined;
    const timer = window.setInterval(() => {
      fetchPipeline({ quiet: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [pipelineData, fetchPipeline]);

  // Admin Phê duyệt xuất bản
  const handleApprove = async () => {
    setActionInProgress('approve');
    try {
      const response = await apiClient.post(`/admin/courses/${courseId}/approve`);
      showToast(response.data?.message || 'Khóa học đã được phê duyệt và chính thức xuất bản!', 'success');
      if (onCourseUpdated) onCourseUpdated();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi khi phê duyệt khóa học.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Admin Từ chối duyệt (yêu cầu sửa)
  const handleReject = async () => {
    setActionInProgress('reject');
    try {
      const response = await apiClient.post(`/admin/courses/${courseId}/reject`, { reason: rejectReason });
      showToast(response.data?.message || 'Khóa học đã được chuyển về bản nháp.', 'info');
      if (onCourseUpdated) onCourseUpdated();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi khi từ chối khóa học.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Admin bấm thử lại/ưu tiên xử lý bài giảng
  const handleRetryLesson = async (lessonId) => {
    setActionInProgress(`recover-${lessonId}`);
    try {
      await apiClient.post('/admin/course-transcripts/recover', {
        courseId,
        lessonIds: [lessonId],
        limit: 1,
        includeFailed: true
      });
      showToast(`Đã đưa bài học #${lessonId} vào hàng đợi xử lý ưu tiên!`, 'success');
      await fetchPipeline({ quiet: true });
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể đưa bài học vào hàng đợi.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Admin bấm xử lý đồng thời tất cả bài học chưa hoàn tất
  const handleProcessAllLessons = async () => {
    const unfinishedLessons = (pipelineData?.lessons || [])
      .filter((les) => ['video', 'youtube'].includes(String(les.content_type).toLowerCase()) && les.subtitle_status !== 'ready')
      .map((les) => les.lesson_id);

    if (unfinishedLessons.length === 0) {
      showToast('Tất cả bài học video trong khóa đều đã hoàn tất phụ đề & AI!', 'info');
      return;
    }

    setActionInProgress('recover-all');
    try {
      await apiClient.post('/admin/course-transcripts/recover', {
        courseId,
        lessonIds: unfinishedLessons,
        limit: Math.max(10, unfinishedLessons.length),
        includeFailed: true
      });
      showToast(`Đã đưa đồng thời ${unfinishedLessons.length} bài học vào hàng đợi xử lý song song!`, 'success');
      await fetchPipeline({ quiet: true });
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể kích hoạt xử lý hàng loạt.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const summary = pipelineData?.summary;
  const course = pipelineData?.course;
  const lessons = pipelineData?.lessons || [];
  const isPendingReview = course?.status_name === 'pending_review' || course?.status === 'pending_review';
  const hasUnfinishedLessons = lessons.some(
    (les) => ['video', 'youtube'].includes(String(les.content_type).toLowerCase()) && les.subtitle_status !== 'ready'
  );

  return (
    <div className="transcript-pipeline-overlay" role="dialog" aria-modal="true">
      <div className="transcript-pipeline-modal-shell">
        <div className="transcript-pipeline-modal-core">
          {/* Header */}
          <div className="pipeline-modal-header">
            <div className="pipeline-modal-title-group">
              <div className="pipeline-modal-badge">
                <FiCpu className="badge-icon" />
                <span>Transcript & AI Automation Telemetry</span>
              </div>
              <h2>{course?.course_name || `Khóa học #${courseId}`}</h2>
              <div className="pipeline-modal-meta">
                <span>Giảng viên: <strong>{course?.instructor_name || '—'}</strong></span>
                <span>•</span>
                <span>Trạng thái: 
                  <strong className={`status-pill ${course?.status_name || 'draft'}`}>
                    {course?.status_name === 'published' ? 'Đã xuất bản' : (isPendingReview ? 'Chờ kiểm duyệt' : 'Bản nháp')}
                  </strong>
                </span>
                <span>•</span>
                <span>{summary?.totalLessons || 0} bài học ({summary?.totalMediaLessons || 0} video)</span>
              </div>
            </div>

            <button 
              type="button" 
              className="pipeline-modal-close" 
              onClick={onClose}
              aria-label="Đóng bảng theo dõi"
            >
              <FiX />
            </button>
          </div>

          {loading ? (
            <div className="pipeline-modal-loading">
              <FiRefreshCw className="is-spinning" />
              <span>Đang kết nối hệ thống vi điều khiển AI & CSDL...</span>
            </div>
          ) : error ? (
            <div className="pipeline-modal-error">
              <FiAlertTriangle />
              <p>{error}</p>
              <button type="button" onClick={() => fetchPipeline()}>Thử lại</button>
            </div>
          ) : (
            <div className="pipeline-modal-body">
              {/* Overall Progress Banner */}
              <div className="pipeline-progress-banner">
                <div className="progress-info">
                  <div className="progress-label-group">
                    <span className="progress-title">Độ sẵn sàng tự động hóa tổng thể</span>
                    <span className="progress-status-desc">
                      {summary?.isFullyReady 
                        ? '100% Sẵn sàng cho học viên trải nghiệm' 
                        : (summary?.processingTranscripts > 0 
                            ? `Hệ thống AI đang bóc tách ngầm (${summary.readyTranscripts}/${summary.totalMediaLessons} bài hoàn tất)...` 
                            : 'Cần bóc tách hoặc kiểm tra lỗi')}
                    </span>
                  </div>
                  <div className="progress-metric">
                    <span className="progress-percent">{summary?.overallProgress || 0}%</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div 
                    className={`progress-fill ${summary?.isFullyReady ? 'is-complete' : 'is-processing'}`} 
                    style={{ width: `${summary?.overallProgress || 0}%` }} 
                  />
                </div>
              </div>

              {/* 4-Stage Stepper Grid */}
              <div className="pipeline-stages-grid">
                {(summary?.stages || []).map((st) => {
                  const IconComponent = STAGE_ICONS[st.id] || FiLayers;
                  const isReady = st.status === 'ready';
                  const isProcessing = st.status === 'processing';
                  const isFailed = st.status === 'failed';

                  return (
                    <div key={st.id} className={`pipeline-stage-card ${st.status}`}>
                      <div className="stage-card-header">
                        <div className="stage-icon-wrap">
                          <IconComponent />
                        </div>
                        <span className={`stage-status-chip ${st.status}`}>
                          {isReady ? (
                            <><FiCheckCircle /> Đã sẵn sàng</>
                          ) : isProcessing ? (
                            <><FiRefreshCw className="is-spinning" /> Đang xử lý</>
                          ) : isFailed ? (
                            <><FiAlertTriangle /> Cần kiểm tra</>
                          ) : (
                            <><FiClock /> Đang chờ</>
                          )}
                        </span>
                      </div>
                      <div className="stage-card-body">
                        <h4>{st.title}</h4>
                        <p>{st.description}</p>
                      </div>
                      <div className="stage-card-footer">
                        <div className="stage-mini-track">
                          <div className="stage-mini-fill" style={{ width: `${st.percent}%` }} />
                        </div>
                        <span className="stage-percent-text">{st.percent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lessons Detailed Pipeline Table */}
              <div className="pipeline-lessons-section">
                <div className="section-header">
                  <h3>Chi tiết từng bài giảng trong quy trình bóc tách</h3>
                  <div className="section-header-actions">
                    {hasUnfinishedLessons && (
                      <button
                        type="button"
                        className="pipeline-batch-process-btn"
                        onClick={handleProcessAllLessons}
                        disabled={actionInProgress === 'recover-all'}
                        title="Đưa đồng thời tất cả các bài học chưa hoàn tất vào hàng đợi xử lý song song"
                      >
                        <FiZap className={actionInProgress === 'recover-all' ? 'is-spinning' : ''} />
                        {actionInProgress === 'recover-all' ? 'Đang kích hoạt...' : 'Xử lý song song tất cả bài học'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="pipeline-refresh-btn"
                      onClick={() => fetchPipeline({ quiet: false })}
                    >
                      <FiRefreshCw /> Làm mới trạng thái
                    </button>
                  </div>
                </div>

                <div className="pipeline-lessons-table-wrap">
                  <table className="pipeline-lessons-table">
                    <thead>
                      <tr>
                        <th>Bài học</th>
                        <th>Chương</th>
                        <th>Định dạng</th>
                        <th>File Media</th>
                        <th>Phụ đề En - Vi</th>
                        <th>RAG Vector</th>
                        <th>Câu hỏi gợi ý</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessons.map((les) => {
                        const isVideo = ['video', 'youtube'].includes(String(les.content_type).toLowerCase());
                        const isSubReady = les.subtitle_status === 'ready';
                        const isSubProcessing = ['pending', 'processing'].includes(les.subtitle_status);
                        const isSubFailed = les.subtitle_status === 'failed';

                        return (
                          <tr key={les.lesson_id} className={isSubFailed ? 'row-failed' : ''}>
                            <td>
                              <div className="lesson-cell-name">
                                <strong>{les.lesson_title}</strong>
                                <span className="lesson-id">#{les.lesson_id}</span>
                              </div>
                            </td>
                            <td>{les.section_title || '—'}</td>
                            <td>
                              <span className={`content-type-badge ${les.content_type}`}>
                                {les.content_type === 'youtube' ? 'YouTube' : (les.content_type === 'video' ? 'Video DASH' : les.content_type)}
                              </span>
                            </td>
                            <td>
                              {les.media_status === 'READY' || les.content_type === 'youtube' ? (
                                <span className="badge-pill is-ok"><FiCheckCircle /> Sẵn sàng</span>
                              ) : les.media_status === 'MISSING_SOURCE' ? (
                                <span className="badge-pill is-err"><FiAlertTriangle /> Mất file</span>
                              ) : (
                                <span className="badge-pill is-pending"><FiClock /> Đang xử lý</span>
                              )}
                            </td>
                            <td>
                              {isSubReady ? (
                                <span className="badge-pill is-ok">
                                  <FiCheckCircle /> {les.cue_count} cues
                                </span>
                              ) : isSubProcessing ? (
                                <span className="badge-pill is-proc">
                                  <FiRefreshCw className="is-spinning" /> Đang bóc tách
                                </span>
                              ) : isSubFailed ? (
                                <span className="badge-pill is-err" title={les.error_message || les.error_code || 'Lỗi bóc tách'}>
                                  <FiAlertTriangle /> Thất bại
                                </span>
                              ) : (
                                <span className="badge-pill is-pending"><FiClock /> Chưa bóc tách</span>
                              )}
                            </td>
                            <td>
                              {isSubReady ? (
                                <span className="badge-pill is-ok"><FiCheckCircle /> Đã nạp RAG</span>
                              ) : (
                                <span className="badge-pill is-pending"><FiClock /> Chờ phụ đề</span>
                              )}
                            </td>
                            <td>
                              {les.has_suggested_questions ? (
                                <span className="badge-pill is-ok"><FiCheckCircle /> {les.suggested_questions_count} câu hỏi</span>
                              ) : isSubReady ? (
                                <span className="badge-pill is-proc"><FiRefreshCw className="is-spinning" /> Đang sinh</span>
                              ) : (
                                <span className="badge-pill is-pending"><FiClock /> Chờ phụ đề</span>
                              )}
                            </td>
                            <td>
                              {isVideo && !isSubReady && (
                                <button
                                  type="button"
                                  className="btn-retry-lesson"
                                  onClick={() => handleRetryLesson(les.lesson_id)}
                                  disabled={actionInProgress === `recover-${les.lesson_id}`}
                                >
                                  <FiRefreshCw className={actionInProgress === `recover-${les.lesson_id}` ? 'is-spinning' : ''} />
                                  Xử lý ngay
                                </button>
                              )}
                              {isSubReady && (
                                <span className="text-ready-check"><FiCheck /> Hoàn tất</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admin Publishing Gate Decision Bar */}
              {isPendingReview && (
                <div className="pipeline-decision-bar">
                  <div className="decision-info">
                    <div className="decision-title">
                      <FiClock className="icon-pulse" />
                      <span>Khóa học này đang chờ Phê duyệt xuất bản (Publishing Gate)</span>
                    </div>
                    <p className="decision-desc">
                      {summary?.isFullyReady
                        ? 'Toàn bộ bài giảng đã hoàn tất bóc tách phụ đề và chuẩn bị câu hỏi. Khóa học đủ điều kiện xuất bản ngay cho học viên!'
                        : 'Một số bài giảng đang được AI tiền xử lý. Bạn có thể duyệt trước hoặc đợi hệ thống bóc tách xong để trải nghiệm học viên là 100% mượt mà.'}
                    </p>
                  </div>

                  {!showRejectInput ? (
                    <div className="decision-actions">
                      <button
                        type="button"
                        className="btn-decision-reject"
                        onClick={() => setShowRejectInput(true)}
                        disabled={Boolean(actionInProgress)}
                      >
                        <FiCornerDownLeft /> Yêu cầu sửa (Từ chối)
                      </button>
                      <button
                        type="button"
                        className="btn-decision-approve"
                        onClick={handleApprove}
                        disabled={Boolean(actionInProgress)}
                      >
                        {actionInProgress === 'approve' ? (
                          <><FiRefreshCw className="is-spinning" /> Đang xuất bản...</>
                        ) : (
                          <><FiCheck /> Phê duyệt & Xuất bản ngay</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="reject-input-group">
                      <input
                        type="text"
                        placeholder="Nhập lý do yêu cầu chỉnh sửa cho giảng viên..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="reject-reason-input"
                      />
                      <button
                        type="button"
                        className="btn-confirm-reject"
                        onClick={handleReject}
                        disabled={Boolean(actionInProgress)}
                      >
                        Xác nhận gửi trả
                      </button>
                      <button
                        type="button"
                        className="btn-cancel-reject"
                        onClick={() => setShowRejectInput(false)}
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseTranscriptPipelineModal;
