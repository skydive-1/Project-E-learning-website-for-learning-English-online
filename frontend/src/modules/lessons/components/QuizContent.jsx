import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Award, 
  Mic, 
  Square, 
  Volume2, 
  Edit3, 
  Check, 
  Sparkles, 
  Send, 
  RefreshCw,
  HelpCircle,
  Play,
  XCircle,
  FileAudio
} from 'lucide-react';
import { 
  getCourseQuizQuestions, 
  getFreeQuizById,
  getCourseQuizByLessonId,
  submitQuizAttempt,
  submitOpenClozeAnswer,
  submitWritingAnswer,
  submitAudioAnswer
} from '../../quizzes/services/quizzes.service';
import OpenClozeQuestion from '../../quizzes/components/OpenClozeQuestion';
import getEffectiveQuestionType from '../../quizzes/utils/questionType';
import { useGamification } from '../../../context/GamificationContext';
import { useToast } from '../../../context/ToastContext';

// Shadcn UI components
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export const formatQuizOption = (option) => {
  let displayValue = option;
  if (option && typeof option === 'object') {
    displayValue = option.text ?? option.value ?? option.label ?? option.answer;
  }
  if (displayValue === undefined || displayValue === null) return '';
  return String(displayValue).replace(/^[A-D](?:[.):\-]\s*|\s+)/i, '').trim();
};

