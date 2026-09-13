import { useEffect, useRef, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';
import { useOptionalAuth } from '../../context/AuthContext';

const loadPwaRegister = () => import('virtual:pwa-register');

const isUserAdmin = (u) => {
  if (!u) return false;
  const roleId = Number(u.roleId ?? u.role_id);
  return roleId === 1 || u.role === 'admin' || Boolean(u.is_super_admin);
};

const PWAUpdatePrompt = ({
  registrationEnabled = import.meta.env.PROD,
  loadRegisterModule = loadPwaRegister,
  user: propUser,
}) => {
  const { t } = useLanguage();
  const auth = useOptionalAuth();
  const activeUser = propUser !== undefined ? propUser : auth?.user;
  const isAdmin = isUserAdmin(activeUser);

  const updateServiceWorkerRef = useRef(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);

  // Animation states (60fps slide-in from left with Apple spring easing)
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!registrationEnabled || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let isMounted = true;

    loadRegisterModule()
      .then(({ registerSW }) => {
        if (!isMounted || typeof registerSW !== 'function') return;

        updateServiceWorkerRef.current = registerSW({
          immediate: true,
          onNeedRefresh() {
            if (!isMounted) return;
            setUpdateError(false);
            setNeedsRefresh(true);
          },
          onOfflineReady() {
            console.info('[PWA] Ứng dụng đã sẵn sàng hoạt động ngoại tuyến.');
          },
          onRegisterError(error) {
            console.warn('[PWA] Không thể đăng ký service worker:', error);
          },
        });
      })
      .catch((error) => {
        console.warn('[PWA] Không thể tải module đăng ký service worker:', error);
      });

    return () => {
      isMounted = false;
      updateServiceWorkerRef.current = null;
    };
  }, [loadRegisterModule, registrationEnabled]);

  // Kích hoạt animation slide-in mượt mà từ bên trái sang khi có bản cập nhật mới
  useEffect(() => {
    if (needsRefresh && isAdmin) {
      let frame1, frame2;
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          setIsEntered(true);
        });
      });
      return () => {
        if (frame1) cancelAnimationFrame(frame1);
        if (frame2) cancelAnimationFrame(frame2);
      };
    } else {
      setIsEntered(false);
    }
  }, [needsRefresh, isAdmin]);

  const handleUpdate = async () => {
    if (isUpdating || typeof updateServiceWorkerRef.current !== 'function') return;

    setIsUpdating(true);
    setUpdateError(false);

    try {
      await updateServiceWorkerRef.current(true);
    } catch (error) {
      console.warn('[PWA] Không thể kích hoạt bản cập nhật:', error);
      setIsUpdating(false);
      setUpdateError(true);
    }
  };

  // Animation slide-out sang trái khi Admin ấn "Để sau"
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setNeedsRefresh(false);
      setIsExiting(false);
    }, 450);
  };

  // Chỉ hiển thị trên role Admin (học viên role 3 và giảng viên role 2 hoàn toàn không hiện)
  if (!isAdmin || !needsRefresh) return null;

  return (
    <aside
      className={`fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[11000] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[min(28rem,calc(100vw-3rem))] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        isEntered && !isExiting
          ? 'translate-x-0 opacity-100 scale-100'
          : '-translate-x-[calc(100%+2.5rem)] opacity-0 scale-95 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
      aria-labelledby="pwa-update-title"
    >
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-[var(--text-color)] shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-2xl transition-colors dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-[0_25px_60px_rgba(0,0,0,0.55)] sm:p-5">
        {/* Thanh accent màu nổi bật bên trái */}
        <div
          className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500 rounded-l-2xl"
          aria-hidden="true"
        />

        <div className="flex items-start gap-3.5 pl-1">
          {/* Icon hiệu ứng quay / pulse */}
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]">
            <FiRefreshCw className={`size-5 ${isUpdating ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="absolute -top-1 -right-1 flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-blue-500"></span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id="pwa-update-title" className="text-base font-bold leading-6 text-slate-900 dark:text-white">
                {t('Có phiên bản mới')}
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Admin
              </span>
            </div>

            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">
              {updateError
                ? t('Không thể cập nhật ứng dụng. Bạn có thể tiếp tục học và thử lại sau.')
                : t('Bản cập nhật đã sẵn sàng. Hãy cập nhật sau khi bạn đã lưu bài làm hoặc nội dung đang nhập.')}
            </p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-500/10 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smart-indigo dark:text-slate-400 dark:hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleDismiss}
                disabled={isUpdating}
              >
                {t('Để sau')}
              </button>
              <button
                type="button"
                className="min-h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-md hover:shadow-blue-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smart-indigo focus-visible:ring-offset-2 active:scale-95 disabled:cursor-wait disabled:opacity-70"
                onClick={handleUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? t('Đang cập nhật...') : t('Cập nhật')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default PWAUpdatePrompt;
