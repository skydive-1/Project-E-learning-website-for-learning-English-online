import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  FiX
} from 'react-icons/fi';

import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { 
  getAiQuotaAnalytics, 
  resetUserAiToken, 
  resetBulkAiTokens 
} from '../services/adminAnalytics.service';
import RagIncidentAlertModal from './RagIncidentAlertModal';
import GeminiUsageTrendChart from './GeminiUsageTrendChart';
import { buildAiQuotaCsv, downloadCsvReport } from '../utils/aiQuotaCsv';
import '../styles/ai-quota-board.scss';

const AIQuotaUsageBoard = ({ onOpenRateLimits }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const targetUserId = Number(searchParams.get('userId')) || null;
  const targetIncidentId = Number(searchParams.get('incidentId')) || null;
  const deepLinkHandledRef = useRef(false);
  const showToast = useToast();
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
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
  const [focusedUserId, setFocusedUserId] = useState(null);

  // State Modal xem lịch sử tương tác AI
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [targetUserHistory, setTargetUserHistory] = useState(null);
  const [dismissedIncidentIds, setDismissedIncidentIds] = useState([]);

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

  useEffect(() => {
    const incidentPoller = window.setInterval(() => fetchQuotaData(true), 30000);
    return () => window.clearInterval(incidentPoller);
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
      showToast(err.response?.data?.message || t('Không thể đặt lại lượt hỏi. Vui lòng thử lại.'), 'error');
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

    const csvContent = buildAiQuotaCsv(dashboardData.users, t);
    downloadCsvReport(csvContent, `ai_quota_usage_report_${new Date().toISOString().slice(0, 10)}.csv`);
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

  useEffect(() => {
    if (!targetUserId || deepLinkHandledRef.current || !allUsers.some((user) => Number(user.user_id) === targetUserId)) {
      return undefined;
    }

    deepLinkHandledRef.current = true;
    setFilterTab('all');
    setSearchTerm('');
    setFocusedUserId(targetUserId);

    const scrollTimer = window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(`ai-quota-user-${targetUserId}`)?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    }, 80);
    const clearTimer = window.setTimeout(() => setFocusedUserId(null), 6000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [allUsers, targetUserId]);

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
  const totalUsed = Number(summary.total_model_tokens_period ?? summary.total_used_tokens ?? 0);
  const backfilledTokens = Number(summary.backfilled_tokens_period || 0);
  const historicalTokensExcludedFromCost = Number(summary.historical_tokens_excluded_from_cost || 0);

  // Lọc lịch sử câu hỏi của user đang chọn
  const userAuditLogs = useMemo(() => {
    if (!targetUserHistory || !dashboardData?.recentAiLogs) return [];
    return dashboardData.recentAiLogs.filter(l => l.user_id === targetUserHistory.user_id);
  }, [targetUserHistory, dashboardData?.recentAiLogs]);

  const visibleRagIncident = useMemo(() => (
    (targetIncidentId
      ? (dashboardData?.ragIncidents || []).find((incident) => Number(incident.incidentId) === targetIncidentId)
      : null
    ) || (dashboardData?.ragIncidents || []).find((incident) => (
      String(incident.purpose || '').startsWith('rag_')
      && !dismissedIncidentIds.includes(incident.incidentId)
    )) || null
  ), [dashboardData?.ragIncidents, dismissedIncidentIds, targetIncidentId]);

  const dismissRagIncident = useCallback(() => {
    if (!visibleRagIncident) return;
    setDismissedIncidentIds((current) => [...new Set([...current, visibleRagIncident.incidentId])]);
  }, [visibleRagIncident]);

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
            {backfilledTokens > 0
              ? t('Bao gồm {{tokens}} token lịch sử tổng hợp từ Google AI Studio; không gán cho người dùng.', {
                  tokens: numberFormatter.format(backfilledTokens)
                })
              : t('Token mô hình chỉ dùng để đo mức tiêu thụ, không phải hạn mức câu hỏi.')}
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
            {historicalTokensExcludedFromCost > 0
              ? t('Chi phí không gồm {{tokens}} token backfill vì Google không cung cấp chi phí theo request.', {
                  tokens: numberFormatter.format(historicalTokensExcludedFromCost)
                })
              : <>{t('Mô hình:')} <strong>Google Gemini 3.7 Flash</strong> ($0.075 / 1M)</>}
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

      {/* 2. GOOGLE-LIKE GEMINI USAGE TREND WITH CLOUD MONITORING FALLBACK */}
      <GeminiUsageTrendChart initialTrends={dashboardData?.trends || []} />

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
                <th>{t('Usage Limit')}</th>
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
                  // 1. Hạn mức sử dụng Token mô hình (Usage Limit) - hiển thị phần trăm (%)
                  const tokenLimit = user.max_tokens || 6000;
                  const tokenPct = user.usage_percentage !== undefined && user.usage_percentage !== null
                    ? user.usage_percentage
                    : Math.min(100, Math.round(((user.used_tokens || 0) / tokenLimit) * 100));

                  // 2. Hạn mức câu hỏi trong ngày: Tài khoản Admin hiển thị bình thường giống học viên và giảng viên
                  const isAdmin = user.role_id === 1;
                  const isUnlimited = Boolean(user.question_quota_unlimited) && !isAdmin;
                  const adminDefaultLimit = 50;
                  const usedQuestions = user.used_questions_24h || 0;
                  const questionLimit = isUnlimited
                    ? null
                    : (user.question_limit_24h || (isAdmin ? adminDefaultLimit : (user.role_id === 2 ? 20 : 10)));
                  const remainingQuestions = isUnlimited
                    ? null
                    : (user.questions_remaining_24h !== null && user.questions_remaining_24h !== undefined
                        ? user.questions_remaining_24h
                        : Math.max(0, questionLimit - usedQuestions));
                  const pct = isUnlimited
                    ? 0
                    : (user.question_usage_percentage !== undefined && user.question_usage_percentage !== null && !isAdmin
                        ? user.question_usage_percentage
                        : Math.min(100, Math.round((usedQuestions / questionLimit) * 100)));

                  const isExhausted = !isUnlimited && pct >= 100;
                  const isCritical = !isUnlimited && pct >= 80 && pct < 100;
                  const isWarning = !isUnlimited && pct >= 50 && pct < 80;

                  return (
                    <tr
                      key={user.user_id}
                      id={`ai-quota-user-${user.user_id}`}
                      className={focusedUserId === Number(user.user_id) ? 'alert-target-row' : ''}
                    >
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

                      {/* Usage Limit: Hiển thị phần trăm (%) kèm số lượng token đã dùng */}
                      <td>
                        <div className="font-mono font-bold text-sm text-slate-200">
                          {tokenPct}%
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {numberFormatter.format(user.used_tokens || 0)} / {numberFormatter.format(tokenLimit)}
                        </div>
                      </td>

                      {/* Lượt hỏi theo role - Admin hiển thị bình thường giống học viên và giảng viên */}
                      <td>
                        {isUnlimited ? (
                          <span className="ai-unlimited-badge">{t('Không giới hạn')}</span>
                        ) : (
                          <div className="ai-quota-bar-cell">
                            <div className="flex justify-between items-center text-xs font-mono mb-1">
                              <span className="font-bold text-slate-200">
                                {numberFormatter.format(usedQuestions)} / {numberFormatter.format(questionLimit)}
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
                            <div className={`font-mono font-bold text-sm ${remainingQuestions <= 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                              {t('{{count}} câu còn lại', {
                                count: numberFormatter.format(remainingQuestions)
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

      <RagIncidentAlertModal
        incident={visibleRagIncident}
        onClose={dismissRagIncident}
        onOpenRateLimits={onOpenRateLimits}
      />
    </div>
  );
};

export default AIQuotaUsageBoard;