const QuizContent = ({ lessonId, quizId, isFreeQuiz = false, onComplete }) => {
  const { triggerBadgeUnlock } = useGamification() || {};
  const showToast = useToast();
  const [questions, setQuestions] = useState([]);
  const [quizTitle, setQuizTitle] = useState("Bài tập Trắc nghiệm");
  const [timeLimit, setTimeLimit] = useState(10); // minutes
  const [actualQuizId, setActualQuizId] = useState(null);

  // Common Quiz states
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600); // seconds
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [questionScores, setQuestionScores] = useState({});
  const [submittingQuestionId, setSubmittingQuestionId] = useState(null);
  const [isFinalSubmitting, setIsFinalSubmitting] = useState(false);

  // Open Cloze states
  const [clozeAnswersByQuestion, setClozeAnswersByQuestion] = useState({});
  const [clozeFeedbackByQuestion, setClozeFeedbackByQuestion] = useState({});

  // Writing states
  const [writingAnswersByQuestion, setWritingAnswersByQuestion] = useState({});
  const [writingFeedbackByQuestion, setWritingFeedbackByQuestion] = useState({});
  const [submittingWritingId, setSubmittingWritingId] = useState(null);

  // Pronunciation / Speaking states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingQuestionId, setRecordingQuestionId] = useState(null);
  const [audioBlobsByQuestion, setAudioBlobsByQuestion] = useState({});
  const [audioUrlsByQuestion, setAudioUrlsByQuestion] = useState({});
  const [pronunciationFeedbackByQuestion, setPronunciationFeedbackByQuestion] = useState({});
  const [submittingAudioId, setSubmittingAudioId] = useState(null);
  const [isPlayingReference, setIsPlayingReference] = useState(false);

  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Load questions
  useEffect(() => {
    let isCurrent = true;
    const loadQuizData = async () => {
      try {
        if (isFreeQuiz && quizId) {
          const quiz = await getFreeQuizById(quizId);
          if (quiz && isCurrent) {
            setQuestions(quiz.questions || []);
            setQuizTitle(quiz.title || "Bài kiểm tra trắc nghiệm");
            setTimeLimit(quiz.timeLimit || 10);
            setTimeLeft((quiz.timeLimit || 10) * 60);
            setActualQuizId(quiz.id || quizId);
          }
        } else if (lessonId) {
          const quiz = getCourseQuizByLessonId(lessonId);
          if (quiz && isCurrent) {
            setQuestions(quiz.questions || []);
            setQuizTitle(quiz.title || "Bài kiểm tra phản xạ kiến thức");
            setTimeLimit(quiz.timeLimit || 10);
            setTimeLeft((quiz.timeLimit || 10) * 60);
            setActualQuizId(quiz.id || quizId || lessonId);
          } else if (isCurrent) {
            // Fallback: fetch questions if not in cache
            try {
              const fetchedQuestions = await getCourseQuizQuestions(lessonId);
              if (fetchedQuestions && isCurrent) {
                setQuestions(fetchedQuestions);
                setActualQuizId(quizId || lessonId);
              }
            } catch (fetchErr) {
              console.warn("Could not load quiz questions by lessonId:", fetchErr);
            }
          }
        }
      } catch (err) {
        console.error("Lỗi load câu hỏi trắc nghiệm:", err);
      }
    };

    loadQuizData();

    // Reset quiz state when switching quiz/lesson
    setSelectedAnswers({});
    setActiveQuestionIdx(0);
    setIsSubmitted(false);
    setScore(0);
    setShowConfirmModal(false);
    setClozeAnswersByQuestion({});
    setClozeFeedbackByQuestion({});
    setWritingAnswersByQuestion({});
    setWritingFeedbackByQuestion({});
    setAudioBlobsByQuestion({});
    setAudioUrlsByQuestion({});
    setPronunciationFeedbackByQuestion({});
    setQuestionScores({});
    setSubmittingQuestionId(null);
    setSubmittingWritingId(null);
    setSubmittingAudioId(null);
    setIsFinalSubmitting(false);

    return () => {
      isCurrent = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [lessonId, quizId, isFreeQuiz]);

  // Countdown timer logic
  useEffect(() => {
    if (isSubmitted || questions.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSubmitted, questions.length]);

  const handleSelectOption = (questionId, optionKey) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleAutoSubmit = () => {
    showToast("Hết giờ làm bài! Hệ thống tự động nộp bài của bạn.", 'warning', { duration: 6500 });
    calculateAndSubmit();
  };

  const calculateAndSubmit = async () => {
    if (isFinalSubmitting) return;
    setIsFinalSubmitting(true);

    let correctCount = questions.reduce((total, question) => {
      const type = getEffectiveQuestionType(question);
      if (type === 'multiple_choice') {
        return total + (selectedAnswers[question.id] === question.correctAnswer ? 1 : 0);
      }
      return total + (Number(questionScores[question.id]) || 0) / 100;
    }, 0);

    setIsSubmitted(true);
    setShowConfirmModal(false);

    const targetQuizId = actualQuizId || quizId || lessonId;
    if (targetQuizId) {
      try {
        const result = await submitQuizAttempt(targetQuizId, selectedAnswers);
        const authoritativeCount = Number(result?.data?.correct_count);
        if (Number.isFinite(authoritativeCount)) correctCount = authoritativeCount;
      } catch (err) {
        console.warn("⚠️ Không thể lưu kết quả thi lên máy chủ:", err.message);
      }
    }

    const finalScore = Math.round(correctCount * 10) / 10;
    setScore(finalScore);

    if (finalScore > 0 && finalScore >= questions.length && triggerBadgeUnlock) {
      triggerBadgeUnlock('badge-quiz-100');
    }

    if (onComplete) {
      onComplete(finalScore, questions.length);
    }
    setIsFinalSubmitting(false);
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setActiveQuestionIdx(0);
    setIsSubmitted(false);
    setScore(0);
    setTimeLeft(timeLimit * 60);
    setClozeAnswersByQuestion({});
    setClozeFeedbackByQuestion({});
    setWritingAnswersByQuestion({});
    setWritingFeedbackByQuestion({});
    setAudioBlobsByQuestion({});
    setAudioUrlsByQuestion({});
    setPronunciationFeedbackByQuestion({});
    setQuestionScores({});
    setSubmittingQuestionId(null);
    setSubmittingWritingId(null);
    setSubmittingAudioId(null);
    setIsFinalSubmitting(false);
  };

  // --- Open Cloze Handlers ---
  const handleClozeAnswerChange = (questionId, gapId, value) => {
    if (isSubmitted || clozeFeedbackByQuestion[questionId]) return;
    setClozeAnswersByQuestion(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [gapId]: String(value || '').slice(0, 100)
      }
    }));
  };

  const handleClozeSubmit = async (event, question) => {
    event.preventDefault();
    const gaps = Array.isArray(question.options) ? question.options : [];
    const answers = clozeAnswersByQuestion[question.id] || {};
    const hasEmptyGap = gaps.length === 0 || gaps.some(gap => !String(answers[gap?.id] || '').trim());

    if (hasEmptyGap) {
      showToast('Vui lòng điền đầy đủ tất cả chỗ trống trước khi nộp.', 'warning');
      return;
    }
    const targetQuizId = actualQuizId || quizId || lessonId;
    if (!targetQuizId) {
      showToast('Không xác định được bài quiz để chấm điểm.', 'error');
      return;
    }

    try {
      setSubmittingQuestionId(question.id);
      const result = await submitOpenClozeAnswer(targetQuizId, question.id, answers);
      if (!result?.success || !result?.data) throw new Error('Phản hồi chấm điểm không hợp lệ.');

      setClozeFeedbackByQuestion(prev => ({ ...prev, [question.id]: result.data }));
      const earned = Number(result.data.score) || 0;
      setQuestionScores(prev => ({ ...prev, [question.id]: earned }));
      setSelectedAnswers(prev => ({
        ...prev,
        [question.id]: { type: 'open_cloze', answers: { ...answers }, score: earned }
      }));
      showToast(`AI đã chấm câu điền từ: ${earned}/100 điểm!`, 'success');
    } catch (err) {
      console.error('Lỗi chấm câu Open Cloze:', err);
      showToast(err.response?.data?.message || 'Không thể chấm câu điền từ. Vui lòng thử lại.', 'error');
    } finally {
      setSubmittingQuestionId(null);
    }
  };

  // --- Writing Handlers (Làm trực tiếp tại trang bài học) ---
  const handleWritingChange = (questionId, text) => {
    if (isSubmitted) return;
    setWritingAnswersByQuestion(prev => ({
      ...prev,
      [questionId]: text.slice(0, 500)
    }));
  };

  const handleWritingSubmit = async (question) => {
    const text = (writingAnswersByQuestion[question.id] || '').trim();
    if (!text) {
      showToast("Vui lòng nhập bài làm tự luận trước khi nộp.", "warning");
      return;
    }
    const targetQuizId = actualQuizId || quizId || lessonId;
    if (!targetQuizId) {
      showToast("Không xác định được bài trắc nghiệm để chấm điểm.", "error");
      return;
    }

    setSubmittingWritingId(question.id);
    try {
      const res = await submitWritingAnswer(targetQuizId, question.id, text);
      if (res?.success && res?.data) {
        const evalData = res.data;
        setWritingFeedbackByQuestion(prev => ({ ...prev, [question.id]: evalData }));
        const earnedScore = Number(evalData.score) || 0;
        setQuestionScores(prev => ({ ...prev, [question.id]: earnedScore }));
        setSelectedAnswers(prev => ({
          ...prev,
          [question.id]: { type: 'writing', text, score: earnedScore }
        }));
        showToast(`AI đã chấm xong bài viết: ${earnedScore}/100 điểm!`, "success");
      }
    } catch (err) {
      console.error("Lỗi nộp bài tự luận:", err);
      showToast(err.response?.data?.message || "Đã xảy ra lỗi khi AI chấm bài tự luận. Vui lòng thử lại.", "error");
    } finally {
      setSubmittingWritingId(null);
    }
  };

  // --- Pronunciation / Speaking Handlers (Làm trực tiếp tại trang bài học) ---
  const handlePlayReferenceAudio = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      showToast("Trình duyệt không hỗ trợ phát âm tự động.", "warning");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    setIsPlayingReference(true);
    utterance.onend = () => setIsPlayingReference(false);
    utterance.onerror = () => setIsPlayingReference(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleAudioStart = async (questionId) => {
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        showToast("Trình duyệt không hỗ trợ thu âm MediaRecorder.", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm') && MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMime = mediaRecorder.mimeType || mimeType;
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        const ext = finalMime.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `pronunciation_${questionId}.${ext}`, {
          type: finalMime,
          lastModified: Date.now()
        });
        const url = URL.createObjectURL(blob);
        setAudioBlobsByQuestion(prev => ({ ...prev, [questionId]: file }));
        setAudioUrlsByQuestion(prev => ({ ...prev, [questionId]: url }));

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setIsRecording(false);
        setRecordingQuestionId(null);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingQuestionId(questionId);
    } catch (err) {
      console.error("Lỗi bật micro:", err);
      showToast("Không thể truy cập Microphone. Vui lòng kiểm tra và cấp quyền Micro trong cài đặt trình duyệt.", "error");
    }
  };

  const handleAudioStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleAudioSubmit = async (question) => {
    const blob = audioBlobsByQuestion[question.id];
    if (!blob) {
      showToast("Vui lòng ghi âm giọng nói trước khi nộp bài.", "warning");
      return;
    }
    if (blob.size < 1500) {
      showToast("Thời gian ghi âm quá ngắn hoặc chưa có âm thanh. Vui lòng đọc to, rõ ràng hơn.", "warning");
      return;
    }
    const targetQuizId = actualQuizId || quizId || lessonId;
    if (!targetQuizId) {
      showToast("Không xác định được bài trắc nghiệm.", "error");
      return;
    }

    setSubmittingAudioId(question.id);
    try {
      const expectedSentence = question.correctAnswer || question.question || '';
      const res = await submitAudioAnswer(targetQuizId, question.id, blob, expectedSentence);
      if (res?.success && res?.data) {
        const evalData = res.data;
        setPronunciationFeedbackByQuestion(prev => ({ ...prev, [question.id]: evalData }));
        const earnedScore = Number(evalData.score) || 0;
        setQuestionScores(prev => ({ ...prev, [question.id]: earnedScore }));
        setSelectedAnswers(prev => ({
          ...prev,
          [question.id]: { type: 'pronunciation', score: earnedScore }
        }));
        showToast(`AI đã chấm phát âm: ${earnedScore}/100 điểm!`, "success");
      }
    } catch (err) {
      console.error("Lỗi nộp bài phát âm:", err);
      showToast(err.response?.data?.message || "Đã xảy ra lỗi khi AI chấm bài phát âm. Vui lòng thử lại.", "error");
    } finally {
      setSubmittingAudioId(null);
    }
  };

  // Format time (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (questions.length === 0) {
    return (
      <Alert className="flex flex-col items-center justify-center p-8 bg-card text-card-foreground border-border rounded-2xl min-h-[300px] text-center">
        <AlertCircle className="size-10 mb-3 text-muted-foreground opacity-60" />
        <AlertTitle className="text-base font-bold">Chưa có câu hỏi trắc nghiệm cho bài học này</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground mt-1">
          Giảng viên đang biên soạn bộ đề, vui lòng quay lại sau.
        </AlertDescription>
      </Alert>
    );
  }

  const currentQuestion = questions[activeQuestionIdx] || {};
  const currentQuestionType = getEffectiveQuestionType(currentQuestion);
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const isTimeCritical = timeLeft < 60;

  // Type labels and colors
  const getTypeInfo = (type) => {
    switch (type) {
      case 'writing':
        return { label: 'Tự luận viết (AI Grading)', variant: 'outline', className: 'border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10' };
      case 'pronunciation':
        return { label: 'Phát âm & Nói (AI Voice)', variant: 'outline', className: 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10' };
      case 'open_cloze':
        return { label: 'Điền từ đoạn văn', variant: 'outline', className: 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10' };
      case 'multiple_choice':
      default:
        return { label: 'Trắc nghiệm', variant: 'secondary', className: '' };
    }
  };

  const typeInfo = getTypeInfo(currentQuestionType);

  return (
    <div className="flex flex-col gap-6 w-full animate-fade">
      {/* Top bar: Quiz Header, Progress, Countdown and Submit Button */}
      <Card className="bg-card text-card-foreground border-border shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">{quizTitle}</h2>
            <p className="text-xs text-muted-foreground">
              Tiến độ: <span className="font-bold text-foreground">{answeredCount}/{totalQuestions} câu</span> đã trả lời
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Countdown Badge */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-bold tracking-wider transition-all ${
              isSubmitted
                ? 'bg-muted text-muted-foreground border-border'
                : isTimeCritical
                  ? 'bg-destructive/10 text-destructive border-destructive/30 animate-pulse'
                  : 'bg-primary/10 text-primary border-primary/20'
            }`}>
              <Clock className={`size-4 ${isTimeCritical && !isSubmitted ? 'animate-spin' : ''}`} />
              <span>{isSubmitted ? 'Đã hoàn thành' : formatTime(timeLeft)}</span>
            </div>

            {!isSubmitted && (
              <Button
                onClick={() => setShowConfirmModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm px-5 py-2"
              >
                Nộp bài
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Grid: Left Question Card + Right Jump Grid */}
      <div className="grid grid-cols-10 gap-6 items-start">
        {/* Left: Current Question Area */}
        <Card className="col-span-10 lg:col-span-7 bg-card text-card-foreground border-border shadow-sm flex flex-col gap-5 p-4 sm:p-6 overflow-hidden">
          {/* Submission Banner */}
          {isSubmitted && (
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-3">
                <Award className="size-6 text-emerald-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Kết quả bài làm</h4>
                  <p className="text-xs opacity-90">
                    Độ chính xác: <strong className="font-extrabold">{score}/{totalQuestions} câu đúng</strong> ({Math.round((score / totalQuestions) * 100)}%)
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
              >
                <RefreshCw className="size-3.5" />
                <span>Làm lại</span>
              </Button>
            </div>
          )}

          {/* Question Metadata & Title */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-bold tracking-wider uppercase text-[10px]">
                Câu {activeQuestionIdx + 1} / {totalQuestions}
              </Badge>
              <Badge variant={typeInfo.variant} className={`text-[10px] font-bold ${typeInfo.className}`}>
                {typeInfo.label}
              </Badge>
              {questionScores[currentQuestion.id] !== undefined && (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] font-bold">
                  Điểm: {questionScores[currentQuestion.id]}/100
                </Badge>
              )}
            </div>

            <p className="text-base sm:text-lg font-bold text-foreground leading-relaxed mt-1">
              {currentQuestionType === 'open_cloze'
                ? 'Hoàn thành đoạn văn bằng cách điền từ hoặc cụm từ phù hợp vào các ô trống:'
                : currentQuestion.question}
            </p>
          </div>

          <Separator />

          {/* DẠNG 1: TRẮC NGHIỆM (Multiple Choice) */}
          {currentQuestionType === 'multiple_choice' && (
            <div className="flex flex-col gap-3">
              {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option, idx) => {
                const optionKey = String.fromCharCode(65 + idx); // A, B, C, D
                const optionLabel = formatQuizOption(option);
                const isSelected = selectedAnswers[currentQuestion.id] === optionKey;
                const isCorrect = currentQuestion.correctAnswer === optionKey;

                let optionClass = "border-border bg-card hover:bg-muted text-foreground hover:border-primary/40";
                let badgeClass = "bg-muted text-muted-foreground border-border";

                if (isSubmitted) {
                  if (isCorrect) {
                    optionClass = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold";
                    badgeClass = "bg-emerald-600 text-white";
                  } else if (isSelected) {
                    optionClass = "border-destructive bg-destructive/10 text-destructive font-semibold";
                    badgeClass = "bg-destructive text-white";
                  } else {
                    optionClass = "border-border bg-muted/20 text-muted-foreground opacity-50";
                    badgeClass = "bg-muted text-muted-foreground opacity-50";
                  }
                } else if (isSelected) {
                  optionClass = "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary/30";
                  badgeClass = "bg-primary text-primary-foreground";
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(currentQuestion.id, optionKey)}
                    disabled={isSubmitted}
                    className={`flex items-center text-left p-4 rounded-xl border text-sm leading-relaxed transition-all cursor-pointer ${optionClass}`}
                  >
                    <span className={`size-7 rounded-lg flex items-center justify-center text-xs font-bold mr-3.5 shrink-0 transition-colors ${badgeClass}`}>
                      {optionKey}
                    </span>
                    <span className="flex-1 break-words">{optionLabel || `Lựa chọn ${optionKey}`}</span>
                  </button>
                );
              })}

              {(!Array.isArray(currentQuestion.options) || currentQuestion.options.length === 0) && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Chưa có phương án</AlertTitle>
                  <AlertDescription>
                    Câu hỏi này chưa có danh sách phương án trả lời hợp lệ.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* DẠNG 2: VIẾT LUẬN (Writing - Làm Trực Tiếp Ngay Tại Bài Học) */}
          {currentQuestionType === 'writing' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Nhập câu trả lời hoặc đoạn văn ngắn của bạn bằng tiếng Anh (tối đa 500 ký tự):</span>
                  <span className={(writingAnswersByQuestion[currentQuestion.id]?.length || 0) >= 480 ? 'text-rose-500 font-bold' : ''}>
                    {writingAnswersByQuestion[currentQuestion.id]?.length || 0} / 500 ký tự
                  </span>
                </div>

                <Textarea
                  value={writingAnswersByQuestion[currentQuestion.id] || ''}
                  onChange={(e) => handleWritingChange(currentQuestion.id, e.target.value)}
                  disabled={isSubmitted || submittingWritingId === currentQuestion.id}
                  placeholder="Viết câu trả lời hoặc đoạn văn ngắn của bạn bằng tiếng Anh..."
                  rows={5}
                  className="rounded-xl font-medium text-sm p-3.5 focus-visible:ring-primary/20"
                />

                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Mẹo: Chú ý chia đúng thì động từ, cấu trúc câu và từ vựng phong phú.</span>
                  {!isSubmitted && (
                    <Button
                      onClick={() => handleWritingSubmit(currentQuestion)}
                      disabled={submittingWritingId === currentQuestion.id || !(writingAnswersByQuestion[currentQuestion.id] || '').trim()}
                      className="rounded-xl px-5 py-2 text-xs font-bold gap-1.5"
                    >
                      {submittingWritingId === currentQuestion.id ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>AI đang chấm bài...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3.5 text-amber-300" />
                          <span>Nộp bài &amp; Chấm điểm AI</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* AI Feedback Card cho bài viết */}
              {writingFeedbackByQuestion[currentQuestion.id] && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 text-foreground animate-fade">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <span className="font-bold text-sm">Đánh giá từ Trợ lý AI</span>
                    </div>
                    <Badge variant="outline" className="border-primary/40 text-primary font-bold text-xs bg-primary/10">
                      Điểm bài viết: {writingFeedbackByQuestion[currentQuestion.id].score}/100
                    </Badge>
                  </div>

                  {writingFeedbackByQuestion[currentQuestion.id].detailed_feedback && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {writingFeedbackByQuestion[currentQuestion.id].detailed_feedback}
                    </p>
                  )}

                  {writingFeedbackByQuestion[currentQuestion.id].improved_sentence && (
                    <div className="p-3 rounded-lg bg-background/80 border border-border text-xs sm:text-sm">
                      <span className="font-bold text-primary block mb-1">Gợi ý câu bản xứ chuẩn xác:</span>
                      <p className="italic font-medium text-foreground">
                        "{writingFeedbackByQuestion[currentQuestion.id].improved_sentence}"
                      </p>
                    </div>
                  )}

                  {Array.isArray(writingFeedbackByQuestion[currentQuestion.id].errors) && writingFeedbackByQuestion[currentQuestion.id].errors.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground block">Các điểm cần lưu ý:</span>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                        {writingFeedbackByQuestion[currentQuestion.id].errors.map((errItem, idx) => (
                          <li key={idx}>{errItem}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DẠNG 3: PHÁT ÂM / NÓI (Pronunciation & Speaking - Thu âm trực tiếp) */}
          {currentQuestionType === 'pronunciation' && (
            <div className="flex flex-col gap-5">
              {/* Target Prompt Sentence with Audio Player TTS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-muted/30 gap-3">
                <div className="space-y-1 flex-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary block">
                    {currentQuestion.correctAnswer ? 'Mẫu câu luyện đọc phát âm:' : 'Chủ đề luyện nói:'}
                  </span>
                  <p className="text-base sm:text-lg font-extrabold text-foreground italic">
                    "{currentQuestion.correctAnswer || currentQuestion.question}"
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePlayReferenceAudio(currentQuestion.correctAnswer || currentQuestion.question)}
                  disabled={isPlayingReference}
                  className="shrink-0 gap-1.5 text-xs font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Volume2 className={`size-4 ${isPlayingReference ? 'animate-bounce text-primary' : ''}`} />
                  <span>{isPlayingReference ? 'Đang phát...' : 'Nghe mẫu bản xứ'}</span>
                </Button>
              </div>

              {/* Recording Action Box */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-border bg-card text-center gap-4">
                {/* Status indicator */}
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <Badge variant="destructive" className="animate-pulse gap-1.5 text-xs px-3 py-1">
                      <span className="size-2 rounded-full bg-white animate-ping"></span>
                      <span>Đang thu âm giọng nói... Nhấn nút vuông để dừng</span>
                    </Badge>
                  ) : audioUrlsByQuestion[currentQuestion.id] ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1 text-xs px-3 py-1">
                      <Check className="size-3.5" />
                      <span>Đã ghi âm xong (Có thể nghe lại hoặc nộp bài)</span>
                    </Badge>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      Bấm vào nút Micro bên dưới để bắt đầu luyện nói
                    </span>
                  )}
                </div>

                {/* Big Mic Button */}
                {!isRecording ? (
                  <Button
                    type="button"
                    onClick={() => handleAudioStart(currentQuestion.id)}
                    disabled={isSubmitted || submittingAudioId === currentQuestion.id}
                    className="size-16 sm:size-20 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-all p-0 flex items-center justify-center"
                    title="Bật Micro để thu âm"
                  >
                    <Mic className="size-8 sm:size-9" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleAudioStop}
                    className="size-16 sm:size-20 rounded-full shadow-lg animate-pulse hover:scale-105 active:scale-95 transition-all p-0 flex items-center justify-center"
                    title="Dừng thu âm"
                  >
                    <Square className="size-7 sm:size-8" />
                  </Button>
                )}

                {/* Audio Preview Controls */}
                {audioUrlsByQuestion[currentQuestion.id] && !isRecording && (
                  <div className="flex flex-col items-center gap-3 w-full max-w-sm mt-1 animate-fade">
                    <audio
                      src={audioUrlsByQuestion[currentQuestion.id]}
                      controls
                      className="w-full h-9 rounded-lg outline-none shadow-sm"
                    />

                    {!isSubmitted && (
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAudioUrlsByQuestion(prev => ({ ...prev, [currentQuestion.id]: null }));
                            setAudioBlobsByQuestion(prev => ({ ...prev, [currentQuestion.id]: null }));
                          }}
                          disabled={submittingAudioId === currentQuestion.id}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Thu âm lại
                        </Button>

                        <Button
                          onClick={() => handleAudioSubmit(currentQuestion)}
                          disabled={submittingAudioId === currentQuestion.id}
                          className="rounded-xl px-5 py-2 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
                        >
                          {submittingAudioId === currentQuestion.id ? (
                            <>
                              <RefreshCw className="size-3.5 animate-spin" />
                              <span>AI đang chấm phát âm...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-3.5 text-amber-300" />
                              <span>Nộp bài &amp; Chấm phát âm AI</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AI Feedback Card cho bài phát âm */}
              {pronunciationFeedbackByQuestion[currentQuestion.id] && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 text-foreground animate-fade">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <span className="font-bold text-sm">Kết quả phân tích giọng nói AI</span>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold text-xs">
                      Điểm: {pronunciationFeedbackByQuestion[currentQuestion.id].score}/100 ({pronunciationFeedbackByQuestion[currentQuestion.id].pronunciation_accuracy || '85%'})
                    </Badge>
                  </div>

                  {pronunciationFeedbackByQuestion[currentQuestion.id].detailed_feedback && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {pronunciationFeedbackByQuestion[currentQuestion.id].detailed_feedback}
                    </p>
                  )}

                  {Array.isArray(pronunciationFeedbackByQuestion[currentQuestion.id].errors) && pronunciationFeedbackByQuestion[currentQuestion.id].errors.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground block">Lưu ý phát âm:</span>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                        {pronunciationFeedbackByQuestion[currentQuestion.id].errors.map((errItem, idx) => (
                          <li key={idx}>{errItem}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DẠNG 4: ĐIỀN TỪ (Open Cloze) */}
          {currentQuestionType === 'open_cloze' && (
            <OpenClozeQuestion
              question={currentQuestion}
              answers={clozeAnswersByQuestion[currentQuestion.id] || {}}
              onAnswerChange={(gapId, value) => handleClozeAnswerChange(currentQuestion.id, gapId, value)}
              onSubmit={(event) => handleClozeSubmit(event, currentQuestion)}
              disabled={isSubmitted || Boolean(clozeFeedbackByQuestion[currentQuestion.id])}
              loading={submittingQuestionId === currentQuestion.id}
              feedback={clozeFeedbackByQuestion[currentQuestion.id] || null}
              showSubmit={!isSubmitted && !clozeFeedbackByQuestion[currentQuestion.id]}
            />
          )}

          {/* Giải thích chi tiết khi nộp bài */}
          {isSubmitted && currentQuestion.explanation && (
            <Alert className="bg-primary/5 border-primary/20 text-foreground">
              <Sparkles className="size-4 text-primary" />
              <AlertTitle className="text-xs font-bold text-primary">Giải thích chi tiết:</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed text-muted-foreground mt-1">
                {currentQuestion.explanation}
              </AlertDescription>
            </Alert>
          )}

          {/* Bottom Navigation controls */}
          <div className="flex justify-between items-center pt-4 border-t border-border mt-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
              disabled={activeQuestionIdx === 0}
              className="gap-1.5 rounded-xl font-bold text-xs"
            >
              <ChevronLeft className="size-4" />
              <span>Trước</span>
            </Button>

            <span className="text-xs text-muted-foreground font-semibold">
              Câu {activeQuestionIdx + 1} / {totalQuestions}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveQuestionIdx(prev => Math.min(totalQuestions - 1, prev + 1))}
              disabled={activeQuestionIdx === totalQuestions - 1}
              className="gap-1.5 rounded-xl font-bold text-xs"
            >
              <span>Sau</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </Card>

        {/* Right: Question Navigation Status Grid */}
        <Card className="col-span-10 lg:col-span-3 bg-card text-card-foreground border-border shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground">
              Danh sách câu hỏi
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === activeQuestionIdx;
                const isAnswered = selectedAnswers[q.id] !== undefined;
                const qType = getEffectiveQuestionType(q);
                const isCorrect = isSubmitted && (
                  qType === 'multiple_choice' 
                    ? selectedAnswers[q.id] === q.correctAnswer 
                    : (Number(questionScores[q.id]) || 0) >= 50
                );

                let btnClass = "border-border text-foreground hover:border-primary/50 bg-card";
                if (isSubmitted) {
                  btnClass = isCorrect
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-destructive text-white border-destructive";
                } else if (isCurrent) {
                  btnClass = "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30";
                } else if (isAnswered) {
                  btnClass = "bg-primary/15 text-primary border-primary/30 font-bold";
                }

                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => setActiveQuestionIdx(idx)}
                    className={`aspect-square rounded-xl border flex items-center justify-center text-xs font-bold transition-all cursor-pointer active:scale-90 ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <Separator />

            {/* Legend / Status Indicators */}
            <div className="space-y-2 text-[11px] text-muted-foreground font-medium">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-md bg-primary/15 border border-primary/30 shrink-0"></span>
                <span>Đã làm</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-md bg-card border border-border shrink-0"></span>
                <span>Chưa làm</span>
              </div>
              {isSubmitted && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-md bg-emerald-600 shrink-0"></span>
                    <span>Đáp án đúng (≥ 50%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-md bg-destructive shrink-0"></span>
                    <span>Đáp án chưa đạt (&lt; 50%)</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Modal: Sử dụng Shadcn Dialog */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Xác nhận nộp bài</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Bạn mới hoàn thành {answeredCount}/{totalQuestions} câu hỏi. Bạn có chắc chắn muốn nộp bài trắc nghiệm ngay bây giờ để hệ thống tổng hợp điểm số không?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Tiếp tục làm
            </Button>
            <Button
              onClick={calculateAndSubmit}
              disabled={isFinalSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
            >
              {isFinalSubmitting ? 'Đang nộp...' : 'Xác nhận nộp bài'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizContent;
