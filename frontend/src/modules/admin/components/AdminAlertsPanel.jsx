import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiBell,
  FiAlertTriangle,
  FiCheck,
  FiRefreshCw,
  FiExternalLink,
  FiInfo,
  FiServer,
  FiActivity,
  FiCpu,
  FiShield,
  FiUser,
  FiUploadCloud,
  FiCreditCard,
  FiBookOpen,
  FiHelpCircle,
  FiWifi,
  FiWifiOff
} from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import {
  connectAdminAlertsStream,
  getAdminAlerts
} from '../services/adminAlerts.service';

const STATUS_STYLES = {
  live: {
    label: 'Kết nối trực tiếp',
    className: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
  },
  connecting: {
    label: 'Đang kết nối',
    className: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
  },
  fallback: {
    label: 'Tự làm mới',
    className: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
  },
  offline: {
    label: 'Mất kết nối',
    className: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
  }
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Không rõ thời gian';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60_000));
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
};

const AdminAlertsPanel = ({ className = '' }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [source, setSource] = useState('PostgreSQL và telemetry runtime của backend');
  const isLiveRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.alerts)) return;
    setAlerts(snapshot.alerts);
    setLastUpdatedAt(snapshot.generatedAt || new Date().toISOString());
    setSource(snapshot.source || 'PostgreSQL và telemetry runtime của backend');
    setError('');
    setLoading(false);
    hasLoadedRef.current = true;
  }, []);

  const fetchAlerts = useCallback(async ({ background = false } = {}) => {
    if (!user?.userId) return;

    if (!background) setRefreshing(true);
    if (!hasLoadedRef.current) setLoading(true);

    try {
      const snapshot = await getAdminAlerts({ fresh: !background });
      applySnapshot(snapshot);
      if (!isLiveRef.current) setConnectionStatus('fallback');
    } catch (fetchError) {
      console.error('Không thể tải cảnh báo Admin:', fetchError);
      setError(fetchError?.message || 'Không thể kết nối tới nguồn cảnh báo');
      if (!hasLoadedRef.current) setConnectionStatus('offline');
    } finally {
      setLoading(false);
      if (!background) setRefreshing(false);
    }
  }, [applySnapshot, user?.userId]);

  useEffect(() => {
    if (!user?.userId) return undefined;

    let disposed = false;
    let stream = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;
      isLiveRef.current = false;
      setConnectionStatus(hasLoadedRef.current ? 'fallback' : 'connecting');
      const delay = Math.min(30_000, 5_000 * (2 ** reconnectAttempts));
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectStream();
      }, delay);
    };

    const connectStream = () => {
      if (disposed) return;
      setConnectionStatus('connecting');

      stream = connectAdminAlertsStream({
        onSnapshot: applySnapshot,
        onStatus: (status) => {
          if (disposed || status !== 'live') return;
          reconnectAttempts = 0;
          isLiveRef.current = true;
          setConnectionStatus('live');
        },
        onStreamError: (streamError) => {
          if (disposed) return;
          setError(streamError?.message || 'Backend tạm thời không thể cập nhật cảnh báo');
        }
      });

      stream.done.catch((streamError) => {
        if (disposed || streamError?.name === 'AbortError') return;
        console.warn('Luồng cảnh báo Admin bị ngắt:', streamError);
        scheduleReconnect();
      });
    };

    fetchAlerts();
    connectStream();

    const fallbackInterval = setInterval(() => {
      if (!isLiveRef.current && document.visibilityState !== 'hidden') {
        fetchAlerts({ background: true });
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLiveRef.current) {
        fetchAlerts({ background: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      isLiveRef.current = false;
      stream?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallbackInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applySnapshot, fetchAlerts, user?.userId]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200';
      case 'medium': return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200';
      case 'low': return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200';
      default: return 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
    }
  };

  const getSeverityIcon = (severity) => {
    if (severity === 'high') return <FiAlertTriangle className="text-red-500" />;
    if (severity === 'medium') return <FiAlertTriangle className="text-amber-500" />;
    return <FiInfo className="text-blue-500" />;
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
      case 'course': return <FiBookOpen className="text-indigo-500" />;
      case 'quiz': return <FiHelpCircle className="text-violet-500" />;
      default: return <FiAlertTriangle className="text-slate-500" />;
    }
  };

  if (!user?.userId) return null;

  // Vẫn giữ kết nối SSE/polling ở nền nhưng không chiếm chỗ trên dashboard
  // khi backend đã không trả về cảnh báo nào. Nếu nguồn dữ liệu lỗi, bảng vẫn
  // xuất hiện để Admin biết trạng thái chưa thể được xác minh.
  if (alerts.length === 0 && !error) return null;

  const status = STATUS_STYLES[connectionStatus] || STATUS_STYLES.offline;

  return (
    <section className={`admin-alerts-panel ${className}`} aria-labelledby="admin-alerts-title">
      <div className="flex items-start justify-between gap-4 mb-4 pb-4">
        <div className="flex items-start gap-3">
          <FiBell className="text-indigo-500 mt-0.5" size={24} />
          <div>
            <h3 id="admin-alerts-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Cảnh báo vận hành
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {source} · SSE kiểm tra mỗi 15 giây, dự phòng 60 giây
            </p>
            {lastUpdatedAt && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Cập nhật lần cuối: {formatTime(lastUpdatedAt)}
              </p>
            )}
          </div>
        </div>

        <span className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
          {connectionStatus === 'live' ? <FiWifi size={13} /> : connectionStatus === 'offline' ? <FiWifiOff size={13} /> : (
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
          )}
          {status.label}
        </span>
      </div>

      {error && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200" role="alert">
          <span>{error}. Hệ thống sẽ tự thử kết nối lại.</span>
          <button type="button" onClick={() => fetchAlerts()} className="shrink-0 font-semibold underline underline-offset-2">
            Thử ngay
          </button>
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-500" role="status">
          <FiRefreshCw className="animate-spin mr-2" />
          Đang đọc cảnh báo từ backend...
        </div>
      ) : alerts.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FiCheck className="text-emerald-500 text-4xl mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Không phát hiện vấn đề cần xử lý</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Kết quả được tổng hợp từ dữ liệu vận hành thực tế của backend
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto" aria-live="polite">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className={`flex gap-3 p-4 rounded-2xl border ${getSeverityColor(alert.severity)} animate-fade-in`}
            >
              <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(alert.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getTypeIcon(alert.type)}
                    <h4 className="font-bold text-sm truncate">{alert.title}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      alert.severity === 'high'
                        ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                        : alert.severity === 'medium'
                          ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                          : 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {alert.severity === 'high' ? 'CAO' : alert.severity === 'medium' ? 'TB' : 'THẤP'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                    {formatTime(alert.timestamp)}
                  </span>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">{alert.message}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 break-all">Nguồn: {alert.source}</p>

                {alert.actionUrl && alert.actionLabel && (
                  <a
                    href={alert.actionUrl}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
                  >
                    {alert.actionLabel}
                    <FiExternalLink size={12} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4">
        <button
          type="button"
          onClick={() => fetchAlerts()}
          disabled={refreshing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors disabled:opacity-50"
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Đang đọc dữ liệu...' : 'Kiểm tra cảnh báo ngay'}
        </button>
      </div>
    </section>
  );
};

export default AdminAlertsPanel;
