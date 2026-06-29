import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiAward, FiMessageSquare } from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import QuizContent from '../../lessons/components/QuizContent';

const PlayQuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-28 flex flex-col space-y-6">
        {/* Navigation back and header */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/quizzes')}
            className="flex items-center space-x-2 text-xs font-bold text-slate-500 hover:text-smart-indigo transition-colors"
          >
            <FiArrowLeft className="text-sm" />
            <span>Quay lại danh sách đề thi</span>
          </button>
        </div>

        {/* Standalone Quiz Area */}
        <div className="w-full">
          <QuizContent 
            quizId={quizId} 
            isFreeQuiz={true} 
            onComplete={(score, total) => {
              // Custom play-completion logic if needed
            }}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PlayQuizPage;
