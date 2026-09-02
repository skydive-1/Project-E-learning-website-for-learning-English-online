import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FiRefreshCw, 
  FiSearch, 
  FiDownload, 
  FiAlertTriangle, 
  FiCpu, 
  FiZap, 
  FiUsers, 
  FiMessageSquare, 
  FiCheck, 
  FiX, 
  FiTrendingUp
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';

import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { 
  getAiQuotaAnalytics, 
  resetUserAiToken, 
  resetBulkAiTokens 
} from '../services/adminAnalytics.service';
import '../styles/ai-quota-board.scss';

const AIQuotaUsageBoard = () => {
  const showToast = useToast();
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const compactFormatter = useMemo(() => new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  }), [locale]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit'
  }), [locale]);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }), [locale]);

  // State dữ liệu
  const [rangeDays, setRangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  // State lọc và tìm kiếm (Chuẩn giao diện Admin)
  const [filterTab, setFilterTab] = useState('all'); // all, exhausted, critical, normal, unused, student, instructor, admin
  const [searchTerm, setSearchTerm] = useState('');
  const [showChart, setShowChart] = useState(true);

  // State Modal xem lịch sử tương tác AI
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [targetUserHistory, setTargetUserHistory] = useState(null);

  // Tải dữ liệu từ Backend
  const fetchQuotaData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const data = await getAiQuotaAnalytics(rangeDays);
      setDashboardData(data);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu AI Quota:', err);
      setError(err.response?.status === 404
        ? 'API quản lý hạn mức AI chưa khả dụng. Hãy kiểm tra kết nối backend rồi thử lại.'
        : 'Không thể tải dữ liệu hạn mức AI. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    fetchQuotaData();
  }, [fetchQuotaData]);

  // Xử lý Reset Token cho 1 người dùng
  const handleResetToken = async (user) => {
    const name = user.full_name || user.username;
    if (!window.confirm(t('Bạn có chắc muốn đặt lại lượt hỏi AI của "{{name}}" về 0?', { name }))) {
      return;
    }

    try {
      await resetUserAiToken(user.user_id);
      showToast(t('Đã đặt lại lượt hỏi cho {{name}}.', { name }), 'success');
      fetchQuotaData(true);
    } catch (err) {
      console.error('Lỗi reset token:', err);
      showToast(t('Không thể đặt lại lượt hỏi. Vui lòng thử lại.'), 'error');
    }
  };

  // Xử lý Reset Token hàng loạt theo Role
  const handleBulkReset = async (roleId, roleName) => {
    if (!window.confirm(t('Bạn có chắc muốn đặt lại lượt hỏi AI của tất cả {{role}} về 0?', { role: roleName }))) {
      return;
    }

    try {
      await resetBulkAiTokens(roleId);
      showToast(t('Đã đặt lại lượt hỏi cho tất cả {{role}}.', { role: roleName }), 'success');
      fetchQuotaData(true);
    } catch (err) {
      console.error('Lỗi reset token hàng loạt:', err);
      showToast(t('Không thể đặt lại lượt hỏi hàng loạt. Vui lòng thử lại.'), 'error');
    }
  };

  // Mở Modal xem prompt lịch sử
  const handleOpenHistoryModal = (user) => {
    setTargetUserHistory(user);
    setHistoryModalOpen(true);
  };

  // Xuất file CSV báo cáo
  const handleExportCsv = () => {
    if (!dashboardData?.users || dashboardData.users.length === 0) {
      showToast(t('Không có dữ liệu để xuất.'), 'warning');
      return;
    }

    const getRoleLabel = (roleId) => (
      roleId === 1 ? t('Quản trị viên hệ thống') : roleId === 2 ? t('Giảng viên hệ thống') : t('Học viên hệ thống')
    );
    const getStatusLabel = (status) => ({
      exhausted: t('Đã hết hạn mức'),
      critical: t('Sắp hết hạn mức'),
      warning: t('Cảnh báo'),
      normal: t('Bình thường'),
      unused: t('Chưa sử dụng'),
      unlimited: t('Không giới hạn')
    })[status] || status;
    const headers = [
      t('ID người dùng'),
      t('Họ tên'),
      t('Tên đăng nhập'),
      'Email',
      t('Vai trò'),
      t('Token mô hình đã dùng'),
      t('Lượt hỏi hôm nay'),
      t('Hạn mức câu hỏi trong ngày'),
      t('Số câu hỏi còn lại'),
      t('Thời điểm đặt lại'),
      t('Trạng thái'),
      t('Tương tác gần nhất')
    ];
    const rows = dashboardData.users.map(u => [
      u.user_id,
      `"${u.full_name || ''}"`,
      `"${u.username || ''}"`,
      `"${u.email || ''}"`,
      `"${getRoleLabel(u.role_id)}"`,
      u.used_tokens,
      u.question_quota_unlimited ? t('Không giới hạn') : u.used_questions_24h,
      u.question_quota_unlimited ? t('Không giới hạn') : u.question_limit_24h,
      u.question_quota_unlimited ? t('Không giới hạn') : u.questions_remaining_24h,
      `"${u.question_reset_at || ''}"`,
      `"${getStatusLabel(u.question_quota_status)}"`,
      `"${u.last_ai_activity_at || 'N/A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ai_quota_usage_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(t('Đã xuất báo cáo CSV.'), 'success');
  };

  // Lọc danh sách người dùng theo Tab filter và Search
  const allUsers = dashboardData?.users || [];
  const filteredUsers = useMemo(() => {
    return allUsers.filter(user => {
      // Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = (user.full_name || '').toLowerCase().includes(term);
        const matchUser = (user.username || '').toLowerCase().includes(term);
        const matchEmail = (user.email || '').toLowerCase().includes(term);
        if (!matchName && !matchUser && !matchEmail) return false;
      }

      // Lọc theo filter tab
      if (filterTab === 'all') return true;
      if (filterTab === 'exhausted') return user.question_quota_status === 'exhausted';
      if (filterTab === 'critical') return user.question_quota_status === 'critical';
      if (filterTab === 'warning') return user.question_quota_status === 'warning';
      if (filterTab === 'normal') return user.question_quota_status === 'normal';
      if (filterTab === 'unused') return user.question_quota_status === 'unused';
      if (filterTab === 'student') return user.role_id === 3;
      if (filterTab === 'instructor') return user.role_id === 2;
      if (filterTab === 'admin') return user.role_id === 1;

      return true;
    });
  }, [allUsers, searchTerm, filterTab]);

  // Thống kê counts cho các tab
  const counts = useMemo(() => {
    return {
      all: allUsers.length,
      exhausted: allUsers.filter(u => u.question_quota_status === 'exhausted').length,
      critical: allUsers.filter(u => u.question_quota_status === 'critical').length,
      student: allUsers.filter(u => u.role_id === 3).length,
      instructor: allUsers.filter(u => u.role_id === 2).length,
      admin: allUsers.filter(u => u.role_id === 1).length
    };
  }, [allUsers]);

  // Tóm tắt số liệu
  const summary = dashboardData?.summary || {};
  const totalUsed = Number(summary.total_used_tokens || 0);

  // Lọc lịch sử câu hỏi của user đang chọn
  const userAuditLogs = useMemo(() => {
    if (!targetUserHistory || !dashboardData?.recentAiLogs) return [];
    return dashboardData.recentAiLogs.filter(l => l.user_id === targetUserHistory.user_id);
  }, [targetUserHistory, dashboardData?.recentAiLogs]);

  return (
    <div className="users-table-container ai-quota-dashboard-view">
      {/* 1. TOP KPI METRICS CARDS (Phong cách BoardUI tinh gọn) */}
      <div className="ai-quota-kpi-grid">
        {/* KPI 1 */}
        <div className="ai-kpi-box primary">
          <div className="ai-kpi-header">
            <span className="ai-kpi-title">{t('Tổng token mô hình đã dùng')}</span>
            <FiZap className="ai-kpi-icon text-blue-500" />
          </div>
          <div className="ai-kpi-number-row">
            <span className="ai-kpi-num">{numberFormatter.format(totalUsed)}</span>
            <span className="ai-kpi-denom">{t('token mô hình')}</span>
          </div>
          <p className="ai-kpi-desc">
            {t('Token mô hình chỉ dùng để đo mức tiêu thụ, không phải hạn mức câu hỏi.')}
          </p>
        </div>

        {/* KPI 2 */}
        <div className="ai-kpi-box">
          <div className="ai-kpi-header">
            <span className="ai-kpi-title">{t('Người dùng đang dùng AI')}</span>
            <FiUsers className="ai-kpi-icon text-indigo-400" />
          </div>
          <div className="ai-kpi-number-row">
            <span className="ai-kpi-num">{numberFormatter.format(summary.active_ai_users_period || 0)}</span>
            <span className="ai-kpi-badge-green">
              {t('{{count}} lượt hỏi', { count: numberFormatter.format(summary.total_questions_rolling_24h || 0) })}
            </span>
          </div>
          <p className="ai-kpi-desc">
            {t('Trung bình: {{tokens}} token/người dùng', {
              tokens: numberFormatter.format(summary.avg_tokens_per_active_user || 0)
            })}
          </p>
        </div>

        {/* KPI 3 */}
        <div className="ai-kpi-box">
          <div className="ai-kpi-header">
            <span className="ai-kpi-title">{t('Chi phí API ước tính')}</span>
            <FiCpu className="ai-kpi-icon text-emerald-400" />
          </div>
          <div className="ai-kpi-number-row">
            <span className="ai-kpi-num text-emerald-500">${summary.estimatedCostUsd || '0.0000'}</span>
            <span className="ai-kpi-denom">USD</span>
          </div>
          <p className="ai-kpi-desc">
            {t('Mô hình:')} <strong>Google Gemini 3.7 Flash</strong> ($0.075 / 1M)
          </p>
        </div>

        {/* KPI 4 */}
        <button
          type="button"
          className={`ai-kpi-box clickable ${(counts.exhausted > 0 || counts.critical > 0) ? 'has-alert' : ''}`}
          onClick={() => setFilterTab(counts.exhausted > 0 ? 'exhausted' : 'critical')}
          title={t('Nhấp để lọc người dùng đã hết hoặc sắp hết hạn mức câu hỏi')}
        >
          <div className="ai-kpi-header">
            <span className="ai-kpi-title">{t('Cảnh báo hạn mức')}</span>
            <FiAlertTriangle className="ai-kpi-icon text-amber-500" />
          </div>
          <div className="ai-kpi-number-row">
            <span className="ai-kpi-num text-rose-500">{counts.exhausted}</span>
            <span className="ai-kpi-denom">{t('Đã hết (100%)')}</span>
            <span className="text-slate-500 mx-1">|</span>
            <span className="ai-kpi-num text-amber-500 text-lg">{counts.critical}</span>
            <span className="ai-kpi-denom">&gt;80%</span>
          </div>
          <p className="ai-kpi-desc text-amber-400 font-medium">
            {t('Xem danh sách cần đặt lại')}
          </p>
        </button>
      </div>

      {/* 2. COLLAPSIBLE DAILY CONSUMPTION CHART */}
      {showChart && dashboardData?.trends && dashboardData.trends.length > 0 && (
        <div className="ai-chart-panel mb-5">
          <div className="ai-chart-header">
            <div className="flex items-center gap-2">
              <FiTrendingUp className="text-blue-500 text-sm" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t('Xu hướng sử dụng token theo ngày ({{days}} ngày qua)', { days: rangeDays })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" /> Gemini 3.7 Flash
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Embedding
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500" /> Speaking STT
              </div>
              <button 
                type="button" 
                aria-label={t('Thu gọn')}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                onClick={() => setShowChart(false)}
              >
                {t('Thu gọn')} <FiX aria-hidden="true" />
              </button>
            </div>
          </div>
          <div style={{ height: 180, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dashboardData.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis 
                  dataKey="day" 
                  tickFormatter={(val) => dateFormatter.format(new Date(val))}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                />
                <YAxis 
                  yAxisId="left"
                  tickFormatter={(val) => compactFormatter.format(val)}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={false}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1E293B', borderRadius: 8, fontSize: 12 }}
                  formatter={(val, name) => [`${numberFormatter.format(val)} token`, name]}
                  labelFormatter={(lbl) => t('Ngày: {{date}}', { date: lbl })}
                />
                <Bar yAxisId="left" dataKey="gemini_flash_tokens" name="Gemini Flash" stackId="a" fill="#3B82F6" />
                <Bar yAxisId="left" dataKey="gemini_embedding_tokens" name="Embedding" stackId="a" fill="#10B981" />
                <Bar yAxisId="left" dataKey="speaking_stt_tokens" name="Voice STT" stackId="a" fill="#F59E0B" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. FILTER PILL BUTTONS (Đúng theo mẫu screenshot) */}
      <div className="table-filters flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap items-center">
          <button 
            className={`filter-btn ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            {t('Tất cả')} ({counts.all})
          </button>
          <button 
            className={`filter-btn ${filterTab === 'exhausted' ? 'active' : ''}`}
            onClick={() => setFilterTab('exhausted')}
          >
            {t('Đã hết 100%')} ({counts.exhausted})
          </button>
          <button 
            className={`filter-btn ${filterTab === 'critical' ? 'active' : ''}`}
            onClick={() => setFilterTab('critical')}
          >
            {t('Nguy cơ >80%')} ({counts.critical})
          </button>
          <button 
            className={`filter-btn ${filterTab === 'student' ? 'active' : ''}`}
            onClick={() => setFilterTab('student')}
          >
            {t('Học viên')} ({counts.student})
          </button>
          <button 
            className={`filter-btn ${filterTab === 'instructor' ? 'active' : ''}`}
            onClick={() => setFilterTab('instructor')}
          >
            {t('Giảng viên')} ({counts.instructor})
          </button>
          <button 
            className={`filter-btn ${filterTab === 'admin' ? 'active' : ''}`}
            onClick={() => setFilterTab('admin')}
          >
            {t('Quản trị viên')} ({counts.admin})
          </button>
        </div>

        {/* Ô Tìm kiếm nhanh */}
        <div className="ai-search-box">
          <FiSearch className="ai-search-icon" />
          <input
            type="text"
            aria-label={t('Tìm kiếm người dùng')}
            placeholder={t('Tìm theo tên, email hoặc tên đăng nhập...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              aria-label={t('Xóa nội dung tìm kiếm')}
              onClick={() => setSearchTerm('')}
              className="ai-search-clear"
            >
              <FiX />
            </button>
          )}
        </div>
      </div>

      {/* 4. BULK ACTION BUTTONS (Đúng theo mẫu screenshot) */}
      <div className="bulk-actions mb-4 flex gap-3 flex-wrap items-center">
        <button 
          type="button"
          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          onClick={() => handleBulkReset(3, t('Học viên').toLowerCase())}
        >
          <FiRefreshCw className="text-xs" /> {t('Đặt lại lượt hỏi của tất cả học viên')}
        </button>
        <button 
          type="button"
          className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          onClick={() => handleBulkReset(2, t('Giảng viên').toLowerCase())}
        >
          <FiRefreshCw className="text-xs" /> {t('Đặt lại lượt hỏi của tất cả giảng viên')}
        </button>
        <button 
          type="button"
          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          onClick={handleExportCsv}
        >
          <FiDownload className="text-xs" /> {t('Xuất báo cáo CSV')}
        </button>
        <button 
          type="button"
          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
          onClick={() => fetchQuotaData(true)}
          disabled={refreshing}
        >
          <FiRefreshCw className={`text-xs ${refreshing ? 'animate-spin' : ''}`} /> {t('Đồng bộ dữ liệu')}
        </button>
      </div>

      {/* 5. MAIN DATA TABLE (Đúng theo mẫu screenshot) */}
      {loading ? (
        <div className="text-center py-10">
          <FiRefreshCw className="animate-spin h-8 w-8 text-indigo-600 mx-auto" aria-hidden="true" />
          <p className="text-slate-500 mt-4 text-sm">{t('Đang tải dữ liệu hạn mức AI...')}</p>
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <FiAlertTriangle className="h-8 w-8 text-red-500 mx-auto" aria-hidden="true" />
          <p className="text-red-500 mt-4 text-sm">{t(error)}</p>
          <button 
            type="button" 
            className="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium cursor-pointer"
            onClick={() => fetchQuotaData()}
          >
            {t('Thử lại')}
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th>{t('Tên hiển thị')}</th>
                <th>{t('Email / Tên đăng nhập')}</th>
                <th>{t('Vai trò')}</th>
                <th>{t('Token mô hình đã dùng')}</th>
                <th>{t('Câu hỏi / hạn mức (hôm nay)')}</th>
                <th>{t('Còn lại / đặt lại')}</th>
                <th style={{ textAlign: 'center' }}>{t('Hành động')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    {t('Không có người dùng nào khớp với bộ lọc.')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const pct = user.question_usage_percentage || 0;
                  const isUnlimited = Boolean(user.question_quota_unlimited);
                  const isExhausted = pct >= 100;
                  const isCritical = pct >= 80 && pct < 100;
                  const isWarning = pct >= 50 && pct < 80;

                  return (
                    <tr key={user.user_id}>
                      {/* ID */}
                      <td className="font-mono text-slate-400 text-xs">
                        #{user.user_id}
                      </td>

                      {/* Tên hiển thị */}
                      <td>
                        <div className="font-semibold text-slate-100">
                          {user.full_name || user.username}
                        </div>
                      </td>

                      {/* Email / Username */}
                      <td>
                        <div className="text-slate-200 text-sm font-medium">{user.email}</div>
                        <div className="text-xs text-slate-400 font-mono">@{user.username}</div>
                      </td>

                      {/* Vai trò */}
                      <td>
                        <span className={`role-badge role-${user.role_id === 1 ? 'admin' : user.role_id === 2 ? 'instructor' : 'student'}`}>
                          {user.role_id === 1
                            ? t('Quản trị viên hệ thống')
                            : user.role_id === 2
                              ? t('Giảng viên hệ thống')
                              : t('Học viên hệ thống')}
                        </span>
                      </td>

                      {/* Token mô hình đã tiêu thụ, không phải hạn mức lượt hỏi */}
                      <td>
                        <div className="font-mono font-bold text-sm text-slate-200">
                          {numberFormatter.format(user.used_tokens || 0)}
                        </div>
                        <div className="text-[11px] text-slate-500">{t('token mô hình')}</div>
                      </td>

                      {/* Lượt hỏi theo role */}
                      <td>
                        {isUnlimited ? (
                          <span className="ai-unlimited-badge">{t('Không giới hạn')}</span>
                        ) : (
                          <div className="ai-quota-bar-cell">
                            <div className="flex justify-between items-center text-xs font-mono mb-1">
                              <span className="font-bold text-slate-200">
                                {numberFormatter.format(user.used_questions_24h || 0)} / {numberFormatter.format(user.question_limit_24h || 0)}
                              </span>
                              <span className={`ai-pct-pill ${isExhausted ? 'red' : isCritical ? 'orange' : isWarning ? 'yellow' : 'blue'}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className="ai-table-progress-track">
                              <div
                                className={`ai-table-progress-fill ${isExhausted ? 'red' : isCritical ? 'orange' : isWarning ? 'yellow' : 'blue'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Số câu còn lại và thời điểm mở lại */}
                      <td>
                        {isUnlimited ? (
                          <span className="font-semibold text-emerald-400">{t('Không giới hạn')}</span>
                        ) : (
                          <div>
                            <div className={`font-mono font-bold text-sm ${user.questions_remaining_24h <= 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                              {t('{{count}} câu còn lại', {
                                count: numberFormatter.format(user.questions_remaining_24h || 0)
                              })}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {user.question_reset_at
                                ? t('Đặt lại lúc {{time}}', {
                                  time: dateTimeFormatter.format(new Date(user.question_reset_at))
                                })
                                : t('Hạn mức tự đặt lại lúc 00:00 mỗi ngày.')}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Hành động (Nút icon vuông chuẩn screenshot) */}
                      <td>
                        <div className="action-buttons justify-center">
                          {/* Nút Reset Token */}
                          <button
                            type="button"
                            className="btn-action"
                            title={t('Đặt lại lượt hỏi hôm nay về 0')}
                            onClick={() => handleResetToken(user)}
                          >
                            <FiRefreshCw className="text-xs text-emerald-400" />
                          </button>

                          {/* Nút Xem lịch sử prompt */}
                          <button
                            type="button"
                            className="btn-action"
                            title={t('Xem câu hỏi AI gần đây')}
                            onClick={() => handleOpenHistoryModal(user)}
                          >
                            <FiMessageSquare className="text-xs text-purple-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. MODAL: XEM LỊCH SỬ PROMPT AI CỦA USER */}
      {historyModalOpen && targetUserHistory && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box wide">
            <div className="admin-modal-header">
              <div className="flex items-center gap-2">
                <FiMessageSquare className="text-purple-400" />
                <h3>
                  {t('Lịch sử câu hỏi AI: {{name}}', {
                    name: targetUserHistory.full_name || targetUserHistory.username
                  })}
                </h3>
              </div>
              <button 
                type="button" 
                className="admin-modal-close"
                aria-label={t('Đóng hộp thoại')}
                onClick={() => setHistoryModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body max-h-96 overflow-y-auto">
              {userAuditLogs.length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-xs">
                  {t('Chưa có câu hỏi AI nào được ghi nhận gần đây cho học viên này.')}
                </p>
              ) : (
                <div className="audit-prompts-list">
                  {userAuditLogs.map((log) => (
                    <div key={log.log_id} className="audit-prompt-item">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-semibold text-blue-400">
                          {log.lesson_title
                            ? t('Bài học: {{title}}', { title: log.lesson_title })
                            : t('Trợ lý AI toàn hệ thống')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleString(locale)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 m-0">"{log.prompt_content}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setHistoryModalOpen(false)}
              >
                {t('Đóng')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIQuotaUsageBoard;
