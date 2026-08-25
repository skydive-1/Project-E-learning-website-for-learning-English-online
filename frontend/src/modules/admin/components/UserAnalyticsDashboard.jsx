import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  RefreshCw,
  Search,
  UsersRound
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis
} from 'recharts';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { getAdminAnalytics } from '../services/adminAnalytics.service';
import '../styles/user-analytics.scss';

const RANGE_OPTIONS = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
  { value: 365, label: '1 năm' }
];

const STATUS_META = {
  active: { label: 'Đang hoạt động', shortLabel: 'Hoạt động' },
  attention: { label: 'Cần chú ý', shortLabel: 'Cần chú ý' },
  inactive: { label: 'Không hoạt động', shortLabel: 'Không hoạt động' }
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))
];

const CHART_CONFIG = {
  active_learners: {
    label: 'Học viên hoạt động',
    color: 'var(--chart-1)'
  },
  completed_lessons: {
    label: 'Bài hoàn thành',
    color: 'var(--chart-2)'
  }
};

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
  return rest ? `${numberFormatter.format(hours)}g ${rest}p` : `${numberFormatter.format(hours)} giờ`;
};

const formatRelativeActivity = (learner) => {
  if (!learner.last_activity_at) return 'Chưa có hoạt động';
  const days = toNumber(learner.inactive_days);
  if (days <= 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  if (days < 30) return `${days} ngày trước`;
  return dateFormatter.format(new Date(learner.last_activity_at));
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

const StatusBadge = ({ status }) => {
  const safeStatus = STATUS_META[status] ? status : 'inactive';
  return (
    <Badge variant="outline" className={cn('aua-status-badge', `is-${safeStatus}`)}>
      <span className="aua-status-dot" aria-hidden="true" />
      {STATUS_META[safeStatus].shortLabel}
    </Badge>
  );
};

const LearnerIdentity = ({ learner, expanded, onToggle }) => (
  <Button
    type="button"
    variant="ghost"
    className="aua-learner-trigger h-auto w-full justify-start gap-3 p-0 text-left hover:bg-transparent"
    onClick={onToggle}
    aria-expanded={expanded}
  >
    <Avatar size="lg">
      {learner.profile_picture_url && (
        <AvatarImage src={learner.profile_picture_url} alt="" />
      )}
      <AvatarFallback>{getInitials(learner)}</AvatarFallback>
    </Avatar>
    <span className="min-w-0 flex-1">
      <strong className="block truncate font-medium text-foreground">
        {learner.full_name || learner.username}
      </strong>
      <small className="block truncate text-xs text-muted-foreground">{learner.email}</small>
    </span>
    {expanded ? (
      <ChevronUp aria-hidden="true" />
    ) : (
      <ChevronDown aria-hidden="true" />
    )}
  </Button>
);

const DashboardSkeleton = () => (
  <section className="user-analytics-shadcn flex flex-col gap-4" aria-busy="true" aria-label="Đang tải User Analytics">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-[min(32rem,80vw)]" />
      </div>
      <Skeleton className="h-9 w-80 max-w-full" />
    </div>
    <Skeleton className="h-44 w-full rounded-2xl" />
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
      <Skeleton className="h-[340px] w-full rounded-2xl" />
      <Skeleton className="h-[340px] w-full rounded-2xl" />
    </div>
    <Skeleton className="h-[440px] w-full rounded-2xl" />
  </section>
);

const UserAnalyticsDashboard = ({ dataSource = getAdminAnalytics, initialData = null }) => {
  const [range, setRange] = useState(30);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [page, setPage] = useState(1);

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
      const matchesStatus = statusFilter === 'all' || learner.engagement_status === statusFilter;
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

  if (loading) return <DashboardSkeleton />;

  if (error && !data) {
    return (
      <section className="user-analytics-shadcn">
        <Alert variant="destructive" className="min-h-28 items-center p-5">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Chưa thể mở User Analytics</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction className="right-5 top-1/2 -translate-y-1/2">
            <Button type="button" variant="outline" onClick={() => loadAnalytics()}>
              Thử tải lại
            </Button>
          </AlertAction>
        </Alert>
      </section>
    );
  }

  return (
    <section className="user-analytics-shadcn flex min-w-0 flex-col gap-4" aria-labelledby="user-analytics-title">
      <header className="aua-page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 id="user-analytics-title" className="text-2xl font-semibold tracking-tight text-foreground">
            User Analytics
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Hoạt động, tiến độ học tập và mức độ tương tác trên toàn hệ thống.
          </p>
        </div>

        <div className="aua-toolbar-actions flex min-w-0 flex-wrap items-center gap-2">
          <ToggleGroup
            value={[String(range)]}
            onValueChange={(values) => {
              const nextValue = values.at(-1);
              if (nextValue) setRange(Number(nextValue));
            }}
            variant="outline"
            size="sm"
            spacing={0}
            className="aua-range-toggle"
            aria-label="Chọn khoảng thời gian"
          >
            {RANGE_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.value} value={String(option.value)} aria-label={option.label}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadAnalytics({ silent: true })}
            disabled={refreshing}
            aria-label="Làm mới dữ liệu Analytics"
          >
            {refreshing ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
            )}
            <span>{refreshing ? 'Đang cập nhật' : 'Làm mới'}</span>
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive" className="px-3 py-2">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Chưa cập nhật được dữ liệu mới</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="aua-pulse-band" aria-labelledby="system-pulse-title">
        <div className="aua-pulse-heading">
          <div>
            <h3 id="system-pulse-title">Nhịp hệ thống</h3>
            <p>Tín hiệu học tập trong {range} ngày gần nhất.</p>
          </div>
          <Badge className="aua-pulse-badge">{activeRate}% đang hoạt động</Badge>
        </div>
        <div className="aua-pulse-layout">
          <div className="aua-pulse-lead">
            <span>Học viên hoạt động</span>
            <strong>{numberFormatter.format(toNumber(overview.active_learners))}</strong>
            <small>trên {numberFormatter.format(learnerCount)} học viên</small>
          </div>
          <dl className="aua-pulse-metrics">
            <div>
              <dt>Đăng ký mới</dt>
              <dd>+{numberFormatter.format(toNumber(overview.new_learners))}</dd>
            </div>
            <div>
              <dt>Bài hoàn thành</dt>
              <dd>{numberFormatter.format(toNumber(overview.lessons_completed))}</dd>
            </div>
            <div>
              <dt>Thời gian học</dt>
              <dd>{formatStudyTime(overview.study_minutes)}</dd>
            </div>
            <div>
              <dt>Điểm quiz TB</dt>
              <dd>{toNumber(overview.average_quiz_score)}%</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="aua-operations-panel order-3" aria-labelledby="learner-progress-title">
        <header className="aua-panel-heading aua-users-header">
          <div>
            <h3 id="learner-progress-title">Tiến trình người dùng</h3>
            <p>{numberFormatter.format(filteredLearners.length)} học viên phù hợp với bộ lọc.</p>
          </div>
          <div className="aua-table-tools flex min-w-0 flex-col gap-2 md:flex-row">
            <label className="relative block min-w-0">
              <span className="sr-only">Tìm học viên</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tên hoặc email..."
                className="w-full pl-9 md:w-60"
              />
            </label>
            <Select items={STATUS_OPTIONS} value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48" aria-label="Lọc theo trạng thái hoạt động">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="aua-table-content">
          {visibleLearners.length ? (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[29%] px-4">Học viên</TableHead>
                      <TableHead className="w-[20%]">Tiến độ khóa học</TableHead>
                      <TableHead>Thời gian học</TableHead>
                      <TableHead>Quiz TB</TableHead>
                      <TableHead>Hoạt động gần nhất</TableHead>
                      <TableHead className="pr-4">Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleLearners.map((learner) => {
                      const expanded = expandedUserId === learner.user_id;
                      const progress = toNumber(learner.progress_percent);
                      return (
                        <Fragment key={learner.user_id}>
                          <TableRow aria-expanded={expanded} className={cn(expanded && 'bg-muted/40')}>
                            <TableCell className="px-4 py-2.5">
                              <LearnerIdentity
                                learner={learner}
                                expanded={expanded}
                                onToggle={() => setExpandedUserId(expanded ? null : learner.user_id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-32 flex-col gap-2">
                                <div className="flex items-center justify-between gap-3">
                                  <strong className="text-sm tabular-nums">{progress}%</strong>
                                  <span className="text-xs text-muted-foreground">
                                    {toNumber(learner.completed_lessons)}/{toNumber(learner.available_lessons)} bài
                                  </span>
                                </div>
                                <Progress value={progress} aria-label={`Tiến độ của ${learner.full_name || learner.username}`} />
                              </div>
                            </TableCell>
                            <TableCell>{formatStudyTime(learner.study_minutes)}</TableCell>
                            <TableCell>{toNumber(learner.quiz_attempts) ? `${toNumber(learner.average_quiz_score)}%` : 'Chưa có'}</TableCell>
                            <TableCell title={learner.last_activity_at ? dateTimeFormatter.format(new Date(learner.last_activity_at)) : ''}>
                              {formatRelativeActivity(learner)}
                            </TableCell>
                            <TableCell className="pr-4"><StatusBadge status={learner.engagement_status} /></TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow className="aua-detail-row hover:bg-muted/40">
                              <TableCell colSpan={6} className="px-4 py-3">
                                <dl className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                                  <div><dt>Hoàn thành kỳ này</dt><dd>{toNumber(learner.period_completions)} bài</dd></div>
                                  <div><dt>Lượt làm quiz</dt><dd>{toNumber(learner.quiz_attempts)}</dd></div>
                                  <div><dt>Trao đổi với AI</dt><dd>{toNumber(learner.ai_messages)}</dd></div>
                                  <div><dt>Token AI đã dùng</dt><dd>{numberFormatter.format(toNumber(learner.used_tokens))}</dd></div>
                                  <div><dt>Ngày tham gia</dt><dd>{dateFormatter.format(new Date(learner.created_date))}</dd></div>
                                </dl>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col lg:hidden">
                {visibleLearners.map((learner, index) => {
                  const expanded = expandedUserId === learner.user_id;
                  const progress = toNumber(learner.progress_percent);
                  return (
                    <div key={learner.user_id}>
                      {index > 0 && <Separator />}
                      <article className="flex flex-col gap-4 p-4">
                        <LearnerIdentity
                          learner={learner}
                          expanded={expanded}
                          onToggle={() => setExpandedUserId(expanded ? null : learner.user_id)}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge status={learner.engagement_status} />
                          <small className="text-xs text-muted-foreground">{formatRelativeActivity(learner)}</small>
                        </div>
                        <div className="aua-mobile-metrics grid grid-cols-3 gap-3 text-sm">
                          <div><span>Tiến độ</span><strong>{progress}%</strong></div>
                          <div><span>Thời gian</span><strong>{formatStudyTime(learner.study_minutes)}</strong></div>
                          <div><span>Quiz TB</span><strong>{toNumber(learner.quiz_attempts) ? `${toNumber(learner.average_quiz_score)}%` : '-'}</strong></div>
                        </div>
                        <Progress value={progress} aria-label={`Tiến độ của ${learner.full_name || learner.username}`} />
                        {expanded && (
                          <dl className="aua-mobile-detail grid grid-cols-2 gap-3 bg-muted/60 p-4">
                            <div><dt>Bài đã hoàn thành</dt><dd>{toNumber(learner.completed_lessons)}</dd></div>
                            <div><dt>Hoàn thành kỳ này</dt><dd>{toNumber(learner.period_completions)}</dd></div>
                            <div><dt>Trao đổi AI</dt><dd>{toNumber(learner.ai_messages)}</dd></div>
                            <div><dt>Token AI đã dùng</dt><dd>{numberFormatter.format(toNumber(learner.used_tokens))}</dd></div>
                          </dl>
                        )}
                      </article>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon"><UsersRound aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>Không tìm thấy học viên phù hợp</EmptyTitle>
                <EmptyDescription>Thử đổi từ khóa hoặc chọn một trạng thái khác.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        {visibleLearners.length > 0 && pageCount > 1 && (
          <footer className="aua-pagination flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Trang {safePage}/{pageCount}</span>
            <nav className="flex items-center gap-2" aria-label="Phân trang danh sách học viên">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                aria-label="Trang trước"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
                disabled={safePage === pageCount}
                aria-label="Trang sau"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          </footer>
        )}
      </section>

      <div className="aua-analysis-grid order-2">
        <section className="aua-chart-panel" aria-labelledby="activity-chart-title">
          <header className="aua-panel-heading">
            <div>
              <h3 id="activity-chart-title">Hoạt động hệ thống</h3>
              <p>Học viên hoạt động và bài hoàn thành theo ngày.</p>
            </div>
            <Badge variant="outline">{range} ngày</Badge>
          </header>
          <div className="aua-chart-content">
            {hasChartData ? (
              <div role="img" aria-label="Biểu đồ nhịp học theo ngày">
                <p className="sr-only">
                  Biểu đồ gồm {chartData.length} ngày, với tổng {numberFormatter.format(chartData.reduce((sum, item) => sum + item.active_learners, 0))} lượt học viên hoạt động theo ngày và {numberFormatter.format(chartData.reduce((sum, item) => sum + item.completed_lessons, 0))} bài học hoàn thành.
                </p>
                <ChartContainer config={CHART_CONFIG} className="h-[250px] w-full min-w-0 aspect-auto">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 2, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 6" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      yAxisId="right"
                      dataKey="completed_lessons"
                      fill="var(--color-completed_lessons)"
                      maxBarSize={12}
                      radius={[2, 2, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="active_learners"
                      stroke="var(--color-active_learners)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ChartContainer>
              </div>
            ) : (
              <Empty className="min-h-[250px] border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Activity aria-hidden="true" /></EmptyMedia>
                  <EmptyTitle>Chưa có hoạt động trong khoảng này</EmptyTitle>
                  <EmptyDescription>Biểu đồ sẽ xuất hiện khi học viên bắt đầu học hoặc hoàn thành bài.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </section>

        <aside className="aua-attention-rail" aria-labelledby="engagement-title">
          <header className="aua-panel-heading">
            <div>
              <h3 id="engagement-title">Tín hiệu cần xử lý</h3>
              <p>Theo hoạt động gần nhất.</p>
            </div>
          </header>
          <div className="aua-attention-content">
            <Alert className="aua-attention-alert">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>{numberFormatter.format(toNumber(engagement.attention))} học viên cần chú ý</AlertTitle>
              <AlertDescription>Không hoạt động từ 8 đến 30 ngày.</AlertDescription>
            </Alert>
            <div
              className="aua-distribution-bar"
              role="img"
              aria-label={`Phân bổ: ${toNumber(engagement.active)} đang hoạt động, ${toNumber(engagement.attention)} cần chú ý, ${toNumber(engagement.inactive)} không hoạt động`}
            >
              {Object.keys(STATUS_META).map((key) => (
                <span
                  key={key}
                  className={`is-${key}`}
                  style={{ width: `${(toNumber(engagement[key]) / totalLearners) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const count = toNumber(engagement[key]);
                const percent = Math.round((count / totalLearners) * 100);
                return (
                  <div key={key} className="aua-distribution-row">
                    <span className={`aua-legend-mark is-${key}`} aria-hidden="true" />
                    <span>{meta.label}</span>
                    <strong>{numberFormatter.format(count)}</strong>
                    <small>{percent}%</small>
                  </div>
                );
              })}
            </div>
            <Separator />
            <dl className="aua-secondary-stats">
              <div><dt>Khóa đang mở</dt><dd>{toNumber(overview.published_courses)}</dd></div>
              <div><dt>Trao đổi AI</dt><dd>{compactFormatter.format(toNumber(overview.ai_messages))}</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      <section className="aua-operations-panel order-4" aria-labelledby="course-health-title">
        <header className="aua-panel-heading">
          <div>
            <h3 id="course-health-title">Tiến độ theo khóa học</h3>
            <p>Các khóa đang có người học, xếp theo quy mô tham gia.</p>
          </div>
          <div>
            <Badge variant="outline" className="hidden gap-1.5 sm:flex">
              <BookOpen data-icon="inline-start" aria-hidden="true" />
              {numberFormatter.format(toNumber(overview.total_lessons))} bài học
            </Badge>
          </div>
        </header>
        <div className="aua-course-list">
          {activeCourses.length ? (
            <div className="flex flex-col">
              {activeCourses.map((course, index) => {
                const averageProgress = toNumber(course.average_progress);
                return (
                  <Fragment key={course.course_id}>
                    {index > 0 && <Separator />}
                    <div className="aua-course-row">
                      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.65fr)] md:gap-8">
                        <div className="min-w-0">
                          <strong className="block truncate text-sm font-medium text-foreground">{course.course_name}</strong>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {toNumber(course.learners)} học viên · {toNumber(course.completed_learners)} đã hoàn thành
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={averageProgress} className="flex-1" aria-label={`Tiến độ trung bình khóa ${course.course_name}`} />
                          <strong className="w-11 text-right text-sm tabular-nums">{averageProgress}%</strong>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <Empty className="min-h-40 border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>Chưa có tiến trình khóa học</EmptyTitle>
                <EmptyDescription>Dữ liệu sẽ được tổng hợp khi học viên bắt đầu học.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </section>

      <footer className="order-5 flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
        <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Dữ liệu cập nhật lúc {data?.generatedAt ? dateTimeFormatter.format(new Date(data.generatedAt)) : '-'}. Trạng thái được tính theo lần học, làm quiz, hoàn thành bài hoặc dùng trợ lý AI gần nhất.
        </span>
      </footer>
    </section>
  );
};

export default UserAnalyticsDashboard;
