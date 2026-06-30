import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { saveFreeQuiz, saveCourseQuizQuestions } from '../../quizzes/services/quizzes.service';
import { 
  FiUsers, 
  FiTrash2, 
  FiPlus, 
  FiFolder, 
  FiClock, 
  FiFileText, 
  FiArrowUp, 
  FiArrowDown,
  FiBookOpen,
  FiAlertTriangle
} from 'react-icons/fi';
import '../styles/admin.scss';

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // Tab active: 'users' (Quản lý tài khoản) hoặc 'quizzes' (Tạo đề trắc nghiệm)
  const [activeTab, setActiveTab] = useState('users');

  // State Quản lý người dùng
  const [users, setUsers] = useState([]);
  const [filterRole, setFilterRole] = useState('all');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorUsers, setErrorUsers] = useState('');

  // State Tạo đề trắc nghiệm
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [quizType, setQuizType] = useState('standalone'); // 'standalone' hoặc 'course'
  const [aiGenerating, setAiGenerating] = useState(false);
  
  // Fields Quiz
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [quizDiff, setQuizDiff] = useState('Medium');
  const [quizTime, setQuizTime] = useState(5);
  const [questions, setQuestions] = useState([
    {
      id: `q-${Date.now()}-1`,
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 'A',
      explanation: ''
    }
  ]);

  // Fetch danh sách users khi mở tab users
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  // Fetch danh sách khóa học khi mở tab quizzes
  useEffect(() => {
    if (activeTab === 'quizzes') {
      fetchCourses();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setErrorUsers('');
    try {
      const response = await apiClient.get('/admin/users');
      if (response.data && response.data.success) {
        setUsers(response.data.users || []);
      } else {
        setErrorUsers('Không lấy được danh sách người dùng');
      }
    } catch (err) {
      console.error('Lỗi fetch users:', err);
      setErrorUsers(err.response?.data?.message || 'Có lỗi xảy ra khi kết nối server');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses');
      if (response.data && response.data.courses) {
        setCourses(response.data.courses || []);
      }
    } catch (err) {
      console.error('Lỗi fetch courses:', err);
    }
  };

  const handleCourseChange = async (e) => {
    const courseId = e.target.value;
    setSelectedCourseId(courseId);
    setSelectedLessonId('');
    setLessons([]);
    if (!courseId) return;

    try {
      const response = await apiClient.get(`/courses/${courseId}`);
      if (response.data && response.data.sections) {
        // Hợp nhất toàn bộ bài giảng (lessons) từ tất cả các chương (sections)
        const allLessons = [];
        response.data.sections.forEach(section => {
          if (section.lessons) {
            section.lessons.forEach(lesson => {
              allLessons.push(lesson);
            });
          }
        });
        setLessons(allLessons);
      }
    } catch (err) {
      console.error('Lỗi fetch lessons từ course:', err);
    }
  };

  const handleRoleChange = async (userId, currentRole) => {
    // 1: Admin, 2: Instructor, 3: Student
    // Thay đổi nhanh:
    // Nếu là Học sinh (3) -> Nâng lên Giảng viên (2)
    // Nếu là Giảng viên (2) -> Hạ xuống Học sinh (3)
    const newRole = currentRole === 3 ? 2 : 3;
    const actionText = currentRole === 3 ? 'nâng quyền lên Giảng viên' : 'hạ quyền xuống Học sinh';
    
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} cho người dùng này?`)) {
      return;
    }

    try {
      const response = await apiClient.put(`/admin/users/${userId}/role`, { roleId: newRole });
      if (response.data && response.data.success) {
        alert('Cập nhật vai trò người dùng thành công!');
        fetchUsers();
      }
    } catch (err) {
      console.error('Lỗi thay đổi role:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi đổi vai trò');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN người dùng "${username}"?\nTất cả tiến trình học tập và lịch sử chat của người dùng này cũng sẽ bị xóa khỏi hệ thống.`)) {
      return;
    }

    try {
      const response = await apiClient.delete(`/admin/users/${userId}`);
      if (response.data && response.data.success) {
        alert('Đã xóa người dùng thành công!');
        fetchUsers();
      }
    } catch (err) {
      console.error('Lỗi xóa user:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi xóa người dùng');
    }
  };

  // Logic quản lý câu hỏi Quiz
  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q-${Date.now()}-${questions.length + 1}`,
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 'A',
        explanation: ''
      }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length === 1) {
      alert('Phải có ít nhất 1 câu hỏi trong bộ đề!');
      return;
    }
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const handleQuestionTextChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].question = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[optIndex] = value;
    setQuestions(newQuestions);
  };

  const handleCorrectAnswerChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].correctAnswer = value;
    setQuestions(newQuestions);
  };

  const handleExplanationChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].explanation = value;
    setQuestions(newQuestions);
  };

  const handleSubmitQuiz = (e) => {
    e.preventDefault();

    // Validate chung
    if (questions.some(q => !q.question.trim())) {
      alert('Vui lòng điền nội dung cho tất cả các câu hỏi!');
      return;
    }
    if (questions.some(q => q.options.some(opt => !opt.trim()))) {
      alert('Vui lòng nhập đầy đủ 4 đáp án lựa chọn cho tất cả các câu hỏi!');
      return;
    }

    if (quizType === 'standalone') {
      if (!quizTitle.trim() || !quizDesc.trim()) {
        alert('Vui lòng nhập Tiêu đề và Mô tả cho bài Quiz tự do!');
        return;
      }
      
      const newQuiz = {
        id: `fun-${Date.now()}`,
        title: quizTitle.trim(),
        description: quizDesc.trim(),
        difficulty: quizDiff,
        timeLimit: parseInt(quizTime) || 5,
        questions: questions.map((q, idx) => ({
          id: `q-fun-${Date.now()}-${idx + 1}`,
          question: q.question,
          options: q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt.trim()}`),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation.trim()
        }))
      };

      saveFreeQuiz(newQuiz);
      alert(`🎉 Đã tạo thành công bài Quiz tự do "${quizTitle}"! Bài học đã được đưa vào Kho Trắc Nghiệm.`);
      
      // Reset form
      setQuizTitle('');
      setQuizDesc('');
      setQuizDiff('Medium');
      setQuizTime(5);
      setQuestions([
        {
          id: `q-${Date.now()}-1`,
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 'A',
          explanation: ''
        }
      ]);
    } else {
      // Quiz bài học
      if (!selectedCourseId || !selectedLessonId) {
        alert('Vui lòng chọn Khóa học và Bài học!');
        return;
      }

      const formattedQuestions = questions.map((q, idx) => ({
        id: `q-${selectedLessonId}-${idx + 1}`,
        question: q.question.trim(),
        options: q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt.trim()}`),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation.trim()
      }));

      saveCourseQuizQuestions(selectedLessonId, formattedQuestions);
      alert('🎉 Đã tạo/cập nhật bộ đề trắc nghiệm cho bài học thành công!');
      
      // Reset form
      setSelectedCourseId('');
      setSelectedLessonId('');
      setLessons([]);
      setQuestions([
        {
          id: `q-${Date.now()}-1`,
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 'A',
          explanation: ''
        }
      ]);
    }
  };

  const handleAiGenerateQuestions = async () => {
    let topicPrompt = '';
    if (quizType === 'standalone') {
      topicPrompt = quizTitle || quizDesc || '';
    } else {
      const selectedLesson = lessons.find(l => String(l.lesson_id) === String(selectedLessonId));
      topicPrompt = selectedLesson ? selectedLesson.title : '';
    }

    const topicInput = window.prompt(
      'Nhập chủ đề hoặc từ khóa tiếng Anh để AI tạo câu hỏi:',
      topicPrompt
    );

    if (topicInput === null) return;
    if (!topicInput.trim()) {
      alert('Vui lòng nhập chủ đề câu hỏi!');
      return;
    }

    setAiGenerating(true);
    try {
      const response = await apiClient.post('/instructor/generate-quiz', {
        topic: topicInput.trim(),
        count: 5
      });

      if (response.data && response.data.success && response.data.questions) {
        const newQuestions = response.data.questions.map((q, idx) => {
          const cleanOptions = q.options.map(opt => {
            const match = opt.match(/^[A-D]\.\s*(.*)/);
            return match ? match[1] : opt;
          });
          
          return {
            id: `q-ai-${Date.now()}-${idx + 1}`,
            question: q.question,
            options: cleanOptions,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
          };
        });

        setQuestions(newQuestions);
        
        if (quizType === 'standalone') {
          if (!quizTitle.trim()) setQuizTitle(`AI Quiz: ${topicInput}`);
          if (!quizDesc.trim()) setQuizDesc(`Bài kiểm tra trắc nghiệm được tạo tự động bởi AI Gemini về chủ đề: ${topicInput}.`);
        }

        alert('🎉 Đã tự động tạo và tải 5 câu hỏi từ AI Gemini thành công!');
      } else {
        alert('Không thể tạo câu hỏi từ AI. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi từ AI:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi gọi AI Gemini để tạo câu hỏi.');
    } finally {
      setAiGenerating(false);
    }
  };

  // Lọc users hiển thị
  const filteredUsers = users.filter(user => {
    if (filterRole === 'all') return true;
    if (filterRole === 'instructor') return user.role_id === 2;
    if (filterRole === 'student') return user.role_id === 3;
    return true;
  });

  return (
    <>
      <Header />
      
      <div className="admin-dashboard-wrapper">
        <div className="admin-container">
          
          <div className="admin-header">
            <div>
              <h1>Hệ Thống Quản Trị LingoMate</h1>
              <p className="text-slate-500 text-sm mt-1">Quản lý cơ sở dữ liệu người dùng và kiểm soát kho câu hỏi học tập</p>
            </div>
            <span className="admin-badge">System Admin Role</span>
          </div>

          {/* Tab Navigation */}
          <div className="admin-tabs">
            <button 
              className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <FiUsers className="inline mr-2" /> Quản lý tài khoản
            </button>
            <button 
              className={`admin-tab ${activeTab === 'quizzes' ? 'active' : ''}`}
              onClick={() => setActiveTab('quizzes')}
            >
              <FiPlus className="inline mr-2" /> Tạo đề trắc nghiệm (Quiz)
            </button>
          </div>

          {/* Tab Content */}
          <div className="admin-content">
            
            {/* TAB 1: USER MANAGEMENT */}
            {activeTab === 'users' && (
              <div className="users-table-container">
                <div className="table-filters">
                  <button 
                    className={`filter-btn ${filterRole === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterRole('all')}
                  >
                    Tất cả ({users.length})
                  </button>
                  <button 
                    className={`filter-btn ${filterRole === 'instructor' ? 'active' : ''}`}
                    onClick={() => setFilterRole('instructor')}
                  >
                    Giảng viên ({users.filter(u => u.role_id === 2).length})
                  </button>
                  <button 
                    className={`filter-btn ${filterRole === 'student' ? 'active' : ''}`}
                    onClick={() => setFilterRole('student')}
                  >
                    Học sinh ({users.filter(u => u.role_id === 3).length})
                  </button>
                </div>

                {loadingUsers ? (
                  <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-slate-500 mt-4 text-sm">Đang tải dữ liệu người dùng...</p>
                  </div>
                ) : errorUsers ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
                    <FiAlertTriangle className="text-xl" />
                    <span>{errorUsers}</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-center py-10 text-slate-500">Không có người dùng nào khớp bộ lọc.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Tên hiển thị</th>
                        <th>Email / Tên đăng nhập</th>
                        <th>Vai trò</th>
                        <th>Ngày tạo</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.user_id}>
                          <td className="font-mono text-xs">#{user.user_id}</td>
                          <td className="font-bold">{user.full_name || '—'}</td>
                          <td>
                            <div className="text-sm font-semibold">{user.email}</div>
                            <div className="text-xs text-slate-400">@{user.username}</div>
                          </td>
                          <td>
                            <span className={`role-badge ${
                              user.role_id === 1 ? 'role-admin' : 
                              user.role_id === 2 ? 'role-instructor' : 'role-student'
                            }`}>
                              {user.role_name || (user.role_id === 1 ? 'Admin' : user.role_id === 2 ? 'Instructor' : 'Student')}
                            </span>
                          </td>
                          <td className="text-xs text-slate-500">
                            {user.created_date ? new Date(user.created_date).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td>
                            <div className="action-buttons">
                              {user.role_id !== 1 && (
                                <>
                                  <button 
                                    className={`btn-action ${user.role_id === 3 ? 'btn-promote' : 'btn-demote'}`}
                                    onClick={() => handleRoleChange(user.user_id, user.role_id)}
                                    title={user.role_id === 3 ? 'Nâng lên Giảng viên' : 'Hạ xuống Học sinh'}
                                  >
                                    {user.role_id === 3 ? <FiArrowUp /> : <FiArrowDown />}
                                  </button>
                                  <button 
                                    className="btn-action btn-delete"
                                    onClick={() => handleDeleteUser(user.user_id, user.username)}
                                    title="Xóa tài khoản"
                                  >
                                    <FiTrash2 />
                                  </button>
                                </>
                              )}
                              {user.role_id === 1 && (
                                <span className="text-xs text-slate-400 font-semibold italic">Không thể tác động</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 2: QUIZ CREATOR */}
            {activeTab === 'quizzes' && (
              <div className="quiz-creator-container">
                <form onSubmit={handleSubmitQuiz}>
                  
                  {/* Cấu hình chung của đề Quiz */}
                  <div className="form-section">
                    <h3>Cấu Hình Đề Trắc Nghiệm</h3>
                    
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Loại đề trắc nghiệm</label>
                        <select 
                          value={quizType}
                          onChange={(e) => {
                            setQuizType(e.target.value);
                            setSelectedCourseId('');
                            setSelectedLessonId('');
                            setLessons([]);
                          }}
                        >
                          <option value="standalone">Đề tự do giải trí (Standalone / Entertainment)</option>
                          <option value="course">Bộ câu hỏi theo Bài Học (Course / Lesson Quiz)</option>
                        </select>
                      </div>

                      {quizType === 'standalone' ? (
                        <>
                          <div className="form-group">
                            <label>Độ khó</label>
                            <select value={quizDiff} onChange={(e) => setQuizDiff(e.target.value)}>
                              <option value="Easy">Dễ (Easy)</option>
                              <option value="Medium">Trung bình (Medium)</option>
                              <option value="Hard">Khó (Hard)</option>
                            </select>
                          </div>
                          
                          <div className="form-group">
                            <label>Giới hạn thời gian (phút)</label>
                            <input 
                              type="number" 
                              min="1" 
                              max="60"
                              value={quizTime}
                              onChange={(e) => setQuizTime(parseInt(e.target.value) || 5)}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="form-group">
                            <label>Chọn khóa học</label>
                            <select value={selectedCourseId} onChange={handleCourseChange}>
                              <option value="">-- Chọn Khóa Học --</option>
                              {courses.map(course => (
                                <option key={course.course_id} value={course.course_id}>
                                  {course.course_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Chọn bài học</label>
                            <select 
                              value={selectedLessonId}
                              onChange={(e) => setSelectedLessonId(e.target.value)}
                              disabled={!selectedCourseId}
                            >
                              <option value="">-- Chọn Bài Học --</option>
                              {lessons.map(lesson => (
                                <option key={lesson.lesson_id} value={lesson.lesson_id}>
                                  {lesson.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>

                    {quizType === 'standalone' && (
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                          <label>Tiêu đề bài trắc nghiệm</label>
                          <input 
                            type="text" 
                            placeholder="Ví dụ: English Slangs & Idioms Quiz"
                            value={quizTitle}
                            onChange={(e) => setQuizTitle(e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label>Mô tả tóm tắt</label>
                          <textarea 
                            placeholder="Mô tả nội dung thử thách hoặc kiến thức kiểm tra..."
                            value={quizDesc}
                            onChange={(e) => setQuizDesc(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Danh sách câu hỏi */}
                  <div className="form-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3>Danh Sách Câu Hỏi</h3>
                      <button
                        type="button"
                        onClick={handleAiGenerateQuestions}
                        disabled={aiGenerating}
                        className="btn-ai-generate"
                        style={{
                          backgroundColor: '#4f46e5',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        {aiGenerating ? 'Đang tạo...' : '✨ Tự động tạo bằng AI'}
                      </button>
                    </div>
                    <div className="questions-list">
                      {questions.map((q, qIndex) => (
                        <div className="question-card" key={q.id}>
                          
                          <div className="question-header">
                            <span>Câu hỏi {qIndex + 1}</span>
                            <button 
                              type="button" 
                              className="btn-remove-q"
                              onClick={() => handleRemoveQuestion(qIndex)}
                            >
                              Xóa câu hỏi
                            </button>
                          </div>

                          <div className="form-group mb-4">
                            <label>Nội dung câu hỏi</label>
                            <input 
                              type="text" 
                              placeholder="Ví dụ: When someone says 'Break a leg!', what do they mean?"
                              value={q.question}
                              onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                            />
                          </div>

                          <div className="options-grid">
                            {q.options.map((opt, optIndex) => (
                              <div className="form-group" key={optIndex}>
                                <label>Lựa chọn {String.fromCharCode(65 + optIndex)}</label>
                                <input 
                                  type="text" 
                                  placeholder={`Lựa chọn ${String.fromCharCode(65 + optIndex)}...`}
                                  value={opt}
                                  onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>

                          <div className="form-grid">
                            <div className="form-group">
                              <label>Đáp án đúng</label>
                              <select 
                                value={q.correctAnswer} 
                                onChange={(e) => handleCorrectAnswerChange(qIndex, e.target.value)}
                              >
                                <option value="A">Lựa chọn A</option>
                                <option value="B">Lựa chọn B</option>
                                <option value="C">Lựa chọn C</option>
                                <option value="D">Lựa chọn D</option>
                              </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                              <label>Lời giải thích chi tiết</label>
                              <input 
                                type="text" 
                                placeholder="Giải thích vì sao lựa chọn này đúng..."
                                value={q.explanation}
                                onChange={(e) => handleExplanationChange(qIndex, e.target.value)}
                              />
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>

                    <button 
                      type="button" 
                      className="btn-add-q" 
                      onClick={handleAddQuestion}
                    >
                      + Thêm câu hỏi mới
                    </button>
                  </div>

                  <div className="text-right">
                    <button type="submit" className="btn-submit-quiz">
                      Lưu và Phát Hành Bộ Đề
                    </button>
                  </div>

                </form>
              </div>
            )}

          </div>

        </div>
      </div>

      <Footer />
    </>
  );
};

export default AdminDashboard;
