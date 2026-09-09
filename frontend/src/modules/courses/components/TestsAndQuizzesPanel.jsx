import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiAward, FiClock, FiPlay, FiZap, FiPlus, FiX, 
  FiKey, FiCopy, FiCheck, FiTrash2, FiShield, FiSearch,
  FiChevronRight, FiRefreshCw
} from 'react-icons/fi';
import { 
  getFreeQuizzesList, 
  createQuiz, 
  generateQuizAi, 
  generateQuizAiFromPdf,
  getQuizByPin,
  getAllQuizzesForManagement,
  deleteQuizById
} from '../../quizzes/services/quizzes.service';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { syncClozeGaps, validateClozeDraft, normalizeQuestion, normalizeQuestionsList } from '../../quizzes/utils/openCloze';
import CreateQuizDialog from './CreateQuizDialog';

// Skeleton loading cho Quiz Cards
const QuizCardSkeleton = () => (
  <div className="quiz-card-skeleton animate-pulse">
    <div className="flex justify-between items-center mb-3">
      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
      <div className="h-4 w-14 bg-slate-200 dark:bg-slate-700 rounded"></div>
    </div>
    <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
    <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1"></div>
    <div className="h-3.5 w-2/3 bg-slate-200 dark:bg-slate-700 rounded"></div>
    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
      <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
      <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
    </div>
  </div>
);

