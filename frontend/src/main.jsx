import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Tự động đăng ký và quản lý Service Worker cho PWA Offline Shell (khi chạy production)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('[PWA] Bản cập nhật mới đã sẵn sàng.');
        },
        onOfflineReady() {
          console.log('[PWA] Ứng dụng đã sẵn sàng hoạt động ngoại tuyến (Offline Shell).');
        }
      });
    })
    .catch(() => {});
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
