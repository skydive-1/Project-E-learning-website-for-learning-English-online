import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAward, FiClock, FiBookOpen, FiPlay, FiCompass, FiZap } from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { getFreeQuizzesList } from '../services/quizzes.service';

const QuizzesListPage = () => {
  const navigate = useNavigate();
  const quizzesList = getFreeQuizzesList();
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoinByPin = (e) => {
    e.preventDefault();
    if (!pinCode.trim()) return;
    if (pinCode.length < 4) {
      setPinError('PIN phải có ít nhất 4 ký tự!');
      return;
    }
    setPinError('');
    setJoining(true);
    
    // Simulate game lobby join delay
    setTimeout(() => {
      setJoining(false);
      // Pick a random quiz to play
      const randomIdx = Math.floor(Math.random() * quizzesList.length);
      const targetQuiz = quizzesList[randomIdx];
      navigate(`/quizzes/play/${targetQuiz.id}`);
    }, 1200);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'hard': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <Header />
      
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-28 flex flex-col items-center">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fade">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-smart-indigo tracking-wider uppercase mb-4">
            <FiCompass className="text-sm" />
            <span>Sân chơi tự luyện</span>
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight leading-none mb-4">
            Thử thách trắc nghiệm vui
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Học mà chơi, chơi mà học! Trắc nghiệm phản xạ nhanh giúp củng cố từ vựng, ngữ pháp tiếng Anh giao tiếp thông dụng.
          </p>
        </div>

        {/* Game PIN Join Box (E-Learn style) */}
        <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 text-center mb-16 animate-fade">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-1 flex items-center justify-center gap-2">
            <FiZap className="text-yellow-500 fill-yellow-500" /> Vào chơi nhanh bằng PIN
          </h2>
          <p className="text-xs text-slate-400 mb-5 font-semibold">
            Nhập mã PIN bất kỳ để kết nối ngẫu nhiên và tham gia phòng chờ.
          </p>

          <form onSubmit={handleJoinByPin} className="flex gap-3">
            <input
              type="text"
              placeholder="Nhập mã PIN..."
              maxLength={6}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
              className="flex-1 text-center py-2.5 px-4 text-base font-extrabold border border-slate-200 rounded-xl focus:border-smart-indigo focus:ring-0 outline-none uppercase tracking-widest transition-all"
            />
            
            <button
              type="submit"
              disabled={joining}
              className="py-2.5 px-6 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-98 transition-all cursor-pointer shadow-md disabled:bg-slate-400"
            >
              {joining ? 'Đang vào...' : 'Tham gia'}
            </button>
          </form>
          {pinError && <div className="text-red-500 text-[11px] font-bold mt-2 text-left">{pinError}</div>}
        </div>

        {/* Quizzes List Header */}
        <div className="flex items-center w-full max-w-4xl mb-8">
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">Danh sách đề thi hiện có</h2>
          <div className="flex-1 h-[1px] bg-slate-200 ml-4"></div>
        </div>

        {/* Quizzes Grid (Clean White/Slate Theme) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {quizzesList.map((quiz) => (
            <div 
              key={quiz.id} 
              className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 group min-h-[220px]"
            >
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider ${getDifficultyColor(quiz.difficulty)}`}>
                    {quiz.difficulty === 'Easy' ? '☘️ Dễ' : quiz.difficulty === 'Medium' ? '⚡ Trung bình' : '🔥 Khó'}
                  </span>
                  
                  <div className="flex items-center space-x-1 text-slate-400 text-xs font-semibold">
                    <FiClock />
                    <span>{quiz.timeLimit} phút</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-smart-indigo transition-colors mb-2">
                  {quiz.title}
                </h3>
                
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  {quiz.description}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="flex items-center space-x-1.5 text-xs text-slate-400 font-bold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                  <FiBookOpen className="text-smart-indigo" />
                  <span>{quiz.questions?.length || 0} câu hỏi</span>
                </span>

                <button
                  onClick={() => navigate(`/quizzes/play/${quiz.id}`)}
                  className="flex items-center space-x-1.5 px-5 py-2.5 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <FiPlay />
                  <span>Bắt đầu thi</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default QuizzesListPage;
