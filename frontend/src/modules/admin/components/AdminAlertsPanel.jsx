import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiBell, 
  FiAlertTriangle, 
  FiCheck, 
  FiX, 
  FiRefreshCw,
  FiExternalLink,
  FiInfo,
  FiServer,
  FiActivity,
  FiUser,
  FiUploadCloud,
  FiCreditCard
} from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getGeminiRateLimitStatus, getGeminiUsageTrends } from '../services/adminAnalytics.service';

/**
 * AdminAlertsPanel - Real-time alerts for admin dashboard
 * Shows AI quota issues, failed uploads, payment issues, etc.
 */
const AdminAlertsPanel = ({ className = '' }) => {
  const { user } = useAuth();
  const showToast = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch alerts from backend
  const fetchAlerts = useCallback(async () => {
    if (!user?.userId) return;
    
    try {
      setLoading(true);
      // In a real implementation, this would call an admin alerts endpoint
      // For now, we'll simulate with AI quota and rate limit checks
      const [rateLimitStatus, usageTrends] = await Promise.allSettled([
        getGeminiRateLimitStatus({ fresh: true }),
        getGeminiUsageTrends({ range: '1d', fresh: true })
      ]);

      const newAlerts = [];

      // Check rate limit discrepancies
      if (rateLimitStatus.status === 'fulfilled' && rateLimitStatus.value) {
        const data = rateLimitStatus.value;
        if (data.discrepancies && data.discrepancies.length > 0) {
          data.discrepancies.forEach(disc => {
            newAlerts.push({
              id: `rate-limit-${disc.dimension}`,
              type: 'rate_limit',
              severity: 'high',
              title: `Rate Limit Discrepancy: ${disc.dimension.toUpperCase()}`,
              message: `Configured cap (${disc.configured_cap}) may not match actual provider limit. Observed usage: ${disc.observed_usage}`,
              timestamp: disc.detected_at || new Date().toISOString(),
              actionUrl: '/admin/dashboard?tab=ai-quota',
              actionLabel: 'View Settings'
            });
          });
        }
      }

      // Check for AI quota exhaustion
      if (usageTrends.status === 'fulfilled' && usageTrends.value) {
        const trends = usageTrends.value;
        // Check if recent usage is near limits
        if (trends.daily && trends.daily.length > 0) {
          const latest = trends.daily[trends.daily.length - 1];
          if (latest.total_tokens > 80000) { // Near 100k limit
            newAlerts.push({
              id: 'ai-quota-near-limit',
              type: 'quota_warning',
              severity: 'medium',
              title: 'AI Quota Near Daily Limit',
              message: `Daily token usage at ${(latest.total_tokens / 1000).toFixed(1)}k tokens. Approaching 100k daily limit.`,
              timestamp: new Date().toISOString(),
              actionUrl: '/admin/dashboard?tab=ai-quota',
              actionLabel: 'Manage Quota'
            });
          }
        }
      }

      // Add simulated alerts for demo purposes
      newAlerts.push(
        {
          id: 'failed-upload-1',
          type: 'failed_upload',
          severity: 'high',
          title: 'Video Upload Failed',
          message: 'Course "English Grammar Basics" - Lesson 3 video upload failed after 3 retries. Storage quota may be exceeded.',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          actionUrl: '/instructor/dashboard?tab=courses',
          actionLabel: 'Retry Upload'
        },
        {
          id: 'payment-failed-1',
          type: 'payment_failed',
          severity: 'medium',
          title: 'Subscription Payment Failed',
          message: 'User nguyen.van.a@example.com - Monthly subscription payment declined. Card expired.',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          actionUrl: '/admin/dashboard?tab=users',
          actionLabel: 'View User'
        }
      );

      setAlerts(newAlerts);
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setIsConnected(false);
    }
  }, [user?.userId]);

  // Poll for new alerts every 60 seconds
  useEffect(() => {
    if (!user?.userId) return;
    
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [user?.userId, fetchAlerts]);

  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const dismissAllAlerts = () => {
    setAlerts([]);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200';
      case 'medium': return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200';
      case 'low': return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200';
      default: return 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return <FiAlertTriangle className="text-red-500" />;
      case 'medium': return <FiAlertTriangle className="text-amber-500" />;
      case 'low': return <FiInfo className="text-blue-500" />;
      default: return <FiInfo className="text-slate-500" />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'rate_limit': return <FiActivity className="text-purple-500" />;
      case 'quota_warning': return <FiCpu className="text-orange-500" />;
      case 'failed_upload': return <FiUploadCloud className="text-red-500" />;
      case 'payment_failed': return <FiCreditCard className="text-red-500" />;
      case 'security': return <FiShield className="text-red-500" />;
      case 'server': return <FiServer className="text-blue-500" />;
      case 'user': return <FiUser className="text-blue-500" />;
      default: return <FiAlertTriangle className="text-slate-500" />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  };

  if (!user?.userId) return null;

  return (
    <div className={`admin-alerts-panel ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <FiBell className="text-indigo-500" size={24} />
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bảng Cảnh Báo Thời Gian Thực</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cập nhật tự động mỗi 60 giây
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' 
              : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
          }`}>
            {isConnected ? (
              <>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Đang kết nối
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                Đã ngắt kết nối
              </>
            )}
          </span>
          {alerts.length > 0 && (
            <button
              onClick={dismissAllAlerts}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      {loading && alerts.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <FiRefreshCw className="animate-spin mr-2" />
          Đang tải cảnh báo...
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FiCheck className="text-emerald-500 text-4xl mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Không có cảnh báo nào</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Hệ thống hoạt động bình thường
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex gap-3 p-4 rounded-2xl border ${getSeverityColor(alert.severity)} animate-fade-in`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getSeverityIcon(alert.severity)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getTypeIcon(alert.type)}
                    <h4 className="font-bold text-sm truncate">{alert.title}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      alert.severity === 'high' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300' :
                      alert.severity === 'medium' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' :
                      'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {alert.severity === 'high' ? 'CAO' : alert.severity === 'medium' ? 'TB' : 'THẤP'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                    {formatTime(alert.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{alert.message}</p>
                {alert.actionUrl && alert.actionLabel && (
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={alert.actionUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
                    >
                      {alert.actionLabel}
                      <FiExternalLink size={12} />
                    </a>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Xóa cảnh báo"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang làm mới...' : 'Làm mới cảnh báo'}
        </button>
      </div>
    </div>
  );
};

export default AdminAlertsPanel;