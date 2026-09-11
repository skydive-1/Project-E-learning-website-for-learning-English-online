import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  AlertCircle,
  BarChart3,
  ChevronUp,
  Clock,
  Cloud,
  Cpu,
  Database,
  Layers,
  RefreshCw,
  TrendingUp,
  Zap
} from 'lucide-react';

import { Chip } from '@/components/base/badges/chip';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useLanguage } from '../../../context/LanguageContext';
import { getGeminiUsageTrends } from '../services/adminAnalytics.service';

const RANGE_OPTIONS = [
  ['1h', '1 giờ'], ['6h', '6 giờ'], ['12h', '12 giờ'],
  ['1d', '1 ngày'], ['2d', '2 ngày'], ['4d', '4 ngày'],
  ['7d', '7 ngày'], ['14d', '14 ngày'], ['30d', '30 ngày']
];

const METRIC_OPTIONS = [
  ['tokens', 'Token'],
  ['requests', 'Request'],
  ['quota_errors', 'Lượt vượt quota']
];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

const fallbackReasonLabels = {
  GOOGLE_MONITORING_NOT_CONFIGURED: 'Chưa cấu hình service account Google Cloud Monitoring.',
  GOOGLE_MONITORING_INVALID_CREDENTIALS: 'Service account Google Cloud Monitoring không hợp lệ.',
  GOOGLE_MONITORING_PROJECT_MISMATCH: 'Project ID không khớp với service account.',
  GOOGLE_MONITORING_AUTH_ERROR: 'Google từ chối thông tin xác thực của service account.',
  GOOGLE_MONITORING_PERMISSION_DENIED: 'Service account chưa có quyền Monitoring Viewer.',
  GOOGLE_MONITORING_BILLING_REQUIRED: 'Google yêu cầu bật Billing để đọc dữ liệu Cloud Monitoring của project này.',
  GOOGLE_MONITORING_RATE_LIMITED: 'Cloud Monitoring đang giới hạn tần suất truy vấn.',
  GOOGLE_MONITORING_UNAVAILABLE: 'Cloud Monitoring tạm thời không khả dụng.'
};

const initialDashboardFallback = (trends = []) => ({
  range: '30d',
  metric: 'tokens',
  unit: 'tokens',
  model: 'all',
  bucketSeconds: 86400,
  sourceRequested: 'backend',
  sourceUsed: 'backend',
  providerStatus: 'fallback',
  fallbackReason: 'LEGACY_DASHBOARD_FALLBACK',
  generatedAt: new Date().toISOString(),
  sampledAt: null,
  availableModels: ['Gemini Flash', 'gemini-embedding-001', 'Speaking STT'],
  expectedDelaySeconds: 0,
  series: trends.flatMap((row) => [
    { timestamp: row.day, model: 'Gemini Flash', value: Number(row.gemini_flash_tokens || 0) },
    { timestamp: row.day, model: 'gemini-embedding-001', value: Number(row.gemini_embedding_tokens || 0) },
    { timestamp: row.day, model: 'Speaking STT', value: Number(row.speaking_stt_tokens || 0) }
  ])
});

