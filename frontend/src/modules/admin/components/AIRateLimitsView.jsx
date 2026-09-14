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
  FiLock,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiUnlock
} from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  getGeminiRateLimitCaps,
  getGeminiRateLimitStatus,
  connectGeminiRateLimitStream,
  resetGeminiModelRouting,
  setPreferredGeminiModel,
  toggleAiModelLock,
  updateGeminiRateLimitCaps
} from '../services/adminAnalytics.service';
import FreeTierUsageGuard from './FreeTierUsageGuard';
import GeminiFreeTierReference from './GeminiFreeTierReference';

// Chỉ là gợi ý ban đầu cho form trống; không được dùng để tính % trước khi admin lưu.
const SUGGESTED_CAPS = Object.freeze({
  'gemini-3.7-flash': { rpmCap: 5, tpmCap: 250000, rpdCap: 20 },
  'gemini-3.6-flash': { rpmCap: 5, tpmCap: 250000, rpdCap: 20 },
  'gemini-3.5-flash-lite': { rpmCap: 15, tpmCap: 250000, rpdCap: 500 },
  'gemini-embedding-001': { rpmCap: 100, tpmCap: 30000, rpdCap: 1000 }
});

const DIMENSIONS = [
  { key: 'rpm', label: 'Lượt gọi / 60s', help: 'Backend đã thử gọi trong 60 giây gần nhất' },
  { key: 'tpm', label: 'Token / 60s', help: 'Token backend ghi nhận trong 60 giây gần nhất' },
  { key: 'rpd', label: 'Lượt gọi hôm nay', help: 'Backend đã thử gọi trong ngày Pacific' }
];

