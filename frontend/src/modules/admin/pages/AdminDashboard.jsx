import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
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
  FiAlertTriangle,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
  FiEdit,
  FiCpu,
  FiBell
} from 'react-icons/fi';
import '../styles/admin.scss';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import UserAnalyticsDashboard from '../components/UserAnalyticsDashboard';
import AIQuotaControlCenter from '../components/AIQuotaControlCenter';
import AdminAlertsPanel from '../components/AdminAlertsPanel';
import CourseTranscriptHealthPanel from '../components/CourseTranscriptHealthPanel';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const showToast = useToast();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const deepLinkUserId = Number(new URLSearchParams(window.location.search).get('userId')) || null;
  
  const isAdmin = currentUser?.role === 'admin' || currentUser?.roleId === 1 || currentUser?.role_id === 1;
  // Backend là nguồn sự thật về đặc quyền; frontend chỉ dùng cờ này để hiển thị UI.
  const isSuperAdmin = currentUser?.isSuperAdmin === true || currentUser?.is_super_admin === true;
  
  // Cho phép mở thẳng một tab từ URL, ví dụ /admin/dashboard?tab=ai-quota.
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    return ['users', 'courses', 'security', 'analytics', 'ai-quota'].includes(requestedTab) ? requestedTab : 'users';
  });

  // State Cấu hình bảo mật
  const [securityConfig, setSecurityConfig] = useState({
    blockStudent: true,
    blockInstructor: false,
    blockF12: true,
    blockInspect: true,
    blockViewSource: true,
    blockRightClick: true
  });

  // Tải cấu hình bảo mật từ localStorage khi component load
  useEffect(() => {
    const savedConfig = localStorage.getItem('admin_security_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setSecurityConfig(prev => ({
            ...prev,
            ...parsed
          }));
        }
      } catch (err) {
        console.error('Lỗi parse security config:', err);
      }
    }
  }, []);

  const handleSecurityToggle = (key) => {
    const updated = {
      ...securityConfig,
      [key]: !securityConfig[key]
    };
    setSecurityConfig(updated);
    localStorage.setItem('admin_security_config', JSON.stringify(updated));
  };

  // State Quản lý người dùng
  const [users, setUsers] = useState([]);
  const [filterRole, setFilterRole] = useState('all');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorUsers, setErrorUsers] = useState('');
  const [focusedUserId, setFocusedUserId] = useState(null);

  // State Tạo đề trắc nghiệm
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [errorCourses, setErrorCourses] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [courseStatusFilter, setCourseStatusFilter] = useState('all');
  const [pendingDeleteCourse, setPendingDeleteCourse] = useState(null);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
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

  useEffect(() => {
    if (activeTab !== 'users' || !deepLinkUserId || !users.some((user) => Number(user.user_id) === deepLinkUserId)) {
      return undefined;
    }

    setFilterRole('all');
    setFocusedUserId(deepLinkUserId);
    const scrollTimer = window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(`admin-user-${deepLinkUserId}`)?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    }, 80);
    const clearTimer = window.setTimeout(() => setFocusedUserId(null), 6000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [activeTab, deepLinkUserId, users]);

  // Fetch danh sách khóa học khi Admin / Super Admin quản lý khóa học.
  useEffect(() => {
    if (activeTab === 'courses') {
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
    setLoadingCourses(true);
    setErrorCourses('');
    try {
      const response = await apiClient.get('/courses?includeDrafts=true');
      if (response.data && response.data.courses) {
        setCourses(response.data.courses || []);
      } else {
        setCourses([]);
        setErrorCourses('Không lấy được danh sách khóa học.');
      }
    } catch (err) {
      console.error('Lỗi fetch courses:', err);
      setErrorCourses(err.response?.data?.message || 'Không thể kết nối máy chủ để tải khóa học.');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!pendingDeleteCourse || !isSuperAdmin) return;

    const courseId = pendingDeleteCourse.course_id;
    setDeletingCourseId(courseId);
    try {
      await apiClient.delete(`/courses/${courseId}`);
      setCourses((current) => current.filter((course) => course.course_id !== courseId));
      setPendingDeleteCourse(null);
      showToast(`Đã xóa khóa học “${pendingDeleteCourse.course_name}”.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    } catch (err) {
      console.error('Lỗi xóa khóa học:', err);
      showToast(err.response?.data?.message || 'Không thể xóa khóa học. Vui lòng thử lại.', 'error');
    } finally {
      setDeletingCourseId(null);
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

const handleRoleChange = async (userId, targetRoleId, targetRoleName) => {
    if (!window.confirm(t(`Bạn có chắc chắn muốn chuyển vai trò người dùng này thành "${targetRoleName}"?`))) {
      return;
    }

    try {
      const response = await apiClient.put(`/admin/users/${userId}/role`, { roleId: targetRoleId });
      if (response.data && response.data.success) {
        showToast('Cập nhật vai trò người dùng thành công!', 'success');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      }
    } catch (err) {
      console.error('Lỗi thay đổi role:', err);
      showToast(err.response?.data?.message || 'Có lỗi xảy ra khi đổi vai trò', 'error');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(t(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN người dùng "${username}"?\nTất cả tiến trình học tập và lịch sử chat của người dùng này cũng sẽ bị xóa khỏi hệ thống.`))) {
      return;
    }

    try {
      const response = await apiClient.delete(`/admin/users/${userId}`);
      if (response.data && response.data.success) {
        showToast('Đã xóa người dùng thành công!', 'success');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      }
    } catch (err) {
      console.error('Lỗi xóa user:', err);
      showToast(err.response?.data?.message || 'Có lỗi xảy ra khi xóa người dùng', 'error');
    }
  };

  const handleResetUserToken = async (userId, username) => {
    if (!window.confirm(t('Bạn có chắc muốn đặt lại lượt hỏi AI của "{{name}}" về 0?', { name: username }))) {
      return;
    }

    try {
      const response = await apiClient.post(`/admin/users/${userId}/reset-token`);
      if (response.data && response.data.success) {
        showToast(t('Đã đặt lại lượt hỏi cho {{name}}.', { name: username }), 'success');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'ai-quota'] });
      }
    } catch (err) {
      console.error('Lỗi reset token:', err);
      showToast(err.response?.data?.message || t('Không thể đặt lại lượt hỏi. Vui lòng thử lại.'), 'error');
    }
  };

  const handleBulkResetTokens = async (roleId) => {
    const roleName = roleId === 2
      ? t('instructorRoleLabel').toLowerCase()
      : t('student').toLowerCase();
    if (!window.confirm(t('Bạn có chắc muốn đặt lại lượt hỏi AI của tất cả {{role}} về 0?', { role: roleName }))) {
      return;
    }

    try {
      const response = await apiClient.post('/admin/users/reset-tokens', { roleId });
      if (response.data && response.data.success) {
        showToast(t('Đã đặt lại lượt hỏi cho tất cả {{role}}.', { role: roleName }), 'success');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'ai-quota'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      }
    } catch (err) {
      console.error('Lỗi reset token hàng loạt:', err);
      showToast(t('Không thể đặt lại lượt hỏi hàng loạt. Vui lòng thử lại.'), 'error');
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
      showToast('Phải có ít nhất 1 câu hỏi trong bộ đề!', 'warning');
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

  const handleSubmitQuiz = async (e) => {
    e.preventDefault();

    // Validate chung
    if (questions.some(q => !q.question.trim())) {
      showToast('Vui lòng điền nội dung cho tất cả các câu hỏi!', 'warning');
      return;
    }
    if (questions.some(q => q.options.some(opt => !opt.trim()))) {
      showToast('Vui lòng nhập đầy đủ 4 đáp án lựa chọn cho tất cả các câu hỏi!', 'warning');
      return;
    }

    if (quizType === 'standalone') {
      if (!quizTitle.trim() || !quizDesc.trim()) {
        showToast('Vui lòng nhập Tiêu đề và Mô tả cho bài Quiz tự do!', 'warning');
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

      try {
        await saveFreeQuiz(newQuiz);
      } catch (error) {
        console.error('Lỗi lưu bài Quiz tự do:', error);
        showToast(error.response?.data?.message || 'Không thể lưu bài Quiz. Dữ liệu chưa được ghi lên máy chủ.', 'error');
        return;
      }
      showToast(`🎉 Đã tạo thành công bài Quiz tự do "${quizTitle}"! Bài học đã được đưa vào Kho Trắc Nghiệm.`, 'success');
      
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
        showToast('Vui lòng chọn Khóa học và Bài học!', 'warning');
        return;
      }

      const formattedQuestions = questions.map((q, idx) => ({
        id: `q-${selectedLessonId}-${idx + 1}`,
        question: q.question.trim(),
        options: q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt.trim()}`),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation.trim()
      }));

      try {
        const selectedLesson = lessons.find((lesson) => String(lesson.lesson_id) === String(selectedLessonId));
        await saveCourseQuizQuestions(selectedLessonId, formattedQuestions, {
          courseId: selectedCourseId,
          title: selectedLesson ? `Trắc nghiệm: ${selectedLesson.title}` : `Trắc nghiệm bài học ${selectedLessonId}`,
          description: selectedLesson ? `Bộ câu hỏi luyện tập cho bài học: ${selectedLesson.title}` : undefined
        });
      } catch (error) {
        console.error('Lỗi lưu bộ câu hỏi bài học:', error);
        showToast(error.response?.data?.message || 'Không thể lưu bộ câu hỏi. Dữ liệu chưa được ghi lên máy chủ.', 'error');
        return;
      }
      showToast('🎉 Đã tạo/cập nhật bộ đề trắc nghiệm cho bài học thành công!', 'success');
      
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
      t('Nhập chủ đề hoặc từ khóa tiếng Anh để AI tạo câu hỏi:'),
      topicPrompt
    );

    if (topicInput === null) return;
    if (!topicInput.trim()) {
      showToast('Vui lòng nhập chủ đề câu hỏi!', 'warning');
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

        showToast('🎉 Đã tự động tạo và tải 5 câu hỏi từ AI Gemini thành công!', 'success');
      } else {
        showToast('Không thể tạo câu hỏi từ AI. Vui lòng thử lại.', 'error');
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi từ AI:', err);
      showToast(err.response?.data?.message || 'Có lỗi xảy ra khi gọi AI Gemini để tạo câu hỏi.', 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  // Lọc users hiển thị
  const filteredUsers = users.filter(user => {
    if (filterRole === 'all') return true;
    if (filterRole === 'admin') return user.role_id === 1;
    if (filterRole === 'instructor') return user.role_id === 2;
    if (filterRole === 'student') return user.role_id === 3;
    return true;
  });

  const normalizedCourseSearch = courseSearch.trim().toLowerCase();
  const filteredAdminCourses = courses.filter((course) => {
    const matchesSearch = !normalizedCourseSearch || [
      course.course_name,
      course.instructor_name,
      course.subject_name
    ].some((value) => String(value || '').toLowerCase().includes(normalizedCourseSearch));
    const isPublished = Number(course.status) === 1 || course.status === 'published';
    const matchesStatus = courseStatusFilter === 'all' ||
      (courseStatusFilter === 'published' && isPublished) ||
      (courseStatusFilter === 'draft' && !isPublished);
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <Header />
      
      <div className="admin-dashboard-wrapper">
        <div className="admin-container">
          
          <div className="admin-header">
            <div>
              <h1>{t('adminSystemTitle')}</h1>
              <p className="text-slate-500 text-sm mt-1">{t('adminSystemSubtitle')}</p>
            </div>
            <span className="admin-badge">{isSuperAdmin ? 'Super Admin' : t('adminSystemRole')}</span>
          </div>

          {/* Tab Navigation */}
          <div className="admin-tabs">
            <button 
              className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <FiUsers className="inline mr-2" /> {t('adminAccounts')}
            </button>
            <button
              className={`admin-tab ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              <FiFolder className="inline mr-2" /> {t('adminCourses')}
            </button>
            <button 
              className={`admin-tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <FiAlertTriangle className="inline mr-2" /> {t('adminSecurity')}
            </button>
            <button 
              className={`admin-tab analytics-tab ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <FiTrendingUp className="inline mr-2" /> {t('adminUserAnalytics')}
            </button>
            <button 
              className={`admin-tab ${activeTab === 'ai-quota' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai-quota')}
            >
              <FiCpu className="inline mr-2" /> {t('adminAiTokenManagement')}
            </button>
          </div>

          {/* Real-time Alerts Panel */}
          <AdminAlertsPanel className="mb-6" />

          {/* Tab Content */}
          <div className={`admin-content ${activeTab === 'analytics' ? 'is-analytics' : ''}`}>
            
            {/* TAB 1: USER MANAGEMENT */}
            {activeTab === 'users' && (
              <div className="users-table-container">
                <div className="table-filters">
                  <button 
                    className={`filter-btn ${filterRole === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterRole('all')}
                  >
                    {t('Tất cả')} ({users.length})
                  </button>
                  <button 
                    className={`filter-btn ${filterRole === 'admin' ? 'active' : ''}`}
                    onClick={() => setFilterRole('admin')}
                  >
                    Admin ({users.filter(u => u.role_id === 1).length})
                  </button>
                  <button 
                    className={`filter-btn ${filterRole === 'instructor' ? 'active' : ''}`}
                    onClick={() => setFilterRole('instructor')}
                  >
                    {t('instructorRoleLabel')} ({users.filter(u => u.role_id === 2).length})
                  </button>
                  <button 
                    className={`filter-btn ${filterRole === 'student' ? 'active' : ''}`}
                    onClick={() => setFilterRole('student')}
                  >
                    {t('student')} ({users.filter(u => u.role_id === 3).length})
                  </button>
                </div>

                <div className="bulk-actions mb-4 flex gap-3 flex-wrap">
                  <button 
                    type="button"
                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    onClick={() => handleBulkResetTokens(3)}
                  >
                    <FiRefreshCw className="text-xs" /> {t('Đặt lại lượt hỏi của tất cả học viên')}
                  </button>
                  <button 
                    type="button"
                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    onClick={() => handleBulkResetTokens(2)}
                  >
                    <FiRefreshCw className="text-xs" /> {t('Đặt lại lượt hỏi của tất cả giảng viên')}
                  </button>
                </div>

                {loadingUsers ? (
                  <div className="text-center py-10">
                    <FiRefreshCw className="animate-spin h-8 w-8 text-indigo-600 mx-auto" aria-hidden="true" />
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
                        <th>{t('Tên hiển thị')}</th>
                        <th>{t('Email / Tên đăng nhập')}</th>
                        <th>{t('Vai trò')}</th>
                        <th>{t('Ngày tạo')}</th>
                        <th>{t('Hành động')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr
                          key={user.user_id}
                          id={`admin-user-${user.user_id}`}
                          className={focusedUserId === Number(user.user_id) ? 'alert-target-row' : ''}
                        >
                          <td data-label="ID" className="font-mono text-xs">#{user.user_id}</td>
                          <td data-label="Tên hiển thị" className="font-bold">{user.full_name || '—'}</td>
                          <td data-label="Tài khoản">
                            <div className="text-sm font-semibold">{user.email}</div>
                            <div className="text-xs text-slate-400">@{user.username}</div>
                          </td>
                          <td data-label="Vai trò">
                            <span className={`role-badge ${
                              user.role_id === 1 ? 'role-admin' : 
                              user.role_id === 2 ? 'role-instructor' : 'role-student'
                            }`}>
                              {user.is_super_admin
                                ? 'Super Admin'
                                : (user.role_id === 1
                                  ? t('adminRoleLabel')
                                  : user.role_id === 2
                                    ? t('instructorRoleLabel')
                                    : t('student'))}
                            </span>
                          </td>
                          <td data-label="Ngày tạo" className="text-xs text-slate-500">
                            {user.created_date ? new Date(user.created_date).toLocaleDateString(locale) : '—'}
                          </td>
                          <td data-label="Hành động">
                            <div className="action-buttons">
                              {(!user.is_super_admin && (user.role_id !== 1 || isSuperAdmin) && user.user_id !== currentUser?.userId) ? (
                                <>
                                  {/* Nâng lên Admin (chỉ hiển thị cho Super Admin khi user chưa phải Admin) */}
                                  {isSuperAdmin && user.role_id !== 1 && (
                                    <button 
                                      className="btn-action btn-promote-admin"
                                      onClick={() => handleRoleChange(user.user_id, 1, 'Admin')}
                                      title="Nâng lên quyền Admin"
                                    >
                                      <FiShield />
                                    </button>
                                  )}

                                  {/* Nâng lên Giảng viên (nếu đang là Học sinh) */}
                                  {user.role_id === 3 && (
                                    <button 
                                      className="btn-action btn-promote"
                                      onClick={() => handleRoleChange(user.user_id, 2, 'Giảng viên')}
                                      title="Nâng thành Giảng viên"
                                    >
                                      <FiArrowUp />
                                    </button>
                                  )}

                                  {/* Hạ xuống Học sinh (nếu đang là Giảng viên hoặc Admin) */}
                                  {user.role_id !== 3 && (
                                    <button 
                                      className="btn-action btn-demote"
                                      onClick={() => handleRoleChange(user.user_id, 3, 'Học sinh')}
                                      title="Hạ xuống Học sinh"
                                    >
                                      <FiArrowDown />
                                    </button>
                                  )}
                                  <button 
                                    className="btn-action btn-reset"
                                    onClick={() => handleResetUserToken(user.user_id, user.username)}
                                    title={t('Đặt lại lượt hỏi hôm nay về 0')}
                                  >
                                    <FiRefreshCw />
                                  </button>
                                  <button 
                                    className="btn-action btn-delete"
                                    onClick={() => handleDeleteUser(user.user_id, user.username)}
                                    title="Xóa tài khoản"
                                  >
                                    <FiTrash2 />
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-400 font-semibold italic">
                                  {user.is_super_admin
                                    ? 'Super Admin được bảo vệ'
                                    : (user.user_id === currentUser?.userId ? 'Tài khoản của bạn' : 'Không thể tác động')}
                                </span>
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

            {/* ADMIN / SUPER ADMIN: COURSE MANAGEMENT */}
            {activeTab === 'courses' && (
              <section className="course-management" aria-labelledby="course-management-title">
                <div className="course-management__heading">
                  <div>
                    <h2 id="course-management-title">Quản lý khóa học</h2>
                    <p>Xem toàn bộ khóa học, chỉnh sửa nội dung hoặc tạo khóa học mới vào hệ thống.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => navigate('/instructor/create-course')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 16px',
                        background: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <FiPlus aria-hidden="true" />
                      Tạo khóa học mới
                    </button>
                    <button
                      type="button"
                      className="course-refresh-button"
                      onClick={fetchCourses}
                      disabled={loadingCourses}
                    >
                      <FiRefreshCw className={loadingCourses ? 'is-spinning' : ''} aria-hidden="true" />
                      Làm mới
                    </button>
                  </div>
                </div>

                <CourseTranscriptHealthPanel />

                <div className="course-management__controls">
                  <label className="course-search">
                    <span>Tìm khóa học</span>
                    <input
                      type="search"
                      value={courseSearch}
                      onChange={(event) => setCourseSearch(event.target.value)}
                      placeholder="Tên khóa học, giảng viên hoặc chủ đề"
                    />
                  </label>
                  <label className="course-status-filter">
                    <span>Trạng thái</span>
                    <select value={courseStatusFilter} onChange={(event) => setCourseStatusFilter(event.target.value)}>
                      <option value="all">Tất cả</option>
                      <option value="published">Đã xuất bản</option>
                      <option value="draft">Bản nháp</option>
                    </select>
                  </label>
                  <div className="course-result-count" aria-live="polite">
                    <strong>{filteredAdminCourses.length}</strong>
                    <span>khóa học hiển thị</span>
                  </div>
                </div>

                {loadingCourses ? (
                  <div className="course-management__state" role="status">
                    <FiRefreshCw className="is-spinning" aria-hidden="true" />
                    <span>Đang tải danh sách khóa học…</span>
                  </div>
                ) : errorCourses ? (
                  <div className="course-management__state is-error" role="alert">
                    <FiAlertTriangle aria-hidden="true" />
                    <div>
                      <strong>Không thể tải khóa học</strong>
                      <span>{errorCourses}</span>
                    </div>
                    <button type="button" onClick={fetchCourses}>Thử lại</button>
                  </div>
                ) : filteredAdminCourses.length === 0 ? (
                  <div className="course-management__state">
                    <FiFolder aria-hidden="true" />
                    <div>
                      <strong>Không tìm thấy khóa học</strong>
                      <span>Hãy đổi từ khóa hoặc bộ lọc trạng thái.</span>
                    </div>
                  </div>
                ) : (
                  <div className="course-table-wrap">
                    <table className="course-table">
                      <thead>
                        <tr>
                          <th>Khóa học</th>
                          <th>Giảng viên</th>
                          <th>Chủ đề</th>
                          <th>Trạng thái</th>
                          <th>Ngày tạo</th>
                          <th className="course-table__action-heading">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAdminCourses.map((course) => {
                          const isPublished = Number(course.status) === 1 || course.status === 'published';
                          return (
                            <tr key={course.course_id}>
                              <td data-label="Khóa học">
                                <div className="course-identity">
                                  <strong>{course.course_name}</strong>
                                  <span>#{course.course_id} · {Number(course.price || 0).toLocaleString(locale)}₫</span>
                                </div>
                              </td>
                              <td data-label="Giảng viên">{course.instructor_name || 'Chưa phân công'}</td>
                              <td data-label="Chủ đề">{course.subject_name || 'Chưa phân loại'}</td>
                              <td data-label="Trạng thái">
                                <span className={`course-status ${isPublished ? 'is-published' : 'is-draft'}`}>
                                  {isPublished ? 'Đã xuất bản' : 'Bản nháp'}
                                </span>
                              </td>
                              <td data-label="Ngày tạo">{course.created_at ? new Date(course.created_at).toLocaleDateString(locale) : '—'}</td>
                              <td data-label="Hành động" className="course-table__action-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/instructor/edit-course/${course.course_id}`)}
                                  title="Chỉnh sửa khóa học"
                                  className="course-edit-button"
                                >
                                  <FiEdit aria-hidden="true" />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="course-delete-button"
                                  onClick={() => setPendingDeleteCourse(course)}
                                  aria-label={`Xóa khóa học ${course.course_name}`}
                                >
                                  <FiTrash2 aria-hidden="true" />
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {pendingDeleteCourse && (
                  <div className="course-delete-dialog-backdrop" role="presentation" onMouseDown={() => !deletingCourseId && setPendingDeleteCourse(null)}>
                    <div
                      className="course-delete-dialog"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="course-delete-title"
                      aria-describedby="course-delete-description"
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <div className="course-delete-dialog__icon"><FiTrash2 aria-hidden="true" /></div>
                      <h3 id="course-delete-title">Xóa khóa học này?</h3>
                      <p id="course-delete-description">
                        <strong>“{pendingDeleteCourse.course_name}”</strong> cùng toàn bộ chương, bài học và tài nguyên liên quan sẽ bị xóa vĩnh viễn.
                      </p>
                      <div className="course-delete-dialog__actions">
                        <button
                          type="button"
                          className="course-dialog-cancel"
                          onClick={() => setPendingDeleteCourse(null)}
                          disabled={Boolean(deletingCourseId)}
                          autoFocus
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="course-dialog-confirm"
                          onClick={handleDeleteCourse}
                          disabled={Boolean(deletingCourseId)}
                        >
                          {deletingCourseId ? <><FiRefreshCw className="is-spinning" /> Đang xóa…</> : <><FiTrash2 /> Xóa vĩnh viễn</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
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

            {/* TAB 3: SECURITY SETTINGS */}
            {activeTab === 'security' && (
              <div className="quiz-creator-container bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-md border border-slate-100 dark:border-slate-700 animate-fade">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                  🛡️ Quản Lý Phím Tắt Bảo Mật & Chống Tải Lậu Video
                </h3>
                
                <div className="space-y-8">
                  {/* Đối tượng áp dụng */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-150 dark:border-slate-750">
                    <h4 className="text-sm font-bold text-slate-750 dark:text-slate-300 mb-4">
                      👥 Đối tượng áp dụng chặn phím tắt & chuột phải:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Học viên (Students)</div>
                          <div className="text-[10px] text-slate-400">Chặn xem nguồn bài giảng video</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={securityConfig.blockStudent} 
                            onChange={() => handleSecurityToggle('blockStudent')}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-650 peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Giảng viên (Instructors)</div>
                          <div className="text-[10px] text-slate-400">Chặn inspect element khi xem bài học</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={securityConfig.blockInstructor} 
                            onChange={() => handleSecurityToggle('blockInstructor')}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-650 peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Danh sách phím tắt bị chặn */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-150 dark:border-slate-750">
                    <h4 className="text-sm font-bold text-slate-750 dark:text-slate-300 mb-4">
                      🚫 Cấu hình các phím tắt và thao tác bị chặn:
                    </h4>
                    
                    <div className="space-y-3.5">
                      {[
                        { key: 'blockF12', title: 'Chặn phím F12', desc: 'Ngăn chặn học viên nhấn phím F12 để mở trực tiếp thanh công cụ nhà phát triển (DevTools).' },
                        { key: 'blockInspect', title: 'Chặn tổ hợp Ctrl + Shift + I & Ctrl + Shift + C', desc: 'Chặn phím tắt mở Inspector để săm soi các thuộc tính HTML/CSS hoặc tìm link video ẩn.' },
                        { key: 'blockViewSource', title: 'Chặn tổ hợp Ctrl + U', desc: 'Ngăn chặn việc xem nguồn trang để tìm mã nguồn thô của ứng dụng.' },
                        { key: 'blockRightClick', title: 'Chặn chuột phải (Context Menu)', desc: 'Chặn mở menu chuột phải trên toàn bộ khu vực bài học để không lưu hoặc kiểm tra phần tử.' }
                      ].map((item) => (
                        <div key={item.key} className="flex items-start justify-between p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="pr-4">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-0.5">{item.title}</span>
                            <span className="text-[10.5px] text-slate-450 dark:text-slate-400 leading-normal block">{item.desc}</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                            <input 
                              type="checkbox" 
                              checked={securityConfig[item.key]} 
                              onChange={() => handleSecurityToggle(item.key)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-650 peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-900 p-4 rounded-xl text-emerald-800 dark:text-emerald-400 text-xs font-medium">
                    💡 <strong>Mẹo:</strong> Cấu hình này sẽ được lưu trữ tự động toàn cục và áp dụng ngay lập tức khi Giảng viên hoặc Học viên mở bất kỳ bài giảng nào có định dạng Video/Quizzes trên hệ thống.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: USER & SYSTEM ANALYTICS */}
            {activeTab === 'analytics' && <UserAnalyticsDashboard />}

            {/* TAB 5: AI QUOTA & TOKEN USAGE BOARD */}
            {activeTab === 'ai-quota' && <AIQuotaControlCenter canManageCaps={isAdmin || isSuperAdmin} />}


          </div>

        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
