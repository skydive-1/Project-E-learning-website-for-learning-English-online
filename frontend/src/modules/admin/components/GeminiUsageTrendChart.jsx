import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  AlertCircle,
  BarChart3,
  ChevronUp,
  Cloud,
  Database,
  RefreshCw
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const SOURCE_OPTIONS = [
  ['backend', 'Backend (0₫)'],
  ['auto', 'Tự động'],
  ['google', 'Google Cloud (cần Billing)']
];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a78bfa', '#06b6d4', '#f43f5e'];

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
  const [source, setSource] = useState('backend');
  const [model, setModel] = useState('all');
  const [data, setData] = useState(() => initialDashboardFallback(initialTrends));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const compactFormatter = useMemo(() => new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  }), [locale]);
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

  const selectedMetricLabel = METRIC_OPTIONS.find(([value]) => value === metric)?.[1] || 'Token';
  const sourceLabel = data?.sourceUsed === 'google' ? 'Google Cloud Monitoring' : 'Backend telemetry';
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

  return (
    <section className="ai-chart-panel mb-5" aria-labelledby="gemini-usage-trend-title">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BarChart3 className="size-4 text-blue-500" aria-hidden="true" />
              <h3 id="gemini-usage-trend-title" className="text-sm font-semibold text-slate-100">
                {t('Xu hướng sử dụng Gemini')}
              </h3>
              <Badge variant="outline" className={data?.sourceUsed === 'google'
                ? 'border-emerald-500/40 text-emerald-400'
                : 'border-blue-500/40 text-blue-400'}>
                {data?.sourceUsed === 'google'
                  ? <Cloud data-icon="inline-start" />
                  : <Database data-icon="inline-start" />}
                {sourceLabel}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {data?.sourceUsed === 'google'
                ? t('Dữ liệu gần thời gian thực từ Google, có thể trễ tối đa khoảng 150 giây.')
                : t('Dữ liệu do backend ghi nhận ngay khi ứng dụng gọi Gemini.')}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              aria-label={refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}
              onClick={() => fetchTrend({ silent: true, fresh: true })}
              className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
            >
              {refreshing ? <Spinner /> : <RefreshCw aria-hidden="true" />}
              {refreshing ? t('Đang cập nhật') : t('Cập nhật ngay')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-expanded={!collapsed}
              aria-controls="gemini-usage-trend-content"
              aria-label={collapsed ? t('Mở rộng biểu đồ') : t('Thu gọn')}
              onClick={() => setCollapsed((value) => !value)}
              className="text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <ChevronUp className={collapsed ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </Button>
          </div>
        </div>

        {!collapsed && (
          <div id="gemini-usage-trend-content" className="space-y-3">
            <div className="flex flex-wrap items-end gap-2" aria-label={t('Bộ lọc biểu đồ Gemini')}>
              <TrendSelect label={t('Khoảng thời gian')} value={range} onValueChange={setRange} options={RANGE_OPTIONS} t={t} />
              <TrendSelect label={t('Chỉ số')} value={metric} onValueChange={setMetric} options={METRIC_OPTIONS} t={t} />
              <TrendSelect label={t('Nguồn dữ liệu')} value={source} onValueChange={setSource} options={SOURCE_OPTIONS} t={t} />
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
              <div className="ml-auto min-w-[170px] text-right text-[11px] leading-5 text-slate-500" aria-live="polite">
                <div>{t('Mẫu mới nhất')}: <span className="text-slate-300">{sampledLabel}</span></div>
                <div>{t('Tự làm mới mỗi 60 giây')}</div>
              </div>
            </div>

            {fallbackText && (
              <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-200">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>{t('Đang dùng dữ liệu dự phòng từ backend')}</AlertTitle>
                <AlertDescription className="text-amber-100/75">
                  {t(fallbackText)} {t('Biểu đồ vẫn tiếp tục hoạt động bằng telemetry nội bộ.')}
                </AlertDescription>
              </Alert>
            )}

            {metric === 'tokens' && (
              <p className="text-[11px] leading-5 text-slate-500">
                {data?.sourceUsed === 'google'
                  ? t('Google cộng token đầu vào, đầu ra của Generate Content và token Embedding thuộc free tier.')
                  : t('Backend cộng tổng token thực tế được SDK Gemini trả về cho từng request thành công.')}
              </p>
            )}

            <div className="relative min-h-[250px]" aria-busy={loading}>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-950/55 backdrop-blur-[1px]">
                  <Spinner className="size-5 text-blue-400" />
                  <span className="sr-only">{t('Đang tải dữ liệu biểu đồ')}</span>
                </div>
              )}

              {chartData.length > 0 && models.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[250px] w-full aspect-auto" initialDimension={{ width: 960, height: 250 }}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis
                      dataKey="timestamp"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.16)' }}
                      minTickGap={24}
                      tickFormatter={(value) => dateTimeFormatter.format(new Date(value))}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={54}
                      tickFormatter={(value) => compactFormatter.format(value)}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      content={(
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(_value, payload) => payload?.[0]?.payload?.timestamp
                            ? dateTimeFormatter.format(new Date(payload[0].payload.timestamp))
                            : ''}
                          formatter={(value, name) => (
                            <div className="flex w-full min-w-44 items-center justify-between gap-4">
                              <span className="text-slate-400">{chartConfig[name]?.label || name}</span>
                              <span className="font-mono font-semibold tabular-nums text-slate-100">{formatValue(value)}</span>
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
                        radius={index === models.length - 1 ? [3, 3, 0, 0] : 0}
                        maxBarSize={42}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              ) : !loading && (
                <Empty className="min-h-[250px] border border-slate-800 bg-slate-950/20">
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

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-500">
              <span>{t('Đang hiển thị')}: {t(selectedMetricLabel)} · {t(RANGE_OPTIONS.find(([value]) => value === range)?.[1] || range)}</span>
              <span>{t('Nguồn hiện tại')}: {sourceLabel}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const TrendSelect = ({ label, value, onValueChange, options, t }) => (
  <label className="grid min-w-[138px] gap-1 text-[11px] font-medium text-slate-400">
    <span>{label}</span>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="w-full border-slate-700 bg-slate-950/40 text-slate-200" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="border-slate-700 bg-slate-900 text-slate-100">
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
