import React from 'react';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiX
} from 'react-icons/fi';
import './Toast.css';

const TOAST_STYLES = {
  success: {
    container: 'bg-emerald-500',
    Icon: FiCheckCircle
  },
  error: {
    container: 'bg-red-500',
    Icon: FiAlertCircle
  },
  warning: {
    container: 'bg-friendly-orange',
    Icon: FiAlertTriangle
  },
  info: {
    container: 'bg-smart-indigo',
    Icon: FiInfo
  }
};

const ToastItem = ({ toast, onDismiss }) => {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = style.Icon;
  const isAssertive = toast.type === 'error' || toast.type === 'warning';

  return (
    <div
      className={`toast-enter pointer-events-auto flex w-full items-start gap-3 overflow-hidden rounded-xl px-4 py-3 text-white shadow-lg ${style.container}`}
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon className="mt-0.5 shrink-0 text-xl" aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-mr-2 -mt-2 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white/80 outline-none hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/90"
        aria-label="Đóng thông báo"
      >
        <FiX className="text-lg" aria-hidden="true" />
      </button>
    </div>
  );
};

const ToastViewport = ({ toasts, onDismiss }) => (
  <div
    className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[10000] flex flex-col items-end gap-3 sm:left-auto sm:right-6 sm:top-6 sm:w-[min(24rem,calc(100vw-3rem))]"
    aria-label="Thông báo"
  >
    {[...toasts].reverse().map((toast) => (
      <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
);

export default ToastViewport;