const MIN_MANUAL_REFRESH_MS = 650;
const FALLBACK_POLL_INTERVAL_MS = 15_000;
const STREAM_RECONNECT_MS = 10_000;

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
  const fetchInFlightRef = useRef(false);
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
  const [settingPreferredModel, setSettingPreferredModel] = useState(null);
  const [lockingModel, setLockingModel] = useState(null);
  const [savingModel, setSavingModel] = useState(null);
  const [error, setError] = useState(null);
  const [streamState, setStreamState] = useState('connecting');
  const isStreamConnecting = streamState === 'connecting' || streamState === 'delayed';
  const latestTelemetryAt = getValidDate(status?.guard?.checkedAt || status?.generatedAt);
  const routing = status?.routing || null;
  const preferredModelCooldown = routing?.coolingDown?.find(
    (item) => item.model === routing.preferredModel
  ) || null;
  const preferredModelCoolingDown = Boolean(preferredModelCooldown);
  const preferredModelRpdExhausted = preferredModelCooldown?.dimension === 'rpd';
  const anyModelCoolingDown = Boolean(routing?.coolingDown && routing.coolingDown.length > 0);

  const fetchData = useCallback(async ({ background = false, manual = false, fresh = false, includeCaps = !background } = {}) => {
    if (fetchInFlightRef.current) return false;
    fetchInFlightRef.current = true;
    const manualStartedAt = manual ? Date.now() : 0;
    try {
      if (manual) setRefreshing(true);
      if (!background && !manual) setLoading(true);
      if (!background) setError(null);

      const [nextStatus, nextCaps] = await Promise.all([
        getGeminiRateLimitStatus({ fresh }),
        includeCaps ? getGeminiRateLimitCaps({ fresh }) : Promise.resolve(null)
      ]);
      setStatus(nextStatus);
      if (nextCaps) setSavedCaps(nextCaps);
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
      fetchInFlightRef.current = false;
      if (!background && !manual) setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [dateTimeFormatter, showToast, t]);

  useEffect(() => {
    fetchData();

    let disposed = false;
    let stream = null;
    let reconnectTimer = null;
    let fallbackTimer = null;
    let connectionGeneration = 0;

    const stopFallback = () => {
      if (fallbackTimer) window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    };

    const startFallback = () => {
      if (disposed || document.visibilityState !== 'visible' || fallbackTimer) return;
      setStreamState('fallback');
      fetchData({ background: true, fresh: true });
      fallbackTimer = window.setInterval(
        () => fetchData({ background: true, fresh: true }),
        FALLBACK_POLL_INTERVAL_MS
      );
    };

    const disconnect = () => {
      connectionGeneration += 1;
      stream?.close();
      stream = null;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      stopFallback();
    };

    const connect = () => {
      if (disposed || document.visibilityState !== 'visible') return;
      disconnect();
      setStreamState('connecting');
      const generation = connectionGeneration;

      stream = connectGeminiRateLimitStream({
        onStatus: () => {
          if (disposed || generation !== connectionGeneration) return;
          stopFallback();
          setStreamState('live');
        },
        onSnapshot: (nextStatus) => {
          if (disposed || generation !== connectionGeneration) return;
          setStatus(nextStatus);
          stopFallback();
          setStreamState('live');
        },
        onStreamError: () => {
          if (!disposed && generation === connectionGeneration) setStreamState('delayed');
        }
      });

      stream.done.catch((streamError) => {
        if (disposed || generation !== connectionGeneration) return;
        console.warn('Gemini rate-limit SSE bị gián đoạn, chuyển sang polling:', streamError);
        startFallback();
        reconnectTimer = window.setTimeout(connect, STREAM_RECONNECT_MS);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        disconnect();
        setStreamState('paused');
      } else {
        fetchData({ background: true, fresh: true });
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
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
      await fetchData({ background: true, fresh: true, includeCaps: true });
    } catch (saveError) {
      console.error('Không thể lưu Gemini Rate Limits:', saveError);
      showToast(saveError.response?.data?.message || t('Không thể lưu hạn mức. Vui lòng thử lại.'), 'error');
    } finally {
      setSavingModel(null);
    }
  };

  const handleSelectPreferredModel = async (model) => {
    if (!model || model === routing?.preferredModel || settingPreferredModel) return;
    try {
      setSettingPreferredModel(model);
      const nextRouting = await setPreferredGeminiModel(model);
      setStatus((current) => current ? { ...current, routing: nextRouting } : current);
      showToast(t('Đã chuyển model ưu tiên sang {{model}}. Các tác vụ AI sẽ ưu tiên dùng model này.', {
        model
      }), 'success');
    } catch (selectError) {
      console.error('Không thể đổi model ưu tiên:', selectError);
      showToast(
        selectError.response?.data?.message || t('Không thể đổi model ưu tiên. Vui lòng thử lại.'),
        'error'
      );
    } finally {
      setSettingPreferredModel(null);
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

  const handleToggleLock = async (model, currentlyLocked, event) => {
    if (event) {
      event.stopPropagation();
    }
    if (!model || lockingModel) return;
    try {
      setLockingModel(model);
      const nextRouting = await toggleAiModelLock({
        model,
        locked: !currentlyLocked,
        reason: currentlyLocked ? null : 'Admin manually locked model from dashboard'
      });
      setStatus((current) => (current ? { ...current, routing: nextRouting } : current));
      showToast(
        currentlyLocked
          ? t('Đã mở khóa model {{model}}. Model đã có thể nhận request.', { model })
          : t('Đã khóa model {{model}}. Backend sẽ bỏ qua model này khi điều phối.', { model }),
        'success'
      );
    } catch (lockError) {
      console.error('Không thể thao tác khóa/mở khóa model:', lockError);
      showToast(
        lockError.response?.data?.message || t('Không thể thay đổi trạng thái khóa của model. Vui lòng thử lại.'),
        'error'
      );
    } finally {
      setLockingModel(null);
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
          <h2>{t('Lượt gọi Gemini từ backend')}</h2>
          <p>{t('Theo dõi từng lần backend thử gọi Gemini, gồm thành công, lỗi và đang xử lý. Đây không phải số usage do Google AI Studio báo cáo.')}</p>
        </div>
        <div className="ai-rate-header__actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>
      </header>

      <section className="ai-rate-sync-status" aria-labelledby="ai-rate-sync-title" aria-live="polite">
        <div className="ai-rate-sync-status__summary">
          <span className={`ai-rate-sync-status__icon${refreshing || isStreamConnecting ? ' is-refreshing' : ''}`}>
            {refreshing || isStreamConnecting
              ? <Spinner aria-hidden="true" />
              : <FiActivity aria-hidden="true" />}
          </span>
          <div>
            <strong id="ai-rate-sync-title">
              {refreshing
                ? t('Đang đồng bộ telemetry từ backend...')
                : streamState === 'live'
                  ? t('Telemetry backend đang cập nhật theo sự kiện')
                  : streamState === 'paused'
                    ? t('Telemetry tạm dừng khi tab bị ẩn')
                    : streamState === 'fallback'
                      ? t('SSE gián đoạn — đang dùng polling dự phòng')
                      : streamState === 'delayed'
                        ? t('Luồng telemetry đang phục hồi')
                        : t('Đang kết nối telemetry backend...')}
            </strong>
            <p>{t('SSE cập nhật ngay sau mỗi lượt backend gọi AI · polling 15 giây chỉ dùng dự phòng · kết quả được tách thành công, lỗi và đang xử lý.')}</p>
          </div>
        </div>

        <div className="ai-rate-sync-status__freshness">
          <span className={`is-${streamState}`}><i aria-hidden="true" />{
            streamState === 'live'
              ? t('SSE từ backend')
              : streamState === 'fallback'
                ? t('Polling từ backend')
                : t('Telemetry backend')
          }</span>
          <small>
            <FiClock aria-hidden="true" />
            {latestTelemetryAt
              ? t('Cập nhật cuối: {{time}}', { time: dateTimeFormatter.format(latestTelemetryAt) })
              : t('Chưa có thời điểm cập nhật')}
          </small>
        </div>

        <div className="ai-rate-sync-status__provider">
          <div>
            <span>{t('Usage chính thức của Google')}</span>
            <strong>{t('Chỉ đối chiếu thủ công')}</strong>
          </div>
          <p>{t('GEMINI_API_KEY không đọc được bộ đếm trên AI Studio. Ngưỡng lưu trong hệ thống chỉ dùng để tham chiếu, không phải quota còn lại.')}</p>
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
              <p>{t('Backend chỉ bỏ qua model khi Gemini API trả tín hiệu quota hoặc model đang cooldown; số lượt gọi nội bộ không tự khóa model.')}</p>
            </div>
            <div className="ai-model-routing__heading-actions">
              {canManageCaps && (
                <div className="ai-model-routing__selector">
                  <label htmlFor="ai-preferred-model-select">
                    {t('Model ưu tiên:')}
                  </label>
                  <select
                    id="ai-preferred-model-select"
                    value={routing.preferredModel || ''}
                    onChange={(e) => handleSelectPreferredModel(e.target.value)}
                    disabled={Boolean(settingPreferredModel || lockingModel)}
                    aria-label={t('Chọn model ưu tiên điều phối')}
                  >
                    {(routing.fallbackOrder || []).map((m) => {
                      const isLocked = Boolean(routing.lockedModels?.includes(m));
                      const mCooldown = routing.coolingDown?.find((item) => item.model === m);
                      const isRpdExhausted = mCooldown?.dimension === 'rpd';
                      return (
                        <option key={m} value={m} disabled={isLocked}>
                          {m} {m === routing.preferredModel ? t('(Đang ưu tiên)') : ''} {isLocked ? t('(Admin đã khóa)') : isRpdExhausted ? t('(Google API đang cooldown)') : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              <span className={`ai-model-routing__state${preferredModelCoolingDown ? ' is-cooling' : ' is-ready'}`}>
                <i aria-hidden="true" />
                {preferredModelRpdExhausted
                  ? t('Đang dùng model dự phòng')
                  : preferredModelCoolingDown
                    ? t('Model chính đang chờ')
                    : routing.isCustomPreferred
                      ? t('Admin ưu tiên: {{model}}', { model: routing.preferredModel })
                      : t('Đang ưu tiên model cao nhất')}
              </span>
            </div>
          </div>

          <div className="ai-model-routing__body">
            <div className="ai-model-routing__lane" aria-label={t('Thứ tự fallback')}>
              {(routing.fallbackOrder || []).map((model, index) => {
                const cooldown = routing.coolingDown?.find((item) => item.model === model);
                const isRpdExhausted = cooldown?.dimension === 'rpd';
                const isLocked = Boolean(routing.lockedModels?.includes(model));
                const isEffective = model === routing.effectiveModel;
                const isPreferred = model === routing.preferredModel;
                const isClickable = canManageCaps && !isPreferred && !settingPreferredModel && !lockingModel && !isLocked;

                return (
                  <React.Fragment key={model}>
                    {index > 0 && <span className="ai-model-routing__arrow" aria-hidden="true">→</span>}
                    <div
                      className={`ai-model-routing__model${cooldown ? ' is-cooling' : ''}${isLocked ? ' is-manually-locked' : ''}${isRpdExhausted ? ' is-rpd-locked' : ''}${isEffective ? ' is-effective' : ''}${isPreferred ? ' is-preferred' : ''}${isClickable ? ' is-clickable' : ''}`}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={isClickable ? () => handleSelectPreferredModel(model) : undefined}
                      onKeyDown={isClickable ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectPreferredModel(model);
                        }
                      } : undefined}
                      title={isLocked
                        ? t('Model đang bị Admin khóa thủ công. Bấm [Mở khóa] để cho phép điều phối lại.', { model })
                        : isRpdExhausted
                          ? t('Gemini API đã trả lỗi quota RPD cho {{model}}. Backend tạm dừng model đến {{time}} để tránh gửi lặp request lỗi.', {
                              model,
                              time: dateTimeFormatter.format(new Date(cooldown.retryAt))
                            })
                          : isClickable
                            ? t('Nhấp để chọn {{model}} làm model ưu tiên điều phối', { model })
                            : undefined}
                    >
                      <div className="ai-model-routing__model-header">
                        <span>{index === 0 ? t('Ưu tiên') : t('Dự phòng {{number}}', { number: index })}</span>
                        {isPreferred && (
                          <span className="ai-model-routing__badge">
                            <FiCheck aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '2px' }} />
                            {t('Đang chọn')}
                          </span>
                        )}
                        {isLocked ? (
                          <span className="ai-model-routing__admin-lock-badge" title={t('Admin đã chủ động khóa model này')}>
                            <FiLock aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '3px' }} />
                            {t('Admin đã khóa')}
                          </span>
                        ) : isRpdExhausted && !isPreferred ? (
                          <span className="ai-model-routing__lock-badge" title={t('Gemini API đang từ chối request do quota')}>
                            {t('Provider cooldown')}
                          </span>
                        ) : null}
                      </div>
                      <code>{model}</code>
                      <small>
                        {isLocked
                          ? t('Admin đã khóa · không điều phối')
                          : cooldown
                            ? cooldown.dimension === 'rpd'
                              ? t('Google API từ chối · thử lại {{time}}', {
                                  time: dateTimeFormatter.format(new Date(cooldown.retryAt))
                                })
                              : t('Thử lại {{time}}', {
                                  time: dateTimeFormatter.format(new Date(cooldown.retryAt))
                                })
                            : isEffective ? t('Request kế tiếp') : t('Sẵn sàng')}
                      </small>
                      {canManageCaps && (
                        <div className="ai-model-routing__model-actions">
                          {!isPreferred && (
                            <span className="ai-model-routing__action-hint">
                              {isLocked
                                ? t('Đã khóa')
                                : isRpdExhausted
                                  ? t('Provider cooldown')
                                  : settingPreferredModel === model
                                    ? t('Đang chuyển...')
                                    : t('Bấm để ưu tiên')}
                            </span>
                          )}
                          <button
                            type="button"
                            className={`ai-model-routing__lock-btn${isLocked ? ' is-unlock' : ''}`}
                            onClick={(e) => handleToggleLock(model, isLocked, e)}
                            disabled={lockingModel === model}
                            title={isLocked ? t('Mở khóa model {{model}}', { model }) : t('Khóa model {{model}}', { model })}
                            aria-label={isLocked ? t('Mở khóa model {{model}}', { model }) : t('Khóa model {{model}}', { model })}
                          >
                            {lockingModel === model ? (
                              <Spinner aria-hidden="true" style={{ width: '12px', height: '12px', display: 'inline-block' }} />
                            ) : isLocked ? (
                              <FiUnlock aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '3px' }} />
                            ) : (
                              <FiLock aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '3px' }} />
                            )}
                            {lockingModel === model
                              ? isLocked ? t('Đang mở...') : t('Đang khóa...')
                              : isLocked ? t('Mở khóa') : t('Khóa model')}
                          </button>
                        </div>
                      )}
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
              {t('Routing không suy ra quota Google từ số lượt gọi nội bộ. Mọi phản hồi 429 đều dùng cooldown ngắn hoặc RetryInfo; chỉ payload ghi rõ quota ngày mới được phân loại là RPD. Model khác tiếp tục phục vụ theo thứ tự fallback.')}
            </p>
            {canManageCaps && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetRouting}
                disabled={resettingRouting || (!preferredModelCoolingDown && !anyModelCoolingDown)}
                aria-busy={resettingRouting}
              >
                {resettingRouting
                  ? <Spinner data-icon="inline-start" aria-hidden="true" />
                  : <FiArrowUpCircle data-icon="inline-start" aria-hidden="true" />}
                {resettingRouting
                  ? t('Đang khôi phục')
                  : preferredModelCoolingDown
                    ? t('Khôi phục model ưu tiên')
                    : anyModelCoolingDown
                      ? t('Khôi phục trạng thái tất cả model')
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
            <strong>{t('Tín hiệu quota từ Google không khớp với số lượt backend đã ghi nhận.')}</strong>
            <ul>
              {status.notices.map((notice) => (
                <li key={`${notice.model}-${notice.dimension}`}>
                  <code>{notice.model}</code> · {notice.dimension.toUpperCase()} · {t('ngưỡng tham chiếu')} {numberFormatter.format(notice.configuredCap)}
                  {notice.providerLimit
                    ? ` · ${t('Google báo giới hạn')} ${numberFormatter.format(notice.providerLimit)} · ${t('backend đã thử {{count}} lượt', { count: numberFormatter.format(notice.observedUsage) })}`
                    : ` · ${t('backend đã thử {{count}} lượt', { count: numberFormatter.format(notice.observedUsage) })}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(status?.models || []).length === 0 ? (
        <div className="ai-rate-empty">
          <FiActivity aria-hidden="true" />
          <h3>{t('Backend chưa gọi model Gemini nào trong 24 giờ qua')}</h3>
          <p>{t('Model sẽ xuất hiện sau lần backend thử gọi đầu tiên. Bạn vẫn có thể lưu ngưỡng tham chiếu ở phần cấu hình bên dưới.')}</p>
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
                    {item.configured ? t('Đã lưu ngưỡng tham chiếu') : t('Chưa có ngưỡng tham chiếu')}
                  </span>
                </div>
                <span className={`ai-model-live is-${streamState}`}><i /> {streamState === 'live' ? 'BACKEND LIVE' : 'BACKEND'}</span>
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
                        <span>{cap ? `/ ${t('ngưỡng')} ${numberFormatter.format(cap)}` : t('Chưa có ngưỡng')}</span>
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
                  : t('Chưa lưu ngưỡng tham chiếu')}
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
