import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiClock, 
  FiAward, 
  FiTrendingUp, 
  FiZap, 
  FiCalendar, 
  FiBarChart2, 
  FiPieChart, 
  FiCheckCircle, 
  FiRefreshCw, 
  FiArrowLeft,
  FiTarget,
  FiBookOpen,
  FiActivity
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend
} from 'recharts';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useAuth } from '../../../context/AuthContext';
import { getUserHeatmapData, getUserAnalyticsSummary } from '../services/analytics.service';

const AnalyticsDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // States
  const [timeRange, setTimeRange] = useState('30days'); // '7days', '30days', 'year'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAnalyticsData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const [hmData, sumData] = await Promise.all([
        getUserHeatmapData(timeRange),
        getUserAnalyticsSummary()
      ]);
      setHeatmapData(hmData);
      setSummary(sumData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Lỗi nạp dữ liệu phân tích học tập:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch khi mount hoặc đổi timeRange
  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  // Auto-refresh mỗi 5 phút — tránh loading flicker khi tự động làm mới
  useEffect(() => {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const intervalId = setInterval(() => {
      fetchAnalyticsData(true); // isAutoRefresh = true → không bật loading overlay
    }, FIVE_MINUTES);
    return () => clearInterval(intervalId); // cleanup khi unmount
  }, [timeRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
    setTimeout(() => setRefreshing(false), 600);
  };

  // Tính toán số tuần và màu cho Heatmap Grid 52 tuần
  const heatmapWeeks = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) return [];
    
    // Group heatmapData by 7-day chunks (weeks)
    const weeks = [];
    let currentWeek = [];
    
    heatmapData.forEach((item, index) => {
      currentWeek.push(item);
      if (currentWeek.length === 7 || index === heatmapData.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return weeks;
  }, [heatmapData]);

  // Color mapping cho Heatmap intensity
  const getHeatmapColor = (intensity) => {
    switch (intensity) {
      case 1: return 'bg-emerald-200 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700/60';
      case 2: return 'bg-emerald-400 dark:bg-emerald-700 border border-emerald-500 dark:border-emerald-600';
      case 3: return 'bg-emerald-600 dark:bg-emerald-500 border border-emerald-700 dark:border-emerald-400 shadow-sm';
      case 4: return 'bg-emerald-700 dark:bg-emerald-300 border border-emerald-800 dark:border-emerald-200 shadow-md animate-pulse';
      default: return 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50';
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Header />

      <main className="flex-grow pt-24 pb-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Header Action & Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
            <div>
              <button 
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-smart-indigo transition-colors mb-2"
              >
                <FiArrowLeft />
                <span>Quay lại Trang chủ</span>
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border-2 border-smart-indigo/30 flex items-center justify-center text-smart-indigo dark:text-indigo-400 text-2xl shadow-sm">
                  <FiActivity />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight" style={{ color: 'var(--text-color)' }}>
                    Learning Analytics Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold" style={{ color: 'var(--text-light)' }}>
                    Bảng phân tích hiệu suất học tập, chuỗi luyện tập & xu hướng kết quả Quiz theo thời gian thực.
                  </p>
                </div>
              </div>
            </div>

            {/* Time Filter & Refresh Controls */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {[
                  { id: '7days', label: '7 ngày' },
                  { id: '30days', label: '30 ngày' },
                  { id: 'year', label: 'Cả năm' }
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setTimeRange(btn.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timeRange === btn.id
                        ? 'bg-smart-indigo text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-smart-indigo transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Làm mới dữ liệu"
                >
                  <FiRefreshCw className={`text-sm ${refreshing ? 'animate-spin text-smart-indigo' : ''}`} />
                </button>
                {lastUpdated && (
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    🕐 {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Tổng thời gian học */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all"></div>
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tổng thời gian học
                </span>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-smart-indigo dark:text-indigo-400 flex items-center justify-center text-lg font-bold">
                  <FiClock />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {summary?.kpi?.totalStudyHours ?? '0'}
                </span>
                <span className="text-sm font-extrabold text-slate-500 dark:text-slate-400">Giờ</span>
              </div>
              <div className={`flex items-center text-[11px] font-bold gap-1 pt-1 ${
                (summary?.kpi?.weeklyGrowthPercent ?? 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-500 dark:text-rose-400'
              }`}>
                <FiTrendingUp className={`text-xs ${ (summary?.kpi?.weeklyGrowthPercent ?? 0) < 0 ? 'rotate-180' : '' }`} />
                <span>
                  {(summary?.kpi?.weeklyGrowthPercent ?? 0) >= 0 ? '+' : ''}{summary?.kpi?.weeklyGrowthPercent ?? 0}% so với tuần trước
                </span>
              </div>
            </div>

            {/* Card 2: Tiến độ bài học */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Bài học hoàn thành
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg font-bold">
                  <FiCheckCircle />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {summary?.kpi?.completedLessonsCount ?? 0}
                </span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">bài đã tích xanh</span>
              </div>
              <div className="flex items-center text-[11px] font-bold text-slate-500 dark:text-slate-400 gap-1 pt-1">
                <FiBookOpen className="text-xs text-emerald-500" />
                <span>
                  {summary?.kpi?.completedLessonsCount > 0 ? `${summary.kpi.completedLessonsCount} bài đã hoàn thành` : 'Chưa có bài học nào hoàn thành'}
                </span>
              </div>
            </div>

            {/* Card 3: Điểm Quiz trung bình */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Điểm Quiz trung bình
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center text-lg font-bold">
                  <FiAward />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {summary?.kpi?.avgQuizScorePercent ?? 0}%
                </span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">chính xác</span>
              </div>
              <div className="flex items-center text-[11px] font-bold text-amber-600 dark:text-amber-400 gap-1 pt-1">
                <FiTarget className="text-xs" />
                <span>
                  {(() => {
                    const s = summary?.kpi?.avgQuizScorePercent ?? 0;
                    if (s >= 90) return 'Xếp loại: Học viên Xuất sắc 🏆';
                    if (s >= 75) return 'Xếp loại: Học viên Giỏi 🥇';
                    if (s >= 60) return 'Xếp loại: Học viên Khá 🥈';
                    if (s > 0)   return 'Xếp loại: Học viên Trung bình';
                    return 'Chưa có dữ liệu Quiz';
                  })()}
                </span>
              </div>
            </div>

            {/* Card 4: Daily Flame Streak */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all"></div>
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Daily Flame Streak
                </span>
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center text-lg font-bold">
                  <FiZap className="animate-bounce" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {summary?.kpi?.currentStreakDays ?? 0}
                </span>
                <span className="text-sm font-extrabold text-rose-500">Ngày liên tục 🔥</span>
              </div>
              <div className="flex items-center text-[11px] font-bold text-rose-600 dark:text-rose-400 gap-1 pt-1">
                <FiCalendar className="text-xs" />
                <span>Mục tiêu tuần: Duy trì chuỗi</span>
              </div>
            </div>
          </div>

          {/* MAIN HEATMAP SECTION: EdTech Annual Learning Heatmap */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider mb-1 inline-block">
                  🔥 Tần suất học tập theo ngày (Learning Heatmap)
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100" style={{ color: 'var(--text-color)' }}>
                  Biểu đồ Nhiệt độ rèn luyện trong năm ({heatmapData.length} ngày ghi nhận)
                </h2>
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                <span>Ít</span>
                <div className="flex gap-1.5 items-center">
                  <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50"></span>
                  <span className="w-3.5 h-3.5 rounded bg-emerald-200 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700/60"></span>
                  <span className="w-3.5 h-3.5 rounded bg-emerald-400 dark:bg-emerald-700 border border-emerald-500 dark:border-emerald-600"></span>
                  <span className="w-3.5 h-3.5 rounded bg-emerald-600 dark:bg-emerald-500 border border-emerald-700 dark:border-emerald-400"></span>
                  <span className="w-3.5 h-3.5 rounded bg-emerald-700 dark:bg-emerald-300 border border-emerald-800 dark:border-emerald-200"></span>
                </div>
                <span>Nhiều (60+ phút)</span>
              </div>
            </div>

            {/* Heatmap Grid Rendering */}
            <div className="overflow-x-auto pb-2 scrollbar-thin">
              <div className="min-w-[760px] flex gap-1.5 p-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                {heatmapWeeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1.5 flex-1">
                    {week.map((day, dIdx) => (
                      <div
                        key={dIdx}
                        className={`w-full aspect-square rounded-md transition-all duration-200 hover:scale-125 cursor-pointer relative group ${getHeatmapColor(day.intensity)}`}
                        title={`${day.date}: ${day.count} phút học tập`}
                      >
                        {/* Hover Tooltip Popup */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none min-w-[130px]">
                          <div className="bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xl border border-slate-700 whitespace-nowrap text-center">
                            <div>📅 {day.date}</div>
                            <div className="text-emerald-400">⏱️ {day.count} phút học</div>
                          </div>
                          <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TWO COLUMNS CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left 7 Cols: Quiz Score Trend & Weekly Activity */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Chart 1: Quiz Performance Trends (Composed Area Chart) */}
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-smart-indigo dark:text-indigo-400 text-[11px] font-extrabold uppercase tracking-wider mb-1 inline-block">
                      📈 Tiến trình làm Quiz
                    </span>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Xu hướng điểm số & Số lượt làm bài
                    </h3>
                  </div>
                </div>

                <div className="h-[280px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary?.quizTrends || []}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderColor: '#334155', 
                          borderRadius: '12px', 
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        name="Điểm chính xác (%)" 
                        stroke="#6366f1" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#scoreGradient)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Weekly Activity Breakdown (Bar Chart) */}
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider mb-1 inline-block">
                      📊 Phân bổ theo ngày trong tuần
                    </span>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Số phút rèn luyện theo các ngày trong tuần
                    </h3>
                  </div>
                </div>

                <div className="h-[250px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary?.weeklyActivity || []}>
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderColor: '#334155', 
                          borderRadius: '12px', 
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Bar dataKey="minutes" name="Số phút học" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Right 5 Cols: Course Completion Donut Chart & Skill Radar Chart */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Chart 3: Course Completion Pie/Donut Chart */}
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div>
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-extrabold uppercase tracking-wider mb-1 inline-block">
                    🍩 Tỷ lệ hoàn thành khóa học
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Phân bổ trạng thái học tập
                  </h3>
                </div>

                <div className="h-[240px] w-full flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary?.courseCompletion || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(summary?.courseCompletion || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderColor: '#334155', 
                          borderRadius: '12px', 
                          color: '#fff',
                          fontSize: '12px'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Center Text Indicator — tỷ lệ hoàn thành thực tế */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                      {(() => {
                        const cc = summary?.courseCompletion || [];
                        const total = cc.reduce((s, i) => s + (i.value || 0), 0);
                        const done = cc.find(i => i.name === 'Đã hoàn thành')?.value || 0;
                        return total > 0 ? `${Math.round((done / total) * 100)}%` : '0%';
                      })()}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Tiến độ</span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  {(summary?.courseCompletion || []).map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{item.name}</span>
                      </div>
                      <span className="text-base font-black text-slate-800 dark:text-slate-100">{item.value} khóa</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 4: Skill Mastery Radar Chart */}
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div>
                  <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-extrabold uppercase tracking-wider mb-1 inline-block">
                    🎯 Đánh giá năng lực 5 kỹ năng
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Ma trận điểm năng lực ngôn ngữ
                  </h3>
                </div>

                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={summary?.skillRadar || []}>
                      <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                      <PolarAngleAxis dataKey="skill" stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" fontSize={9} />
                      <Radar name="Điểm đánh giá" dataKey="A" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.35} />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderColor: '#334155', 
                          borderRadius: '12px', 
                          color: '#fff',
                          fontSize: '12px'
                        }} 
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AnalyticsDashboardPage;
