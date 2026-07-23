import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAward, FiClock, FiBookOpen, FiPlay, FiCompass, FiZap, FiPlus } from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { getFreeQuizzesList, createQuiz, generateQuizAi } from '../services/quizzes.service';
import { useAuth } from '../../../context/AuthContext';

// Component Skeleton Loading cho thẻ Quiz
const QuizCardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 flex flex-col justify-between shadow-sm animate-pulse min-h-[220px] gap-4">
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded opacity-50"></div>
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded opacity-50"></div>
        </div>
        <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-2 opacity-50"></div>
        <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 opacity-50"></div>
        <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded opacity-50"></div>
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg opacity-50"></div>
        <div className="h-9 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl opacity-50"></div>
      </div>
    </div>
  );
};

const QuizzesListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user ? parseInt(user.roleId || user.role_id || user.role, 10) : null;
  const isInstructorOrAdmin = userRole === 1 || userRole === 2;

  const [quizzesList, setQuizzesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');
  const [joining, setJoining] = useState(false);

  // States cho modal tạo đề thi tự luyện mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState('Medium');
  const [quizTimeLimit, setQuizTimeLimit] = useState(15);
  const [questionsList, setQuestionsList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [numQuestionsToAdd, setNumQuestionsToAdd] = useState(1);

  // States sinh câu hỏi bằng AI (Dành riêng cho Admin)
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTypes, setAiTypes] = useState({
    multiple_choice: true,
    writing: true,
    pronunciation: true
  });

  const handleAddQuestion = (type) => {
    const newQuestions = [];
    for (let i = 0; i < numQuestionsToAdd; i++) {
      newQuestions.push({
        questionType: type,
        questionText: '',
        options: type === 'multiple_choice' ? ['', '', '', ''] : [],
        correctAnswer: type === 'multiple_choice' ? 'A' : '',
        explanation: ''
      });
    }
    setQuestionsList(prev => [...prev, ...newQuestions]);
  };

  const handleRemoveQuestion = (index) => {
    setQuestionsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateQuestion = (index, field, value) => {
    setQuestionsList(prev => prev.map((q, idx) => idx === index ? { ...q, [field]: value } : q));
  };

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const list = await getFreeQuizzesList();
      setQuizzesList(list);
    } catch (err) {
      console.error("Lỗi tải danh sách trắc nghiệm:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

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

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!quizTitle.trim()) return alert('Vui lòng nhập tiêu đề đề thi!');
    if (questionsList.length === 0) return alert('Vui lòng thêm ít nhất một câu hỏi!');

    try {
      setSubmitting(true);
      const payload = {
        title: quizTitle,
        description: quizDesc,
        difficulty: quizDifficulty,
        timeLimit: Number(quizTimeLimit),
        questions: questionsList
      };
      await createQuiz(payload);
      alert('Tạo đề thi tự luyện mới thành công!');
      setShowCreateModal(false);
      // Reset form states
      setQuizTitle('');
      setQuizDesc('');
      setQuizDifficulty('Medium');
      setQuizTimeLimit(15);
      setQuestionsList([]);
      // Reload list
      await loadQuizzes();
    } catch (err) {
      console.error("Lỗi tạo đề thi:", err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo đề thi!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateQuestionsWithAi = async () => {
    if (!aiTopic.trim()) return alert('Vui lòng nhập chủ đề sinh câu hỏi!');
    
    const selectedTypes = Object.entries(aiTypes)
      .filter(([_, checked]) => checked)
      .map(([type]) => type);

    if (selectedTypes.length === 0) {
      return alert('Vui lòng chọn ít nhất một dạng câu hỏi để AI sinh đề!');
    }

    try {
      setAiGenerating(true);
      const payload = {
        topic: aiTopic,
        count: aiCount,
        questionTypes: selectedTypes
      };
      const res = await generateQuizAi(payload);
      if (res.success && Array.isArray(res.questions)) {
        const newQuestions = res.questions.map(q => ({
          questionType: q.questionType,
          questionText: q.questionText,
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || ''
        }));
        setQuestionsList(prev => [...prev, ...newQuestions]);
        setAiTopic('');
        alert(`Đã tự động tạo và thêm ${newQuestions.length} câu hỏi thành công từ AI! Bạn có thể chỉnh sửa thêm bên dưới.`);
      }
    } catch (error) {
      console.error("Lỗi khi sinh câu hỏi AI:", error);
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi trợ lý AI đang sinh câu hỏi!');
    } finally {
      setAiGenerating(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800';
      case 'hard': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800';
      default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };



  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <Header />
      
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-28 flex flex-col items-center">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fade">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-smart-indigo tracking-wider uppercase mb-4 dark:bg-indigo-950/20 dark:border-indigo-900/50 dark:text-indigo-400">
            <FiCompass className="text-sm" />
            <span>Sân chơi tự luyện</span>
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-4">
            Thử thách trắc nghiệm vui
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-405 leading-relaxed">
            Học mà chơi, chơi mà học! Trắc nghiệm phản xạ nhanh giúp củng cố từ vựng, ngữ pháp tiếng Anh giao tiếp thông dụng.
          </p>
        </div>

        {/* Game PIN Join Box (E-Learn style) */}
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700 text-center mb-16 animate-fade">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-1 flex items-center justify-center gap-2">
            <FiZap className="text-yellow-500 fill-yellow-500" /> Vào chơi nhanh bằng PIN
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-5 font-semibold">
            Nhập mã PIN bất kỳ để kết nối ngẫu nhiên và tham gia phòng chờ.
          </p>

          <form onSubmit={handleJoinByPin} className="flex gap-3">
            <input
              type="text"
              placeholder="Nhập mã PIN..."
              maxLength={6}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
              className="flex-1 text-center py-2.5 px-4 text-base font-extrabold border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-xl focus:border-smart-indigo focus:ring-0 outline-none uppercase tracking-widest transition-all"
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
        <div className="flex justify-between items-center w-full max-w-4xl mb-8">
          <div className="flex items-center flex-1">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Danh sách đề thi hiện có</h2>
            <div className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800 ml-4 mr-4"></div>
          </div>
          {isInstructorOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
            >
              <FiPlus /> <span>Tạo đề thi mới</span>
            </button>
          )}
        </div>

        {/* Quizzes Grid (Clean White/Slate Theme) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {loading ? (
            [...Array(4)].map((_, i) => <QuizCardSkeleton key={i} />)
          ) : (
            quizzesList.map((quiz) => (
              <div 
                key={quiz.id} 
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300 group min-h-[220px]"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider ${getDifficultyColor(quiz.difficulty)}`}>
                      {quiz.difficulty === 'Easy' ? '☘️ Dễ' : quiz.difficulty === 'Medium' ? '⚡ Trung bình' : '🔥 Khó'}
                    </span>
                    
                    <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                      <FiClock />
                      <span>{quiz.timeLimit} phút</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-smart-indigo dark:group-hover:text-indigo-400 transition-colors mb-2">
                    {quiz.title}
                  </h3>
                  
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {quiz.description}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
                  <span className="flex flex-col items-start gap-1 text-[11px] text-slate-400 dark:text-slate-350 font-bold bg-slate-50 dark:bg-slate-900/60 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="flex items-center space-x-1.5">
                      <FiBookOpen className="text-smart-indigo dark:text-indigo-400 text-xs" />
                      <span className="text-slate-650 dark:text-slate-300">{quiz.questions?.length || 0} câu hỏi</span>
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-550 font-semibold mt-0.5">
                      (Trắc nghiệm: {quiz.questions?.filter(q => q.questionType === 'multiple_choice' || !q.questionType).length || 0} | Viết: {quiz.questions?.filter(q => q.questionType === 'writing').length || 0} | Nói: {quiz.questions?.filter(q => q.questionType === 'pronunciation').length || 0})
                    </span>
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
            ))
          )}
        </div>
      </main>

      {/* Create Standalone Quiz Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200/80 dark:border-slate-700/50 flex flex-col gap-6 text-slate-800 dark:text-slate-100">
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                ✨ Tạo đề thi tự luyện mới
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1">
                Biên soạn đề thi trắc nghiệm hoặc viết luận, phát âm tự do (không đính kèm bài giảng).
              </p>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-6">
              {/* Quiz Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tiêu đề đề thi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Luyện viết thư phàn nàn IELTS Writing Task 1..."
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-smart-indigo outline-none transition-all text-sm font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Độ khó</label>
                    <select
                      value={quizDifficulty}
                      onChange={(e) => setQuizDifficulty(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-smart-indigo outline-none transition-all text-sm font-semibold"
                    >
                      <option value="Easy">Easy (Dễ)</option>
                      <option value="Medium">Medium (Trung bình)</option>
                      <option value="Hard">Hard (Khó)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thời gian (phút)</label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={quizTimeLimit}
                      onChange={(e) => setQuizTimeLimit(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-smart-indigo outline-none transition-all text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mô tả đề thi</label>
                <textarea
                  placeholder="Mô tả nội dung thử thách, mục tiêu luyện tập..."
                  rows={2}
                  value={quizDesc}
                  onChange={(e) => setQuizDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-smart-indigo outline-none transition-all text-sm font-semibold resize-none"
                />
              </div>

              {/* AI Generate Questions Section - ONLY FOR ADMIN (role 1) */}
              {userRole === 1 && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-purple-750 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🤖 Trợ lý AI sinh đề tự động (Admin)</span>
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-12 flex flex-col gap-1.5 mb-2">
                      <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Thể loại câu hỏi muốn AI sinh:</label>
                      <div className="flex flex-wrap gap-4 mt-1 bg-white/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-purple-100/50 dark:border-purple-900/20">
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-purple-800 dark:text-purple-300">
                          <input
                            type="checkbox"
                            checked={aiTypes.multiple_choice}
                            onChange={(e) => setAiTypes(prev => ({ ...prev, multiple_choice: e.target.checked }))}
                            className="rounded border-purple-300 dark:border-purple-800 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                          />
                          <span>Trắc nghiệm (Multiple Choice)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-purple-800 dark:text-purple-300">
                          <input
                            type="checkbox"
                            checked={aiTypes.writing}
                            onChange={(e) => setAiTypes(prev => ({ ...prev, writing: e.target.checked }))}
                            className="rounded border-purple-300 dark:border-purple-800 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                          />
                          <span>Tự luận (Writing)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-purple-800 dark:text-purple-300">
                          <input
                            type="checkbox"
                            checked={aiTypes.pronunciation}
                            onChange={(e) => setAiTypes(prev => ({ ...prev, pronunciation: e.target.checked }))}
                            className="rounded border-purple-300 dark:border-purple-800 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                          />
                          <span>Luyện nói phát âm (Pronunciation)</span>
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-6 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Chủ đề đề bài (Tiếng Anh)</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Job interview, Daily life, Past simple..."
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 border border-purple-200 dark:border-purple-900/50 rounded-xl focus:border-purple-500 outline-none text-xs font-semibold"
                      />
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Số câu hỏi</label>
                      <select
                        value={aiCount}
                        onChange={(e) => setAiCount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 border border-purple-200 dark:border-purple-900/50 rounded-xl focus:border-purple-500 outline-none text-xs font-semibold"
                      >
                        <option value={3}>3 câu</option>
                        <option value={5}>5 câu</option>
                        <option value={10}>10 câu</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <button
                        type="button"
                        disabled={aiGenerating || !aiTopic.trim()}
                        onClick={handleGenerateQuestionsWithAi}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {aiGenerating ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Đang tạo...</span>
                          </>
                        ) : (
                          <span>Sinh đề AI</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Questions List Editor */}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex flex-col gap-0.5 md:flex-row md:items-center">
                    <span>Danh sách câu hỏi ({questionsList.length})</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold normal-case md:ml-2">
                      (Trắc nghiệm: {questionsList.filter(q => q.questionType === 'multiple_choice').length} | Viết: {questionsList.filter(q => q.questionType === 'writing').length} | Nói: {questionsList.filter(q => q.questionType === 'pronunciation').length})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">Số lượng thêm:</span>
                      <select
                        value={numQuestionsToAdd}
                        onChange={(e) => setNumQuestionsToAdd(Number(e.target.value))}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-700 text-[11px] font-bold rounded-lg focus:border-smart-indigo outline-none dark:text-slate-100"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddQuestion('multiple_choice')}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/45 dark:hover:bg-indigo-900/65 text-indigo-650 dark:text-indigo-400 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all"
                    >
                      + Trắc nghiệm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('writing')}
                      className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/45 dark:hover:bg-violet-900/65 text-violet-650 dark:text-violet-400 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all"
                    >
                      + Tự luận (Writing)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('pronunciation')}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/45 dark:hover:bg-emerald-900/65 text-emerald-650 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all"
                    >
                      + Luyện đọc (Pronunciation)
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                  {questionsList.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      Chưa có câu hỏi nào. Nhấp các nút phía trên để thêm câu hỏi!
                    </div>
                  ) : (
                    questionsList.map((q, index) => (
                      <div key={index} className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 rounded-xl relative space-y-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(index)}
                          className="absolute top-3 right-3 text-slate-400 hover:text-red-500 text-xs font-bold"
                        >
                          Xóa
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/80 text-smart-indigo dark:text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider">
                            Câu {index + 1} - {q.questionType === 'multiple_choice' ? 'Trắc nghiệm' : q.questionType === 'writing' ? 'Tự luận' : 'Phát âm'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Câu hỏi/Đề bài *</label>
                          <input
                            type="text"
                            required
                            placeholder="Nhập nội dung câu hỏi..."
                            value={q.questionText}
                            onChange={(e) => handleUpdateQuestion(index, 'questionText', e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-smart-indigo outline-none transition-all text-xs font-semibold"
                          />
                        </div>

                        {q.questionType === 'multiple_choice' && (
                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-1">
                                <span className="text-xs font-bold text-slate-400">{String.fromCharCode(65 + oIdx)}.</span>
                                <input
                                  type="text"
                                  required
                                  placeholder={`Lựa chọn ${String.fromCharCode(65 + oIdx)}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...q.options];
                                    newOpts[oIdx] = e.target.value;
                                    handleUpdateQuestion(index, 'options', newOpts);
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-smart-indigo outline-none transition-all text-xs font-semibold"
                                />
                              </div>
                            ))}
                            <div className="col-span-2 flex items-center gap-2 mt-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đáp án đúng:</label>
                              <select
                                value={q.correctAnswer}
                                onChange={(e) => handleUpdateQuestion(index, 'correctAnswer', e.target.value)}
                                className="px-3 py-1 bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-smart-indigo outline-none text-xs font-semibold"
                              >
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {q.questionType === 'pronunciation' && (
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mẫu câu tiếng Anh chuẩn bắt buộc phát âm *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ví dụ: Welcome to our speaking class."
                              value={q.correctAnswer}
                              onChange={(e) => handleUpdateQuestion(index, 'correctAnswer', e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-smart-indigo outline-none transition-all text-xs font-semibold"
                            />
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giải thích đáp án</label>
                          <input
                            type="text"
                            placeholder="Nhập giải thích vì sao đáp án đúng..."
                            value={q.explanation}
                            onChange={(e) => handleUpdateQuestion(index, 'explanation', e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-smart-indigo outline-none transition-all text-xs font-semibold"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-smart-indigo hover:bg-indigo-650 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 disabled:bg-slate-400"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo đề thi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default QuizzesListPage;
