import React, { useMemo } from 'react';
import { FiCheck, FiGrid, FiLoader, FiSend } from 'react-icons/fi';
import { tokenizeClozeTemplate } from '../utils/openCloze';

const OpenClozeQuestion = ({
  question,
  answers,
  onAnswerChange,
  onSubmit,
  disabled = false,
  loading = false,
  feedback = null,
  showSubmit = true
}) => {
  const tokens = useMemo(() => tokenizeClozeTemplate(question?.question || ''), [question?.question]);
  const gaps = Array.isArray(question?.options) ? question.options : [];
  const gapById = useMemo(() => new Map(gaps.map(gap => [String(gap.id), gap])), [gaps]);
  const resultById = useMemo(() => new Map((feedback?.results || []).map(result => [String(result.id), result])), [feedback]);
  const completedCount = gaps.filter(gap => String(answers?.[gap.id] || '').trim()).length;
  const submitDisabled = disabled || loading || completedCount !== gaps.length || gaps.length === 0;

  return (
    <form onSubmit={onSubmit} className="flex flex-col flex-1 gap-5 pt-5 border-t border-slate-100 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <FiGrid aria-hidden="true" className="text-smart-indigo dark:text-indigo-400" />
          Điền một từ hoặc cụm từ vào mỗi ô trống.
        </span>
        <span aria-live="polite">Đã điền {completedCount}/{gaps.length} ô</span>
      </div>

      <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-4 sm:p-6 text-base sm:text-lg font-semibold leading-[2.65] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
        {tokens.map((token, index) => {
          if (token.type === 'text') {
            return <React.Fragment key={`text-${index}`}>{token.value}</React.Fragment>;
          }

          const gap = gapById.get(token.id) || { id: token.id, inputSize: 8 };
          const result = resultById.get(token.id);
          const stateClass = !result
            ? 'border-slate-300 dark:border-slate-600 focus:border-smart-indigo focus:ring-smart-indigo/15'
            : result.isCorrect
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300';

          return (
            <span key={`gap-${token.id}-${index}`} className="inline-flex align-middle mx-1.5">
              <input
                type="text"
                value={answers?.[token.id] || ''}
                onChange={(event) => onAnswerChange(token.id, event.target.value)}
                disabled={disabled}
                size={gap.inputSize || 8}
                maxLength={100}
                aria-label={`Đáp án cho chỗ trống ${token.id}`}
                aria-invalid={result ? !result.isCorrect : undefined}
                title={gap.hint || `Chỗ trống ${token.id}`}
                className={`h-10 max-w-[15rem] rounded-lg border-2 px-3 text-center text-base font-bold leading-none outline-none ring-4 ring-transparent transition-colors disabled:opacity-100 ${stateClass}`}
              />
            </span>
          );
        })}
      </div>

      {feedback && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Kết quả từng chỗ trống">
          {feedback.results.map(result => (
            <div
              key={result.id}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold border ${result.isCorrect
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300'}`}
            >
              <span className="flex items-center gap-1.5"><FiCheck aria-hidden="true" /> Ô {result.id}</span>
              <span>{result.isCorrect ? result.studentAnswer : `${result.studentAnswer || 'Chưa trả lời'} → ${result.correctAnswer}`}</span>
            </div>
          ))}
        </div>
      )}

      {showSubmit && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitDisabled}
            className={submitDisabled
              ? 'inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              : 'button-press-motion inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-smart-indigo px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-indigo-600'}
          >
            {loading ? <FiLoader aria-hidden="true" className="animate-spin" /> : <FiSend aria-hidden="true" />}
            {loading ? 'Đang chấm từng ô...' : 'Nộp bài điền từ'}
          </button>
        </div>
      )}
    </form>
  );
};

export default OpenClozeQuestion;
