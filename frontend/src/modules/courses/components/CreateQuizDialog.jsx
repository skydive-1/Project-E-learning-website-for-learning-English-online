import React, { useState } from 'react';
import {
  BookOpenCheckIcon,
  FilePenLineIcon,
  Grid2X2CheckIcon,
  ListChecksIcon,
  Mic2Icon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
  ClockIcon,
  ShieldIcon,
  XIcon,
  CheckIcon
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { syncClozeGaps } from '../../quizzes/utils/openCloze';

const difficultyItems = [
  { label: 'Dễ (Easy)', value: 'Easy' },
  { label: 'Trung bình (Medium)', value: 'Medium' },
  { label: 'Khó (Hard)', value: 'Hard' }
];

const aiCountItems = [
  { label: '3 câu hỏi nhanh', value: '3' },
  { label: '5 câu hỏi tiêu chuẩn', value: '5' },
  { label: '10 câu hỏi chuyên sâu', value: '10' }
];

// All 4 question types supported across the system
const questionTypes = [
  { 
    value: 'multiple_choice', 
    label: 'Trắc nghiệm', 
    icon: ListChecksIcon, 
    desc: 'Chọn 1 trong 4 đáp án A/B/C/D',
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100/90 dark:bg-blue-950/80',
    activeBorder: 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/30',
    checkColor: 'bg-blue-600 text-white'
  },
  { 
    value: 'writing', 
    label: 'Tự luận (Writing)', 
    icon: FilePenLineIcon, 
    desc: 'Học viên viết đoạn văn, AI chấm chi tiết',
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-100/90 dark:bg-purple-950/80',
    activeBorder: 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 ring-1 ring-purple-500/30',
    checkColor: 'bg-purple-600 text-white'
  },
  { 
    value: 'pronunciation', 
    label: 'Phát âm (Speaking)', 
    icon: Mic2Icon, 
    desc: 'Luyện đọc to câu tiếng Anh chuẩn giọng AI',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100/90 dark:bg-emerald-950/80',
    activeBorder: 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/30',
    checkColor: 'bg-emerald-600 text-white'
  },
  { 
    value: 'open_cloze', 
    label: 'Điền từ (Open Cloze)', 
    icon: Grid2X2CheckIcon, 
    desc: 'Đoạn văn điền từ vào vị trí {{1}}, {{2}}',
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100/90 dark:bg-amber-950/80',
    activeBorder: 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 ring-1 ring-amber-500/30',
    checkColor: 'bg-amber-600 text-white'
  }
];

const typeLabels = Object.fromEntries(questionTypes.map(type => [type.value, type.label]));

const QuestionEditor = ({ question, index, onChange, onRemove }) => {
  const type = question.question_type || 'multiple_choice';
  const options = Array.isArray(question.options) ? question.options : ['', '', '', ''];

  const updatePassage = (value) => {
    onChange({
      question_text: value,
      options: syncClozeGaps(value, Array.isArray(question.options) ? question.options : [])
    });
  };

  const updateGap = (gapId, field, value) => {
    const clozeOptions = Array.isArray(question.options) ? question.options : [];
    onChange({
      options: clozeOptions.map(gap => String(gap.id) === String(gapId) ? { ...gap, [field]: value } : gap)
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs">
      {/* Question Card Header */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-600 font-semibold px-2.5 py-0.5 text-xs">
            Câu {index + 1}
          </Badge>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {typeLabels[type] || 'Trắc nghiệm'}
          </span>
        </div>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={onRemove}
          className="h-8 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-medium"
        >
          <Trash2Icon className="size-3.5 mr-1" />
          <span>Xóa câu</span>
        </Button>
      </div>

      {/* Question Form Body */}
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor={`q-text-${index}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {type === 'open_cloze' 
              ? 'Đoạn văn có chỗ trống (Dùng {{1}}, {{2}}...)' 
              : type === 'writing'
              ? 'Đề bài tự luận / Yêu cầu bài viết *'
              : 'Nội dung câu hỏi / Đề bài *'}
          </label>
          <Textarea
            id={`q-text-${index}`}
            required
            rows={type === 'open_cloze' || type === 'writing' ? 3 : 2}
            value={question.question_text || ''}
            placeholder={
              type === 'open_cloze'
                ? 'Ví dụ: Learning English {{1}} great discipline and daily {{2}}.'
                : type === 'writing'
                ? 'Ví dụ: Write 3-4 sentences describing what you usually do on weekends and why.'
                : 'Nhập nội dung câu hỏi tại đây...'
            }
            onChange={(event) => type === 'open_cloze'
              ? updatePassage(event.target.value)
              : onChange({ question_text: event.target.value })}
            className="text-sm resize-y bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        {/* 1. Multiple Choice Options */}
        {type === 'multiple_choice' && (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">4 Lựa chọn trả lời *</span>
              <span className="text-xs text-slate-400">Chọn đáp án đúng tương ứng</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                <div key={letter} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 pr-2.5 focus-within:border-blue-500 transition-colors">
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                    (question.correct_answer || 'A') === letter 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {letter}
                  </span>
                  <Input
                    required
                    value={options[optIdx] || ''}
                    placeholder={`Lựa chọn ${letter}...`}
                    onChange={(event) => {
                      const next = [...options];
                      next[optIdx] = event.target.value;
                      onChange({ options: next });
                    }}
                    className="h-8 text-xs border-0 shadow-none focus-visible:ring-0 px-1 bg-transparent"
                  />
                  <input
                    type="radio"
                    name={`correct-radio-${index}`}
                    checked={(question.correct_answer || 'A') === letter}
                    onChange={() => onChange({ correct_answer: letter })}
                    title={`Đặt ${letter} là đáp án đúng`}
                    className="accent-blue-600 size-4 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Speaking / Pronunciation */}
        {type === 'pronunciation' && (
          <div>
            <label htmlFor={`q-speaking-${index}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Mẫu câu tiếng Anh học viên cần luyện phát âm *
            </label>
            <Input
              id={`q-speaking-${index}`}
              required
              value={question.correct_answer || ''}
              placeholder="Ví dụ: Good morning, I would like to order a cup of hot coffee."
              onChange={(event) => onChange({ correct_answer: event.target.value })}
              className="text-sm h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
        )}

        {/* 3. Open Cloze Gaps */}
        {type === 'open_cloze' && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Đáp án cho các vị trí trống:</span>
            {(!Array.isArray(question.options) || question.options.length === 0) ? (
              <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                💡 Hãy thêm thẻ {'{{1}}'}, {'{{2}}'} vào đoạn văn trên để hệ thống tự động tạo ô nhập đáp án.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {question.options.map((gap) => (
                  <div key={gap.id} className="grid grid-cols-1 sm:grid-cols-[60px_1fr_1fr] gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <Badge variant="outline" className="font-bold text-center justify-center text-xs">Ô #{gap.id}</Badge>
                    <Input
                      placeholder="Đáp án đúng chính xác..."
                      required
                      value={gap.answer || ''}
                      onChange={(e) => updateGap(gap.id, 'answer', e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Đáp án phụ (ngăn cách dấu phẩy)..."
                      value={(gap.acceptedAnswers || []).join(', ')}
                      onChange={(e) => updateGap(
                        gap.id,
                        'acceptedAnswers',
                        e.target.value.split(',').map(item => item.trim()).filter(Boolean)
                      )}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Writing Guidance */}
        {type === 'writing' && (
          <div>
            <label htmlFor={`q-writing-guide-${index}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Gợi ý cấu trúc hoặc từ vựng trọng tâm cần có
            </label>
            <Input
              id={`q-writing-guide-${index}`}
              value={question.explanation || ''}
              placeholder="Ví dụ: Sử dụng thì hiện tại đơn, trạng từ chỉ tần suất (always, usually)..."
              onChange={(event) => onChange({ explanation: event.target.value })}
              className="text-xs h-8 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
        )}

        {/* General Explanation for non-writing */}
        {type !== 'writing' && (
          <div>
            <label htmlFor={`q-exp-${index}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Giải thích chi tiết (Hiển thị sau khi học viên nộp bài)
            </label>
            <Input
              id={`q-exp-${index}`}
              value={question.explanation || ''}
              placeholder="Giải thích ngữ pháp, từ vựng hoặc mẹo ghi nhớ..."
              onChange={(event) => onChange({ explanation: event.target.value })}
              className="text-xs h-8 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const CreateQuizDialog = ({
  open,
  onOpenChange,
  createMode,
  onCreateModeChange,
  quizTitle,
  onQuizTitleChange,
  quizDescription,
  onQuizDescriptionChange,
  quizDifficulty,
  onQuizDifficultyChange,
  quizTimeLimit,
  onQuizTimeLimitChange,
  isPrivate,
  onPrivateChange,
  pinCode,
  onPinCodeChange,
  questions,
  onQuestionsChange,
  onAddQuestion,
  submitting,
  onSubmit,
  aiTopic,
  onAiTopicChange,
  aiCount,
  onAiCountChange,
  aiTypes = [],
  onAiTypesChange,
  aiGenerating,
  onGenerateAi,
  canUseAi = true
}) => {
  const [selectedTypeToAdd, setSelectedTypeToAdd] = useState('multiple_choice');

  if (!open) return null;

  const updateQuestion = (index, patch) => {
    onQuestionsChange(questions.map((q, qIdx) => (
      qIdx === index ? { ...q, ...patch } : q
    )));
  };

  const handleQuickAdd = () => {
    onAddQuestion(selectedTypeToAdd);
  };

  const toggleAiType = (typeKey) => {
    if (!Array.isArray(aiTypes) || !onAiTypesChange) return;
    if (aiTypes.includes(typeKey)) {
      onAiTypesChange(aiTypes.filter(t => t !== typeKey));
    } else {
      onAiTypesChange([...aiTypes, typeKey]);
    }
  };

  const selectedCount = Array.isArray(aiTypes) ? aiTypes.length : 0;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative w-full max-w-4xl max-h-[86vh] sm:max-h-[84vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ========================================================= */}
        {/* 1. DIALOG HEADER (Sticky, Centered & Clean)               */}
        {/* ========================================================= */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 shadow-xs">
              <SparklesIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Tạo đề thi trắc nghiệm mới
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tự biên soạn câu hỏi hoặc dùng Trợ lý AI, sau đó xem lại và xuất bản đề thi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Đóng cửa sổ"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. TABS SWITCHER (Manual vs AI)                           */}
        {/* ========================================================= */}
        <div className="px-6 py-3 shrink-0 bg-slate-50/60 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800/60">
          <div className="grid grid-cols-2 w-full h-10 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => onCreateModeChange('manual')}
              className={`rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                createMode === 'manual'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpenCheckIcon className="size-4" />
              <span>Soạn câu hỏi ({questions.length})</span>
            </button>

            {canUseAi && (
              <button
                type="button"
                onClick={() => onCreateModeChange('ai')}
                className={`rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  createMode === 'ai'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <WandSparklesIcon className="size-4 text-purple-500" />
                <span>Sinh đề bằng Trợ lý AI</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. DIALOG BODY (Scrollable Area)                          */}
        {/* ========================================================= */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {createMode === 'manual' ? (
            <form id="manual-quiz-form" onSubmit={onSubmit} className="flex flex-col gap-5">
              
              {/* Basic Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Title (2 Cols) */}
                <div className="md:col-span-2">
                  <label htmlFor="quiz-title-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Tiêu đề đề thi <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="quiz-title-input"
                    required
                    value={quizTitle}
                    placeholder="Ví dụ: Kiểm tra Thì Hiện Tại Hoàn Thành & Quá Khứ Đơn"
                    onChange={(e) => onQuizTitleChange(e.target.value)}
                    className="h-10 text-sm font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>

                {/* Difficulty (1 Col) */}
                <div>
                  <label htmlFor="quiz-difficulty-select" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Độ khó
                  </label>
                  <select
                    id="quiz-difficulty-select"
                    value={quizDifficulty}
                    onChange={(e) => onQuizDifficultyChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 font-medium focus:border-blue-500 outline-none"
                  >
                    {difficultyItems.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label htmlFor="quiz-desc-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Mô tả ngắn đề thi
                </label>
                <Textarea
                  id="quiz-desc-input"
                  rows={2}
                  value={quizDescription}
                  placeholder="Mô tả nội dung trọng tâm, mục tiêu hoặc đối tượng học viên của đề thi..."
                  onChange={(e) => onQuizDescriptionChange(e.target.value)}
                  className="text-sm resize-none bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>

              {/* Time Limit & Privacy Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                {/* Time Limit */}
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500">
                    <ClockIcon className="size-4.5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="quiz-time-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Thời gian làm bài
                    </label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Input
                        id="quiz-time-input"
                        type="number"
                        min={1}
                        max={180}
                        value={quizTimeLimit}
                        onChange={(e) => onQuizTimeLimitChange(Number(e.target.value))}
                        className="h-8 w-20 text-xs text-center font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      />
                      <span className="text-xs text-slate-500">phút</span>
                    </div>
                  </div>
                </div>

                {/* Privacy & PIN Code */}
                <div className="flex items-center gap-3 pl-0 md:pl-3 md:border-l border-slate-200 dark:border-slate-800">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500">
                    <ShieldIcon className="size-4.5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        id="quiz-private-chk"
                        checked={isPrivate}
                        onCheckedChange={onPrivateChange}
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Khóa bằng mã PIN riêng tư
                      </span>
                    </label>

                    {isPrivate && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Input
                          required
                          minLength={4}
                          maxLength={8}
                          value={pinCode}
                          placeholder="MÃ PIN (VD: 882910)"
                          onChange={(e) => onPinCodeChange(e.target.value.replace(/\s/g, '').toUpperCase())}
                          className="h-8 w-36 text-xs font-mono font-bold tracking-wider uppercase border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30"
                        />
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">4-8 ký tự</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Questions Section Header */}
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>Danh sách câu hỏi</span>
                      <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
                        {questions.length} câu
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Chọn dạng câu hỏi và bấm "Thêm câu hỏi" để bổ sung vào đề thi.
                    </p>
                  </div>

                  {/* Add Question Control Bar with all 4 types */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTypeToAdd}
                      onChange={(e) => setSelectedTypeToAdd(e.target.value)}
                      className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                    >
                      {questionTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>

                    <Button 
                      type="button" 
                      onClick={handleQuickAdd}
                      className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <PlusIcon className="size-3.5" />
                      <span>Thêm câu hỏi</span>
                    </Button>
                  </div>
                </div>

                {/* Empty State vs Questions List */}
                {questions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-500 mb-3">
                      <BookOpenCheckIcon className="size-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Chưa có câu hỏi nào trong đề thi
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mb-4">
                      Hãy chọn dạng câu hỏi và bấm <strong>"Thêm câu hỏi"</strong> hoặc chuyển sang tab <strong>"Sinh đề bằng Trợ lý AI"</strong> để tạo tự động.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {questionTypes.map(t => (
                        <Button 
                          key={t.value}
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => onAddQuestion(t.value)}
                          className="text-xs font-semibold gap-1.5 h-8"
                        >
                          <PlusIcon className="size-3" />
                          + {t.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {questions.map((q, idx) => (
                      <QuestionEditor
                        key={`${q.question_type || 'q'}-${idx}`}
                        question={q}
                        index={idx}
                        onChange={(patch) => updateQuestion(idx, patch)}
                        onRemove={() => onQuestionsChange(questions.filter((_, i) => i !== idx))}
                      />
                    ))}
                  </div>
                )}
              </div>
            </form>
          ) : (
            /* ========================================================= */
            /* AI GENERATOR TAB                                          */
            /* ========================================================= */
            <div className="flex flex-col gap-5 max-w-2xl mx-auto py-2">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-900 dark:text-purple-200">
                <WandSparklesIcon className="size-6 text-purple-600 dark:text-purple-400 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <strong>Trợ lý AI E-Learn</strong> sẽ tự động thiết kế câu hỏi, các phương án nhiễu, đáp án đúng và giải thích ngữ pháp chuẩn khung CEFR theo chủ đề và các dạng bạn đã chọn bên dưới.
                </div>
              </div>

              {/* AI Topic */}
              <div>
                <label htmlFor="ai-topic-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Chủ đề bài tập muốn AI tạo <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="ai-topic-input"
                  rows={3}
                  value={aiTopic}
                  placeholder="Ví dụ: Phrasal verbs for daily communication, Simple Past vs Present Perfect, IELTS Speaking Part 1 about Hometown..."
                  onChange={(e) => onAiTopicChange(e.target.value)}
                  className="text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400 py-0.5">Gợi ý:</span>
                  {[
                    'IELTS Speaking Part 1',
                    'Phrasal Verbs for Travel',
                    'Present Perfect Tense',
                    'Business Email Writing',
                    'B2 English Open Cloze'
                  ].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onAiTopicChange(tag)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-600 transition-colors cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Questions */}
              <div>
                <label htmlFor="ai-count-select" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Số lượng câu hỏi
                </label>
                <select
                  id="ai-count-select"
                  value={String(aiCount)}
                  onChange={(e) => onAiCountChange(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 font-medium focus:border-purple-500 outline-none"
                >
                  {aiCountItems.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* All 4 Selectable AI Question Types */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    CÁC DẠNG CÂU HỎI <span className="text-red-500">*</span>
                  </label>
                  {selectedCount === 0 ? (
                    <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">
                      ⚠️ Chưa chọn dạng nào
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Đã chọn {selectedCount}/4 dạng
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {questionTypes.map(t => {
                    const Icon = t.icon;
                    const isSelected = Array.isArray(aiTypes) && aiTypes.includes(t.value);

                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleAiType(t.value)}
                        className={`group relative flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected 
                            ? t.activeBorder + ' shadow-sm' 
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${t.iconBg} ${t.iconColor}`}>
                            <Icon className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {t.label}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug truncate">
                              {t.desc}
                            </p>
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                          isSelected 
                            ? `${t.checkColor} border-transparent shadow-xs` 
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 group-hover:border-slate-400'
                        }`}>
                          {isSelected && <CheckIcon className="size-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit AI Generation */}
              <Button
                type="button"
                disabled={aiGenerating || !aiTopic.trim() || selectedCount === 0}
                onClick={onGenerateAi}
                className="h-11 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
              >
                {aiGenerating ? (
                  <>
                    <Spinner className="size-4" />
                    <span>Trợ lý AI đang soạn câu hỏi và đáp án...</span>
                  </>
                ) : selectedCount === 0 ? (
                  <>
                    <WandSparklesIcon className="size-4" />
                    <span>Vui lòng chọn ít nhất 1 dạng câu hỏi ở trên</span>
                  </>
                ) : (
                  <>
                    <WandSparklesIcon className="size-4" />
                    <span>Bắt đầu tạo câu hỏi bằng AI ({selectedCount} dạng đã chọn)</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 4. DIALOG FOOTER (Sticky, Bottom-Pinned & Clean)          */}
        {/* ========================================================= */}
        {createMode === 'manual' && (
          <div className="px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              Đã soạn <strong className="text-blue-600 dark:text-blue-400 font-bold">{questions.length}</strong> câu hỏi
            </div>

            <div className="flex items-center gap-2.5">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 text-xs font-semibold rounded-lg"
              >
                Hủy bỏ
              </Button>
              <Button 
                type="submit" 
                form="manual-quiz-form" 
                disabled={submitting || questions.length === 0}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Spinner className="size-3.5" />
                    <span>Đang xuất bản...</span>
                  </>
                ) : (
                  <>
                    <BookOpenCheckIcon className="size-3.5" />
                    <span>Xuất bản đề thi</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CreateQuizDialog;
