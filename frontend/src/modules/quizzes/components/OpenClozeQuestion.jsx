import React, { useMemo } from 'react';
import { FiCheck, FiGrid, FiLoader, FiSend } from 'react-icons/fi';
import { tokenizeClozeTemplate } from '../utils/openCloze';
import { Button } from '@/components/ui/button';

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
    <form onSubmit={onSubmit} className="flex flex-col flex-1 gap-5 pt-4 border-t border-border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-2">
          <FiGrid aria-hidden="true" className="text-primary" />
          Điền một từ hoặc cụm từ vào mỗi ô trống.
        </span>
        <span aria-live="polite">Đã điền {completedCount}/{gaps.length} ô</span>
      </div>

      <div className="whitespace-pre-wrap rounded-xl bg-muted/40 p-4 sm:p-6 text-base sm:text-lg font-semibold leading-[2.65] text-foreground border border-border">
        {tokens.map((token, index) => {
          if (token.type === 'text') {
            return <React.Fragment key={`text-${index}`}>{token.value}</React.Fragment>;
          }

          const gap = gapById.get(token.id) || { id: token.id, inputSize: 8 };
          const result = resultById.get(token.id);
          const stateClass = !result
            ? 'border-input bg-background text-foreground focus:border-primary focus:ring-primary/20'
            : result.isCorrect
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-destructive bg-destructive/10 text-destructive';

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
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/30 bg-destructive/10 text-destructive'}`}
            >
              <span className="flex items-center gap-1.5"><FiCheck aria-hidden="true" /> Ô {result.id}</span>
              <span>{result.isCorrect ? result.studentAnswer : `${result.studentAnswer || 'Chưa trả lời'} → ${result.correctAnswer}`}</span>
            </div>
          ))}
        </div>
      )}

      {showSubmit && (
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitDisabled}
            size="lg"
            className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider"
          >
            {loading ? <FiLoader aria-hidden="true" className="animate-spin mr-1.5" /> : <FiSend aria-hidden="true" className="mr-1.5" />}
            {loading ? 'Đang chấm từng ô...' : 'Nộp bài điền từ'}
          </Button>
        </div>
      )}
    </form>
  );
};

export default OpenClozeQuestion;
