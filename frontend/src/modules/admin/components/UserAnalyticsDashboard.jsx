import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  RiUserFollowLine,
  RiUserAddLine,
  RiCheckboxCircleLine,
  RiTimeLine,
  RiAwardLine,
  RiSparklingLine,
  RiSearchLine,
  RiRefreshLine,
  RiDownload2Line,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiAlertLine,
  RiInformationLine,
  RiBookOpenLine,
  RiFlashlightLine,
  RiArrowRightLine,
  RiShieldUserLine,
  RiChat3Line,
  RiCheckLine,
  RiCloseLine
} from '@remixicon/react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';

import apiClient from '../../../config/api.config';
import { useToast } from '../../../context/ToastContext';
import { getAdminAnalytics } from '../services/adminAnalytics.service';

import { Button } from '@/components/base/buttons/button';
import { Select, SelectItem } from '@/components/base/select/select';
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control';
import { Chip } from '@/components/base/badges/chip';
import { StatusDot } from '@/components/base/badges/status-dot';
import { Badge } from '@/components/base/badges/badge';
import { Avatar } from '@/components/base/avatar/avatar';
import { Pagination } from '@/components/base/pagination/pagination';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { Divider } from '@/components/base/divider/divider';
import { cx } from '@/utils/cx';

import '../styles/user-analytics.scss';

const RANGE_OPTIONS = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
  { value: 365, label: '1 năm' }
];

const STATUS_META = {
  online: { label: 'Đang online', shortLabel: 'Online', chipColor: 'lime', dotColor: 'green' },
  active: { label: 'Hoạt động hôm nay', shortLabel: 'Hôm nay', chipColor: 'lime', dotColor: 'green' },
  recent: { label: 'Vắng 1-7 ngày', shortLabel: '1-7 ngày', chipColor: 'gray', dotColor: 'indigo' },
  attention: { label: 'Cần chú ý', shortLabel: 'Cần chú ý', chipColor: 'yellow', dotColor: 'yellow' },
  inactive: { label: 'Không hoạt động', shortLabel: 'Không hoạt động', chipColor: 'rose', dotColor: 'indigo' }
};

const STATUS_FILTER_ITEMS = [
  { id: 'all', label: 'Tất cả trạng thái' },
  { id: 'online', label: '🟢 Đang online (Realtime)' },
  { id: 'active', label: 'Hoạt động hôm nay' },
  { id: 'recent', label: 'Vắng mặt 1-7 ngày' },
  { id: 'attention', label: 'Cần chú ý (8-30 ngày)' },
  { id: 'inactive', label: 'Không hoạt động (>30 ngày)' }
];

const numberFormatter = new Intl.NumberFormat('vi-VN');
const compactFormatter = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1
});
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' });
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const toNumber = (value) => Number(value || 0);

