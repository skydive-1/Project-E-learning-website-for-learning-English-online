import React, { useState, useRef } from 'react';
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
  CheckIcon,
  UploadCloudIcon,
  FileTextIcon,
  AlertCircleIcon,
  FileUpIcon,
  LayersIcon,
  GraduationCapIcon,
  HeadphonesIcon,
  BookOpenIcon
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { syncClozeGaps, normalizeQuestionsList } from '../../quizzes/utils/openCloze';
import { generateQuizAiFromPdf } from '../../quizzes/services/quizzes.service';
import { instructorService } from '../../instructor/services/instructor.service';
import { useToast } from '../../../context/ToastContext';

const resolveAudioUrl = (url) => {
  if (!url) return '';
  if (/^(https?:\/\/|blob:|data:)/i.test(url)) return url;
  return `/api/quizzes/audio-stream?key=${encodeURIComponent(url)}`;
};


const difficultyItems = [
  { label: 'Dễ (Easy)', value: 'Easy' },
  { label: 'Trung bình (Medium)', value: 'Medium' },
  { label: 'Khó (Hard)', value: 'Hard' }
];

const aiCountItems = [
  { label: '3 câu hỏi nhanh', value: '3' },
  { label: '5 câu hỏi tiêu chuẩn', value: '5' },
  { label: '10 câu hỏi chuyên sâu', value: '10' },
  { label: '15 câu hỏi hoàn chỉnh', value: '15' }
];

const targetLevelOptions = [
  {
    value: 'auto',
    label: 'Tự động (Theo đề gốc)',
    badge: 'Đề xuất',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    desc: 'Kế thừa độ khó và kiến thức tự nhiên của đề thi PDF được tải lên.'
  },
  {
    value: 'grade_6_7',
    label: 'Lớp 6 - Lớp 7 (A1 - A2)',
    badge: 'Cơ bản',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    desc: 'Từ vựng nền tảng, ngữ pháp sơ cấp: Hiện tại đơn, quá khứ đơn, danh từ số nhiều.'
  },
  {
    value: 'grade_8_9',
    label: 'Lớp 8 - Lớp 9 (B1)',
    badge: 'Trung cấp',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    desc: 'Hiện tại hoàn thành, câu bị động, câu điều kiện loại 1 & 2, mệnh đề quan hệ.'
  },
  {
    value: 'grade_10_12',
    label: 'Lớp 10 - Lớp 12 (B2 - C1)',
    badge: 'Nâng cao',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    desc: 'Đảo ngữ, câu giả định, idioms, collocations và từ vựng học thuật chuyên sâu.'
  }
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
  },
  { 
    value: 'listening', 
    label: 'Nghe hiểu (Listening)', 
    icon: HeadphonesIcon, 
    desc: 'Nghe audio và chọn đáp án đúng A/B/C/D',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-100/90 dark:bg-cyan-950/80',
    activeBorder: 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-950 dark:text-cyan-100 ring-1 ring-cyan-500/30',
    checkColor: 'bg-cyan-600 text-white'
  },
  { 
    value: 'reading', 
    label: 'Đọc hiểu (Reading)', 
    icon: BookOpenIcon, 
    desc: 'Đoạn văn đọc hiểu + câu hỏi A/B/C/D',
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-100/90 dark:bg-rose-950/80',
    activeBorder: 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/30',
    checkColor: 'bg-rose-600 text-white'
  }
];

const typeLabels = Object.fromEntries(questionTypes.map(type => [type.value, type.label]));