const GeminiUsageTrendChart = ({ initialTrends = [] }) => {
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const requestSequence = useRef(0);
  const [range, setRange] = useState('30d');
  const [metric, setMetric] = useState('tokens');
  const source = 'backend';
  const [model, setModel] = useState('all');
  const [data, setData] = useState(() => initialDashboardFallback(initialTrends));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }), [locale]);

  const fetchTrend = useCallback(async ({ silent = false, fresh = false } = {}) => {
    const sequence = ++requestSequence.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const nextData = await getGeminiUsageTrends({ range, metric, source, model, fresh });
      if (sequence !== requestSequence.current) return;
      setData(nextData);
    } catch (requestError) {
      if (sequence !== requestSequence.current) return;
      console.error('Không thể tải xu hướng sử dụng Gemini:', requestError);
      setError('Không thể tải dữ liệu biểu đồ lúc này.');
      if (metric !== 'tokens' || range !== '30d') setData(null);
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [metric, model, range, source]);

  useEffect(() => {
    fetchTrend();
    const poller = window.setInterval(() => fetchTrend({ silent: true }), 60_000);
    return () => window.clearInterval(poller);
  }, [fetchTrend]);

  useEffect(() => {
    if (model !== 'all' && data?.availableModels && !data.availableModels.includes(model)) {
      setModel('all');
    }
  }, [data?.availableModels, model]);

  const models = useMemo(() => {
    if (!data) return [];
    if (model !== 'all') return [model];
    return data.availableModels || [];
  }, [data, model]);

  const chartConfig = useMemo(() => Object.fromEntries(models.map((item, index) => [
    `series_${index}`,
    { label: item, color: CHART_COLORS[index % CHART_COLORS.length] }
  ])), [models]);

  const chartData = useMemo(() => {
    if (!data?.series?.length || !models.length) return [];
    const bucketMs = Number(data.bucketSeconds || 3600) * 1000;
    const start = new Date(data.startTime || data.series[0].timestamp).getTime();
    const end = new Date(data.endTime || data.series[data.series.length - 1].timestamp).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || bucketMs <= 0) return [];

    const firstBucket = Math.floor(start / bucketMs) * bucketMs;
    const rows = new Map();
    for (let timestamp = firstBucket; timestamp <= end && rows.size < 400; timestamp += bucketMs) {
      rows.set(new Date(timestamp).toISOString(), {
        timestamp: new Date(timestamp).toISOString()
      });
    }

    for (const point of data.series) {
      const rawTimestamp = new Date(point.timestamp).getTime();
      const modelIndex = models.indexOf(point.model);
      if (!Number.isFinite(rawTimestamp) || modelIndex < 0) continue;
      const timestamp = new Date(Math.floor(rawTimestamp / bucketMs) * bucketMs).toISOString();
      const row = rows.get(timestamp) || { timestamp };
      const key = `series_${modelIndex}`;
      row[key] = Number(row[key] || 0) + Number(point.value || 0);
      rows.set(timestamp, row);
    }

    return [...rows.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [data, models]);

  const usageSummary = useMemo(() => {
    const keys = models.map((_item, index) => `series_${index}`);
    const totals = chartData.map((row) => keys.reduce(
      (sum, key) => sum + Number(row[key] || 0),
      0
    ));
    return {
      total: totals.reduce((sum, value) => sum + value, 0),
      peak: Math.max(0, ...totals),
      activeBuckets: totals.filter((value) => value > 0).length,
      models: models.length
    };
  }, [chartData, models]);

  const selectedMetricLabel = METRIC_OPTIONS.find(([value]) => value === metric)?.[1] || 'Token';
  const sourceLabel = data?.sourceUsed === 'google' ? 'Google Cloud Monitoring' : 'Backend telemetry';
  const isStale = Boolean(data?.stale || data?.providerStatus === 'stale');
  const sampledLabel = data?.sampledAt
    ? dateTimeFormatter.format(new Date(data.sampledAt))
    : t('Chưa có thời điểm cập nhật');
  const fallbackText = data?.fallbackReason && data.fallbackReason !== 'LEGACY_DASHBOARD_FALLBACK'
    ? (fallbackReasonLabels[data.fallbackReason] || fallbackReasonLabels.GOOGLE_MONITORING_UNAVAILABLE)
    : null;

  const formatValue = (value) => {
    const suffix = metric === 'tokens'
      ? 'token'
      : metric === 'requests'
        ? 'request'
        : t('lượt vượt quota');
    return `${numberFormatter.format(Number(value || 0))} ${suffix}`;
  };

  const formatAxisValue = (value) => {
    const numericValue = Number(value || 0);
    const absoluteValue = Math.abs(numericValue);
    if (absoluteValue >= 1_000_000) return `${(numericValue / 1_000_000).toFixed(absoluteValue >= 10_000_000 ? 0 : 1)}M`;
    if (absoluteValue >= 1_000) return `${(numericValue / 1_000).toFixed(absoluteValue >= 10_000 ? 0 : 1)}K`;
    return numberFormatter.format(numericValue);
  };

  const summaryCards = [
    {
      label: t('Tổng trong kỳ'),
      value: formatValue(usageSummary.total),
      icon: Zap,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      label: t('Đỉnh mỗi mốc'),
      value: formatValue(usageSummary.peak),
      icon: TrendingUp,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20'
    },
    {
      label: t('Model hoạt động'),
      value: numberFormatter.format(usageSummary.models),
      icon: Cpu,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-500/10 border-indigo-500/20'
    },
    {
      label: t('Mốc có dữ liệu'),
      value: numberFormatter.format(usageSummary.activeBuckets),
      icon: Layers,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10 border-purple-500/20'
    }
  ];

  return (
    <section
      className="ai-usage-card mb-6 overflow-hidden rounded-2xl border border-separator-border bg-background-secondary-default shadow-card transition-all duration-200"
      aria-labelledby="gemini-usage-trend-title"
    >
      {/* 1. Header (BoardUI Standard) */}
      <header className="flex flex-col gap-4 border-b border-separator-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500 shadow-2xs dark:border-blue-400/30 dark:bg-blue-400/15 dark:text-blue-400"
              aria-hidden="true"
            >
              <BarChart3 className="size-5" />
            </div>
            <h3 id="gemini-usage-trend-title" className="text-title-3-bold text-text-primary tracking-tight">
              {t('Xu hướng sử dụng Gemini')}
            </h3>
            <Chip
              variant="bold"
              color={data?.sourceUsed === 'google' ? 'cyan' : 'purple'}
              className="gap-1.5 px-3 py-1 text-caption-1-semibold shadow-2xs"
            >
              {data?.sourceUsed === 'google' ? (
                <Cloud className="size-3.5" data-icon="inline-start" />
              ) : (
                <Database className="size-3.5" data-icon="inline-start" />
              )}
              <span>{sourceLabel}</span>
            </Chip>
            {isStale && (
              <Chip
                variant="caption"
                color="neutral"
                title={t('Dữ liệu từ Google Cloud Monitoring có thể bị trễ >5 phút theo độ trễ tự nhiên của Google')}
                className="gap-1 text-text-tertiary"
              >
                <Clock className="size-3" aria-hidden="true" />
                <span>{t('Dữ liệu cũ (>5p)')}</span>
              </Chip>
            )}
          </div>
          <p className="mt-1 max-w-3xl text-caption-1-regular text-text-secondary leading-relaxed">
            {t('Telemetry nội bộ ghi nhận mức sử dụng ngay khi backend gọi Gemini; không phát sinh API giám sát trả phí.')}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-button-default bg-background-primary-default px-3 py-1.5 text-caption-1-semibold text-text-primary shadow-2xs transition-all duration-150 hover:border-border-button-hover hover:bg-background-primary-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            disabled={refreshing}
            aria-label={refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}
            onClick={() => fetchTrend({ silent: true, fresh: true })}
          >
            {refreshing ? <Spinner /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
            <span className="hidden sm:inline">{refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}</span>
          </button>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border-button-default bg-background-primary-default text-text-secondary shadow-2xs transition-all duration-150 hover:border-border-button-hover hover:bg-background-primary-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            aria-expanded={!collapsed}
            aria-controls="gemini-usage-trend-content"
            aria-label={collapsed ? t('Mở rộng biểu đồ') : t('Thu gọn')}
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronUp className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {!collapsed && (
        <>
          {/* 2. Content Body */}
          <div id="gemini-usage-trend-content" className="flex flex-col gap-5 p-5 sm:p-6">
            {/* 2.1 BoardUI KPI Summary Stat Cards */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={card.label}
                    className="flex flex-col justify-between rounded-xl border border-separator-border bg-background-primary-default p-4 shadow-2xs transition-all duration-200 hover:border-border-button-hover"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption-1-medium text-text-secondary">{card.label}</span>
                      <span className={`flex size-7 items-center justify-center rounded-lg border ${card.iconBg} ${card.iconColor} shadow-2xs`}>
                        <IconComponent className="size-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-1">
                      <span className="text-title-2-bold font-mono tabular-nums text-text-primary truncate" title={card.value}>
                        {card.value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2.2 Filter Controls & Live Telemetry Box */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-2.5 sm:grid-cols-3" aria-label={t('Bộ lọc biểu đồ Gemini')}>
                <TrendSelect label={t('Khoảng thời gian')} value={range} onValueChange={setRange} options={RANGE_OPTIONS} t={t} />
                <TrendSelect label={t('Chỉ số')} value={metric} onValueChange={setMetric} options={METRIC_OPTIONS} t={t} />
                <TrendSelect
                  label={t('Model')}
                  value={model}
                  onValueChange={setModel}
                  options={[
                    ['all', 'Tất cả model'],
                    ...(data?.availableModels || []).map((item) => [item, item])
                  ]}
                  t={t}
                />
              </div>

              {/* Zero-Cost Telemetry Live Indicator */}
              <div
                className="flex items-center gap-3 rounded-xl border border-separator-border bg-background-primary-default px-3.5 py-2.5 shadow-2xs"
                aria-live="polite"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                  <Database className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-caption-1-semibold text-text-primary">{t('Telemetry nội bộ · 0₫')}</span>
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-caption-2-regular text-text-tertiary truncate">
                    {t('Mẫu mới nhất')}: {sampledLabel} · {t('Tự làm mới mỗi 60 giây')}
                  </p>
                </div>
              </div>
            </div>

            {/* Fallback Notice Callout */}
            {fallbackText && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-caption-1-medium text-amber-200 shadow-2xs" role="alert">
                <AlertCircle className="size-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="font-semibold text-amber-300">{t('Đang dùng dữ liệu dự phòng từ backend')}</div>
                  <p className="mt-0.5 text-caption-2-regular text-amber-200/90 leading-relaxed">
                    {t(fallbackText)} {t('Biểu đồ vẫn tiếp tục hoạt động bằng telemetry nội bộ.')}
                  </p>
                </div>
              </div>
            )}

            {metric === 'tokens' && (
              <p className="text-caption-2-regular text-text-tertiary flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-blue-400" aria-hidden="true" />
                {t('Backend cộng tổng token thực tế được SDK Gemini trả về cho từng request thành công.')}
              </p>
            )}

            {/* 2.3 Chart Surface */}
            <div className="relative min-h-[320px] rounded-xl border border-separator-border bg-background-primary-default p-4 shadow-2xs" aria-busy={loading}>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background-primary-default/70 backdrop-blur-[1px]">
                  <Spinner className="size-6 text-primary" />
                  <span className="sr-only">{t('Đang tải dữ liệu biểu đồ')}</span>
                </div>
              )}

              {chartData.length > 0 && models.length > 0 ? (
                <div className="-mx-2 overflow-x-auto px-2 pb-1" tabIndex={0} aria-label={t('Biểu đồ có thể cuộn ngang trên màn hình nhỏ')}>
                  <ChartContainer config={chartConfig} className="h-[320px] min-w-[680px] w-full aspect-auto" initialDimension={{ width: 960, height: 320 }}>
                    <BarChart accessibilityLayer data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--color-separator-border, rgba(255,255,255,0.08))" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickLine={false}
                        axisLine={{ stroke: 'var(--color-separator-border, rgba(255,255,255,0.12))' }}
                        minTickGap={28}
                        tick={{ fill: 'var(--color-text-tertiary, #94a3b8)', fontSize: 11 }}
                        tickFormatter={(value) => dateTimeFormatter.format(new Date(value))}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tick={{ fill: 'var(--color-text-tertiary, #94a3b8)', fontSize: 11 }}
                        tickFormatter={formatAxisValue}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'var(--color-background-secondary-default, rgba(255,255,255,0.05))', opacity: 0.5 }}
                        content={(
                          <ChartTooltipContent
                            indicator="dot"
                            labelFormatter={(_value, payload) => payload?.[0]?.payload?.timestamp
                              ? dateTimeFormatter.format(new Date(payload[0].payload.timestamp))
                              : ''}
                            formatter={(value, name) => (
                              <div className="flex w-full min-w-48 items-center justify-between gap-4">
                                <span className="text-text-secondary text-xs">{chartConfig[name]?.label || name}</span>
                                <span className="font-mono font-semibold tabular-nums text-text-primary text-xs">{formatValue(value)}</span>
                              </div>
                            )}
                          />
                        )}
                      />
                      <ChartLegend content={<ChartLegendContent className="flex-wrap pt-3 text-xs" />} />
                      {models.map((item, index) => (
                        <Bar
                          key={item}
                          dataKey={`series_${index}`}
                          stackId="usage"
                          fill={`var(--color-series_${index})`}
                          radius={index === models.length - 1 ? [4, 4, 0, 0] : 0}
                          maxBarSize={38}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>
              ) : !loading && (
                <Empty className="min-h-[320px] border border-separator-border bg-background-secondary-default/40">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><BarChart3 /></EmptyMedia>
                    <EmptyTitle>{error ? t('Không thể tải biểu đồ') : t('Chưa có dữ liệu trong khoảng đã chọn')}</EmptyTitle>
                    <EmptyDescription>
                      {error
                        ? t(error)
                        : t('Hãy chọn khoảng thời gian khác hoặc phát sinh một request Gemini mới.')}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>

          {/* 3. Footer */}
          <footer className="flex flex-col gap-2 border-t border-separator-border bg-background-primary-default/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 text-caption-1-regular text-text-secondary">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-500" aria-hidden="true" />
              <span>
                {t('Đang hiển thị')}: <strong className="font-semibold text-text-primary">{t(selectedMetricLabel)}</strong> · {t(RANGE_OPTIONS.find(([value]) => value === range)?.[1] || range)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-caption-2-regular text-text-tertiary">
              <span>{t('Nguồn hiện tại')}: {sourceLabel}</span>
            </div>
          </footer>
        </>
      )}
    </section>
  );
};

const TrendSelect = ({ label, value, onValueChange, options, t }) => (
  <label className="grid min-w-[148px] gap-1.5 text-caption-1-medium text-text-secondary">
    <span>{label}</span>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        className="w-full rounded-lg border border-border-button-default bg-background-primary-default text-caption-1-medium text-text-primary shadow-2xs transition-all hover:border-border-button-hover sm:w-[168px]"
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>{t(optionLabel)}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  </label>
);

export default GeminiUsageTrendChart;

