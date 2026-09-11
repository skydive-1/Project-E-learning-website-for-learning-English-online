import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  AlertCircle,
  BarChart3,
  ChevronUp,
  Clock,
  Cloud,
  Database,
  RefreshCw
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
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

const CHART_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#22d3ee', '#fb7185'];

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

  const summaryItems = [
    [t('Tổng trong kỳ'), formatValue(usageSummary.total)],
    [t('Đỉnh mỗi mốc'), formatValue(usageSummary.peak)],
    [t('Model hoạt động'), numberFormatter.format(usageSummary.models)],
    [t('Mốc có dữ liệu'), numberFormatter.format(usageSummary.activeBuckets)]
  ];
  const summaryBorders = [
    '',
    'border-t border-border/70 sm:border-t-0 sm:border-l',
    'border-t border-border/70 xl:border-t-0 xl:border-l',
    'border-t border-border/70 sm:border-l xl:border-t-0'
  ];

  return (
    <Card className="ai-usage-card mb-6 overflow-hidden bg-card/80 [--card-spacing:1.25rem]" aria-labelledby="gemini-usage-trend-title">
      <CardHeader className="border-b border-border/70">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" aria-hidden="true" />
            </span>
            <CardTitle id="gemini-usage-trend-title" className="text-base">
              {t('Xu hướng sử dụng Gemini')}
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              {data?.sourceUsed === 'google'
                ? <Cloud data-icon="inline-start" />
                : <Database data-icon="inline-start" />}
              {sourceLabel}
            </Badge>
            {isStale && (
              <Badge
                variant="outline"
                title={t('Dữ liệu từ Google Cloud Monitoring có thể bị trễ >5 phút theo độ trễ tự nhiên của Google')}
                className="font-normal text-muted-foreground"
              >
                <Clock className="size-3" aria-hidden="true" />
                {t('Dữ liệu cũ (>5p)')}
              </Badge>
            )}
          </div>
          <CardDescription className="mt-2 max-w-3xl">
            {t('Telemetry nội bộ ghi nhận mức sử dụng ngay khi backend gọi Gemini; không phát sinh API giám sát trả phí.')}
          </CardDescription>
        </div>

        <CardAction className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing}
            aria-label={refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}
            onClick={() => fetchTrend({ silent: true, fresh: true })}
          >
            {refreshing ? <Spinner /> : <RefreshCw aria-hidden="true" />}
            <span className="hidden sm:inline">{refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={!collapsed}
            aria-controls="gemini-usage-trend-content"
            aria-label={collapsed ? t('Mở rộng biểu đồ') : t('Thu gọn')}
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronUp className={`transition-transform motion-reduce:transition-none ${collapsed ? 'rotate-180' : ''}`} />
          </Button>
        </CardAction>
      </CardHeader>

      {!collapsed && (
        <>
          <CardContent id="gemini-usage-trend-content" className="flex flex-col gap-5">
            <dl className="grid overflow-hidden rounded-xl border border-border/70 bg-muted/25 sm:grid-cols-2 xl:grid-cols-4">
              {summaryItems.map(([label, value], index) => (
                <div
                  key={label}
                  className={`min-w-0 px-4 py-3 ${summaryBorders[index]}`}
                >
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-1 truncate font-mono text-base font-semibold tabular-nums text-foreground" title={value}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-2 sm:grid-cols-3" aria-label={t('Bộ lọc biểu đồ Gemini')}>
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
              <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
                <Database className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <div className="font-medium text-foreground">{t('Telemetry nội bộ · 0₫')}</div>
                  <div>{t('Mẫu mới nhất')}: {sampledLabel} · {t('Tự làm mới mỗi 60 giây')}</div>
                </div>
              </div>
            </div>

            {fallbackText && (
              <Alert>
                <AlertCircle aria-hidden="true" />
                <AlertTitle>{t('Đang dùng dữ liệu dự phòng từ backend')}</AlertTitle>
                <AlertDescription>
                  {t(fallbackText)} {t('Biểu đồ vẫn tiếp tục hoạt động bằng telemetry nội bộ.')}
                </AlertDescription>
              </Alert>
            )}

            {metric === 'tokens' && (
              <p className="text-xs leading-5 text-muted-foreground">
                {t('Backend cộng tổng token thực tế được SDK Gemini trả về cho từng request thành công.')}
              </p>
            )}

            <div className="relative min-h-[320px]" aria-busy={loading}>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/65 backdrop-blur-[1px]">
                  <Spinner className="size-5 text-primary" />
                  <span className="sr-only">{t('Đang tải dữ liệu biểu đồ')}</span>
                </div>
              )}

              {chartData.length > 0 && models.length > 0 ? (
                <div className="-mx-2 overflow-x-auto px-2 pb-1" tabIndex={0} aria-label={t('Biểu đồ có thể cuộn ngang trên màn hình nhỏ')}>
                  <ChartContainer config={chartConfig} className="h-[320px] min-w-[680px] w-full aspect-auto" initialDimension={{ width: 960, height: 320 }}>
                    <BarChart accessibilityLayer data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="timestamp"
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                        minTickGap={28}
                        tickFormatter={(value) => dateTimeFormatter.format(new Date(value))}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tickFormatter={formatAxisValue}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
                        content={(
                          <ChartTooltipContent
                            indicator="dot"
                            labelFormatter={(_value, payload) => payload?.[0]?.payload?.timestamp
                              ? dateTimeFormatter.format(new Date(payload[0].payload.timestamp))
                              : ''}
                            formatter={(value, name) => (
                              <div className="flex w-full min-w-48 items-center justify-between gap-4">
                                <span className="text-muted-foreground">{chartConfig[name]?.label || name}</span>
                                <span className="font-mono font-semibold tabular-nums text-foreground">{formatValue(value)}</span>
                              </div>
                            )}
                          />
                        )}
                      />
                      <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
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
                <Empty className="min-h-[320px] border border-border/70 bg-muted/15">
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
          </CardContent>

          <CardFooter className="flex flex-wrap justify-between gap-2 border-t border-border/70 text-xs text-muted-foreground">
            <span>{t('Đang hiển thị')}: {t(selectedMetricLabel)} · {t(RANGE_OPTIONS.find(([value]) => value === range)?.[1] || range)}</span>
            <span>{t('Nguồn hiện tại')}: {sourceLabel}</span>
          </CardFooter>
        </>
      )}
    </Card>
  );
};

const TrendSelect = ({ label, value, onValueChange, options, t }) => (
  <label className="grid min-w-[148px] gap-1.5 text-xs font-medium text-muted-foreground">
    <span>{label}</span>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="w-full bg-background/60 sm:w-[168px]" aria-label={label}>
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