const formatStudyTime = (minutes) => {
  const value = toNumber(minutes);
  if (value < 60) return `${numberFormatter.format(value)} phút`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${numberFormatter.format(hours)}h ${rest}p` : `${numberFormatter.format(hours)} giờ`;
};

const formatRelativeActivity = (learner) => {
  if (!learner.last_activity_at) return 'Chưa có hoạt động';
  const now = Date.now();
  const date = new Date(learner.last_activity_at);
  const diffMs = Math.max(0, now - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const days = Math.floor(diffHours / 24);

  if (diffMinutes <= 1) return 'Vừa mới đây';
  if (diffMinutes <= 15) return `${diffMinutes} phút trước`;
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24 && date.getDate() === new Date(now).getDate()) {
    return `Hôm nay ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (days === 1 || (diffHours < 48 && date.getDate() === new Date(now - 86400000).getDate())) {
    return `Hôm qua ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (days < 30) return `${days} ngày trước`;
  return dateFormatter.format(date);
};

const getInitials = (learner) => {
  const source = learner.full_name || learner.username || 'HV';
  return source
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

/**
 * Custom Recharts Tooltip matching BoardUI popover style
 */
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border-button-default bg-background-primary-default p-3 shadow-dropdown">
        <p className="mb-2 text-caption-1-semibold text-text-secondary">Ngày {label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry, index) => (
            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4 text-caption-1-medium">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <strong className="text-text-primary tabular-nums">
                {numberFormatter.format(entry.value)}
              </strong>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

/**
 * Loading Skeleton matching BoardUI surfaces
 */
const DashboardSkeleton = () => (
  <section className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải User Analytics">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-background-secondary-hover" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-background-secondary-hover" />
      </div>
      <div className="h-9 w-64 animate-pulse rounded-2lg bg-background-secondary-hover" />
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-background-secondary-default p-4" />
      ))}
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.85fr)]">
      <div className="h-[320px] animate-pulse rounded-2xl bg-background-secondary-default" />
      <div className="h-[320px] animate-pulse rounded-2xl bg-background-secondary-default" />
    </div>

    <div className="h-[420px] animate-pulse rounded-2xl bg-background-secondary-default" />
  </section>
);

const UserAnalyticsDashboard = ({
  dataSource = getAdminAnalytics,
  initialData = null,
  canResetToken = true,
  title = 'User Analytics & System Health',
  subtitle = null
}) => {
  const showToast = useToast();
  const [range, setRange] = useState(30);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [page, setPage] = useState(1);
  const [resettingUserId, setResettingUserId] = useState(null);

  const loadAnalytics = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const dashboard = await dataSource(range);
      setData(dashboard);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải dữ liệu Analytics. Hãy kiểm tra kết nối và thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dataSource, range]);

  useEffect(() => {
    if (initialData) return;
    loadAnalytics();
  }, [initialData, loadAnalytics]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const overview = data?.overview || {};
  const learners = data?.learners || [];
  const engagement = data?.engagement || { active: 0, attention: 0, inactive: 0 };
  const learnerCount = toNumber(overview.total_learners);
  const totalLearners = Math.max(1, learnerCount);
  const activeRate = learnerCount
    ? Math.round((toNumber(overview.active_learners) / totalLearners) * 100)
    : 0;

  const chartData = useMemo(() => (data?.trend || []).map((item) => ({
    ...item,
    label: dateFormatter.format(new Date(item.day)),
    active_learners: toNumber(item.active_learners),
    completed_lessons: toNumber(item.completed_lessons),
    study_minutes: toNumber(item.study_minutes)
  })), [data?.trend]);

  const filteredLearners = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return learners.filter((learner) => {
      let matchesStatus = true;
      if (statusFilter === 'online') {
        matchesStatus = Boolean(learner.is_online || learner.engagement_status === 'online');
      } else if (statusFilter === 'active') {
        matchesStatus = learner.engagement_status === 'online' || learner.engagement_status === 'active';
      } else if (statusFilter !== 'all') {
        matchesStatus = learner.engagement_status === statusFilter;
      }
      const haystack = `${learner.full_name || ''} ${learner.username || ''} ${learner.email || ''}`.toLocaleLowerCase('vi');
      return matchesStatus && (!keyword || haystack.includes(keyword));
    });
  }, [learners, search, statusFilter]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredLearners.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleLearners = filteredLearners.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasChartData = chartData.some((item) => item.active_learners || item.completed_lessons);
  const activeCourses = (data?.courses || []).filter((course) => toNumber(course.learners) > 0);

  // Thao tác reset token AI trực tiếp từ bảng
  const handleQuickResetToken = async (learner) => {
    const name = learner.full_name || learner.username;
    if (!window.confirm(`Bạn có chắc muốn Reset Token AI cho học viên "${name}" về 0?`)) {
      return;
    }

    setResettingUserId(learner.user_id);
    try {
      const res = await apiClient.post(`/admin/users/${learner.user_id}/reset-token`);
      if (res.data?.success) {
        showToast?.(`Đã reset token AI cho ${name} thành công!`, 'success');
        await loadAnalytics({ silent: true });
      }
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Có lỗi khi reset token', 'error');
    } finally {
      setResettingUserId(null);
    }
  };

  // Xuất file CSV báo cáo Analytics
  const handleExportCSV = () => {
    if (!learners.length) return;
    const headers = ['User ID', 'Họ tên', 'Username', 'Email', 'Trạng thái', 'Tiến độ (%)', 'Bài hoàn thành', 'Thời gian học (phút)', 'Điểm Quiz TB', 'Token AI dùng', 'Hoạt động cuối'];
    const rows = learners.map((l) => [
      l.user_id,
      `"${l.full_name || ''}"`,
      `"${l.username || ''}"`,
      `"${l.email || ''}"`,
      STATUS_META[l.engagement_status]?.label || l.engagement_status,
      l.progress_percent,
      l.completed_lessons,
      l.study_minutes,
      l.average_quiz_score,
      l.used_tokens,
      l.last_activity_at ? dateTimeFormatter.format(new Date(l.last_activity_at)) : 'Chưa có'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `elearn_user_analytics_${range}d_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <DashboardSkeleton />;

  if (error && !data) {
    return (
      <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border-button-default bg-background-secondary-default p-8 text-center">
        <RiAlertLine className="size-10 text-status-rose-text" />
        <h3 className="mt-3 text-headline-semibold text-text-primary">Chưa thể tải dữ liệu User Analytics</h3>
        <p className="mt-1 max-w-md text-body-regular text-text-secondary">{error}</p>
        <div className="mt-4">
          <Button variant="primary" size="medium" onClick={() => loadAnalytics()}>
            Thử tải lại
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="user-analytics-main-title">
      {/* 1. Header Toolbar */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <RiShieldUserLine className="size-5" />
            </span>
            <h2 id="user-analytics-main-title" className="text-title-1-semibold text-text-primary">
              {title}
            </h2>
          </div>
          <p className="mt-1 text-body-regular text-text-secondary">
            {subtitle 
              ? `${subtitle} (Thống kê ${range} ngày qua)`
              : `Hoạt động, tiến độ học tập và mức độ tương tác học viên trên toàn hệ thống trong ${range} ngày gần nhất.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Control cho khoảng thời gian */}
          <SegmentedControl
            selectedKeys={[String(range)]}
            onSelectionChange={(keys) => {
              let keyVal = null;
              if (keys instanceof Set) {
                keyVal = Array.from(keys)[0];
              } else if (Array.isArray(keys)) {
                keyVal = keys[0];
              } else if (typeof keys === 'string' || typeof keys === 'number') {
                keyVal = keys;
              }
              const parsed = Number(keyVal);
              if (!Number.isNaN(parsed) && parsed > 0) {
                setRange(parsed);
              }
            }}
            variant="solid"
            aria-label="Chọn khoảng thời gian phân tích"
          >
            {RANGE_OPTIONS.map((opt) => (
              <SegmentedControlItem key={opt.value} id={String(opt.value)}>
                {opt.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>

          {/* Nút Làm mới */}
          <Button
            variant="secondary"
            size="small"
            leadingIcon={RiRefreshLine}
            disabled={refreshing}
            onClick={() => loadAnalytics({ silent: true })}
            aria-label="Làm mới dữ liệu Analytics"
          >
            {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
          </Button>

          {/* Nút Xuất CSV */}
          <Button
            variant="secondary"
            size="small"
            leadingIcon={RiDownload2Line}
            onClick={handleExportCSV}
            aria-label="Xuất báo cáo CSV"
          >
            Xuất CSV
          </Button>
        </div>
      </header>

      {/* 2. BoardUI KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: Học viên hoạt động */}
        <section className="flex flex-col justify-between rounded-2xl border border-separator-border bg-background-secondary-default p-4 shadow-card transition-all duration-200 hover:border-border-button-hover">
          <div className="flex items-center justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500 text-white shadow-xs">
              <RiUserFollowLine className="size-5" />
            </span>
            <Chip variant="bold" color="lime">
              {activeRate}% hoạt động
            </Chip>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <span className="text-caption-1-medium text-text-secondary">Học viên hoạt động</span>
            <span className="text-title-1-bold text-text-primary tabular-nums">
              {numberFormatter.format(toNumber(overview.active_learners))}
            </span>
            <small className="text-caption-2-regular text-text-tertiary">
              trên {numberFormatter.format(learnerCount)} học viên
            </small>
          </div>
        </section>

        {/* Card 2: Đăng ký mới */}
        <section className="flex flex-col justify-between rounded-2xl border border-separator-border bg-background-secondary-default p-4 shadow-card transition-all duration-200 hover:border-border-button-hover">
          <div className="flex items-center justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-purple-500 text-white shadow-xs">
              <RiUserAddLine className="size-5" />
            </span>
            <Chip variant="bold" color="purple">
              +{numberFormatter.format(toNumber(overview.new_learners))}
            </Chip>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <span className="text-caption-1-medium text-text-secondary">Đăng ký mới</span>
            <span className="text-title-1-bold text-text-primary tabular-nums">
              {numberFormatter.format(toNumber(overview.new_learners))}
            </span>
            <small className="text-caption-2-regular text-text-tertiary">trong {range} ngày qua</small>
          </div>
        </section>

        {/* Card 3: Bài học hoàn thành */}
        <section className="flex flex-col justify-between rounded-2xl border border-separator-border bg-background-secondary-default p-4 shadow-card transition-all duration-200 hover:border-border-button-hover">
          <div className="flex items-center justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
              <RiCheckboxCircleLine className="size-5" />
            </span>
            <Chip variant="bold" color="lime">
              Tiến độ
            </Chip>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <span className="text-caption-1-medium text-text-secondary">Bài hoàn thành</span>
            <span className="text-title-1-bold text-text-primary tabular-nums">
              {numberFormatter.format(toNumber(overview.lessons_completed))}
            </span>
            <small className="text-caption-2-regular text-text-tertiary">
              trên {numberFormatter.format(toNumber(overview.total_lessons))} tổng bài
            </small>
          </div>
        </section>

        {/* Card 4: Thời gian học */}
        <section className="flex flex-col justify-between rounded-2xl border border-separator-border bg-background-secondary-default p-4 shadow-card transition-all duration-200 hover:border-border-button-hover">
          <div className="flex items-center justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs">
              <RiTimeLine className="size-5" />
            </span>
            <Chip variant="bold" color="yellow">
              Tích lũy
            </Chip>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <span className="text-caption-1-medium text-text-secondary">Thời gian học</span>
            <span className="text-title-1-bold text-text-primary tabular-nums">
              {formatStudyTime(overview.study_minutes)}
            </span>
            <small className="text-caption-2-regular text-text-tertiary">ghi nhận thực tế</small>
          </div>
        </section>

        {/* Card 5: Điểm Quiz TB */}
        <section className="flex flex-col justify-between rounded-2xl border border-separator-border bg-background-secondary-default p-4 shadow-card transition-all duration-200 hover:border-border-button-hover">
          <div className="flex items-center justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-pink-500 text-white shadow-xs">
              <RiAwardLine className="size-5" />
            </span>
            <Chip variant="bold" color="blue">
              {numberFormatter.format(toNumber(overview.quiz_attempts))} lượt
            </Chip>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <span className="text-caption-1-medium text-text-secondary">Điểm Quiz TB</span>
            <span className="text-title-1-bold text-text-primary tabular-nums">
              {toNumber(overview.average_quiz_score)}%
            </span>
            <small className="text-caption-2-regular text-text-tertiary">độ chính xác chung</small>
          </div>
        </section>

        {/* Card 6: AI Chat & Token */}
        <section className="flex flex-col justify-between rounded-2xl border border-separator-border bg-background-secondary-default p-4 shadow-card transition-all duration-200 hover:border-border-button-hover">
          <div className="flex items-center justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow-xs">
              <RiSparklingLine className="size-5" />
            </span>
            <Chip variant="bold" color="cyan">
              {compactFormatter.format(toNumber(overview.ai_tokens_used))} Tok
            </Chip>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <span className="text-caption-1-medium text-text-secondary">Gia sư AI</span>
            <span className="text-title-1-bold text-text-primary tabular-nums">
              {numberFormatter.format(toNumber(overview.ai_messages))}
            </span>
            <small className="text-caption-2-regular text-text-tertiary">lượt trao đổi</small>
          </div>
        </section>
      </div>

      {/* 3. Grid: Trend Visualizer & Engagement Alert Rail */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.85fr)]">
        {/* Trend Chart Card */}
        <section className="flex flex-col rounded-2xl border border-separator-border bg-background-secondary-default p-5 shadow-card" aria-labelledby="trend-chart-title">
          <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="trend-chart-title" className="text-headline-semibold text-text-primary">
                Nhịp học tập hệ thống theo ngày
              </h3>
              <p className="text-caption-1-regular text-text-secondary">
                So sánh số lượng học viên hoạt động và số bài hoàn thành mỗi ngày.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
                <span className="size-2 rounded-full bg-blue-500" /> Học viên
              </span>
              <span className="flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
                <span className="size-2 rounded-full bg-emerald-500" /> Bài hoàn thành
              </span>
            </div>
          </header>

          <div className="mt-5 h-[260px] w-full">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-separator-border)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<CustomChartTooltip />} />
                  <Bar
                    yAxisId="right"
                    dataKey="completed_lessons"
                    name="Bài hoàn thành"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={16}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="active_learners"
                    name="Học viên hoạt động"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#3b82f6' }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <RiBookOpenLine className="size-8 text-text-tertiary" />
                <p className="mt-2 text-caption-1-medium text-text-secondary">Chưa có dữ liệu hoạt động trong khoảng này</p>
              </div>
            )}
          </div>
        </section>

        {/* Attention & Engagement Rail */}
        <section className="flex flex-col justify-between rounded-2xl border border-separator-border bg-background-secondary-default p-5 shadow-card" aria-labelledby="attention-rail-title">
          <div>
            <header className="flex items-center justify-between">
              <div>
                <h3 id="attention-rail-title" className="text-headline-semibold text-text-primary">
                  Phân bổ tương tác
                </h3>
                <p className="text-caption-1-regular text-text-secondary">Theo mốc hoạt động gần nhất.</p>
              </div>
              <TooltipTrigger delay={150}>
                <button
                  type="button"
                  aria-label="Thông tin phân bổ tương tác"
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <RiInformationLine className="size-4" />
                </button>
                <Tooltip size="md">
                  Active: &lt;8 ngày · Attention: 8-30 ngày · Inactive: &gt;30 ngày
                </Tooltip>
              </TooltipTrigger>
            </header>

            {/* Alert banner for attention learners */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-800 dark:text-yellow-300">
              <RiAlertLine className="mt-0.5 size-4 shrink-0" />
              <div className="text-caption-1-medium">
                <strong>{numberFormatter.format(toNumber(engagement.attention))} học viên cần chú ý</strong>
                <p className="text-caption-2-regular opacity-90">Không có hoạt động học tập từ 8 đến 30 ngày qua.</p>
              </div>
            </div>

            {/* Multi-segment Distribution Bar */}
            <div
              className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-background-tertiary-default p-0.5"
              role="img"
              aria-label={`Phân bổ học viên: ${engagement.active} hoạt động, ${engagement.attention} chú ý, ${engagement.inactive} không hoạt động`}
            >
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${(toNumber(engagement.active) / totalLearners) * 100}%` }}
                title={`Đang hoạt động: ${engagement.active}`}
              />
              <div
                className="h-full rounded-full bg-yellow-500 transition-all duration-300"
                style={{ width: `${(toNumber(engagement.attention) / totalLearners) * 100}%` }}
                title={`Cần chú ý: ${engagement.attention}`}
              />
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-300"
                style={{ width: `${(toNumber(engagement.inactive) / totalLearners) * 100}%` }}
                title={`Không hoạt động: ${engagement.inactive}`}
              />
            </div>

            {/* Interactive Status Rows */}
            <div className="mt-4 flex flex-col gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const count = toNumber(engagement[key]);
                const percent = Math.round((count / totalLearners) * 100);
                const isCurrentFilter = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(isCurrentFilter ? 'all' : key)}
                    className={cx(
                      'flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors duration-150',
                      isCurrentFilter
                        ? 'bg-background-primary-default border border-border-button-default shadow-xs'
                        : 'hover:bg-background-secondary-hover'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot color={meta.dotColor} />
                      <span className="text-body-2-medium text-text-primary">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-body-2-medium text-text-primary tabular-nums">
                        {numberFormatter.format(count)}
                      </strong>
                      <span className="w-9 text-right text-caption-2-regular text-text-tertiary tabular-nums">
                        {percent}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-separator-border pt-3">
            <div className="flex items-center justify-between text-caption-1-medium text-text-secondary">
              <span>Khóa học mở: <strong className="text-text-primary">{toNumber(overview.published_courses)}</strong></span>
              <span>Tổng bài học: <strong className="text-text-primary">{toNumber(overview.total_lessons)}</strong></span>
            </div>
          </div>
        </section>
      </div>

      {/* 4. Core BoardUI Data Table: Tiến trình Học viên */}
      <section className="flex flex-col rounded-2xl border border-separator-border bg-background-secondary-default shadow-card" aria-labelledby="learner-table-title">
        {/* Table Header & Controls */}
        <header className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-separator-border">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="learner-table-title" className="text-headline-semibold text-text-primary">
                Bảng tiến trình học viên
              </h3>
              <Chip variant="bold" color="neutral">
                {numberFormatter.format(filteredLearners.length)} học viên
              </Chip>
            </div>
            <p className="mt-0.5 text-caption-1-regular text-text-secondary">
              Danh sách chi tiết tiến độ, thời lượng học, điểm số và hạn mức sử dụng AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-initial">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, username, email..."
                className="w-full rounded-2lg border border-border-button-default bg-background-primary-default py-1.5 pl-9 pr-3 text-body-medium text-text-primary shadow-xs outline-none transition-all placeholder:text-text-placeholder focus:border-border-focus-ring focus:ring-2 focus:ring-border-focus-ring"
              />
            </div>

            {/* Status Select */}
            <div className="w-44">
              <Select
                selectedKey={statusFilter}
                onSelectionChange={(key) => setStatusFilter(String(key))}
                size="sm"
                aria-label="Lọc theo trạng thái học viên"
              >
                {STATUS_FILTER_ITEMS.map((item) => (
                  <SelectItem key={item.id} id={item.id} textValue={item.label}>
                    {item.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </header>

        {/* Table Body (Desktop View) */}
        <div className="hidden lg:block overflow-x-auto">
          {visibleLearners.length ? (
            <table className="bui-table w-full">
              <thead>
                <tr>
                  <th className="w-[28%] pl-5">Học viên</th>
                  <th className="w-[18%]">Tiến độ khóa học</th>
                  <th className="w-[14%]">Thời gian học</th>
                  <th className="w-[12%]">Điểm Quiz TB</th>
                  <th className="w-[14%]">Hoạt động gần nhất</th>
                  <th className="w-[14%] pr-5">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {visibleLearners.map((learner) => {
                  const expanded = expandedUserId === learner.user_id;
                  const progress = toNumber(learner.progress_percent);
                  const statusInfo = STATUS_META[learner.engagement_status] || STATUS_META.inactive;

                  return (
                    <Fragment key={learner.user_id}>
                      <tr
                        className={cx(
                          'cursor-pointer transition-colors hover:bg-background-secondary-hover',
                          expanded && 'bg-background-primary-default'
                        )}
                        onClick={() => setExpandedUserId(expanded ? null : learner.user_id)}
                      >
                        <td className="pl-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              size="md"
                              src={learner.profile_picture_url}
                              initials={getInitials(learner)}
                              alt={learner.full_name || learner.username}
                            />
                            <div className="min-w-0 flex-1">
                              <strong className="block truncate text-body-medium text-text-primary">
                                {learner.full_name || learner.username}
                              </strong>
                              <small className="block truncate text-caption-1-regular text-text-secondary">
                                {learner.email}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="text-text-tertiary hover:text-text-primary p-1"
                              aria-label={expanded ? 'Thu gọn chi tiết' : 'Mở rộng chi tiết'}
                            >
                              {expanded ? <RiArrowUpSLine className="size-4" /> : <RiArrowDownSLine className="size-4" />}
                            </button>
                          </div>
                        </td>

                        <td className="py-3">
                          <div className="flex flex-col gap-1.5 pr-4">
                            <div className="flex items-center justify-between text-caption-1-medium">
                              <strong className="text-text-primary tabular-nums">{progress}%</strong>
                              <span className="text-text-secondary">
                                {toNumber(learner.completed_lessons)}/{toNumber(learner.available_lessons)} bài
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-background-tertiary-default">
                              <div
                                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${Math.min(100, progress)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 text-body-medium text-text-primary tabular-nums">
                          {formatStudyTime(learner.study_minutes)}
                        </td>

                        <td className="py-3">
                          {toNumber(learner.quiz_attempts) > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Chip variant="bold" color={toNumber(learner.average_quiz_score) >= 80 ? 'lime' : 'yellow'}>
                                {toNumber(learner.average_quiz_score)}%
                              </Chip>
                              <span className="text-caption-2-regular text-text-tertiary">
                                ({toNumber(learner.quiz_attempts)} lần)
                              </span>
                            </div>
                          ) : (
                            <span className="text-caption-1-regular text-text-tertiary">Chưa làm</span>
                          )}
                        </td>

                        <td className="py-3">
                          <TooltipTrigger delay={100}>
                            <span className="text-body-2-medium text-text-secondary">
                              {formatRelativeActivity(learner)}
                            </span>
                            <Tooltip size="md">
                              {learner.last_activity_at
                                ? dateTimeFormatter.format(new Date(learner.last_activity_at))
                                : 'Chưa ghi nhận hoạt động'}
                            </Tooltip>
                          </TooltipTrigger>
                        </td>

                        <td className="pr-5 py-3">
                          <div className="flex items-center gap-1.5">
                            {learner.is_online ? (
                              <span className="relative flex size-2 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                              </span>
                            ) : (
                              <StatusDot color={statusInfo.dotColor} />
                            )}
                            <Chip variant="bold" color={learner.is_online ? 'lime' : statusInfo.chipColor}>
                              {learner.is_online ? 'Online' : statusInfo.shortLabel}
                            </Chip>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Accordion Sub-row */}
                      {expanded && (
                        <tr className="bg-background-primary-default">
                          <td colSpan={6} className="px-5 py-4 border-b border-separator-border">
                            <div className="flex flex-col gap-4 rounded-xl border border-border-button-default bg-background-secondary-default p-4">
                              <div className="flex items-center justify-between">
                                <span className="text-caption-1-semibold text-text-secondary">
                                  CHI TIẾT TIẾN TRÌNH VÀ TƯƠNG TÁC AI CỦA HỌC VIÊN
                                </span>
                                {canResetToken && (
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    leadingIcon={RiFlashlightLine}
                                    disabled={resettingUserId === learner.user_id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickResetToken(learner);
                                    }}
                                    aria-label={`Reset token AI cho ${learner.full_name || learner.username}`}
                                  >
                                    {resettingUserId === learner.user_id ? 'Đang reset...' : 'Reset Token AI'}
                                  </Button>
                                )}
                              </div>

                              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 text-caption-1-medium">
                                <div className="flex flex-col gap-1 rounded-lg bg-background-primary-default p-2.5 border border-border-button-default">
                                  <dt className="text-text-secondary">Hoàn thành kỳ này</dt>
                                  <dd className="text-title-3-bold text-text-primary tabular-nums">
                                    {toNumber(learner.period_completions)} bài
                                  </dd>
                                </div>
                                <div className="flex flex-col gap-1 rounded-lg bg-background-primary-default p-2.5 border border-border-button-default">
                                  <dt className="text-text-secondary">Lượt làm Quiz</dt>
                                  <dd className="text-title-3-bold text-text-primary tabular-nums">
                                    {toNumber(learner.quiz_attempts)} lượt
                                  </dd>
                                </div>
                                <div className="flex flex-col gap-1 rounded-lg bg-background-primary-default p-2.5 border border-border-button-default">
                                  <dt className="text-text-secondary">Trao đổi Gia sư AI</dt>
                                  <dd className="text-title-3-bold text-text-primary tabular-nums">
                                    {toNumber(learner.ai_messages)} tin
                                  </dd>
                                </div>
                                <div className="flex flex-col gap-1 rounded-lg bg-background-primary-default p-2.5 border border-border-button-default">
                                  <dt className="text-text-secondary">Token AI đã dùng</dt>
                                  <dd className="text-title-3-bold text-text-primary tabular-nums">
                                    {numberFormatter.format(toNumber(learner.used_tokens))}
                                  </dd>
                                </div>
                                <div className="flex flex-col gap-1 rounded-lg bg-background-primary-default p-2.5 border border-border-button-default">
                                  <dt className="text-text-secondary">Ngày tham gia</dt>
                                  <dd className="text-body-medium text-text-primary">
                                    {dateFormatter.format(new Date(learner.created_date))}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
              <RiSearchLine className="size-8 text-text-tertiary" />
              <p className="mt-2 text-headline-medium text-text-primary">Không tìm thấy học viên phù hợp</p>
              <small className="text-caption-1-regular text-text-secondary">Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</small>
            </div>
          )}
        </div>

        {/* Mobile View: Cards fallback for small screens */}
        <div className="flex flex-col lg:hidden divide-y divide-separator-border">
          {visibleLearners.length ? (
            visibleLearners.map((learner) => {
              const expanded = expandedUserId === learner.user_id;
              const progress = toNumber(learner.progress_percent);
              const statusInfo = STATUS_META[learner.engagement_status] || STATUS_META.inactive;

              return (
                <article key={learner.user_id} className="flex flex-col gap-3 p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedUserId(expanded ? null : learner.user_id)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="md"
                        src={learner.profile_picture_url}
                        initials={getInitials(learner)}
                        alt={learner.full_name || learner.username}
                      />
                      <div>
                        <strong className="block text-body-medium text-text-primary">
                          {learner.full_name || learner.username}
                        </strong>
                        <small className="block text-caption-1-regular text-text-secondary">
                          {learner.email}
                        </small>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {learner.is_online ? (
                        <span className="relative flex size-2 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                      ) : (
                        <StatusDot color={statusInfo.dotColor} />
                      )}
                      <Chip variant="bold" color={learner.is_online ? 'lime' : statusInfo.chipColor}>
                        {learner.is_online ? 'Online' : statusInfo.shortLabel}
                      </Chip>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-caption-1-medium text-text-secondary">
                    <span>Tiến độ: <strong className="text-text-primary">{progress}%</strong></span>
                    <span>Học: <strong className="text-text-primary">{formatStudyTime(learner.study_minutes)}</strong></span>
                    <span>Quiz TB: <strong className="text-text-primary">{toNumber(learner.quiz_attempts) ? `${toNumber(learner.average_quiz_score)}%` : '-'}</strong></span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-background-tertiary-default">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>

                  {expanded && (
                    <div className="mt-2 rounded-xl bg-background-primary-default p-3 border border-border-button-default flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2 text-caption-1-medium">
                        <div><span className="text-text-secondary">Bài hoàn thành:</span> <strong>{toNumber(learner.completed_lessons)}</strong></div>
                        <div><span className="text-text-secondary">Lượt quiz:</span> <strong>{toNumber(learner.quiz_attempts)}</strong></div>
                        <div><span className="text-text-secondary">Chat AI:</span> <strong>{toNumber(learner.ai_messages)}</strong></div>
                        <div><span className="text-text-secondary">Token đã dùng:</span> <strong>{numberFormatter.format(toNumber(learner.used_tokens))}</strong></div>
                      </div>
                      {canResetToken && (
                        <div className="pt-2 border-t border-separator-border flex justify-end">
                          <Button
                            variant="secondary"
                            size="xs"
                            leadingIcon={RiFlashlightLine}
                            disabled={resettingUserId === learner.user_id}
                            onClick={() => handleQuickResetToken(learner)}
                          >
                            Reset Token AI
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="p-8 text-center text-caption-1-medium text-text-secondary">
              Không tìm thấy học viên phù hợp.
            </div>
          )}
        </div>

        {/* Table Pagination */}
        {pageCount > 1 && (
          <footer className="flex items-center justify-between p-4 border-t border-separator-border">
            <span className="text-caption-1-regular text-text-secondary">
              Trang {safePage} / {pageCount} ({numberFormatter.format(filteredLearners.length)} học viên)
            </span>
            <div className="max-w-xs">
              <Pagination page={safePage} totalPages={pageCount} onChange={setPage} />
            </div>
          </footer>
        )}
      </section>

      {/* 5. Course Health Matrix */}
      <section className="flex flex-col rounded-2xl border border-separator-border bg-background-secondary-default p-5 shadow-card" aria-labelledby="course-progress-title">
        <header className="flex items-center justify-between border-b border-separator-border pb-3">
          <div>
            <h3 id="course-progress-title" className="text-headline-semibold text-text-primary">
              Tiến độ theo khóa học trực tuyến
            </h3>
            <p className="text-caption-1-regular text-text-secondary">
              Thống kê tỷ lệ hoàn thành trung bình và số lượng học viên theo từng khóa học.
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:flex">
            {activeCourses.length} khóa đang hoạt động
          </Badge>
        </header>

        <div className="mt-4 flex flex-col divide-y divide-separator-border">
          {activeCourses.length ? (
            activeCourses.map((course) => {
              const avgProgress = toNumber(course.average_progress);
              return (
                <div key={course.course_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-body-medium text-text-primary">
                      {course.course_name}
                    </strong>
                    <span className="text-caption-2-regular text-text-secondary">
                      {toNumber(course.learners)} học viên đăng ký · {toNumber(course.completed_learners)} đã hoàn thành
                    </span>
                  </div>
                  <div className="flex items-center gap-3 sm:w-64">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${Math.min(100, avgProgress)}%` }}
                      />
                    </div>
                    <strong className="w-10 text-right text-caption-1-semibold text-text-primary tabular-nums">
                      {avgProgress}%
                    </strong>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-6 text-center text-caption-1-medium text-text-secondary">
              Chưa có dữ liệu tiến trình khóa học nào.
            </p>
          )}
        </div>
      </section>

      {/* 6. Footer Audit & Timestamp */}
      <footer className="flex items-center justify-between px-1 text-caption-2-regular text-text-tertiary">
        <span>
          Dữ liệu đồng bộ lúc: {data?.generatedAt ? dateTimeFormatter.format(new Date(data.generatedAt)) : '-'}.
        </span>
        <span>Phát triển theo Design System BoardUI tiêu chuẩn</span>
      </footer>
    </section>
  );
};

export default UserAnalyticsDashboard;
