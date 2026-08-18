import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerSW } from 'virtual:pwa-register';

// Tự động đăng ký và quản lý Service Worker cho PWA Offline Shell
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Bản cập nhật mới đã sẵn sàng.');
  },
  onOfflineReady() {
    console.log('[PWA] Ứng dụng đã sẵn sàng hoạt động ngoại tuyến (Offline Shell).');
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
