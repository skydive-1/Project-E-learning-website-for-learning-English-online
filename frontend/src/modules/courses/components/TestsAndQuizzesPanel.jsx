import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiAward, FiClock, FiPlay, FiZap, FiPlus, FiX, 
  FiKey, FiLock, FiCopy, FiCheck, FiTrash2, FiShield, FiEye, FiGlobe, FiSearch,
  FiChevronRight, FiCheckCircle, FiCpu, FiRefreshCw
} from 'react-icons/fi';
import { 
  getFreeQuizzesList, 
  createQuiz, 
  generateQuizAi, 
  getQuizByPin,
  getAllQuizzesForManagement,
  deleteQuizById
} from '../../quizzes/services/quizzes.service';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';

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
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đề thi "${title}" không?`)) {
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
  const handleAddQuestion = () => {
    setQuestionsList(prev => [
      ...prev,
      {
        question_text: '',
        question_type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: ''
      }
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
      const res = await generateQuizAi({
        topic: aiTopic.trim(),
        count: aiCount,
        types: { multiple_choice: true, writing: true, pronunciation: true }
      });

      if (res && Array.isArray(res.questions) && res.questions.length > 0) {
        setQuestionsList(res.questions);
        if (!quizTitle) setQuizTitle(`Bài tập AI: ${aiTopic.trim()}`);
        if (!quizDesc) setQuizDesc(`Đề thi tự động tạo bởi Trợ lý AI E-Learn về chủ đề ${aiTopic.trim()}.`);
        setCreateMode('manual'); // Chuyển sang xem lại câu hỏi
        showToast(`AI đã tạo thành công ${res.questions.length} câu hỏi!`, 'success');
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

    try {
      setSubmitting(true);
      await createQuiz({
        title: quizTitle.trim(),
        description: quizDesc.trim(),
        difficulty_level: quizDifficulty,
        time_limit_minutes: quizTimeLimit,
        is_private: isPrivateQuiz,
        pin_code: isPrivateQuiz ? quizPinCode.trim() : null,
        questions: questionsList
      });

      showToast('Đã tạo đề thi thành công!', 'success');
      setShowCreateModal(false);
      // Reset
      setQuizTitle('');
      setQuizDesc('');
      setQuestionsList([]);
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
            const difficultyLabel = quiz.difficulty_level === 'Easy' ? 'Dễ' : quiz.difficulty_level === 'Hard' ? 'Khó' : 'Trung bình';
            const difficultyClass = quiz.difficulty_level === 'Easy' ? 'easy' : quiz.difficulty_level === 'Hard' ? 'hard' : 'medium';
            
            return (
              <div 
                key={quiz.quiz_id} 
                className="quiz-card-item"
                onClick={() => navigate(`/quizzes/play/${quiz.quiz_id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="card-top-badges">
                  <span className={`badge-diff ${difficultyClass}`}>
                    <FiZap /> {difficultyLabel}
                  </span>
                  <span className="badge-time">
                    <FiClock /> {quiz.time_limit_minutes || 15} phút
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
                    {quiz.questions_count || (quiz.questions ? quiz.questions.length : 5)} câu hỏi
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
      {showCreateModal && (
        <div className="vocab-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="vocab-modal-card create-quiz-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="vocab-modal-header">
              <div className="header-info">
                <span className="collection-icon-badge">✨</span>
                <div>
                  <h2 className="collection-modal-title">Tạo đề thi trắc nghiệm mới</h2>
                  <p className="modal-subtitle-text">Tự soạn câu hỏi hoặc dùng Trợ lý AI để sinh đề tự động</p>
                </div>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setShowCreateModal(false)}>
                <FiX />
              </button>
            </div>

            {/* Switch Mode: Manual vs AI */}
            <div className="create-tabs-bar">
              <button 
                type="button" 
                className={`tab-switch-btn ${createMode === 'manual' ? 'active' : ''}`}
                onClick={() => setCreateMode('manual')}
              >
                ✍️ Soạn câu hỏi ({questionsList.length})
              </button>
              <button 
                type="button" 
                className={`tab-switch-btn ${createMode === 'ai' ? 'active' : ''}`}
                onClick={() => setCreateMode('ai')}
              >
                <FiCpu /> Sinh đề bằng Trợ lý AI
              </button>
            </div>

            {createMode === 'ai' ? (
              <div className="ai-generator-body">
                <div className="form-group">
                  <label htmlFor="ai-topic">Chủ đề bài tập muốn AI tạo <span className="req">*</span></label>
                  <input 
                    id="ai-topic"
                    type="text" 
                    placeholder="VD: Phrasal verbs for travel, IELTS Speaking Part 1, Simple Past vs Present Perfect..."
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ai-count">Số lượng câu hỏi</label>
                  <select 
                    id="ai-count"
                    value={aiCount} 
                    onChange={(e) => setAiCount(Number(e.target.value))}
                  >
                    <option value={3}>3 câu hỏi nhanh</option>
                    <option value={5}>5 câu hỏi tiêu chuẩn</option>
                    <option value={10}>10 câu hỏi chuyên sâu</option>
                  </select>
                </div>

                <div className="ai-feature-box">
                  <FiCpu className="ai-icon" />
                  <p>Trợ lý AI sẽ tự động phân bổ câu hỏi trắc nghiệm, bài tập tự luận chấm ngữ pháp và mẫu câu luyện phát âm IPA.</p>
                </div>

                <button 
                  type="button" 
                  className="btn-submit-ai"
                  onClick={handleGenerateAI}
                  disabled={aiGenerating || !aiTopic.trim()}
                >
                  {aiGenerating ? (
                    <>
                      <FiRefreshCw className="animate-spin" /> AI đang soạn câu hỏi...
                    </>
                  ) : (
                    <>
                      <FiCpu /> Bắt đầu tạo câu hỏi AI
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveQuiz} className="manual-quiz-form">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="quiz-title">Tiêu đề đề thi <span className="req">*</span></label>
                    <input 
                      id="quiz-title"
                      type="text" 
                      placeholder="VD: Kiểm tra Thì Hiện Tại Hoàn Thành" 
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="quiz-diff">Độ khó</label>
                    <select 
                      id="quiz-diff"
                      value={quizDifficulty} 
                      onChange={(e) => setQuizDifficulty(e.target.value)}
                    >
                      <option value="Easy">Dễ (Easy)</option>
                      <option value="Medium">Trung bình (Medium)</option>
                      <option value="Hard">Khó (Hard)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="quiz-desc">Mô tả ngắn</label>
                  <input 
                    id="quiz-desc"
                    type="text" 
                    placeholder="Mô tả nội dung trọng tâm của đề thi..." 
                    value={quizDesc}
                    onChange={(e) => setQuizDesc(e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="quiz-time">Thời gian làm bài (Phút)</label>
                    <input 
                      id="quiz-time"
                      type="number" 
                      min={1} 
                      max={180} 
                      value={quizTimeLimit}
                      onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Chế độ bảo mật đề thi</label>
                    <div className="privacy-toggle-row">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={isPrivateQuiz} 
                          onChange={(e) => setIsPrivateQuiz(e.target.checked)} 
                        />
                        <span>Khóa bằng mã PIN riêng tư</span>
                      </label>
                      {isPrivateQuiz && (
                        <input 
                          type="text" 
                          placeholder="MÃ PIN (VD: 123456)" 
                          value={quizPinCode} 
                          onChange={(e) => setQuizPinCode(e.target.value.toUpperCase())}
                          className="pin-inline-input"
                          maxLength={8}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Questions List Editor */}
                <div className="questions-editor-wrap">
                  <div className="editor-header">
                    <h4>Danh sách câu hỏi ({questionsList.length})</h4>
                    <button type="button" className="btn-add-q" onClick={handleAddQuestion}>
                      <FiPlus /> Thêm câu hỏi
                    </button>
                  </div>

                  {questionsList.map((q, idx) => (
                    <div key={idx} className="question-item-card">
                      <div className="q-head">
                        <span className="q-number">Câu {idx + 1}</span>
                        <button 
                          type="button" 
                          className="btn-del-q"
                          onClick={() => setQuestionsList(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <FiTrash2 />
                        </button>
                      </div>

                      <input 
                        type="text"
                        placeholder="Nội dung câu hỏi..."
                        value={q.question_text || ''}
                        onChange={(e) => {
                          const updated = [...questionsList];
                          updated[idx].question_text = e.target.value;
                          setQuestionsList(updated);
                        }}
                        className="q-text-input"
                        required
                      />
                    </div>
                  ))}
                </div>

                <div className="form-footer-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                    Hủy bỏ
                  </button>
                  <button type="submit" className="btn-submit-word" disabled={submitting}>
                    {submitting ? 'Đang lưu...' : 'Xuất bản đề thi'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
