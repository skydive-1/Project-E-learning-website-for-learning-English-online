import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, 
  FiClock, 
  FiAward, 
  FiVolume2, 
  FiVolumeX, 
  FiCheck, 
  FiX, 
  FiRefreshCw, 
  FiMic, 
  FiMicOff, 
  FiSquare, 
  FiPlay, 
  FiPause, 
  FiEdit3 
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useAuth } from '../../../context/AuthContext';
import { 
  getFreeQuizById, 
  submitQuizAttempt, 
  getQuizLeaderboard,
  submitWritingAnswer, 
  submitAudioAnswer 
} from '../services/quizzes.service';

const getEffectiveQuestionType = (q) => {
  if (!q) return 'multiple_choice';
  if (q.questionType === 'writing' || q.questionType === 'pronunciation') {
    return q.questionType;
  }
  // Nếu câu hỏi không có các lựa chọn A, B, C, D (options rỗng hoặc null), tự động chuyển sang chế độ Luyện nói / Phát âm bằng Micro
  if (!q.options || q.options.length === 0) {
    return 'pronunciation';
  }
  return 'multiple_choice';
};

const PlayQuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState({});

  // States
  const [gameState, setGameState] = useState('intro'); // 'intro', 'playing', 'feedback', 'podium'
  const [nickname, setNickname] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20); // 20s per question
  const [score, setScore] = useState(0);
  const [answersLog, setAnswersLog] = useState([]); // Array of { isCorrect, pointsEarned }
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (user) {
      setNickname(user.full_name || user.username || 'Học viên');
    }
  }, [user]);

  // Feedback states
  const [selectedOptionKey, setSelectedOptionKey] = useState(null);
  const [feedbackType, setFeedbackType] = useState(''); // 'correct', 'incorrect', 'timeout'
  const [earnedPoints, setEarnedPoints] = useState(0);

  // AI Creative Quizzes states
  const [writingAnswer, setWritingAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [aiFeedback, setAiFeedback] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const data = await getFreeQuizById(quizId);
        setQuiz(data);
      } catch (err) {
        console.error("Lỗi tải thông tin đề thi trắc nghiệm:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId]);

  const timerRef = useRef(null);

  // Synth sounds using Web Audio API
  const playAudio = (type) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'incorrect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(293.66, ctx.currentTime); // D4
        osc.frequency.setValueAtTime(220.00, ctx.currentTime + 0.12); // A3
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'tick') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(timeLeft <= 5 ? 900 : 700, ctx.currentTime);
        gain.gain.setValueAtTime(timeLeft <= 5 ? 0.03 : 0.015, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  };

  // Question Timer
  useEffect(() => {
    if (gameState !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const currentQuestion = quiz?.questions?.[currentIdx];
    const effectiveType = getEffectiveQuestionType(currentQuestion);
    const isAiQuestion = effectiveType === 'writing' || effectiveType === 'pronunciation';

    if (isAiQuestion) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        playAudio('tick');
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, currentIdx, quiz]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <Header />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-28 flex flex-col justify-center items-center">
          <div className="w-full flex justify-between items-center mb-6 max-w-3xl animate-pulse">
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded opacity-50"></div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded opacity-50"></div>
          </div>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-8 shadow-sm space-y-6 animate-pulse text-center">
            <div className="flex justify-center">
              <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded-full opacity-50"></div>
            </div>
            <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mx-auto opacity-50"></div>
            <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded mx-auto opacity-50"></div>
            <div className="pt-4 space-y-3">
              <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded-xl opacity-50"></div>
            </div>
            <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded-xl opacity-50"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bộ trắc nghiệm không tìm thấy hoặc chưa có câu hỏi!</h2>
        <button onClick={() => navigate('/quizzes')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">Quay lại danh sách</button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentIdx] || {};

  const handleStartGame = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setGameState('playing');
    setCurrentIdx(0);
    setScore(0);
    setAnswersLog([]);
    setTimeLeft(20);
    setSelectedAnswers({});
  };

  const handleAnswerClick = (optionKey) => {
    if (gameState !== 'playing') return;
    if (timerRef.current) clearInterval(timerRef.current);
    
    setSelectedOptionKey(optionKey);
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: optionKey
    }));
    
    const isCorrect = optionKey === currentQuestion.correctAnswer;
    
    let pts = 0;
    if (isCorrect) {
      const timePercent = timeLeft / 20;
      pts = Math.round(500 + (500 * timePercent));
      setScore(prev => prev + pts);
      setFeedbackType('correct');
      playAudio('correct');
    } else {
      setFeedbackType('incorrect');
      playAudio('incorrect');
    }

    setEarnedPoints(pts);
    setAnswersLog(prev => [...prev, { isCorrect, pointsEarned: pts }]);
    setGameState('feedback');
  };

  const handleTimeout = () => {
    setSelectedOptionKey(null);
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: ''
    }));
    setFeedbackType('timeout');
    setEarnedPoints(0);
    playAudio('incorrect');
    setAnswersLog(prev => [...prev, { isCorrect: false, pointsEarned: 0 }]);
    setGameState('feedback');
  };

  const handleWritingSubmit = async () => {
    if (!writingAnswer.trim()) return;
    setAiLoading(true);
    try {
      const res = await submitWritingAnswer(quiz.id, currentQuestion.id, writingAnswer);
      if (res.success) {
        setAiFeedback(res.data);
        
        // Cập nhật điểm số chung cuộc
        const pts = res.data.score || 0;
        setScore(prev => prev + pts);
        
        // Thêm vào nhật ký làm bài
        setAnswersLog(prev => [...prev, { 
          isCorrect: pts >= 50, 
          pointsEarned: pts,
          questionType: 'writing'
        }]);
        
        setGameState('feedback');
      }
    } catch (err) {
      console.error("Lỗi nộp bài tự luận:", err);
      alert("Đã xảy ra lỗi khi chấm điểm bài viết bằng AI. Vui lòng thử lại!");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAudioStart = async () => {
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        alert("Trình duyệt của bạn không hỗ trợ tính năng thu âm HTML5 MediaRecorder.");
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `pronunciation_${currentQuestion?.id || 'audio'}.${ext}`, {
          type: mimeType,
          lastModified: Date.now()
        });
        setAudioBlob(file);
        setAudioUrl(URL.createObjectURL(blob));
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setAudioUrl(null);
      setAudioBlob(null);
    } catch (err) {
      console.error("Lỗi khởi động ghi âm:", err);
      alert("Không thể truy cập microphone. Vui lòng kiểm tra và cấp quyền Microphone cho trang web trong Cài đặt trình duyệt!");
    }
  };

  const handleAudioStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioSubmit = async () => {
    if (!audioBlob) return;
    setAiLoading(true);
    try {
      const res = await submitAudioAnswer(quiz.id, currentQuestion.id, audioBlob);
      if (res.success) {
        setAiFeedback(res.data);
        
        // Cập nhật điểm số chung cuộc
        const pts = res.data.score || 0;
        setScore(prev => prev + pts);
        
        // Thêm vào nhật ký làm bài
        setAnswersLog(prev => [...prev, { 
          isCorrect: pts >= 50, 
          pointsEarned: pts,
          questionType: 'pronunciation'
        }]);
        
        setGameState('feedback');
      }
    } catch (err) {
      console.error("Lỗi nộp bài phát âm:", err);
      alert("Đã xảy ra lỗi khi chấm điểm phát âm bằng AI. Vui lòng thử lại!");
    } finally {
      setAiLoading(false);
    }
  };

  const handleNext = async () => {
    // Reset AI states
    setWritingAnswer('');
    setAudioBlob(null);
    setAudioUrl(null);
    setAiFeedback(null);
    setIsRecording(false);

    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setTimeLeft(20);
      setGameState('playing');
    } else {
      setGameState('podium');
      try {
        await submitQuizAttempt(quiz.id, selectedAnswers, nickname);
        const lbData = await getQuizLeaderboard(quiz.id);
        setLeaderboard(lbData);
      } catch (err) {
        console.warn("⚠️ Lỗi lưu kết quả thi lên máy chủ:", err.message);
      }
    }
  };

  const shapes = {
    A: { color: '#ef4444', hoverBg: 'hover:bg-red-50 dark:hover:bg-red-950/20', char: '▲' },
    B: { color: '#3b82f6', hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-950/20', char: '◆' },
    C: { color: '#eab308', hoverBg: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/20', char: '●' },
    D: { color: '#10b981', hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20', char: '■' }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-28 flex flex-col justify-center items-center">
        
        {/* Back and Sound Controls row */}
        <div className="w-full flex justify-between items-center mb-6 max-w-3xl">
          <button 
            onClick={() => navigate('/quizzes')}
            className="flex items-center space-x-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-smart-indigo dark:hover:text-indigo-450 transition-colors"
          >
            <FiArrowLeft className="text-sm" />
            <span>Quay lại sảnh</span>
          </button>
          
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors p-1"
          >
            {soundEnabled ? <FiVolume2 className="text-base text-smart-indigo dark:text-indigo-400" /> : <FiVolumeX className="text-base" />}
            <span>{soundEnabled ? 'Bật âm thanh' : 'Tắt âm thanh'}</span>
          </button>
        </div>

        {/* LOGIN REQUIRED SCREEN */}
        {!authLoading && !user ? (
          <div className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-8 shadow-sm text-center space-y-6 animate-fade">
            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border-2 border-smart-indigo dark:border-indigo-500 flex items-center justify-center text-3xl text-smart-indigo dark:text-indigo-400 mx-auto shadow-sm">
              🔐
            </div>
            <div>
              <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-[10px] font-black text-smart-indigo dark:text-indigo-400 tracking-widest uppercase">
                Yêu cầu đăng nhập
              </span>
              <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-4 mb-2 leading-tight">
                Đăng nhập để làm bài thi
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-450 leading-relaxed font-semibold">
                Vui lòng đăng nhập tài khoản để tham gia thử thách phản xạ tiếng Anh, lưu lịch sử làm bài và ghi tên trên Bảng xếp hạng!
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <button
                onClick={() => navigate(`/login?redirect=/quizzes/play/${quizId}`)}
                className="w-full py-3.5 px-6 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-widest transition-all cursor-pointer shadow-md active:scale-98"
              >
                Đăng nhập ngay
              </button>
              <button
                onClick={() => navigate('/quizzes')}
                className="w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl tracking-wider transition-all cursor-pointer"
              >
                Quay lại sảnh bài tập
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* INTRO SCREEN */}
            {gameState === 'intro' && (
              <div className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-8 shadow-sm text-center space-y-6 animate-fade">
                <div>
                  <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-[10px] font-black text-smart-indigo dark:text-indigo-400 tracking-widest uppercase">
                    🚀 Trắc nghiệm phản xạ nhanh
                  </span>
                  <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-4 mb-2 leading-tight">
                    {quiz.title}
                  </h1>
                  <p className="text-xs text-slate-400 dark:text-slate-450 leading-relaxed font-semibold">
                    {quiz.description}
                  </p>
                </div>

                <form onSubmit={handleStartGame} className="space-y-4 pt-2">
                  <div className="text-left">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Tên hiển thị thi đấu của bạn
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full text-center py-3 px-4 font-bold border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-xl focus:border-smart-indigo focus:ring-0 outline-none transition-all"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-widest transition-all cursor-pointer shadow-md active:scale-98"
                  >
                    Bắt đầu chơi
                  </button>
                </form>
              </div>
            )}
        {gameState === 'playing' && (
          <div className="w-full max-w-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm flex flex-col min-h-[480px] justify-between animate-fade">
            {(() => {
                const effectiveQuestionType = getEffectiveQuestionType(currentQuestion);

                return (
                  <>
                    {/* Top Stats Panel */}
                    <div className="flex justify-between items-center w-full pb-4 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-505 uppercase tracking-widest">
                        Câu {currentIdx + 1} / {quiz.questions.length}
                      </span>
                      <div className="text-xs font-extrabold text-slate-505 dark:text-slate-350 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-3 py-1 rounded-lg">
                        Tổng điểm: <span className="text-smart-indigo dark:text-indigo-400 font-black">{score}</span>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="text-center py-6">
                      <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 inline-block">
                        {effectiveQuestionType === 'writing' ? '📝 Viết luận' : effectiveQuestionType === 'pronunciation' ? '🗣️ Bài nói & Phát âm (AI Voice)' : '▲ Trắc nghiệm'}
                      </span>
                      <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-snug">
                        {currentQuestion.question}
                      </h2>
                    </div>

                    {/* Elegant Circular Timer or AI badge */}
                    {effectiveQuestionType === 'multiple_choice' ? (
                      <div className="flex justify-center items-center my-4">
                        <div 
                          style={{
                            borderColor: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#6366f1'
                          }}
                          className="w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-black shadow-sm transition-all duration-300 bg-slate-50 dark:bg-slate-900 dark:border-slate-850"
                        >
                          <span style={{ color: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#6366f1' }}>
                            {timeLeft}s
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center my-4">
                        <div className="px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/50 text-xs font-black text-smart-indigo dark:text-indigo-400 tracking-wider flex items-center gap-1.5 shadow-sm animate-pulse">
                          <span>✨ Trợ lý AI đang sẵn sàng thu âm & chấm điểm bài nói...</span>
                        </div>
                      </div>
                    )}

                    {/* Choices Grid (For Multiple Choice) */}
                    {effectiveQuestionType === 'multiple_choice' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-700">
                        {(currentQuestion.options || []).map((opt, oIdx) => {
                          const optKey = String.fromCharCode(65 + oIdx);
                          const shapeInfo = shapes[optKey];
                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleAnswerClick(optKey)}
                              style={{ borderColor: shapeInfo.color }}
                              className={`border-2 ${shapeInfo.hoverBg} rounded-xl p-4.5 text-left font-bold text-sm shadow-sm transition-all flex items-center gap-3 cursor-pointer min-h-[68px] group`}
                            >
                              <span 
                                style={{ backgroundColor: shapeInfo.color }}
                                className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-base font-black shadow-sm group-hover:scale-105 transition-transform"
                              >
                                {shapeInfo.char}
                              </span>
                              <span className="text-slate-700 dark:text-slate-200 font-extrabold">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Writing Input Area */}
                    {effectiveQuestionType === 'writing' && (
                      <div className="flex flex-col flex-1 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Nhập câu trả lời tự luận của bạn (tối đa 500 ký tự):
                          </label>
                          <textarea
                            value={writingAnswer}
                            onChange={(e) => setWritingAnswer(e.target.value.slice(0, 500))}
                            disabled={aiLoading}
                            placeholder="Viết câu trả lời hoặc đoạn văn ngắn của bạn bằng tiếng Anh..."
                            rows={5}
                            className="w-full p-4 border border-slate-200 dark:border-slate-750 dark:bg-slate-900 dark:text-slate-100 rounded-xl outline-none focus:border-smart-indigo transition-all font-semibold resize-none shadow-inner"
                          />
                          <div className="flex justify-between items-center text-xs font-bold text-slate-455">
                            <span>Tránh lỗi chính tả và ngữ pháp để đạt điểm cao</span>
                            <span className={writingAnswer.length >= 480 ? 'text-rose-500 font-extrabold animate-pulse' : ''}>
                              {writingAnswer.length} / 500 ký tự
                            </span>
                          </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                          <button
                            onClick={handleWritingSubmit}
                            disabled={aiLoading || !writingAnswer.trim()}
                            className="px-6 py-3.5 bg-smart-indigo hover:bg-indigo-650 disabled:bg-slate-250 dark:disabled:bg-slate-755 disabled:text-slate-400 dark:disabled:text-slate-500 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer shadow-md flex items-center gap-2"
                          >
                            {aiLoading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>AI Đang Chấm Điểm...</span>
                              </>
                            ) : (
                              <>
                                <FiEdit3 className="text-sm" />
                                <span>Nộp bài & Chấm điểm AI</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pronunciation / Speaking Voice Recording Area */}
                    {effectiveQuestionType === 'pronunciation' && (
                      <div className="flex flex-col flex-1 gap-6 pt-4 border-t border-slate-100 dark:border-slate-700 items-center justify-between">
                        <div className="text-center w-full max-w-lg bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl p-5 shadow-inner">
                          <span className="text-[10px] font-black text-smart-indigo dark:text-indigo-400 tracking-widest uppercase block mb-2">
                            {currentQuestion.correctAnswer ? 'Mẫu câu luyện đọc phát âm:' : 'Chủ đề bài nói:'}
                          </span>
                          <p className="text-lg md:text-xl font-extrabold text-slate-800 dark:text-slate-100 italic">
                            "{currentQuestion.correctAnswer || currentQuestion.question}"
                          </p>
                        </div>

                        {/* Microphone Status Indicator */}
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black tracking-wide border shadow-sm transition-all duration-300">
                          {isRecording ? (
                            <div className="flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 px-4 py-1.5 rounded-full animate-pulse">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                              <span>🔴 MICRO ĐANG BẬT & THU ÂM GIỌNG NÓI...</span>
                            </div>
                          ) : audioUrl ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 px-4 py-1.5 rounded-full">
                              <FiCheck className="text-sm" />
                              <span>✅ Đã ghi âm thành công (Có thể nghe lại hoặc nộp bài)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-smart-indigo dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 px-4 py-1.5 rounded-full">
                              <FiMic className="text-sm" />
                              <span>🎤 Micro sẵn sàng: Nhấn nút Micro bên dưới để nói</span>
                            </div>
                          )}
                        </div>

                        {/* Big Interactive Microphone Button */}
                        <div className="flex flex-col items-center gap-4 py-2 w-full">
                          {!isRecording ? (
                            <button
                              onClick={handleAudioStart}
                              disabled={aiLoading}
                              className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center text-3xl shadow-lg hover:shadow-indigo-500/50 transition-all active:scale-95 cursor-pointer hover:scale-105 duration-300 group"
                              title="Nhấp để bật Micro và thu âm giọng nói"
                            >
                              <FiMic className="group-hover:scale-110 transition-transform" />
                            </button>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <button
                                onClick={handleAudioStop}
                                className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-3xl shadow-lg hover:shadow-rose-500/50 transition-all active:scale-95 cursor-pointer hover:scale-105 duration-300 animate-bounce"
                                title="Dừng thu âm giọng nói"
                              >
                                <FiSquare />
                              </button>
                              <span className="text-xs font-extrabold text-rose-500 animate-pulse tracking-wider">
                                ĐANG THU ÂM... NHẮP NÚT VUÔNG ĐỂ HOÀN TẤT
                              </span>
                            </div>
                          )}

                          {audioUrl && !isRecording && (
                            <div className="flex flex-col items-center gap-2 mt-2 w-full max-w-xs animate-fade">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File ghi âm giọng nói của bạn:</span>
                              <audio src={audioUrl} controls className="w-full h-9 rounded-lg outline-none shadow-sm" />
                            </div>
                          )}
                        </div>

                        <div className="w-full flex justify-end gap-3 mt-auto">
                          {audioUrl && !isRecording && (
                            <button
                              onClick={() => {
                                setAudioUrl(null);
                                setAudioBlob(null);
                              }}
                              disabled={aiLoading}
                              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer"
                            >
                              Thu âm lại
                            </button>
                          )}
                          <button
                            onClick={handleAudioSubmit}
                            disabled={aiLoading || !audioBlob || isRecording}
                            className="px-6 py-3.5 bg-smart-indigo hover:bg-indigo-650 disabled:bg-slate-200 dark:disabled:bg-slate-750 disabled:text-slate-400 dark:disabled:text-slate-500 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer shadow-md flex items-center gap-2"
                          >
                            {aiLoading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>AI Đang Chấm Điểm...</span>
                              </>
                            ) : (
                              <>
                                <FiCheck className="text-sm" />
                                <span>Nộp bài & Chấm phát âm AI</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
          </div>
        )}

        {/* FEEDBACK OVERLAY CARD */}
        {gameState === 'feedback' && (
          <div className="w-full max-w-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-6 animate-fade">
            
            {/* Nếu là câu hỏi trắc nghiệm truyền thống */}
            {(!currentQuestion.questionType || currentQuestion.questionType === 'multiple_choice') && (
              <>
                {feedbackType === 'correct' ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500 flex items-center justify-center text-3xl text-emerald-500 mx-auto shadow-sm">
                      <FiCheck />
                    </div>
                    <h2 className="text-2xl font-black text-emerald-600">Câu trả lời chính xác!</h2>
                    <div className="inline-block px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-400 text-sm font-extrabold">
                      +{earnedPoints} Điểm phản xạ
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 border-2 border-red-500 flex items-center justify-center text-3xl text-red-500 mx-auto shadow-sm">
                      <FiX />
                    </div>
                    <h2 className="text-2xl font-black text-red-600">
                      {feedbackType === 'timeout' ? 'Hết giờ mất rồi!' : 'Câu trả lời chưa đúng!'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
                      Đáp án chính xác là:{' '}
                      <span className="bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-750 font-black text-slate-800 dark:text-slate-100 ml-1">
                        {currentQuestion.options?.find(opt => typeof opt === 'string' && opt.trim().startsWith(currentQuestion.correctAnswer)) || currentQuestion.correctAnswer}
                      </span>
                    </p>
                  </div>
                )}

                {/* Explanation box */}
                {currentQuestion.explanation && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-5 text-left border border-slate-100 dark:border-slate-800 max-w-lg w-full text-xs leading-relaxed font-semibold text-slate-600 dark:text-slate-450 shadow-inner">
                    <span className="font-extrabold text-sm block mb-1.5 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      💡 Giải thích ngữ pháp:
                    </span>
                    {currentQuestion.explanation}
                  </div>
                )}
              </>
            )}

            {/* Nếu là câu hỏi Tự luận (Writing) hoặc Phát âm (Pronunciation) được chấm bởi AI */}
            {(currentQuestion.questionType === 'writing' || currentQuestion.questionType === 'pronunciation') && aiFeedback && (
              <div className="w-full flex flex-col items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-[10px] font-black text-smart-indigo dark:text-indigo-400 tracking-widest uppercase flex items-center gap-1.5">
                    ✨ Đánh giá chi tiết từ Trợ lý AI
                  </span>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-4">
                    {currentQuestion.questionType === 'writing' ? 'Bài luận của bạn' : 'Phát âm của bạn'}
                  </h2>
                </div>

                {/* Score donut or progress bar for AI */}
                <div className="flex flex-col items-center my-2">
                  <div 
                    style={{
                      borderColor: (aiFeedback.score || 0) >= 80 ? '#10b981' : (aiFeedback.score || 0) >= 50 ? '#f59e0b' : '#ef4444'
                    }}
                    className="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 shadow-sm"
                  >
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{aiFeedback.score || 0}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Điểm AI</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
                  {/* Nhận xét của AI */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-inner flex flex-col gap-2">
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      💬 Nhận xét tổng quan:
                    </span>
                    <p className="text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-300">
                      {aiFeedback.feedback || 'Không có nhận xét chi tiết.'}
                    </p>
                  </div>

                  {/* Lỗi được phát hiện */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-inner flex flex-col gap-2">
                    <span className="text-xs font-black text-slate-505 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      ⚠️ Lỗi và lưu ý:
                    </span>
                    {aiFeedback.errors && aiFeedback.errors.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {aiFeedback.errors.map((err, idx) => (
                          <li key={idx} className="text-xs font-bold text-rose-500 leading-normal">
                            {err}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs font-bold text-emerald-500">
                        🎉 Tuyệt vời! Trợ lý AI không phát hiện lỗi phát âm hay ngữ pháp nào đáng kể.
                      </p>
                    )}
                  </div>
                </div>

                {/* Câu sửa mẫu chuẩn */}
                {aiFeedback.suggestedText && (
                  <div className="bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl p-5 w-full text-left">
                    <span className="text-[10px] font-black text-smart-indigo dark:text-indigo-400 tracking-widest uppercase block mb-1.5">
                      💡 Câu mẫu gợi ý sửa đổi:
                    </span>
                    <p className="text-sm font-extrabold text-slate-850 dark:text-slate-150 leading-relaxed italic">
                      "{aiFeedback.suggestedText}"
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleNext}
              className="px-8 py-3.5 bg-smart-indigo hover:bg-indigo-650 text-white font-bold text-xs uppercase rounded-xl tracking-widest active:scale-95 transition-all cursor-pointer shadow-md"
            >
              Câu tiếp theo
            </button>
          </div>
        )}

        {/* PODIUM/LEADERBOARD SCREEN */}
        {gameState === 'podium' && (
          <div className="w-full max-w-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center space-y-6 animate-fade">
            <div className="text-center">
              <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-[10px] font-black text-smart-indigo dark:text-indigo-400 tracking-widest uppercase">
                🎉 Hoàn thành bài thi trắc nghiệm
              </span>
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-4">English Game Show</h1>
              <p className="text-xs text-slate-400 dark:text-slate-505 font-semibold mt-1">Kết quả và bảng xếp hạng chung cuộc</p>
            </div>

            {/* Grid layout for Podium & Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-stretch pt-2">
              
              {/* Left Column: Podium Leaderboard */}
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-between min-h-[220px]">
                <div className="text-center">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-full flex items-center justify-center text-xl mx-auto shadow-sm mb-2">
                    🏆
                  </div>
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Bảng xếp hạng danh dự</h3>
                </div>
                
                {(() => {
                  // Leaderboard dynamic mapping
                  const rank1 = leaderboard[0] || { user_name: nickname || 'Học viên', score: score };
                  const rank2 = leaderboard[1] || null;
                  const rank3 = leaderboard[2] || null;

                  return (
                    <div className="flex items-end justify-center gap-3 w-full h-32 mt-4">
                      {/* 2nd Place */}
                      <div className="flex flex-col items-center w-20">
                        <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 mb-1 truncate max-w-[65px]">
                          {rank2 ? rank2.user_name : '---'}
                        </span>
                        <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-xl flex flex-col items-center justify-center py-2 shadow-sm" style={{ height: '48px' }}>
                          <span className="text-base font-black text-slate-650 dark:text-slate-350">2</span>
                          <span className="text-[8px] font-bold text-slate-400 dark:text-slate-505">
                            {rank2 ? `${rank2.score} pts` : '0 pts'}
                          </span>
                        </div>
                      </div>

                      {/* 1st Place */}
                      <div className="flex flex-col items-center w-24">
                        <span className="text-xs font-black text-smart-indigo dark:text-indigo-400 mb-1 flex items-center gap-0.5">
                          👑 <span className="truncate max-w-[65px]">{rank1.user_name}</span>
                        </span>
                        <div className="w-full bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-250 dark:border-indigo-800 rounded-t-xl flex flex-col items-center justify-center py-3 shadow-md" style={{ height: '70px' }}>
                          <span className="text-xl font-black text-smart-indigo dark:text-indigo-400">1</span>
                          <span className="text-[9px] font-black text-smart-indigo dark:text-indigo-400 mt-0.5">{rank1.score} pts</span>
                        </div>
                      </div>

                      {/* 3rd Place */}
                      <div className="flex flex-col items-center w-18">
                        <span className="text-[9px] font-bold text-slate-550 dark:text-slate-400 mb-1 truncate max-w-[60px]">
                          {rank3 ? rank3.user_name : '---'}
                        </span>
                        <div className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-t-xl flex flex-col items-center justify-center py-1.5 shadow-sm" style={{ height: '32px' }}>
                          <span className="text-sm font-black text-slate-500 dark:text-slate-455">3</span>
                          <span className="text-[7px] font-bold text-slate-400 dark:text-slate-505">
                            {rank3 ? `${rank3.score} pts` : '0 pts'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Dynamic SVG Donut Chart */}
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-between gap-4">
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider text-center">Phân tích tỷ lệ câu hỏi</h3>
                
                {(() => {
                  const correctCount = answersLog.filter(l => l.isCorrect).length;
                  const totalCount = quiz.questions.length || 1;
                  const correctPercent = Math.round((correctCount / totalCount) * 100);
                  
                  // Donut math
                  const r = 50;
                  const strokeWidth = 10;
                  const strokeCircumference = 2 * Math.PI * r; // ~314.16
                  const strokeOffset = strokeCircumference - (correctCount / totalCount) * strokeCircumference;
                  
                  return (
                    <div className="flex flex-col sm:flex-row items-center gap-6 w-full justify-center">
                      {/* SVG Donut Circle */}
                      <div className="relative flex items-center justify-center w-28 h-28 shrink-0">
                        <svg width="112" height="112" viewBox="0 0 120 120" className="transform -rotate-90">
                          {/* Background track (Incorrect base) */}
                          <circle
                            cx="60"
                            cy="60"
                            r={r}
                            fill="transparent"
                            stroke="#f43f5e"
                            strokeWidth={strokeWidth}
                          />
                          {/* Foreground segment (Correct answers) */}
                          <circle
                            cx="60"
                            cy="60"
                            r={r}
                            fill="transparent"
                            stroke="#10b981"
                            strokeWidth={strokeWidth}
                            strokeDasharray={strokeCircumference}
                            strokeDashoffset={strokeOffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        
                        <div className="absolute flex flex-col items-center justify-center">
                          <span className="text-xl font-black text-slate-800 dark:text-slate-100">{correctPercent}%</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-505">Chính xác</span>
                        </div>
                      </div>

                      {/* Score metrics detail list */}
                      <div className="flex-1 flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center bg-emerald-500/5 dark:bg-emerald-950/20 px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-450 border border-emerald-500/10">
                          <span className="flex items-center gap-1.5">🟢 Đúng:</span>
                          <span>{correctCount} / {totalCount} câu</span>
                        </div>
                        <div className="flex justify-between items-center bg-rose-500/5 dark:bg-rose-950/20 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/10">
                          <span className="flex items-center gap-1.5">🔴 Sai / Quá giờ:</span>
                          <span>{totalCount - correctCount} câu</span>
                        </div>
                        <div className="flex justify-between items-center bg-indigo-500/5 dark:bg-indigo-950/20 px-3 py-2 rounded-xl text-xs font-bold text-smart-indigo dark:text-indigo-400 border border-indigo-500/10">
                          <span className="flex items-center gap-1.5">⭐ Tổng điểm:</span>
                          <span>{score} điểm</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Smart comment assessment */}
            {(() => {
              const correctCount = answersLog.filter(l => l.isCorrect).length;
              const totalCount = quiz.questions.length || 1;
              const correctPercent = Math.round((correctCount / totalCount) * 100);
              
              let comment = "Cần nỗ lực hơn nữa! Bạn hãy xem lại tài liệu bài học và chơi lại lần nữa để cải thiện phản xạ nhé.";
              let commentClass = "text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/50";
              
              if (correctPercent >= 80) {
                comment = "Tuyệt vời! Bạn đã làm chủ hoàn hảo các kiến thức trọng tâm của bài học này. Hãy tiếp tục phát huy nhé!";
                commentClass = "text-emerald-600 dark:text-emerald-450 bg-emerald-50/55 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50";
              } else if (correctPercent >= 50) {
                comment = "Khá tốt! Bạn đã nắm được kiến thức nền tảng. Hãy luyện tập lại một lần nữa để đạt điểm số tối đa nhé.";
                commentClass = "text-amber-600 dark:text-amber-450 bg-amber-50/55 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/50";
              }
              
              return (
                <div className={`p-4 rounded-xl border w-full text-xs font-semibold leading-relaxed text-center ${commentClass}`}>
                  💡 <strong>Đánh giá năng lực:</strong> {comment}
                </div>
              );
            })()}

            {/* Action buttons */}
            <div className="flex gap-4 max-w-sm w-full mx-auto pt-2">
              <button
                onClick={() => {
                  setGameState('playing');
                  setCurrentIdx(0);
                  setScore(0);
                  setAnswersLog([]);
                  setTimeLeft(20);
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FiRefreshCw /> Chơi lại
              </button>
              <button
                onClick={() => navigate('/quizzes')}
                className="flex-1 py-3 bg-smart-indigo hover:bg-indigo-650 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer shadow-md"
              >
                Về sảnh thi
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PlayQuizPage;