const TestsAndQuizzesPanel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const showToast = useToast();

  const userRole = user ? parseInt(user.roleId || user.role_id || user.role, 10) : null;
  const isInstructorOrAdmin = userRole === 1 || userRole === 2;

  const [quizzesList, setQuizzesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');
  const [joining, setJoining] = useState(false);

  // States cho modal Tạo đề thi
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState('Medium');
  const [quizTimeLimit, setQuizTimeLimit] = useState(15);
  const [isPrivateQuiz, setIsPrivateQuiz] = useState(false);
  const [quizPinCode, setQuizPinCode] = useState('');
  const [questionsList, setQuestionsList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [createMode, setCreateMode] = useState('manual'); // 'manual' | 'ai'

  // States sinh câu hỏi bằng AI
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTypes, setAiTypes] = useState([]);

  // States cho modal Quản lý đề thi (Giảng viên / Admin)
  const [showManageModal, setShowManageModal] = useState(false);
  const [managedQuizzes, setManagedQuizzes] = useState([]);
  const [loadingManaged, setLoadingManaged] = useState(false);
  const [manageSearch, setManageSearch] = useState('');
  const [manageFilter, setManageFilter] = useState('all');
  const [copiedPinId, setCopiedPinId] = useState(null);

  // Tải danh sách đề thi công khai
  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const data = await getFreeQuizzesList();
      setQuizzesList(data || []);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách đề thi:', err);
      showToast('Không thể tải danh sách đề thi!', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  // Xử lý tham gia bằng mã PIN
  const handleJoinPin = async (e) => {
    e?.preventDefault();
    if (!pinCode.trim()) {
      setPinError('Vui lòng nhập mã PIN');
      return;
    }

    setJoining(true);
    setPinError('');

    try {
      const quiz = await getQuizByPin(pinCode.trim().toUpperCase());
      if (quiz && quiz.quiz_id) {
        showToast('Kết nối phòng thi thành công!', 'success');
        navigate(`/quizzes/play/${quiz.quiz_id}`);
      } else {
        setPinError('Mã PIN không tồn tại hoặc đề thi đã bị khóa.');
      }
    } catch (err) {
      console.error('Lỗi khi vào phòng thi:', err);
      setPinError(err.response?.data?.message || 'Mã PIN không hợp lệ!');
    } finally {
      setJoining(false);
    }
  };

  // Quản lý đề thi (Giảng viên / Admin)
  const loadManagedQuizzes = async () => {
    try {
      setLoadingManaged(true);
      const data = await getAllQuizzesForManagement();
      setManagedQuizzes(data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách quản lý:', err);
    } finally {
      setLoadingManaged(false);
    }
  };

  const handleOpenManageModal = () => {
    setShowManageModal(true);
    loadManagedQuizzes();
  };

  const handleCopyPin = (quizId, pin) => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPinId(quizId);
    showToast(`Đã sao chép mã PIN: ${pin}`, 'info');
    setTimeout(() => setCopiedPinId(null), 2000);
  };

  const handleDeleteManagedQuiz = async (quizId, title) => {
    if (!window.confirm(t(`Bạn có chắc chắn muốn xóa đề thi "${title}" không?`))) {
      return;
    }
    try {
      await deleteQuizById(quizId);
      showToast('Đã xóa đề thi thành công!', 'success');
      loadManagedQuizzes();
      loadQuizzes();
    } catch (err) {
      console.error('Lỗi khi xóa đề thi:', err);
      showToast(err.response?.data?.message || 'Không thể xóa đề thi!', 'error');
    }
  };

  // Tạo câu hỏi thủ công
  const handleAddQuestion = (questionType = 'multiple_choice') => {
    const isMultipleChoiceLike = ['multiple_choice', 'listening', 'reading'].includes(questionType);
    const baseQuestion = {
      question_text: '',
      question_type: questionType,
      audio_url: questionType === 'listening' ? '' : undefined,
      passage_text: questionType === 'reading' ? '' : undefined,
      options: isMultipleChoiceLike ? ['', '', '', ''] : [],
      correct_answer: isMultipleChoiceLike ? 'A' : '',
      explanation: ''
    };

    setQuestionsList(prev => [
      ...prev,
      baseQuestion
    ]);
  };

  // Sinh đề thi bằng AI
  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      showToast('Vui lòng nhập chủ đề bạn muốn AI tạo câu hỏi', 'warning');
      return;
    }
    try {
      setAiGenerating(true);
      if (aiTypes.length === 0) {
        showToast('Vui lòng chọn ít nhất một dạng câu hỏi', 'warning');
        return;
      }

      const res = await generateQuizAi({
        topic: aiTopic.trim(),
        count: aiCount,
        questionTypes: aiTypes
      });

      if (res && Array.isArray(res.questions) && res.questions.length > 0) {
        const normalizedQuestions = normalizeQuestionsList(res.questions);

        setQuestionsList(normalizedQuestions);
        if (!quizTitle) setQuizTitle(`Bài tập AI: ${aiTopic.trim()}`);
        if (!quizDesc) setQuizDesc(`Đề thi tự động tạo bởi Trợ lý AI E-Learn về chủ đề ${aiTopic.trim()}.`);
        setCreateMode('manual'); // Chuyển sang xem lại câu hỏi
        showToast(`AI đã tạo thành công ${normalizedQuestions.length} câu hỏi!`, 'success');
      } else {
        showToast('Không thể sinh câu hỏi từ AI, vui lòng thử lại!', 'error');
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi AI:', err);
      showToast(err.response?.data?.message || 'Lỗi khi gọi Trợ lý AI!', 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleGenerateAiQuizFromPdf = async ({ files, file, targetLevel, count, questionTypes, additionalNotes }) => {
    try {
      setAiGenerating(true);
      const fileList = Array.isArray(files) && files.length > 0 ? files : (file ? [file] : []);
      const formData = new FormData();
      fileList.forEach(f => {
        formData.append('pdfs', f);
      });
      formData.append('targetLevel', targetLevel || 'auto');
      formData.append('count', String(count || 5));
      formData.append('questionTypes', JSON.stringify(questionTypes || ['multiple_choice']));
      if (additionalNotes) formData.append('additionalNotes', additionalNotes);

      const res = await generateQuizAiFromPdf(formData);
      if (res && Array.isArray(res.questions) && res.questions.length > 0) {
        const normalized = normalizeQuestionsList(res.questions);
        setQuestionsList(normalized);
        if (!quizTitle || quizTitle.startsWith('Quiz AI')) {
          if (fileList.length === 1) {
            const cleanName = fileList[0].name.replace(/\.[^/.]+$/, "");
            setQuizTitle(`Quiz AI: ${cleanName}`);
          } else {
            setQuizTitle(`Quiz AI: Tổng hợp ${fileList.length} đề thi PDF`);
          }
        }
        if (!quizDesc) setQuizDesc(`Đề thi tạo tự động bởi AI tổng hợp từ ${fileList.length} tài liệu PDF: ${fileList.map(f => f.name).join(', ')}.`);
        setCreateMode('manual');
        showToast(`AI đã phân tích ${fileList.length} file PDF và tạo thành công ${normalized.length} câu hỏi!`, 'success');
      } else {
        showToast('Không nhận được câu hỏi từ AI. Vui lòng thử lại với file PDF khác.', 'error');
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi từ nhiều PDF:', err);
      showToast(err.response?.data?.message || 'Không thể tạo đề thi từ file PDF này.', 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  // Nộp form tạo đề thi
  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    if (!quizTitle.trim()) {
      showToast('Vui lòng nhập tiêu đề đề thi', 'warning');
      return;
    }
    if (questionsList.length === 0) {
      showToast('Đề thi phải có ít nhất 1 câu hỏi', 'warning');
      return;
    }
    if (isPrivateQuiz && quizPinCode.trim().length < 4) {
      showToast('Mã PIN riêng tư phải có ít nhất 4 ký tự', 'warning');
      return;
    }

    // Auto-normalize questions before saving
    const cleanedQuestions = normalizeQuestionsList(questionsList);

    const invalidQuestion = cleanedQuestions.find(question => {
      const type = question.question_type || 'multiple_choice';
      if (!String(question.question_text || '').trim()) return true;
      if (type === 'multiple_choice') {
        return !Array.isArray(question.options)
          || question.options.length !== 4
          || question.options.some(option => !String(option).trim())
          || !/^[A-D]$/.test(String(question.correct_answer || ''));
      }
      if (type === 'pronunciation') return !String(question.correct_answer || '').trim();
      if (type === 'open_cloze') return Boolean(validateClozeDraft({
        questionText: question.question_text,
        options: question.options
      }));
      return false;
    });

    if (invalidQuestion) {
      showToast('Vui lòng hoàn thiện nội dung và đáp án của tất cả câu hỏi', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await createQuiz({
        title: quizTitle.trim(),
        description: quizDesc.trim(),
        difficulty: quizDifficulty,
        timeLimit: quizTimeLimit,
        isPrivate: isPrivateQuiz,
        pinCode: isPrivateQuiz ? quizPinCode.trim() : null,
        questions: cleanedQuestions
      });

      showToast('Đã tạo đề thi thành công!', 'success');
      setShowCreateModal(false);
      // Reset
      setQuizTitle('');
      setQuizDesc('');
      setQuestionsList([]);
      setIsPrivateQuiz(false);
      setQuizPinCode('');
      setCreateMode('manual');
      loadQuizzes();
    } catch (err) {
      console.error('Lỗi tạo đề thi:', err);
      showToast(err.response?.data?.message || 'Không thể tạo đề thi!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredManagedQuizzes = managedQuizzes.filter(q => {
    const matchSearch = !manageSearch || 
      (q.title && q.title.toLowerCase().includes(manageSearch.toLowerCase())) ||
      (q.pin_code && q.pin_code.toLowerCase().includes(manageSearch.toLowerCase()));
    const matchFilter = manageFilter === 'all' || 
      (manageFilter === 'private' && q.is_private) ||
      (manageFilter === 'public' && !q.is_private);
    return matchSearch && matchFilter;
  });

  return (
    <div className="tests-quizzes-panel">
      {/* Panel Header */}
      <div className="panel-header-hero">
        <div className="hero-eyebrow">
          <FiZap className="icon-bolt" />
          <span>Practice Arena & Live Reflex</span>
        </div>
        <h1 className="panel-main-title">Interactive Quizzes</h1>
        <p className="panel-subtitle">
          Thực hành bài tập trắc nghiệm ngắn, phản xạ phát âm AI và thi thử nhanh giúp củng cố kiến thức tức thì.
        </p>
      </div>

      {/* Quick PIN Entry Card (Double-Bezel High-End Hardware Style) */}
      <div className="pin-join-outer-card">
        <div className="pin-join-inner-box">
          <div className="pin-box-header">
            <FiZap className="pin-header-icon" />
            <div>
              <h3>Vào chơi nhanh bằng mã PIN</h3>
              <p>Nhập mã PIN đề thi riêng tư để tham gia phòng luyện tập trực tiếp.</p>
            </div>
          </div>

          <form onSubmit={handleJoinPin} className="pin-input-form-row">
            <div className="pin-input-field-wrap">
              <FiKey className="pin-field-icon" />
              <input 
                type="text"
                placeholder="NHẬP MÃ PIN (VD: 882910)..."
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.toUpperCase())}
                maxLength={10}
                className="input-pin-code"
              />
            </div>
            <button 
              type="submit" 
              className="btn-join-pin"
              disabled={joining || !pinCode.trim()}
            >
              {joining ? (
                <>
                  <FiRefreshCw className="animate-spin" /> Đang vào...
                </>
              ) : (
                <>
                  <span>Tham gia</span>
                  <div className="btn-icon-circle">
                    <FiChevronRight />
                  </div>
                </>
              )}
            </button>
          </form>
          {pinError && <p className="pin-error-text">{pinError}</p>}
        </div>
      </div>

      {/* Action Bar (Role-Aware: Tạo đề thi / Quản lý) */}
      <div className="quizzes-action-bar">
        <div className="bar-left-label">
          <h3>Danh sách đề thi có sẵn ({quizzesList.length})</h3>
        </div>

        {isInstructorOrAdmin && (
          <div className="bar-right-buttons">
            <button 
              type="button" 
              className="btn-secondary-manage"
              onClick={handleOpenManageModal}
            >
              <FiShield /> Quản lý Đề & PIN
            </button>
            <button 
              type="button" 
              className="btn-primary-create"
              onClick={() => {
                setQuestionsList([]);
                setShowCreateModal(true);
              }}
            >
              <FiPlus /> Tạo đề thi mới
            </button>
          </div>
        )}
      </div>

      {/* Quizzes List Grid */}
      {loading ? (
        <div className="quizzes-cards-grid">
          {[...Array(4)].map((_, i) => <QuizCardSkeleton key={i} />)}
        </div>
      ) : quizzesList.length === 0 ? (
        <div className="quizzes-empty-box">
          <FiAward className="empty-trophy-icon" />
          <h4>Chưa có đề thi trắc nghiệm công khai</h4>
          <p>Hãy nhập mã PIN đề thi riêng tư hoặc giáo viên có thể tạo đề mới.</p>
        </div>
      ) : (
        <div className="quizzes-cards-grid">
          {quizzesList.map(quiz => {
            const difficultyLabel = quiz.difficulty === 'Easy' ? 'Dễ' : quiz.difficulty === 'Hard' ? 'Khó' : 'Trung bình';
            const difficultyClass = quiz.difficulty === 'Easy' ? 'easy' : quiz.difficulty === 'Hard' ? 'hard' : 'medium';
            
            return (
              <div 
                key={quiz.id}
                className="quiz-card-item"
                onClick={() => navigate(`/quizzes/play/${quiz.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="card-top-badges">
                  <span className={`badge-diff ${difficultyClass}`}>
                    <FiZap /> {difficultyLabel}
                  </span>
                  <span className="badge-time">
                    <FiClock /> {quiz.timeLimit || 15} phút
                  </span>
                </div>

                <div className="card-body-content">
                  <h4 className="quiz-title">{quiz.title}</h4>
                  <p className="quiz-desc">
                    {quiz.description || 'Thử thách phản xạ từ vựng và ngữ pháp tiếng Anh nhanh chóng.'}
                  </p>
                </div>

                <div className="card-bottom-footer">
                  <span className="questions-count">
                    {quiz.questions?.length || 0} câu hỏi
                  </span>
                  <button type="button" className="btn-start-quiz">
                    <span>Bắt đầu thi</span>
                    <FiChevronRight className="arrow-run" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: TẠO ĐỀ THI MỚI (Tích hợp AI Generator)            */}
      {/* ========================================================= */}
      <CreateQuizDialog
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        createMode={createMode}
        onCreateModeChange={setCreateMode}
        quizTitle={quizTitle}
        onQuizTitleChange={setQuizTitle}
        quizDescription={quizDesc}
        onQuizDescriptionChange={setQuizDesc}
        quizDifficulty={quizDifficulty}
        onQuizDifficultyChange={setQuizDifficulty}
        quizTimeLimit={quizTimeLimit}
        onQuizTimeLimitChange={setQuizTimeLimit}
        isPrivate={isPrivateQuiz}
        onPrivateChange={setIsPrivateQuiz}
        pinCode={quizPinCode}
        onPinCodeChange={setQuizPinCode}
        questions={questionsList}
        onQuestionsChange={setQuestionsList}
        onAddQuestion={handleAddQuestion}
        submitting={submitting}
        onSubmit={handleSaveQuiz}
        aiTopic={aiTopic}
        onAiTopicChange={setAiTopic}
        aiCount={aiCount}
        onAiCountChange={setAiCount}
        aiTypes={aiTypes}
        onAiTypesChange={setAiTypes}
        aiGenerating={aiGenerating}
        onGenerateAi={handleGenerateAI}
        onGenerateAiFromPdf={handleGenerateAiQuizFromPdf}
        canUseAi={isInstructorOrAdmin}
      />

      {/* ========================================================= */}
      {/* MODAL 2: QUẢN LÝ ĐỀ THI & MÃ PIN (Giảng viên / Admin)      */}
      {/* ========================================================= */}
      {showManageModal && (
        <div className="vocab-modal-backdrop" onClick={() => setShowManageModal(false)}>
          <div className="vocab-modal-card manage-quiz-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="vocab-modal-header">
              <div className="header-info">
                <span className="collection-icon-badge">🛡️</span>
                <div>
                  <h2 className="collection-modal-title">Quản lý Đề thi & Tra cứu mã PIN</h2>
                  <p className="modal-subtitle-text">Dành riêng cho Giảng viên & Quản trị viên hệ thống</p>
                </div>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setShowManageModal(false)}>
                <FiX />
              </button>
            </div>

            <div className="manage-dialog-body">
              <div className="manage-filter-bar">
                <div className="search-box">
                  <FiSearch />
                  <input 
                    type="text" 
                    placeholder="Tìm theo tên đề thi hoặc mã PIN..." 
                    value={manageSearch}
                    onChange={(e) => setManageSearch(e.target.value)}
                  />
                </div>

                <div className="filter-chips">
                  <button 
                    type="button" 
                    className={manageFilter === 'all' ? 'active' : ''} 
                    onClick={() => setManageFilter('all')}
                  >
                    Tất cả
                  </button>
                  <button 
                    type="button" 
                    className={manageFilter === 'private' ? 'active' : ''} 
                    onClick={() => setManageFilter('private')}
                  >
                    🔒 Có mã PIN
                  </button>
                  <button 
                    type="button" 
                    className={manageFilter === 'public' ? 'active' : ''} 
                    onClick={() => setManageFilter('public')}
                  >
                    🌐 Công khai
                  </button>
                </div>
              </div>

              {loadingManaged ? (
                <p className="py-8 text-center text-slate-500">Đang tải danh sách đề thi quản lý...</p>
              ) : filteredManagedQuizzes.length === 0 ? (
                <p className="py-8 text-center text-slate-400">Không tìm thấy đề thi nào phù hợp.</p>
              ) : (
                <div className="manage-quizzes-table-scroll">
                  {filteredManagedQuizzes.map(quiz => (
                    <div key={quiz.quiz_id} className="manage-quiz-row">
                      <div className="quiz-info-col">
                        <div className="quiz-title-row">
                          <strong className="name">{quiz.title}</strong>
                          {quiz.is_private ? (
                            <span className="badge-private">🔒 Riêng tư</span>
                          ) : (
                            <span className="badge-public">🌐 Công khai</span>
                          )}
                        </div>
                        <div className="quiz-meta-sub">
                          <span>{quiz.difficulty_level || 'Medium'}</span> • 
                          <span>{quiz.time_limit_minutes || 15} phút</span> • 
                          <span>Tác giả: {quiz.creator_name || 'Hệ thống'}</span>
                        </div>
                      </div>

                      <div className="quiz-actions-col">
                        {quiz.is_private && quiz.pin_code && (
                          <button 
                            type="button" 
                            className="btn-copy-pin"
                            onClick={() => handleCopyPin(quiz.quiz_id, quiz.pin_code)}
                            title="Sao chép mã PIN"
                          >
                            {copiedPinId === quiz.quiz_id ? (
                              <>
                                <FiCheck className="text-emerald-500" /> 
                                <span className="pin-text text-emerald-500">{quiz.pin_code}</span>
                              </>
                            ) : (
                              <>
                                <FiCopy /> 
                                <span className="pin-text">{quiz.pin_code}</span>
                              </>
                            )}
                          </button>
                        )}

                        <button 
                          type="button" 
                          className="btn-try-quiz"
                          onClick={() => navigate(`/quizzes/play/${quiz.quiz_id}`)}
                        >
                          <FiPlay /> Thi thử
                        </button>

                        <button 
                          type="button" 
                          className="btn-delete-quiz"
                          onClick={() => handleDeleteManagedQuiz(quiz.quiz_id, quiz.title)}
                          title="Xóa đề thi"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestsAndQuizzesPanel;
