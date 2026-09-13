import React, { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiHardDrive,
  FiLayers,
  FiLock,
  FiSave,
  FiZap
} from 'react-icons/fi';

const MODE_CONFIG = {
  fetching: {
    badge: 'Đồng bộ đám mây',
    title: 'Đang tải dữ liệu khóa học',
    subtitle: 'Đang đồng bộ cấu trúc chương mục, video bài giảng và tài nguyên...',
    steps: [
      { label: 'Kết nối máy chủ học viện...', icon: FiDatabase },
      { label: 'Đọc cấu trúc chương mục, video & Quizzes', icon: FiLayers },
      { label: 'Khởi tạo không gian soạn thảo giảng viên', icon: FiHardDrive }
    ]
  },
  saving_draft: {
    badge: 'Lưu nháp an toàn',
    title: 'Đang lưu bản nháp khóa học',
    subtitle: 'Lưu trữ an toàn các thay đổi, bài giảng và tài liệu học tập...',
    steps: [
      { label: 'Kiểm tra cấu trúc bài giảng...', icon: FiLayers },
      { label: 'Ghi nhận bản nháp vào PostgreSQL', icon: FiSave },
      { label: 'Đồng bộ trạng thái khóa học an toàn', icon: FiCheckCircle }
    ]
  },
  saving_changes: {
    badge: 'Cập nhật khóa học',
    title: 'Đang lưu thay đổi khóa học',
    subtitle: 'Đang ghi nhận nội dung giảng viên vừa chỉnh sửa và giữ khóa học ở trạng thái đã xuất bản...',
    steps: [
      { label: 'Kiểm tra cấu trúc khóa học...', icon: FiLayers },
      { label: 'Ghi nhận thay đổi vào PostgreSQL', icon: FiSave },
      { label: 'Đồng bộ nội dung khóa học đã xuất bản', icon: FiCheckCircle }
    ]
  },
  publishing: {
    badge: 'Kích hoạt khóa học',
    title: 'Đang xuất bản khóa học',
    subtitle: 'Kiểm định chất lượng, xác thực media và kích hoạt khóa học chính thức...',
    steps: [
      { label: 'Kiểm tra chuẩn bản quyền giảng viên...', icon: FiLock },
      { label: 'Kích hoạt đồng bộ RAG Ingestion (Pinecone)', icon: FiZap },
      { label: 'Kích hoạt khóa học chính thức trên hệ sinh thái', icon: FiCheckCircle }
    ]
  },
  processing_media: {
    badge: 'Xử lý video nền',
    title: 'Đang xử lý media bài giảng',
    subtitle: 'Lưu video nguồn lên Cloudflare R2, đóng gói DASH và xác minh tính toàn vẹn...',
    steps: [
      { label: 'Tải lên Cloudflare R2 (Multipart 64MiB/part)', icon: FiHardDrive },
      { label: 'Đóng gói luồng MPEG-DASH không mã hóa', icon: FiLayers },
      { label: 'Xác minh đầy đủ manifest, hình và tiếng', icon: FiCheckCircle }
    ]
  },
  default: {
    badge: 'Đang xử lý',
    title: 'Đang lưu thông tin khóa học',
    subtitle: 'Vui lòng chờ trong giây lát trong khi hệ thống hoàn tất xử lý...',
    steps: [
      { label: 'Gửi yêu cầu tới máy chủ dịch vụ', icon: FiDatabase },
      { label: 'Xử lý dữ liệu và xác thực cấu trúc', icon: FiLayers },
      { label: 'Đồng bộ kết quả lưu trữ an toàn', icon: FiCheckCircle }
    ]
  }
};

const formatElapsed = (deciseconds) => {
  const totalSeconds = deciseconds / 10;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  return `${Math.floor(totalSeconds / 60)}m ${(totalSeconds % 60).toFixed(1)}s`;
};

export default function CourseEditorLoadingModal({
  isOpen,
  mode = 'fetching',
  customTitle,
  customSubtitle,
  currentProgressPercent = null
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [deciseconds, setDeciseconds] = useState(0);

  const activeMode = MODE_CONFIG[mode] || MODE_CONFIG.default;

  // Step advancement timer (realistic step transitions)
  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIdx(0);
      setDeciseconds(0);
      return;
    }

    const timer = setInterval(() => {
      setDeciseconds((prev) => prev + 1);
    }, 100);

    const stepTimer = setInterval(() => {
      setCurrentStepIdx((prev) => (prev < activeMode.steps.length - 1 ? prev + 1 : prev));
    }, 1600);

    return () => {
      clearInterval(timer);
      clearInterval(stepTimer);
    };
  }, [isOpen, activeMode.steps.length]);

  if (!isOpen) return null;

  // Calculate progress percentage
  const pipelineProgress = currentProgressPercent !== null
    ? Math.min(100, Math.max(0, currentProgressPercent))
    : Math.round(((currentStepIdx + 1) / activeMode.steps.length) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-editor-loading-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none"
    >
      {/* BoardUI Dark Precision Modal Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl">
        
        {/* Header with Phase Badge & Elapsed Timer */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {activeMode.badge}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
            <FiClock className="size-3 text-slate-500" />
            <span>{formatElapsed(deciseconds)}</span>
          </div>
        </div>

        {/* Headings */}
        <div className="mt-4 text-left">
          <h3 id="course-editor-loading-title" className="text-base font-bold tracking-tight text-slate-100">
            {customTitle || activeMode.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {customSubtitle || activeMode.subtitle}
          </p>
        </div>

        {/* Technical Pipeline Stepper (No vague spinner) */}
        <div className="my-5 flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5">
          {activeMode.steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const isPending = idx > currentStepIdx;

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
                  isCurrent
                    ? 'border border-blue-500/30 bg-blue-500/10 font-semibold text-blue-300'
                    : isCompleted
                    ? 'text-slate-300'
                    : 'text-slate-600'
                }`}
              >
                {/* Step indicator dot / checkmark */}
                <div className="flex size-5 shrink-0 items-center justify-center">
                  {isCompleted ? (
                    <FiCheckCircle className="size-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="size-2.5 rounded-full bg-blue-400 animate-pulse ring-4 ring-blue-500/20" />
                  ) : (
                    <span className="size-2 rounded-full bg-slate-700" />
                  )}
                </div>

                {/* Step Icon */}
                <Icon className={`size-3.5 shrink-0 ${isCurrent ? 'text-blue-400' : isCompleted ? 'text-slate-400' : 'text-slate-600'}`} />

                {/* Step Label */}
                <span className="truncate">{step.label}</span>

                {/* Status tag */}
                <span className="ml-auto text-[10px] font-mono uppercase tracking-wider">
                  {isCompleted ? (
                    <span className="text-emerald-400">Xong</span>
                  ) : isCurrent ? (
                    <span className="text-blue-400">Đang xử lý...</span>
                  ) : (
                    <span className="text-slate-600">Chờ</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Real Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>Tiến độ tổng thể</span>
            <span className="font-mono font-semibold text-slate-200 tabular-nums">
              {pipelineProgress}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${pipelineProgress}%` }}
            />
          </div>
        </div>

        {/* Reassuring Operational Footnote */}
        <p className="mt-4 text-left text-[11px] text-slate-500">
          Hệ thống đang thực thi tuần tự trong nền. Dữ liệu bài giảng được bảo toàn toàn vẹn.
        </p>

      </div>
    </div>
  );
}
