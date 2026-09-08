import React, { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiCpu, FiDatabase } from 'react-icons/fi';

const formatElapsed = (deciseconds) => {
  const totalSeconds = deciseconds / 10;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  return `${Math.floor(totalSeconds / 60)}m ${(totalSeconds % 60).toFixed(1)}s`;
};

const RAG_STAGES = [
  {
    id: 'context',
    label: 'Đang tra cứu phụ đề & ngữ cảnh bài học...',
    shortLabel: 'Ngữ cảnh bài học',
    icon: FiBookOpen,
    activeColor: 'text-blue-400 border-blue-500/40 bg-blue-500/10'
  },
  {
    id: 'retrieval',
    label: 'Đang đối chiếu tri thức vector...',
    shortLabel: 'Truy xuất tri thức',
    icon: FiDatabase,
    activeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
  },
  {
    id: 'reasoning',
    label: 'Đang hoàn thiện câu trả lời có căn cứ...',
    shortLabel: 'Tổng hợp câu trả lời',
    icon: FiCpu,
    activeColor: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10'
  }
];

const AiThinkingState = ({
  customLabel = null
}) => {
  const [deciseconds, setDeciseconds] = useState(0);

  useEffect(() => {
    const timerId = setInterval(() => {
      setDeciseconds((current) => current + 1);
    }, 100);

    return () => clearInterval(timerId);
  }, []);

  // Determine stage based on elapsed time (realistic RAG timing windows)
  const currentStageIndex = useMemo(() => {
    const seconds = deciseconds / 10;
    if (seconds < 1.4) return 0;
    if (seconds < 3.2) return 1;
    return 2;
  }, [deciseconds]);

  const currentStage = RAG_STAGES[currentStageIndex];
  const activeLabel = customLabel || currentStage.label;

  return (
    <div
      role="status"
      aria-live="polite"
      className="chatbot-thinking-state flex flex-col gap-2.5 py-1 select-none"
    >
      <span className="sr-only">AI đang tra cứu tài liệu & suy nghĩ...</span>
      <div className="hidden" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} data-pixel-cell={i} />
        ))}
      </div>
      {/* Visual RAG Knowledge Retrieval Pipeline */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {RAG_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isCurrent = idx === currentStageIndex;
          const isPassed = idx < currentStageIndex;

          return (
            <React.Fragment key={stage.id}>
              {/* Node Indicator */}
              <div
                title={stage.shortLabel}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-medium border transition-all duration-200 ${
                  isCurrent
                    ? `${stage.activeColor} rag-node-active font-semibold shadow-sm`
                    : isPassed
                    ? 'text-slate-300 border-slate-700 bg-slate-800/60'
                    : 'text-slate-600 border-slate-800/80 bg-slate-900/40'
                }`}
              >
                <Icon className={`size-3 ${isCurrent ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{stage.shortLabel}</span>
              </div>

              {/* Connecting Pipeline Line */}
              {idx < RAG_STAGES.length - 1 && (
                <span
                  className={`h-px w-3 transition-colors duration-200 ${
                    isPassed ? 'bg-slate-600' : 'bg-slate-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Dynamic Status Label + Elapsed Timer */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
        <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
        <span className="text-[11.5px] text-slate-300">
          {activeLabel}
        </span>
        <span
          aria-label={`Thời gian chờ: ${formatElapsed(deciseconds)}`}
          className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums"
        >
          {formatElapsed(deciseconds)}
        </span>
      </div>
    </div>
  );
};

export default AiThinkingState;
