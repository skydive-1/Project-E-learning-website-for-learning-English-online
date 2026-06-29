import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiAward, FiVolume2, FiVolumeX, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { getFreeQuizById } from '../services/quizzes.service';

const PlayQuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const quiz = getFreeQuizById(quizId);

  // States
  const [gameState, setGameState] = useState('intro'); // 'intro', 'playing', 'feedback', 'podium'
  const [nickname, setNickname] = useState(localStorage.getItem('username') || 'Người chơi');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20); // 20s per question
  const [score, setScore] = useState(0);
  const [answersLog, setAnswersLog] = useState([]); // Array of { isCorrect, pointsEarned }
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Feedback states
  const [selectedOptionKey, setSelectedOptionKey] = useState(null);
  const [feedbackType, setFeedbackType] = useState(''); // 'correct', 'incorrect', 'timeout'
  const [earnedPoints, setEarnedPoints] = useState(0);

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
  }, [gameState, currentIdx]);

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy bộ trắc nghiệm!</h2>
        <button onClick={() => navigate('/quizzes')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Quay lại</button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentIdx];

  const handleStartGame = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setGameState('playing');
    setCurrentIdx(0);
    setScore(0);
    setAnswersLog([]);
    setTimeLeft(20);
  };

  const handleAnswerClick = (optionKey) => {
    if (gameState !== 'playing') return;
    if (timerRef.current) clearInterval(timerRef.current);
    
    setSelectedOptionKey(optionKey);
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
    setFeedbackType('timeout');
    setEarnedPoints(0);
    playAudio('incorrect');
    setAnswersLog(prev => [...prev, { isCorrect: false, pointsEarned: 0 }]);
    setGameState('feedback');
  };

  const handleNext = () => {
    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setTimeLeft(20);
      setGameState('playing');
    } else {
      setGameState('podium');
    }
  };

  const shapes = {
    A: { color: '#ef4444', hoverBg: 'hover:bg-red-50', char: '▲' },
    B: { color: '#3b82f6', hoverBg: 'hover:bg-blue-50', char: '◆' },
    C: { color: '#eab308', hoverBg: 'hover:bg-yellow-50', char: '●' },
    D: { color: '#10b981', hoverBg: 'hover:bg-emerald-50', char: '■' }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-28 flex flex-col justify-center items-center">
        
        {/* Back and Sound Controls row */}
        <div className="w-full flex justify-between items-center mb-6 max-w-3xl">
          <button 
            onClick={() => navigate('/quizzes')}
            className="flex items-center space-x-2 text-xs font-bold text-slate-500 hover:text-smart-indigo transition-colors"
          >
            <FiArrowLeft className="text-sm" />
            <span>Quay lại sảnh</span>
          </button>
          
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors p-1"
          >
            {soundEnabled ? <FiVolume2 className="text-base text-smart-indigo" /> : <FiVolumeX className="text-base" />}
            <span>{soundEnabled ? 'Bật âm thanh' : 'Tắt âm thanh'}</span>
          </button>
        </div>

        {/* INTRO SCREEN */}
        {gameState === 'intro' && (
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm text-center space-y-6 animate-fade">
            <div>
              <span className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-smart-indigo tracking-widest uppercase">
                🚀 Trắc nghiệm phản xạ nhanh
              </span>
              <h1 className="text-2xl font-extrabold text-slate-800 mt-4 mb-2 leading-tight">
                {quiz.title}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                {quiz.description}
              </p>
            </div>

            <form onSubmit={handleStartGame} className="space-y-4 pt-2">
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Nhập biệt danh của bạn
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full text-center py-3 px-4 font-bold border border-slate-200 rounded-xl focus:border-smart-indigo focus:ring-0 outline-none transition-all"
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

        {/* GAMEPLAY SCREEN */}
        {gameState === 'playing' && (
          <div className="w-full max-w-3xl bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm flex flex-col min-h-[480px] justify-between animate-fade">
            {/* Top Stats Panel */}
            <div className="flex justify-between items-center w-full pb-4 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Câu {currentIdx + 1} / {quiz.questions.length}
              </span>
              <div className="text-xs font-extrabold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg">
                Tổng điểm: <span className="text-smart-indigo font-black">{score}</span>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-center py-6">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 leading-snug">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Elegant Circular Timer */}
            <div className="flex justify-center items-center my-4">
              <div 
                style={{
                  borderColor: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#6366f1'
                }}
                className="w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-black shadow-sm transition-all duration-300 bg-slate-50"
              >
                <span style={{ color: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#6366f1' }}>
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Choices Grid (E-Learn Elegant Colors) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
              {currentQuestion.options.map((opt, oIdx) => {
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
                    <span className="text-slate-700 font-extrabold">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* FEEDBACK OVERLAY CARD */}
        {gameState === 'feedback' && (
          <div className="w-full max-w-3xl bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-6 animate-fade">
            {feedbackType === 'correct' ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-3xl text-emerald-500 mx-auto shadow-sm">
                  <FiCheck />
                </div>
                <h2 className="text-2xl font-black text-emerald-600">Câu trả lời chính xác!</h2>
                <div className="inline-block px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-extrabold">
                  +{earnedPoints} Điểm phản xạ
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-500 flex items-center justify-center text-3xl text-red-500 mx-auto shadow-sm">
                  <FiX />
                </div>
                <h2 className="text-2xl font-black text-red-600">
                  {feedbackType === 'timeout' ? 'Hết giờ mất rồi!' : 'Câu trả lời chưa đúng!'}
                </h2>
                <p className="text-sm text-slate-500 font-bold">
                  Đáp án chính xác là:{' '}
                  <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 font-black text-slate-800 ml-1">
                    {currentQuestion.correctAnswer}
                  </span>
                </p>
              </div>
            )}

            {/* Explanation box */}
            {currentQuestion.explanation && (
              <div className="bg-slate-50 rounded-xl p-5 text-left border border-slate-100 max-w-lg w-full text-xs leading-relaxed font-semibold text-slate-600 shadow-inner">
                <span className="font-extrabold text-sm block mb-1.5 text-slate-700 flex items-center gap-1.5">
                  💡 Giải thích ngữ pháp:
                </span>
                {currentQuestion.explanation}
              </div>
            )}

            <button
              onClick={handleNext}
              className="px-8 py-3.5 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-widest active:scale-95 transition-all cursor-pointer shadow-md"
            >
              Câu tiếp theo
            </button>
          </div>
        )}

        {/* PODIUM/LEADERBOARD SCREEN */}
        {gameState === 'podium' && (
          <div className="w-full max-w-3xl bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-6 animate-fade">
            <div>
              <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center text-slate-800 text-2xl mx-auto shadow-sm mb-3">
                🏆
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800">English Game Show</h1>
              <p className="text-xs text-slate-400 font-semibold mt-1">Bảng xếp hạng chung cuộc</p>
            </div>

            {/* Elegant 3D Podium Layout */}
            <div className="flex items-end justify-center gap-4 max-w-sm w-full mx-auto h-40 mt-6 mb-4">
              {/* 2nd Place: LingoBot */}
              <div className="flex flex-col items-center w-24">
                <span className="text-[10px] font-bold text-slate-500 mb-1 truncate max-w-[80px]">LingoBot</span>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-t-xl flex flex-col items-center justify-center py-2 shadow-sm" style={{ height: '55px' }}>
                  <span className="text-lg font-black text-slate-600">2</span>
                  <span className="text-[9px] font-bold text-slate-400">3,450 pts</span>
                </div>
              </div>

              {/* 1st Place: User */}
              <div className="flex flex-col items-center w-28">
                <span className="text-xs font-black text-smart-indigo mb-1 flex items-center gap-1">
                  👑 <span className="truncate max-w-[80px]">{nickname}</span>
                </span>
                <div className="w-full bg-indigo-50 border border-indigo-200 rounded-t-xl flex flex-col items-center justify-center py-3 shadow-md" style={{ height: '80px' }}>
                  <span className="text-2xl font-black text-smart-indigo">1</span>
                  <span className="text-[10px] font-black text-smart-indigo mt-0.5">{score} pts</span>
                </div>
              </div>

              {/* 3rd Place: Guru99 */}
              <div className="flex flex-col items-center w-20">
                <span className="text-[9px] font-bold text-slate-500 mb-1 truncate max-w-[70px]">Guru99</span>
                <div className="w-full bg-slate-50 border border-slate-100 rounded-t-xl flex flex-col items-center justify-center py-1.5 shadow-sm" style={{ height: '40px' }}>
                  <span className="text-base font-black text-slate-500">3</span>
                  <span className="text-[8px] font-bold text-slate-400">2,800 pts</span>
                </div>
              </div>
            </div>

            {/* Performance Stats List */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left max-w-sm w-full mx-auto space-y-2.5 font-semibold text-xs text-slate-600 shadow-inner">
              <div className="flex justify-between">
                <span>Độ chính xác:</span>
                <span className="text-slate-800 font-extrabold">
                  {answersLog.filter(l => l.isCorrect).length} / {quiz.questions.length} câu đúng
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tổng số điểm đạt được:</span>
                <span className="text-smart-indigo font-black text-sm">{score} điểm</span>
              </div>
            </div>

            <div className="flex gap-4 max-w-sm w-full mx-auto pt-4">
              <button
                onClick={() => {
                  setGameState('playing');
                  setCurrentIdx(0);
                  setScore(0);
                  setAnswersLog([]);
                  setTimeLeft(20);
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FiRefreshCw /> Chơi lại
              </button>
              <button
                onClick={() => navigate('/quizzes')}
                className="flex-1 py-3 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer shadow-md"
              >
                Về sảnh thi
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PlayQuizPage;
