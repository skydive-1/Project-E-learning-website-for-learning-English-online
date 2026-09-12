import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpCircle,
  FiCheck,
  FiClock,
  FiExternalLink,
  FiInfo,
  FiRefreshCw,
  FiSave,
  FiSettings
} from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  getGeminiRateLimitCaps,
  getGeminiRateLimitStatus,
  resetGeminiModelRouting,
  updateGeminiRateLimitCaps
} from '../services/adminAnalytics.service';
import FreeTierUsageGuard from './FreeTierUsageGuard';
import GeminiFreeTierReference from './GeminiFreeTierReference';

// Chỉ là gợi ý ban đầu cho form trống; không được dùng để tính % trước khi admin lưu.
const SUGGESTED_CAPS = Object.freeze({
  'gemini-3.7-flash': { rpmCap: 10, tpmCap: 250000, rpdCap: 250 },
  'gemini-3.6-flash': { rpmCap: 10, tpmCap: 250000, rpdCap: 250 },
  'gemini-3.5-flash-lite': { rpmCap: 15, tpmCap: 250000, rpdCap: 1000 },
  'gemini-embedding-001': { rpmCap: 100, tpmCap: 30000, rpdCap: 1000 }
});

const DIMENSIONS = [
  { key: 'rpm', label: 'RPM', help: 'Requests / 60 giây (cửa sổ trượt)' },
  { key: 'tpm', label: 'TPM', help: 'Tokens / 60 giây (cửa sổ trượt)' },
  { key: 'rpd', label: 'RPD', help: 'Requests / ngày (reset 00:00 Pacific)' }
];

const MIN_MANUAL_REFRESH_MS = 650;

const waitForVisibleRefreshState = async (startedAt) => {
  const remainingMs = MIN_MANUAL_REFRESH_MS - (Date.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
  }
};

const getValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

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
  const targetModel = new URLSearchParams(window.location.search).get('model');
  const deepLinkHandledRef = useRef(false);
  const showToast = useToast();
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short'
  }), [locale]);

  const [status, setStatus] = useState(null);
  const [focusedModel, setFocusedModel] = useState('');
  const [savedCaps, setSavedCaps] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resettingRouting, setResettingRouting] = useState(false);
  const [savingModel, setSavingModel] = useState(null);
  const [error, setError] = useState(null);
  const latestTelemetryAt = getValidDate(status?.guard?.checkedAt || status?.generatedAt);
  const routing = status?.routing || null;
  const preferredModelCooldown = routing?.coolingDown?.find(
    (item) => item.model === routing.preferredModel
  ) || null;
  const preferredModelCoolingDown = Boolean(preferredModelCooldown);
  const preferredModelRpdExhausted = preferredModelCooldown?.dimension === 'rpd';

  const fetchData = useCallback(async ({ background = false, manual = false, fresh = false } = {}) => {
    const manualStartedAt = manual ? Date.now() : 0;
    try {
      if (manual) setRefreshing(true);
      if (!background && !manual) setLoading(true);
      if (!background) setError(null);

      const [nextStatus, nextCaps] = await Promise.all([
        getGeminiRateLimitStatus({ fresh }),
        getGeminiRateLimitCaps({ fresh })
      ]);
      setStatus(nextStatus);
      setSavedCaps(nextCaps);
      if (manual) {
        await waitForVisibleRefreshState(manualStartedAt);
        showToast(t('Đã cập nhật dữ liệu Gemini lúc {{time}}.', {
          time: dateTimeFormatter.format(new Date(nextStatus.generatedAt || Date.now()))
        }), 'success');
      }
      return true;
    } catch (requestError) {
      console.error('Không thể tải Gemini Rate Limits:', requestError);
      const message = t('Không thể cập nhật Rate Limits. Dữ liệu hiện tại vẫn được giữ nguyên.');
      if (manual) {
        await waitForVisibleRefreshState(manualStartedAt);
        showToast(message, 'error');
      }
      else if (!background) setError(t('Không thể tải Rate Limits. Kiểm tra backend và thử lại.'));
      return false;
    } finally {
      if (!background && !manual) setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [dateTimeFormatter, showToast, t]);

  useEffect(() => {
    fetchData();
    const refreshTimer = window.setInterval(() => fetchData({ background: true }), 15000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchData]);

  useEffect(() => {
    if (!targetModel || deepLinkHandledRef.current || !(status?.models || []).some((item) => item.model === targetModel)) {
      return undefined;
    }

    deepLinkHandledRef.current = true;
    setFocusedModel(targetModel);
    const scrollTimer = window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(`ai-model-${encodeURIComponent(targetModel)}`)?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    }, 80);
    const clearTimer = window.setTimeout(() => setFocusedModel(''), 6000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [status?.models, targetModel]);

  const editableModels = useMemo(() => {
    const modelNames = new Set([
      ...Object.keys(SUGGESTED_CAPS),
      ...(status?.models || []).map((item) => item.model),
      ...savedCaps.map((item) => item.model)
    ]);
    return Array.from(modelNames).sort((a, b) => a.localeCompare(b));
  }, [savedCaps, status?.models]);

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
      await fetchData({ background: true, fresh: true });
    } catch (saveError) {
      console.error('Không thể lưu Gemini Rate Limits:', saveError);
      showToast(saveError.response?.data?.message || t('Không thể lưu hạn mức. Vui lòng thử lại.'), 'error');
    } finally {
      setSavingModel(null);
    }
  };

  const handleResetRouting = async () => {
    try {
      setResettingRouting(true);
      const nextRouting = await resetGeminiModelRouting();
      setStatus((current) => current ? { ...current, routing: nextRouting } : current);
      showToast(t('Đã mở lại {{model}}. Request thật tiếp theo sẽ kiểm tra model này.', {
        model: nextRouting.preferredModel
      }), 'success');
    } catch (resetError) {
      console.error('Không thể khôi phục model Gemini ưu tiên:', resetError);
      showToast(
        resetError.response?.data?.message || t('Không thể khôi phục model ưu tiên. Vui lòng thử lại.'),
        'error'
      );
    } finally {
      setResettingRouting(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-rate-state" role="status">
        <FiRefreshCw className="is-spinning" aria-hidden="true" />
        <span>{t('Đang đọc dữ liệu sử dụng Gemini từ backend...')}</span>
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
          <p>{t('Theo dõi request Gemini do backend ghi nhận theo từng model. Cap chỉ có hiệu lực sau khi admin xác nhận và lưu.')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="ai-rate-refresh"
          onClick={() => fetchData({ manual: true, fresh: true })}
          disabled={refreshing}
          aria-busy={refreshing}
          aria-label={refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}
        >
          {refreshing
            ? <Spinner data-icon="inline-start" aria-hidden="true" />
            : <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />}
          {refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}
        </Button>
      </header>

      <section className="ai-rate-sync-status" aria-labelledby="ai-rate-sync-title" aria-live="polite">
        <div className="ai-rate-sync-status__summary">
          <span className={`ai-rate-sync-status__icon${refreshing ? ' is-refreshing' : ''}`}>
            {refreshing
              ? <Spinner aria-hidden="true" />
              : <FiActivity aria-hidden="true" />}
          </span>
          <div>
            <strong id="ai-rate-sync-title">
              {refreshing ? t('Đang đồng bộ telemetry từ backend...') : t('Backend telemetry đang hoạt động')}
            </strong>
            <p>{t('Tự làm mới mỗi 15 giây · RPM/TPM là cửa sổ trượt 60s · RPD đặt lại lúc 00:00 Pacific (14:00/15:00 VN).')}</p>
          </div>
        </div>

        <div className="ai-rate-sync-status__freshness">
          <span><i aria-hidden="true" />{t('Trực tiếp từ backend')}</span>
          <small>
            <FiClock aria-hidden="true" />
            {latestTelemetryAt
              ? t('Cập nhật cuối: {{time}}', { time: dateTimeFormatter.format(latestTelemetryAt) })
              : t('Chưa có thời điểm cập nhật')}
          </small>
        </div>

        <div className="ai-rate-sync-status__provider">
          <div>
            <span>{t('Đối chiếu Google Cloud Monitoring')}</span>
            <strong>{t('Chưa kết nối')}</strong>
          </div>
          <p>{t('Gemini API key không cấp quyền đọc Usage. Cần service account để đồng bộ metric từ Google; dữ liệu Google có thể trễ khoảng 150 giây.')}</p>
          <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer">
            {t('Mở Google AI Studio')}
            <FiExternalLink aria-hidden="true" />
          </a>
        </div>
      </section>

      {routing && (
        <section className="ai-model-routing" aria-labelledby="ai-model-routing-title">
          <div className="ai-model-routing__heading">
            <div>
              <span className="ai-model-routing__eyebrow">{t('Điều phối model')}</span>
              <h2 id="ai-model-routing-title">{t('Fallback và tự phục hồi')}</h2>
              <p>{t('Backend bỏ qua model đã hết RPD hoặc đang cooldown, rồi tự chọn model còn quota theo thứ tự ưu tiên.')}</p>
            </div>
            <span className={`ai-model-routing__state${preferredModelCoolingDown ? ' is-cooling' : ' is-ready'}`}>
              <i aria-hidden="true" />
              {preferredModelRpdExhausted
                ? t('Đang dùng model còn RPD')
                : preferredModelCoolingDown ? t('Model chính đang chờ') : t('Đang ưu tiên model cao nhất')}
            </span>
          </div>

          <div className="ai-model-routing__body">
            <div className="ai-model-routing__lane" aria-label={t('Thứ tự fallback')}>
              {(routing.fallbackOrder || []).map((model, index) => {
                const cooldown = routing.coolingDown?.find((item) => item.model === model);
                const isEffective = model === routing.effectiveModel;
                return (
                  <React.Fragment key={model}>
                    {index > 0 && <span className="ai-model-routing__arrow" aria-hidden="true">→</span>}
                    <div className={`ai-model-routing__model${cooldown ? ' is-cooling' : ''}${isEffective ? ' is-effective' : ''}`}>
                      <span>{index === 0 ? t('Ưu tiên') : t('Dự phòng {{number}}', { number: index })}</span>
                      <code>{model}</code>
                      <small>
                        {cooldown
                          ? cooldown.dimension === 'rpd'
                            ? t('Hết RPD · đặt lại {{time}}', {
                              time: dateTimeFormatter.format(new Date(cooldown.retryAt))
                            })
                            : t('Thử lại {{time}}', {
                              time: dateTimeFormatter.format(new Date(cooldown.retryAt))
                            })
                          : isEffective ? t('Request kế tiếp') : t('Sẵn sàng')}
                      </small>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <dl className="ai-model-routing__facts">
              <div>
                <dt>{t('Model cho request kế tiếp')}</dt>
                <dd><code>{routing.effectiveModel || routing.preferredModel}</code></dd>
              </div>
              <div>
                <dt>{t('Model thành công gần nhất')}</dt>
                <dd>
                  <code>{routing.lastSuccessfulModel || t('Chưa có dữ liệu')}</code>
                  {routing.lastSuccessfulAt && (
                    <small>{dateTimeFormatter.format(new Date(routing.lastSuccessfulAt))}</small>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <footer className="ai-model-routing__footer">
            <p>
              {t('Routing dùng telemetry do backend quan sát để bỏ qua model đã chạm RPD; Google AI Studio và phản hồi 429 vẫn là nguồn đối chiếu cuối. Model tự trở lại sau 00:00 Pacific.')}
            </p>
            {canManageCaps && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetRouting}
                disabled={resettingRouting || !preferredModelCoolingDown || preferredModelRpdExhausted}
                aria-busy={resettingRouting}
              >
                {resettingRouting
                  ? <Spinner data-icon="inline-start" aria-hidden="true" />
                  : <FiArrowUpCircle data-icon="inline-start" aria-hidden="true" />}
                {resettingRouting
                  ? t('Đang khôi phục')
                  : preferredModelRpdExhausted
                    ? t('Chờ reset RPD')
                    : preferredModelCoolingDown
                    ? t('Khôi phục model ưu tiên')
                    : t('Model ưu tiên đã sẵn sàng')}
              </Button>
            )}
          </footer>
        </section>
      )}

      <GeminiFreeTierReference models={status?.models || []} windows={status?.windows} />

      <FreeTierUsageGuard
        models={status?.models || []}
        checkedAt={status?.guard?.checkedAt || status?.generatedAt}
      />

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
            <article
              id={`ai-model-${encodeURIComponent(item.model)}`}
              className={`ai-model-card ${focusedModel === item.model ? 'alert-target-model' : ''}`}
              key={item.model}
            >
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

              <div className="ai-model-request-status" aria-label={t('Trạng thái request hôm nay')}>
                <span className="is-success">
                  <FiCheck aria-hidden="true" />
                  {t('{{count}} thành công', {
                    count: numberFormatter.format(item.requestStatus?.rpd?.success || 0)
                  })}
                </span>
                <span className={item.requestStatus?.rpd?.error > 0 ? 'is-error' : ''}>
                  <FiAlertTriangle aria-hidden="true" />
                  {t('{{count}} lỗi', {
                    count: numberFormatter.format(item.requestStatus?.rpd?.error || 0)
                  })}
                </span>
                {(item.requestStatus?.rpd?.pending || 0) > 0 && (
                  <span className="is-pending">
                    <FiClock aria-hidden="true" />
                    {t('{{count}} đang xử lý', {
                      count: numberFormatter.format(item.requestStatus.rpd.pending)
                    })}
                  </span>
                )}
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
              <h2 id="ai-rate-settings-title"><FiSettings aria-hidden="true" /> {t('Cấu hình cap theo model')}</h2>
              <p>{t('Nhập đúng giá trị của project đang dùng. Mỗi model và tier có thể có hạn mức khác nhau.')}</p>
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
