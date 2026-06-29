import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAward, FiClock, FiBookOpen, FiPlay, FiCompass } from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { getFreeQuizzesList } from '../services/quizzes.service';

const QuizzesListPage = () => {
  const navigate = useNavigate();
  const quizzesList = getFreeQuizzesList();

  const getDifficultyColor = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'hard': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-28">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 animate-fade">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-smart-indigo tracking-wider uppercase mb-4">
            <FiCompass className="text-sm" />
            <span>Sân chơi tự luyện</span>
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight leading-none mb-4">
            Thử thách trắc nghiệm vui
          </h1>
          <p className="text-sm md:text-base text-slate-500 leading-relaxed">
            Học mà chơi, chơi mà học! Tổng hợp các bài trắc nghiệm phản xạ nhanh về từ vựng, thành ngữ, văn hóa du lịch để nâng trình giao tiếp tiếng Anh một cách thú vị nhất.
          </p>
        </div>

        {/* Quizzes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {quizzesList.map((quiz) => (
            <div 
              key={quiz.id} 
              className="bg-white rounded-2xl border border-slate-200/60 p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 group"
            >
              <div>
                {/* Meta details: Difficulty and time */}
                <div className="flex justify-between items-center mb-4">
                  <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${getDifficultyColor(quiz.difficulty)}`}>
                    {quiz.difficulty}
                  </span>
                  
                  <div className="flex items-center space-x-1 text-slate-400 text-xs font-semibold">
                    <FiClock />
                    <span>{quiz.timeLimit} phút</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-800 leading-tight group-hover:text-smart-indigo transition-colors mb-2">
                  {quiz.title}
                </h3>
                
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  {quiz.description}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="flex items-center space-x-1.5 text-xs text-slate-400 font-semibold">
                  <FiBookOpen className="text-smart-indigo" />
                  <span>{quiz.questions?.length || 0} câu hỏi</span>
                </span>

                <button
                  onClick={() => navigate(`/quizzes/play/${quiz.id}`)}
                  className="flex items-center space-x-1.5 px-4.5 py-2 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <FiPlay />
                  <span>Bắt đầu</span>
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
