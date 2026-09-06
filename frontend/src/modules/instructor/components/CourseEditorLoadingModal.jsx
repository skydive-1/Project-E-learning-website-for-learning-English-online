import React, { useEffect, useState } from 'react';
import { FiLayers, FiSave, FiZap, FiCheckCircle, FiLoader } from 'react-icons/fi';

const MODE_CONFIG = {
  fetching: {
    badge: 'Đồng bộ đám mây',
    title: 'Đang tải dữ liệu khóa học',
    subtitle: 'Đang đồng bộ cấu trúc chương mục, video bài giảng và tài nguyên số...',
    colorClass: 'indigo',
    accentColor: '#6366f1',
    accentBg: 'rgba(99, 102, 241, 0.15)',
    icon: FiLayers,
    steps: [
      'Kết nối máy chủ học viện...',
      'Đọc cấu trúc bài học & Quizzes...',
      'Khởi tạo không gian soạn thảo...'
    ]
  },
  saving_draft: {
    badge: 'Lưu nháp an toàn',
    title: 'Đang lưu bản nháp khóa học',
    subtitle: 'Lưu trữ an toàn các thay đổi, bài giảng và tài liệu học tập...',
    colorClass: 'emerald',
    accentColor: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.15)',
    icon: FiSave,
    steps: [
      'Kiểm tra cấu trúc bài giảng...',
      'Đồng bộ bản nháp lên cơ sở dữ liệu...',
      'Hoàn tất lưu trữ an toàn...'
    ]
  },
  publishing: {
    badge: 'Kích hoạt khóa học',
    title: 'Đang xuất bản khóa học',
    subtitle: 'Kiểm định chất lượng, xác thực media và kích hoạt khóa học...',
    colorClass: 'violet',
    accentColor: '#8b5cf6',
    accentBg: 'rgba(139, 92, 246, 0.18)',
    icon: FiZap,
    steps: [
      'Kiểm tra chuẩn bản quyền giảng viên...',
      'Xác thực tệp video & PDF Cloudflare R2...',
      'Kích hoạt khóa học trên hệ thống...'
    ]
  },
  default: {
    badge: 'Đang xử lý',
    title: 'Đang lưu thông tin khóa học',
    subtitle: 'Vui lòng chờ trong giây lát trong khi hệ thống xử lý...',
    colorClass: 'indigo',
    accentColor: '#3b82f6',
    accentBg: 'rgba(59, 130, 246, 0.15)',
    icon: FiLoader,
    steps: [
      'Đang gửi yêu cầu tới máy chủ...',
      'Đang xử lý dữ liệu...',
      'Sắp hoàn tất...'
    ]
  }
};

export default function CourseEditorLoadingModal({
  isOpen,
  mode = 'fetching',
  customTitle,
  customSubtitle
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const activeMode = MODE_CONFIG[mode] || MODE_CONFIG.default;
  const IconComponent = activeMode.icon;

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIdx(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIdx((prev) => (prev + 1) % activeMode.steps.length);
    }, 1400);

    return () => clearInterval(interval);
  }, [isOpen, activeMode.steps.length]);

  if (!isOpen) return null;

  return (
    <div
      className="course-editor-loading-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={customTitle || activeMode.title}
    >
      <div className={`course-editor-loading-card ${activeMode.colorClass}`}>
        {/* Ambient background glow */}
        <div
          className="card-ambient-glow"
          style={{ background: activeMode.accentColor }}
        />

        {/* Top phase status badge */}
        <div className="loading-badge-pill">
          <span
            className="pulse-dot"
            style={{ background: activeMode.accentColor }}
          />
          <span>{activeMode.badge}</span>
        </div>

        {/* Impeccable Dual-Ring Orbital Spinner */}
        <div className="orbital-spinner-container">
          {/* Outer rotating gradient ring */}
          <div
            className="outer-orbital-ring"
            style={{
              borderColor: `${activeMode.accentColor} transparent transparent ${activeMode.accentColor}`
            }}
          />
          {/* Inner counter-rotating dashed ring */}
          <div className="inner-counter-ring" />
          {/* Center icon aura */}
          <div
            className="center-icon-core"
            style={{ background: activeMode.accentBg, color: activeMode.accentColor }}
          >
            <IconComponent className="center-icon" />
          </div>
        </div>

        {/* Headings */}
        <h3 className="loading-title">{customTitle || activeMode.title}</h3>
        <p className="loading-subtitle">{customSubtitle || activeMode.subtitle}</p>

        {/* Sleek indeterminate progress bar */}
        <div className="loading-progress-track">
          <div
            className="loading-progress-bar"
            style={{
              background: `linear-gradient(90deg, transparent, ${activeMode.accentColor}, #38bdf8, transparent)`
            }}
          />
        </div>

        {/* Animated dynamic step ticker */}
        <div className="loading-step-ticker">
          <span
            className="step-dot"
            style={{ background: activeMode.accentColor }}
          />
          <span className="step-text" key={currentStepIdx}>
            {activeMode.steps[currentStepIdx]}
          </span>
        </div>
      </div>
    </div>
  );
}
