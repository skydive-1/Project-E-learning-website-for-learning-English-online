import React, { useState, useEffect } from 'react';
import { FiWifiOff, FiCheckCircle, FiX } from 'react-icons/fi';
import useNetworkStatus from '../../hooks/useNetworkStatus';

/**
 * OfflineIndicator Component (PWA Offline Status Banner)
 * - Tự động hiển thị khi người dùng bị mất kết nối Internet
 * - Thông báo người dùng đang sử dụng Offline Shell đã được lưu cache
 * - Tự động ẩn đi khi kết nối mạng được khôi phục
 */
const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false);
      setShowRestored(false);
    } else if (wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showRestored) return null;
  if (!isOnline && isDismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 pointer-events-auto">
      {!isOnline ? (
        <div className="bg-amber-600 dark:bg-amber-700 text-white px-4 py-2 text-xs md:text-sm font-medium shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <FiWifiOff className="text-base shrink-0 animate-pulse" />
            <span className="flex-1">
              <strong>Chế độ Ngoại tuyến (Offline):</strong> Bạn đang mất kết nối Internet. Ứng dụng vẫn có thể duyệt giao diện và tài nguyên đã tải, nhưng tính năng AI và Video trực tuyến sẽ tạm dừng.
            </span>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:bg-amber-800 rounded transition-colors text-white/80 hover:text-white"
              title="Đóng thông báo"
            >
              <FiX className="text-sm" />
            </button>
          </div>
        </div>
      ) : showRestored ? (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs md:text-sm font-medium shadow-md flex items-center justify-center gap-2 animate-fade-in">
          <FiCheckCircle className="text-base shrink-0" />
          <span>Đã khôi phục kết nối Internet thành công!</span>
        </div>
      ) : null}
    </div>
  );
};

export default OfflineIndicator;