const QuestionEditor = ({ question, index, onChange, onRemove }) => {
  const type = question.question_type || 'multiple_choice';
  const options = Array.isArray(question.options) ? question.options : ['', '', '', ''];
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');

  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAudio(true);
      const localUrl = URL.createObjectURL(file);
      setAudioPreviewUrl(localUrl);
      const res = await instructorService.uploadMedia(file);
      const uploadedKey = res?.fileUrl || res?.storageKey;
      if (uploadedKey) {
        onChange({ audio_url: uploadedKey });
      }
    } catch (err) {
      console.error('Lỗi upload file audio:', err);
    } finally {
      setUploadingAudio(false);
    }
  };

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

  const needsAnswer = ['multiple_choice', 'listening', 'reading'].includes(type);
  const isMissingAnswer = needsAnswer && (!question.correct_answer || !String(question.correct_answer).trim());

  return (
    <div
      id={`question-card-${index}`}
      className={`rounded-xl border transition-all shadow-xs p-4 ${
        isMissingAnswer
          ? 'border-red-400 dark:border-red-500/80 bg-red-50/20 dark:bg-red-950/10 ring-1 ring-red-400/30'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Question Card Header */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-600 font-semibold px-2.5 py-0.5 text-xs">
            Câu {index + 1}
          </Badge>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {typeLabels[type] || 'Trắc nghiệm'}
          </span>
          {isMissingAnswer && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 px-2 py-0.5 rounded-md animate-pulse">
              <AlertCircleIcon className="size-3 shrink-0" />
              <span>Chưa chọn đáp án đúng</span>
            </span>
          )}
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
        {/* Reading Passage if Reading question */}
        {type === 'reading' && (
          <div>
            <label htmlFor={`q-passage-${index}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Đoạn văn đọc hiểu (Reading Passage) *
            </label>
            <Textarea
              id={`q-passage-${index}`}
              required
              rows={4}
              value={question.passage_text || ''}
              placeholder="Nhập đoạn văn bản đọc hiểu tiếng Anh..."
              onChange={(event) => onChange({ passage_text: event.target.value })}
              className="text-sm resize-y bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
        )}

        {/* Listening Audio Upload/URL if Listening question */}
        {type === 'listening' && (
          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-900/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-900 dark:text-cyan-200 flex items-center gap-1.5">
                <HeadphonesIcon className="size-4 text-cyan-600 dark:text-cyan-400" />
                File âm thanh bài nghe (Upload hoặc dán URL) *
              </span>
              {uploadingAudio && (
                <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold animate-pulse">
                  Đang tải lên R2...
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={question.audio_url || ''}
                placeholder="Dán link audio (https://...) hoặc bấm nút tải file bên cạnh"
                onChange={(e) => onChange({ audio_url: e.target.value })}
                className="text-xs h-9 bg-white dark:bg-slate-900 border-cyan-200 dark:border-cyan-800/60 flex-1"
              />
              <label className="inline-flex items-center justify-center px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shrink-0 shadow-xs">
                <UploadCloudIcon className="size-3.5 mr-1.5" />
                <span>Tải file Audio</span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a"
                  className="hidden"
                  onChange={handleAudioUpload}
                />
              </label>
            </div>

            {(audioPreviewUrl || question.audio_url) && (
              <div className="mt-1 flex flex-col gap-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Nghe thử audio:</span>
                <audio
                  src={audioPreviewUrl || resolveAudioUrl(question.audio_url)}
                  controls
                  className="w-full h-8 outline-none"
                />
              </div>
            )}
          </div>
        )}

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

        {/* 1. Multiple Choice Options (for multiple_choice, listening, reading) */}
        {['multiple_choice', 'listening', 'reading'].includes(type) && (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">4 Lựa chọn trả lời *</span>
              <span className="text-xs text-slate-400">Chọn đáp án đúng tương ứng</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                const isSelected = question.correct_answer === letter;
                return (
                  <div
                    key={letter}
                    className={`flex items-center gap-2 rounded-lg border transition-colors p-1.5 pr-2.5 focus-within:border-blue-500 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <span className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      isSelected
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {letter}
                    </span>
                    <Input
                      required
                      aria-label={`Đáp án ${letter}`}
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
                      checked={isSelected}
                      onChange={() => onChange({ correct_answer: letter })}
                      title={`Đặt ${letter} là đáp án đúng`}
                      className="accent-blue-600 size-4 cursor-pointer"
                    />
                  </div>
                );
              })}
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
  canUseAi = true,
  onGenerateAiFromPdf
}) => {
  const [selectedTypeToAdd, setSelectedTypeToAdd] = useState('multiple_choice');
  const [aiSource, setAiSource] = useState('topic'); // 'topic' | 'pdf'
  const [pdfFiles, setPdfFiles] = useState([]); // Array of File objects
  const [pdfTargetLevel, setPdfTargetLevel] = useState('auto');
  const [pdfNotes, setPdfNotes] = useState('');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const showToast = useToast();

  const handleManualSubmit = (e) => {
    e.preventDefault();

    const missingIndices = [];
    questions.forEach((q, idx) => {
      const qType = q.question_type || 'multiple_choice';
      if (['multiple_choice', 'listening', 'reading'].includes(qType)) {
        const corr = q.correct_answer ?? q.correctAnswer ?? q.answer;
        if (!corr || !String(corr).trim()) {
          missingIndices.push(idx + 1);
        }
      }
    });

    if (missingIndices.length > 0) {
      const msg = `Câu ${missingIndices.join(', ')} chưa chọn đáp án đúng. Vui lòng kiểm tra lại.`;
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      } else {
        alert(msg);
      }

      const firstInvalidCard = document.getElementById(`question-card-${missingIndices[0] - 1}`);
      if (firstInvalidCard) {
        firstInvalidCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (onSubmit) {
      onSubmit(e);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const addPdfFiles = (newFiles) => {
    setPdfError('');
    if (!newFiles || newFiles.length === 0) return;

    const validFiles = [];
    const errors = [];

    Array.from(newFiles).forEach(file => {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
      if (!isPdf) {
        errors.push(`"${file.name}" không phải file PDF.`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        errors.push(`"${file.name}" vượt quá 20MB.`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setPdfError(errors.join(' '));
    }

    if (validFiles.length > 0) {
      setPdfFiles(prev => {
        const existingKeys = new Set(prev.map(f => `${f.name}_${f.size}`));
        const filteredNew = validFiles.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
        const combined = [...prev, ...filteredNew];
        if (combined.length > 10) {
          setPdfError('Tối đa 10 file PDF đề thi trong một lần tạo.');
          return combined.slice(0, 10);
        }
        return combined;
      });
    }
  };

  const removePdfFile = (index) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAllPdfFiles = () => {
    setPdfFiles([]);
    setPdfError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addPdfFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target?.files && e.target.files.length > 0) {
      addPdfFiles(e.target.files);
    }
  };

  const handleGeneratePdfQuiz = async () => {
    if (pdfFiles.length === 0) {
      setPdfError('Vui lòng tải lên ít nhất 1 file đề thi PDF.');
      return;
    }
    if (selectedCount === 0) {
      setPdfError('Vui lòng chọn ít nhất 1 dạng câu hỏi.');
      return;
    }

    try {
      setPdfGenerating(true);
      setPdfError('');

      if (onGenerateAiFromPdf) {
        await onGenerateAiFromPdf({
          files: pdfFiles,
          file: pdfFiles[0],
          targetLevel: pdfTargetLevel,
          count: aiCount,
          questionTypes: aiTypes,
          additionalNotes: pdfNotes
        });
        return;
      }

      const formData = new FormData();
      pdfFiles.forEach(f => {
        formData.append('pdfs', f);
      });
      formData.append('targetLevel', pdfTargetLevel);
      formData.append('count', String(aiCount));
      formData.append('questionTypes', JSON.stringify(aiTypes));
      if (pdfNotes.trim()) {
        formData.append('additionalNotes', pdfNotes.trim());
      }

      const res = await generateQuizAiFromPdf(formData);
      if (res && Array.isArray(res.questions) && res.questions.length > 0) {
        const normalized = normalizeQuestionsList(res.questions);
        onQuestionsChange(normalized);
        const levelObj = targetLevelOptions.find(l => l.value === pdfTargetLevel);
        const levelLabel = levelObj ? levelObj.label : 'Mặc định';

        if (!quizTitle || quizTitle.startsWith('Trắc nghiệm') || quizTitle.startsWith('Bài tập') || quizTitle.startsWith('Quiz AI')) {
          if (pdfFiles.length === 1) {
            const cleanName = pdfFiles[0].name.replace(/\.[^/.]+$/, "");
            onQuizTitleChange(`Quiz AI: ${cleanName}`);
          } else {
            onQuizTitleChange(`Quiz AI: Tổng hợp ${pdfFiles.length} đề thi PDF (${levelLabel})`);
          }
        }
        if (!quizDescription) {
          onQuizDescriptionChange(`Đề thi tạo tự động bởi AI tổng hợp từ ${pdfFiles.length} tài liệu PDF: ${pdfFiles.map(f => f.name).join(', ')} phù hợp với Level: ${levelLabel}. Gồm ${normalized.length} câu hỏi đa dạng.`);
        }
        onCreateModeChange('manual');
      } else {
        setPdfError('Không nhận được câu hỏi từ AI. Vui lòng thử lại với các file PDF khác.');
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi AI từ nhiều PDF:', err);
      setPdfError(err.response?.data?.message || 'Không thể tạo câu hỏi từ các file PDF này. Đảm bảo file có nội dung văn bản tiếng Anh.');
    } finally {
      setPdfGenerating(false);
    }
  };

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
          <div role="tablist" className="grid grid-cols-2 w-full h-10 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              role="tab"
              aria-selected={createMode === 'manual'}
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
                role="tab"
                aria-selected={createMode === 'ai'}
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
            <form id="manual-quiz-form" onSubmit={handleManualSubmit} className="flex flex-col gap-5">
              
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
            /* AI GENERATOR TAB: PDF Ingestion & Topic Generator         */
            /* ========================================================= */
            <div className="flex flex-col gap-5 max-w-2xl mx-auto py-2">
              
              {/* Sub-tab Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAiSource('pdf')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    aiSource === 'pdf'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-800'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <FileUpIcon className="size-4 text-indigo-500" />
                  <span>Tải lên Đề thi PDF</span>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] px-1.5 py-0 font-bold ml-1">
                    Đề xuất
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => setAiSource('topic')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    aiSource === 'topic'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs border border-slate-200/60 dark:border-slate-800'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <WandSparklesIcon className="size-4 text-purple-500" />
                  <span>Nhập chủ đề văn bản</span>
                </button>
              </div>

              {/* ======================================================= */}
              {/* SUB-VIEW 1: IMPORT DỮ LIỆU ĐỀ THI PDF                   */}
              {/* ======================================================= */}
              {aiSource === 'pdf' ? (
                <div className="flex flex-col gap-5">
                  {/* Hero Banner */}
                  <div className="flex items-start gap-3.5 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-900/60">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                      <GraduationCapIcon className="size-5" />
                    </div>
                    <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                      <div className="font-bold text-sm text-indigo-950 dark:text-indigo-100 mb-0.5">
                        Thu nạp kiến thức từ tài liệu Đề thi PDF
                      </div>
                      Tải lên file đề thi tiếng Anh định dạng PDF (đề thi thử, giữa kỳ, học kỳ...). Trợ lý AI sẽ đọc hiểu cấu trúc đề, phân tích từ vựng và ngữ pháp, sau đó sinh ngẫu nhiên một bài Quizzes mới được cá nhân hóa phù hợp với <strong>Level</strong> bạn chọn bên dưới.
                    </div>
                  </div>

                  {/* PDF Upload Dropzone & Multi-file List */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        TÀI LIỆU ĐỀ THI PDF <span className="text-red-500">*</span>
                      </label>
                      {pdfFiles.length > 0 && (
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Đã nạp <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{pdfFiles.length}</strong> đề thi
                          </span>
                          <button
                            type="button"
                            onClick={clearAllPdfFiles}
                            className="text-xs text-red-500 hover:text-red-600 hover:underline cursor-pointer font-medium"
                          >
                            Xóa tất cả
                          </button>
                        </div>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />

                    {pdfFiles.length === 0 ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          dragActive 
                            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30' 
                            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
                          <UploadCloudIcon className="size-7" />
                        </div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                          Kéo thả một hoặc nhiều file PDF đề thi vào đây
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-2.5">
                          Hỗ trợ chọn hoặc kéo thả nhiều đề thi tiếng Anh cùng lúc để AI tổng hợp (Tối đa 10 file, 20MB/file).
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/40 hover:bg-indigo-100 transition-colors">
                          <FileUpIcon className="size-3.5" /> Chọn nhiều file từ máy tính
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {/* Selected Files List */}
                        <div className="max-h-56 overflow-y-auto pr-1 flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-2.5">
                          {pdfFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 shadow-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 font-bold text-xs border border-red-200 dark:border-red-900/40">
                                  <FileTextIcon className="size-4.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={file.name}>
                                    <span className="text-slate-400 mr-1.5">#{idx + 1}</span>
                                    {file.name}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>{formatFileSize(file.size)}</span>
                                    <span>•</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                                      <CheckIcon className="size-3 stroke-[3]" /> Sẵn sàng thu nạp
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePdfFile(idx)}
                                className="size-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                                title="Xóa đề thi này"
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        {/* Add More Files Strip & Dropzone */}
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border border-dashed rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                            dragActive
                              ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                              : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                          }`}
                        >
                          <PlusIcon className="size-3.5 text-indigo-500" />
                          <span>Kéo thả thêm đề thi PDF hoặc click để chọn thêm file ({pdfFiles.length}/10)</span>
                        </div>
                      </div>
                    )}

                    {pdfError && (
                      <div className="flex items-center gap-2 mt-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/50">
                        <AlertCircleIcon className="size-4 shrink-0 text-red-500" />
                        <span>{pdfError}</span>
                      </div>
                    )}
                  </div>

                  {/* Level Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        LEVEL MỤC TIÊU CỦA BÀI QUIZ <span className="text-red-500">*</span>
                      </label>
                      <span className="text-xs text-slate-500 dark:text-slate-400">AI sẽ tinh chỉnh độ khó theo level này</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {targetLevelOptions.map(lvl => {
                        const isSelected = pdfTargetLevel === lvl.value;
                        return (
                          <button
                            key={lvl.value}
                            type="button"
                            onClick={() => setPdfTargetLevel(lvl.value)}
                            className={`group flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {lvl.label}
                              </span>
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-bold ${lvl.badgeColor}`}>
                                {lvl.badge}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              {lvl.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Number of Questions */}
                  <div>
                    <label htmlFor="pdf-count-select" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Số lượng câu hỏi cần sinh
                    </label>
                    <select
                      id="pdf-count-select"
                      value={String(aiCount)}
                      onChange={(e) => onAiCountChange(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 font-medium focus:border-indigo-500 outline-none"
                    >
                      {aiCountItems.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Question Types Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        CÁC DẠNG CÂU HỎI TRỘN VÀO BÀI THI <span className="text-red-500">*</span>
                      </label>
                      {selectedCount === 0 ? (
                        <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">
                          ⚠️ Chưa chọn dạng nào
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Đã chọn {selectedCount}/{questionTypes.length} dạng
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

                  {/* Additional Notes (Optional) */}
                  <div>
                    <label htmlFor="pdf-notes-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Ghi chú thêm cho AI (Tùy chọn)
                    </label>
                    <Input
                      id="pdf-notes-input"
                      value={pdfNotes}
                      placeholder="Ví dụ: Tập trung kiểm tra cấu trúc câu điều kiện, ưu tiên câu hỏi tương tự câu 5-15..."
                      onChange={(e) => setPdfNotes(e.target.value)}
                      className="text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>

                  {/* Action Button */}
                  <Button
                    type="button"
                    disabled={pdfGenerating || aiGenerating || pdfFiles.length === 0 || selectedCount === 0}
                    onClick={handleGeneratePdfQuiz}
                    className="h-11 w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 mt-1 cursor-pointer disabled:opacity-50"
                  >
                    {pdfGenerating || aiGenerating ? (
                      <>
                        <Spinner className="size-4" />
                        <span>AI đang tổng hợp {pdfFiles.length} đề thi PDF và sinh câu hỏi theo level...</span>
                      </>
                    ) : pdfFiles.length === 0 ? (
                      <>
                        <UploadCloudIcon className="size-4" />
                        <span>Vui lòng tải lên ít nhất 1 file PDF đề thi ở trên</span>
                      </>
                    ) : selectedCount === 0 ? (
                      <>
                        <AlertCircleIcon className="size-4" />
                        <span>Vui lòng chọn ít nhất 1 dạng câu hỏi</span>
                      </>
                    ) : (
                      <>
                        <WandSparklesIcon className="size-4" />
                        <span>Bắt đầu AI tổng hợp {pdfFiles.length} PDF & Tạo Quizzes ({selectedCount} dạng)</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* ======================================================= */
                /* SUB-VIEW 2: TẠO CÂU HỎI THEO CHỦ ĐỀ VĂN BẢN (EXISTING)  */
                /* ======================================================= */
                <div className="flex flex-col gap-5">
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
                          Đã chọn {selectedCount}/{questionTypes.length} dạng
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
                    disabled={aiGenerating || pdfGenerating || !aiTopic.trim() || selectedCount === 0}
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
