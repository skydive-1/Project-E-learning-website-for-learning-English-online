import React, { useEffect, useRef } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiExternalLink, FiX } from 'react-icons/fi';

import { useLanguage } from '../../../context/LanguageContext';

const PURPOSE_LABELS = {
  rag_ingestion_embedding: 'Nạp transcript vào Pinecone',
  rag_retrieval_embedding: 'Tìm kiếm ngữ cảnh bài học',
  rag_answer_generation: 'Sinh câu trả lời có căn cứ',
  rag_suggested_questions: 'Sinh câu hỏi gợi ý',
  rag_lesson_vocabulary: 'Trích xuất từ vựng bài học',
  rag_lesson_quiz: 'Tạo bài tập từ nội dung bài học'
};

const RagIncidentAlertModal = ({ incident, onClose, onOpenRateLimits }) => {
  const { language, t } = useLanguage();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button:not(:disabled), a[href]') || [];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  if (!incident || !String(incident.purpose || '').startsWith('rag_')) return null;

  const isQuota = incident.httpStatus === 429
    || /QUOTA|RESOURCE_EXHAUSTED|429/i.test(String(incident.errorCode || ''));
  const recovered = Boolean(incident.resolvedAt);
  const taskLabel = PURPOSE_LABELS[incident.purpose] || incident.purpose;
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';

  return (
    <div className="rag-incident-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="rag-incident-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rag-incident-title"
        aria-describedby="rag-incident-description"
      >
        <div className={`rag-incident-status ${recovered ? 'is-recovered' : 'is-active'}`}>
          {recovered ? <FiCheckCircle aria-hidden="true" /> : <FiAlertTriangle aria-hidden="true" />}
          <span>{recovered ? t('Đã tự phục hồi') : t('Đang cần chú ý')}</span>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          className="rag-incident-close"
          aria-label={t('Đóng hộp thoại')}
          onClick={onClose}
        >
          <FiX aria-hidden="true" />
        </button>

        <div className="rag-incident-heading">
          <FiAlertTriangle aria-hidden="true" />
          <div>
            <h2 id="rag-incident-title">
              {isQuota ? t('Gemini đã chạm quota khi xử lý RAG') : t('Gemini gặp lỗi khi xử lý RAG')}
            </h2>
            <p id="rag-incident-description">
              {t('Cảnh báo này chỉ xuất hiện cho tác vụ RAG; các lỗi AI ngoài RAG không kích hoạt popup.')}
            </p>
          </div>
        </div>

        <dl className="rag-incident-facts">
          <div><dt>{t('Tác vụ')}</dt><dd>{t(taskLabel)}</dd></div>
          <div><dt>{t('Model')}</dt><dd><code>{incident.model}</code></dd></div>
          <div><dt>{t('Mã lỗi')}</dt><dd><code>{incident.errorCode}</code></dd></div>
          <div><dt>{t('Số lần lặp')}</dt><dd>{incident.occurrenceCount || 1}</dd></div>
          <div><dt>{t('Ghi nhận gần nhất')}</dt><dd>{new Date(incident.lastSeenAt).toLocaleString(locale)}</dd></div>
          {incident.retryAfterMs ? (
            <div><dt>{t('Google đề nghị chờ')}</dt><dd>{Math.ceil(incident.retryAfterMs / 1000)}s</dd></div>
          ) : null}
        </dl>

        <p className="rag-incident-message">{incident.message}</p>

        <div className="rag-incident-actions">
          <button type="button" className="is-secondary" onClick={onClose}>{t('Đóng')}</button>
          <button type="button" className="is-primary" onClick={() => {
            onClose();
            onOpenRateLimits?.();
          }}>
            {t('Kiểm tra Rate Limits')} <FiExternalLink aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default RagIncidentAlertModal;
