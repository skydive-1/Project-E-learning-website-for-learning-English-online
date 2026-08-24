import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import ToastViewport from '../components/common/Toast';

const DEFAULT_DURATION = 3500;
const VALID_TYPES = new Set(['success', 'error', 'warning', 'info']);
const noopShowToast = () => null;
const ToastContext = createContext(noopShowToast);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const nextIdRef = useRef(0);

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', options = {}) => {
    if (message === null || message === undefined || message === '') return null;

    const id = `toast-${Date.now()}-${nextIdRef.current++}`;
    const normalizedType = VALID_TYPES.has(type) ? type : 'info';
    const requestedDuration = Number(options?.duration);
    const duration = Number.isFinite(requestedDuration)
      ? Math.max(1000, requestedDuration)
      : DEFAULT_DURATION;

    setToasts((current) => [
      ...current,
      { id, message: String(message), type: normalizedType }
    ]);

    const timer = setTimeout(() => dismissToast(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
