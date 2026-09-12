import { useEffect, useRef, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';

const loadPwaRegister = () => import('virtual:pwa-register');

const PWAUpdatePrompt = ({
  registrationEnabled = import.meta.env.PROD,
  loadRegisterModule = loadPwaRegister,
}) => {
  const { t } = useLanguage();
  const updateServiceWorkerRef = useRef(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);

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

  if (!needsRefresh) return null;

  return (
    <aside
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[11000] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[min(28rem,calc(100vw-3rem))]"
      role="status"
      aria-live="polite"
      aria-labelledby="pwa-update-title"
    >
      <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-[var(--text-color)] shadow-[0_12px_36px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-smart-indigo text-white">
            <FiRefreshCw className={isUpdating ? 'animate-spin' : ''} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 id="pwa-update-title" className="text-base font-bold leading-6">
              {t('Có phiên bản mới')}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
              {updateError
                ? t('Không thể cập nhật ứng dụng. Bạn có thể tiếp tục học và thử lại sau.')
                : t('Bản cập nhật đã sẵn sàng. Hãy cập nhật sau khi bạn đã lưu bài làm hoặc nội dung đang nhập.')}
            </p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--text-light)] transition-colors hover:bg-slate-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smart-indigo focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setNeedsRefresh(false)}
                disabled={isUpdating}
              >
                {t('Để sau')}
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-smart-indigo px-4 text-sm font-semibold text-white transition-colors hover:bg-smart-indigo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smart-indigo focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
                onClick={handleUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? t('Đang cập nhật ứng dụng...') : t('Cập nhật ứng dụng')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default PWAUpdatePrompt;
