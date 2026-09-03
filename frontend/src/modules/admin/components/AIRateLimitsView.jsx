import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiExternalLink,
  FiInfo,
  FiRefreshCw,
  FiSave,
  FiSettings
} from 'react-icons/fi';

import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  getGeminiRateLimitCaps,
  getGeminiRateLimitStatus,
  updateGeminiRateLimitCaps
} from '../services/adminAnalytics.service';

// Chỉ là gợi ý ban đầu cho form trống; không được dùng để tính % trước khi admin lưu.
const ACTIVE_GEMINI_MODEL = 'gemini-3.7-flash';
const SUGGESTED_CAPS = Object.freeze({
  [ACTIVE_GEMINI_MODEL]: { rpmCap: 10, tpmCap: 250000, rpdCap: 250 }
});

const DIMENSIONS = [
  { key: 'rpm', label: 'RPM', help: 'Requests / 60 giây' },
  { key: 'tpm', label: 'TPM', help: 'Tokens / 60 giây' },
  { key: 'rpd', label: 'RPD', help: 'Requests / ngày Pacific' }
];

const getLevel = (percent) => {
  if (percent === null || percent === undefined) return 'unconfigured';
  if (percent > 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'healthy';
};

const makeDraft = (model, saved) => {
  const suggestion = SUGGESTED_CAPS[model] || {};
  return {
    model,
    rpmCap: saved?.rpmCap ?? suggestion.rpmCap ?? '',
    tpmCap: saved?.tpmCap ?? suggestion.tpmCap ?? '',
    rpdCap: saved?.rpdCap ?? suggestion.rpdCap ?? '',
    sourceUpdatedAt: saved?.updatedAt ?? null
  };
};

const AIRateLimitsView = ({ canManageCaps }) => {
  const showToast = useToast();
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short'
  }), [locale]);

  const [status, setStatus] = useState(null);
  const [savedCaps, setSavedCaps] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingModel, setSavingModel] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [nextStatus, nextCaps] = await Promise.all([
        getGeminiRateLimitStatus(),
        getGeminiRateLimitCaps()
      ]);
      setStatus({
        ...nextStatus,
        models: (nextStatus?.models || []).filter((item) => item.model === ACTIVE_GEMINI_MODEL),
        notices: (nextStatus?.notices || []).filter((item) => item.model === ACTIVE_GEMINI_MODEL)
      });
      setSavedCaps((nextCaps || []).filter((item) => item.model === ACTIVE_GEMINI_MODEL));
    } catch (requestError) {
      console.error('Không thể tải Gemini Rate Limits:', requestError);
      setError(t('Không thể tải Rate Limits. Kiểm tra backend và thử lại.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    const refreshTimer = window.setInterval(() => fetchData({ silent: true }), 15000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchData]);

  const editableModels = useMemo(() => {
    return [ACTIVE_GEMINI_MODEL];
  }, []);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const model of editableModels) {
        const saved = savedCaps.find((item) => item.model === model);
        if (!next[model] || (saved && next[model].sourceUpdatedAt !== saved.updatedAt)) {
          next[model] = makeDraft(model, saved);
        }
      }
      return next;
    });
  }, [editableModels, savedCaps]);

  const handleDraftChange = (model, field, value) => {
    setDrafts((current) => ({
      ...current,
      [model]: { ...current[model], [field]: value }
    }));
  };

  const handleSave = async (model) => {
    const draft = drafts[model];
    const payload = {
      model,
      rpmCap: Number(draft?.rpmCap),
      tpmCap: Number(draft?.tpmCap),
      rpdCap: Number(draft?.rpdCap)
    };

    if ([payload.rpmCap, payload.tpmCap, payload.rpdCap].some((cap) => !Number.isSafeInteger(cap) || cap <= 0)) {
      showToast(t('RPM, TPM và RPD phải là số nguyên dương.'), 'warning');
      return;
    }

    try {
      setSavingModel(model);
      await updateGeminiRateLimitCaps(payload);
      showToast(t('Đã lưu hạn mức cho {{model}}.', { model }), 'success');
      await fetchData({ silent: true });
    } catch (saveError) {
      console.error('Không thể lưu Gemini Rate Limits:', saveError);
      showToast(saveError.response?.data?.message || t('Không thể lưu hạn mức. Vui lòng thử lại.'), 'error');
    } finally {
      setSavingModel(null);
    }
  };

  if (loading) {
    return (
      <div className="ai-rate-state" role="status">
        <FiRefreshCw className="is-spinning" aria-hidden="true" />
        <span>{t('Đang đọc mức sử dụng Gemini theo thời gian thực...')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-rate-state is-error" role="alert">
        <FiAlertTriangle aria-hidden="true" />
        <div>
          <strong>{error}</strong>
          <button type="button" onClick={() => fetchData()}>{t('Thử lại')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-rate-view">
      <header className="ai-rate-header">
        <div>
          <h2>{t('Nhịp sử dụng Gemini')}</h2>
          <p>{t('Theo dõi ba cửa sổ quota thật của Gemini 3.7 Flash. Cap chỉ có hiệu lực sau khi admin xác nhận và lưu.')}</p>
        </div>
        <button
          type="button"
          className="ai-rate-refresh"
          onClick={() => fetchData({ silent: true })}
          disabled={refreshing}
        >
          <FiRefreshCw className={refreshing ? 'is-spinning' : ''} aria-hidden="true" />
          {refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}
        </button>
      </header>

      <div className="ai-rate-boundary-note">
        <FiClock aria-hidden="true" />
        <p>
          <strong>{t('Hai loại hạn mức, hai mốc đặt lại.')}</strong>
          {t(' RPM/TPM là cửa sổ trượt 60 giây; RPD đặt lại lúc 00:00 Pacific. Quota câu hỏi học viên ở tab Usage là quy tắc nội bộ theo giờ Việt Nam.')}
        </p>
      </div>

      {(status?.notices || []).length > 0 && (
        <div className="ai-rate-discrepancy" role="alert">
          <FiAlertTriangle aria-hidden="true" />
          <div>
            <strong>{t('Phát hiện giới hạn thật có thể khác cấu hình hiện tại — vui lòng xác nhận lại.')}</strong>
            <ul>
              {status.notices.map((notice) => (
                <li key={`${notice.model}-${notice.dimension}`}>
                  <code>{notice.model}</code> · {notice.dimension.toUpperCase()} · {t('cap đang lưu')} {numberFormatter.format(notice.configuredCap)}
                  {notice.providerLimit
                    ? ` · ${t('tín hiệu từ Google')} ${numberFormatter.format(notice.providerLimit)}`
                    : ` · ${t('usage quan sát')} ${numberFormatter.format(notice.observedUsage)}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(status?.models || []).length === 0 ? (
        <div className="ai-rate-empty">
          <FiActivity aria-hidden="true" />
          <h3>{t('Chưa có model hoạt động trong 24 giờ qua')}</h3>
          <p>{t('Khi Gemini phát sinh usage, model sẽ xuất hiện ở đây. Bạn vẫn có thể chuẩn bị cap trong phần cấu hình bên dưới.')}</p>
        </div>
      ) : (
        <div className="ai-model-grid">
          {status.models.map((item) => (
            <article className="ai-model-card" key={item.model}>
              <div className="ai-model-card__header">
                <div>
                  <h3>{item.model}</h3>
                  <span className={item.configured ? 'is-configured' : 'is-unconfigured'}>
                    {item.configured ? <FiCheck aria-hidden="true" /> : <FiInfo aria-hidden="true" />}
                    {item.configured ? t('Đã xác nhận cap') : t('Chưa cấu hình cap')}
                  </span>
                </div>
                <span className="ai-model-live"><i /> LIVE</span>
              </div>

              <div className="ai-model-metrics">
                {DIMENSIONS.map((dimension) => {
                  const current = item.usage?.[dimension.key] || 0;
                  const cap = item.caps?.[dimension.key];
                  const percent = item.percentUsed?.[dimension.key] ?? null;
                  const level = getLevel(percent);
                  return (
                    <div className={`ai-limit-meter is-${level}`} key={dimension.key}>
                      <div className="ai-limit-meter__label">
                        <span><strong>{dimension.label}</strong> {t(dimension.help)}</span>
                        <b>{percent === null ? '—' : `${numberFormatter.format(percent)}%`}</b>
                      </div>
                      <div
                        className="ai-limit-meter__track"
                        role="progressbar"
                        aria-label={`${dimension.label} ${item.model}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent === null ? undefined : Math.min(100, Math.round(percent))}
                      >
                        <span style={{ width: `${percent === null ? 0 : Math.min(100, percent)}%` }} />
                      </div>
                      <div className="ai-limit-meter__values">
                        <span>{numberFormatter.format(current)}</span>
                        <span>{cap ? `/ ${numberFormatter.format(cap)}` : t('Chưa có cap')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer>
                {item.updatedAt
                  ? t('Cập nhật {{time}}{{name}}', {
                    time: dateTimeFormatter.format(new Date(item.updatedAt)),
                    name: item.updatedByName ? ` · ${item.updatedByName}` : ''
                  })
                  : t('Cần xác nhận cap trong Google AI Studio')}
              </footer>
            </article>
          ))}
        </div>
      )}

      {canManageCaps && (
        <section className="ai-rate-settings" aria-labelledby="ai-rate-settings-title">
          <div className="ai-rate-settings__heading">
            <div>
              <h2 id="ai-rate-settings-title"><FiSettings aria-hidden="true" /> {t('Cấu hình cap Gemini 3.7 Flash')}</h2>
              <p>{t('Nhập đúng hạn mức của Gemini 3.7 Flash trong project Google AI Studio đang dùng.')}</p>
            </div>
            <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer">
              Google AI Studio <FiExternalLink aria-hidden="true" />
            </a>
          </div>

          <div className="ai-rate-suggestion-warning" role="note">
            <FiAlertTriangle aria-hidden="true" />
            <span><strong>{t('Giá trị mặc định — vui lòng xác nhận lại số thật trong Google AI Studio > Usage.')}</strong> {t('Các số gợi ý chưa được dùng để tính phần trăm cho tới khi bạn bấm Lưu.')}</span>
          </div>

          <div className="ai-rate-settings-list">
            {editableModels.map((model) => {
              const saved = savedCaps.find((item) => item.model === model);
              const draft = drafts[model] || makeDraft(model, saved);
              return (
                <div className="ai-rate-setting-row" key={model}>
                  <div className="ai-rate-setting-model">
                    <strong>{model}</strong>
                    <span>{saved ? t('Cap đang có hiệu lực') : t('Gợi ý chưa lưu')}</span>
                  </div>
                  {['rpmCap', 'tpmCap', 'rpdCap'].map((field) => (
                    <label key={field}>
                      <span>{field.replace('Cap', '').toUpperCase()}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={draft[field]}
                        onChange={(event) => handleDraftChange(model, field, event.target.value)}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSave(model)}
                    disabled={savingModel === model}
                  >
                    {savingModel === model
                      ? <FiRefreshCw className="is-spinning" aria-hidden="true" />
                      : <FiSave aria-hidden="true" />}
                    {savingModel === model ? t('Đang lưu') : t('Lưu cap')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default AIRateLimitsView;
