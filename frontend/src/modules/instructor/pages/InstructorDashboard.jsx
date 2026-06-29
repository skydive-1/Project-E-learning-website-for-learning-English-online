import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FiPlus, FiBook, FiUsers, FiTrendingUp, FiSettings, 
  FiEdit, FiTrash2, FiEye, FiLoader, FiAlertCircle, FiLayers,
  FiSearch, FiMail, FiPhone, FiLock, FiCalendar, FiDollarSign, FiStar,
  FiCheckSquare, FiVideo, FiFileText, FiMoreVertical
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import '../styles/instructor.scss';
import { getCourseQuizQuestions, saveCourseQuizQuestions } from '../../quizzes/services/quizzes.service';

const getRoleFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    return parseInt(payload.roleId || payload.role);
  } catch (e) {
    return null;
  }
};

const getUserIdFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    return parseInt(payload.id || payload.userId);
  } catch (e) {
    return null;
  }
};

const API_BASE_URL = 'http://localhost:5000/api';

const InstructorDashboard = () => {
  const navigate = useNavigate();
  const currentUserId = getUserIdFromToken();

  // Navigation State
  const [activeTab, setActiveTab] = useState('courses');

  // Auth check
  useEffect(() => {
    const role = getRoleFromToken();
    if (role !== 2 && role !== 1) { // Instructor or Admin
      navigate('/');
    }
  }, [navigate]);

  // --- TAB 1: MY COURSES STATES ---
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/courses`);
        if (response.data && response.data.courses) {
          setCourses(response.data.courses);
        }
      } catch (err) {
        console.error('Lỗi lấy danh sách khóa học:', err);
        setErrorMsg('Không thể kết nối máy chủ để lấy danh sách khóa học.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khóa học này cùng tất cả chương học và bài giảng liên quan không? Hành động này không thể hoàn tác.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/courses/${courseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setCourses(prev => prev.filter(c => c.course_id !== courseId));
      alert('Xóa khóa học thành công!');
    } catch (err) {
      console.error('Lỗi khi xóa khóa học:', err);
      alert(err.response?.data?.message || 'Lỗi khi xóa khóa học.');
    }
  };

  // Filter courses to show only this instructor's courses
  const myCourses = courses.filter(c => c.instructor_id === currentUserId);
  const totalCourses = myCourses.length;
  const totalLessons = myCourses.reduce((sum, c) => sum + (c.lessons_count || 0), 0);
  const publishedCourses = myCourses.filter(c => c.status === 1).length;

  // Quiz management states
  const [selectedQuizCourseId, setSelectedQuizCourseId] = useState('');
  const [selectedQuizLessonId, setSelectedQuizLessonId] = useState('');
  const [quizLessons, setQuizLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);

  // Quizzes dashboard list states (based on image.png structure)
  const [quizMode, setQuizMode] = useState('list'); // 'list' or 'edit'
  const [quizSearchQuery, setQuizSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterCourseId, setFilterCourseId] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiNumQuestions, setAiNumQuestions] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCourseId, setCreateCourseId] = useState('');
  const [createLessonId, setCreateLessonId] = useState('');
  const [activeDropdownQuizId, setActiveDropdownQuizId] = useState(null);
  
  const [allLessons, setAllLessons] = useState([]);
  const [loadingAllLessons, setLoadingAllLessons] = useState(false);

  // Fetch details for all instructor's courses to list all lessons/quizzes
  useEffect(() => {
    const fetchAllCourseDetails = async () => {
      const myOwned = courses.filter(c => c.instructor_id === currentUserId);
      if (myOwned.length === 0) return;
      setLoadingAllLessons(true);
      try {
        const promises = myOwned.map(c => axios.get(`${API_BASE_URL}/courses/${c.course_id}`));
        const responses = await Promise.all(promises);
        const lessonsList = [];
        responses.forEach((response) => {
          const course = response.data?.course;
          if (course && course.sections) {
            course.sections.forEach(sec => {
              if (sec.lessons) {
                sec.lessons.forEach(l => {
                  lessonsList.push({
                    id: String(l.lesson_id),
                    title: l.title,
                    contentType: l.content_type || 'video',
                    courseId: String(course.course_id),
                    courseName: course.course_name
                  });
                });
              }
            });
          }
        });
        setAllLessons(lessonsList);
      } catch (err) {
        console.error('Lỗi khi lấy chi tiết tất cả các khóa học:', err);
      } finally {
        setLoadingAllLessons(false);
      }
    };
    if (courses && courses.length > 0) {
      fetchAllCourseDetails();
    }
  }, [courses, currentUserId]);

  useEffect(() => {
    if (createCourseId) {
      const filtered = allLessons.filter(l => l.courseId === createCourseId);
      if (filtered.length > 0) {
        setCreateLessonId(filtered[0].id);
      } else {
        setCreateLessonId('');
      }
    }
  }, [createCourseId, allLessons]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownQuizId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const handleGenerateAiQuiz = (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) return alert('Vui lòng nhập chủ đề trắc nghiệm.');
    if (!createLessonId) return alert('Vui lòng chọn bài học để gán câu hỏi.');

    setAiGenerating(true);

    // Simulate AI generation delay
    setTimeout(() => {
      const generatedQuestions = [
        {
          id: `q-${createLessonId}-ai-1`,
          question: `Which of the following sentences is grammatically correct regarding the topic: "${aiTopic}"?`,
          options: [
            "A. He don't know the answer.",
            "B. He doesn't know the answer.",
            "C. He not know the answer.",
            "D. He isn't know the answer."
          ],
          correctAnswer: "B",
          explanation: "In English grammar, the third-person singular auxiliary verb for negation is 'doesn't'."
        },
        {
          id: `q-${createLessonId}-ai-2`,
          question: `Select the most appropriate vocabulary word for the context of "${aiTopic}": "She gave a __________ explanation that cleared up all confusion."`,
          options: [
            "A. vague",
            "B. lucid",
            "C. obscure",
            "D. redundant"
          ],
          correctAnswer: "B",
          explanation: "'Lucid' means clear and easy to understand, which matches the context of clearing up confusion."
        },
        {
          id: `q-${createLessonId}-ai-3`,
          question: `Choose the correct preposition: "We need to focus __________ improving our English speaking skills."`,
          options: [
            "A. in",
            "B. at",
            "C. on",
            "D. with"
          ],
          correctAnswer: "C",
          explanation: "The verb 'focus' is always followed by the preposition 'on'."
        },
        {
          id: `q-${createLessonId}-ai-4`,
          question: `Identify the synonym of 'acquire' related to the study of "${aiTopic}":`,
          options: [
            "A. lose",
            "B. obtain",
            "C. forfeit",
            "D. abandon"
          ],
          correctAnswer: "B",
          explanation: "'Acquire' means to gain or obtain possession of something."
        },
        {
          id: `q-${createLessonId}-ai-5`,
          question: `What is the opposite of 'deliberate' in the context of "${aiTopic}"?`,
          options: [
            "A. intentional",
            "B. planned",
            "C. accidental",
            "D. conscious"
          ],
          correctAnswer: "C",
          explanation: "'Deliberate' means done on purpose; its opposite is 'accidental'."
        }
      ];

      saveCourseQuizQuestions(createLessonId, generatedQuestions);
      setAiGenerating(false);
      setShowAiModal(false);
      setAiTopic('');
      
      setSelectedQuizCourseId(createCourseId);
      setSelectedQuizLessonId(createLessonId);
      setQuizQuestions(generatedQuestions);
      setQuizMode('edit');

      alert('Đã tạo thành công 5 câu hỏi trắc nghiệm bằng AI!');
    }, 2000);
  };

  const handleCreateNewQuiz = (e) => {
    e.preventDefault();
    if (!createLessonId) return alert('Vui lòng chọn bài học.');
    setSelectedQuizCourseId(createCourseId);
    setSelectedQuizLessonId(createLessonId);
    const existing = getCourseQuizQuestions(createLessonId);
    setQuizQuestions(existing);
    setQuizMode('edit');
    setShowCreateModal(false);
  };

  const enterEditMode = (item) => {
    setSelectedQuizCourseId(item.courseId);
    setSelectedQuizLessonId(item.id);
    setQuizQuestions(item.questions);
    setQuizMode('edit');
  };

  const deleteQuiz = (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ câu hỏi trắc nghiệm của bài học "${item.lessonTitle}"?`)) return;
    saveCourseQuizQuestions(item.id, []);
    // Force reload by refreshing course data locally
    setAllLessons(prev => prev.map(l => l.id === item.id ? { ...l } : l));
    alert('Đã xóa bộ trắc nghiệm thành công!');
  };

  // Question editing form states
  const [isEditingIdx, setIsEditingIdx] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [explanationText, setExplanationText] = useState('');

  // Computed values for Quizzes list/filters
  const quizItems = allLessons.map(l => {
    const questions = getCourseQuizQuestions(l.id);
    let difficulty = 'Easy';
    if (l.title.toLowerCase().includes('advanced') || l.title.toLowerCase().includes('nâng cao')) {
      difficulty = 'Hard';
    } else if (l.title.toLowerCase().includes('intermediate') || l.title.toLowerCase().includes('trung cấp')) {
      difficulty = 'Medium';
    }
    return {
      id: l.id,
      lessonTitle: l.title,
      iconType: l.contentType,
      courseId: l.courseId,
      courseName: l.courseName,
      questionCount: questions.length,
      questions: questions,
      difficulty: difficulty
    };
  });

  const filteredQuizItems = quizItems.filter(item => {
    const matchesCourse = filterCourseId === 'all' || item.courseId === filterCourseId;
    const matchesDifficulty = filterDifficulty === 'all' || item.difficulty === filterDifficulty;
    const matchesSearch = item.lessonTitle.toLowerCase().includes(quizSearchQuery.toLowerCase());
    return matchesCourse && matchesDifficulty && matchesSearch;
  });

  const sortedQuizItems = [...filteredQuizItems].sort((a, b) => {
    if (sortBy === 'questions') {
      return b.questionCount - a.questionCount;
    } else if (sortBy === 'oldest') {
      return a.id.localeCompare(b.id);
    } else { // newest
      return b.id.localeCompare(a.id);
    }
  });

  const createLessons = allLessons.filter(l => l.courseId === createCourseId);

  // Auto-select first course when courses load
  useEffect(() => {
    if (courses && courses.length > 0) {
      const myOwned = courses.filter(c => c.instructor_id === currentUserId);
      if (myOwned.length > 0 && !selectedQuizCourseId) {
        setSelectedQuizCourseId(String(myOwned[0].course_id));
      }
    }
  }, [courses, currentUserId, selectedQuizCourseId]);

  // Fetch lessons for selected course details
  useEffect(() => {
    if (!selectedQuizCourseId) {
      setQuizLessons([]);
      setSelectedQuizLessonId('');
      return;
    }
    const fetchCourseDetails = async () => {
      setLoadingLessons(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/courses/${selectedQuizCourseId}`);
        if (response.data && response.data.course && response.data.course.sections) {
          const lessonsList = response.data.course.sections.flatMap(sec => 
            sec.lessons.map(l => ({
              id: String(l.lesson_id),
              title: l.title,
              contentType: l.content_type || 'video'
            }))
          );
          setQuizLessons(lessonsList);
          if (lessonsList.length > 0) {
            setSelectedQuizLessonId(lessonsList[0].id);
          } else {
            setSelectedQuizLessonId('');
          }
        }
      } catch (err) {
        console.error('Lỗi lấy chi tiết bài giảng:', err);
      } finally {
        setLoadingLessons(false);
      }
    };
    fetchCourseDetails();
  }, [selectedQuizCourseId]);

  // Load questions when selected quiz lesson changes
  useEffect(() => {
    if (selectedQuizLessonId) {
      const qList = getCourseQuizQuestions(selectedQuizLessonId);
      setQuizQuestions(qList);
    } else {
      setQuizQuestions([]);
    }
    handleCancelEdit();
  }, [selectedQuizLessonId]);

  const handleCancelEdit = () => {
    setIsEditingIdx(null);
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectAnswer('A');
    setExplanationText('');
  };

  const handleEditQuestion = (idx) => {
    const q = quizQuestions[idx];
    setIsEditingIdx(idx);
    setQuestionText(q.question);
    setOptions(q.options.map(opt => opt.replace(/^[A-D]\.\s*/, '')));
    setCorrectAnswer(q.correctAnswer);
    setExplanationText(q.explanation || '');
  };

  const handleDeleteQuestion = (idx) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này không?')) return;
    const updated = [...quizQuestions];
    updated.splice(idx, 1);
    setQuizQuestions(updated);
    saveCourseQuizQuestions(selectedQuizLessonId, updated);
    alert('Xóa câu hỏi thành công!');
  };

  const handleSaveQuestion = (e) => {
    e.preventDefault();
    if (!questionText.trim()) return alert('Vui lòng nhập nội dung câu hỏi.');
    if (options.some(opt => !opt.trim())) return alert('Vui lòng điền đủ 4 phương án trả lời.');

    const newQuestion = {
      id: isEditingIdx !== null ? quizQuestions[isEditingIdx].id : `q-${selectedQuizLessonId}-${Date.now()}`,
      question: questionText,
      options: options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`),
      correctAnswer,
      explanation: explanationText
    };

    let updated = [];
    if (isEditingIdx !== null) {
      updated = [...quizQuestions];
      updated[isEditingIdx] = newQuestion;
    } else {
      updated = [...quizQuestions, newQuestion];
    }

    setQuizQuestions(updated);
    saveCourseQuizQuestions(selectedQuizLessonId, updated);
    alert(isEditingIdx !== null ? 'Cập nhật câu hỏi thành công!' : 'Thêm câu hỏi mới thành công!');
    handleCancelEdit();
  };


  // --- TAB 2: STUDENTS STATES ---
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');

  useEffect(() => {
    if (activeTab === 'students') {
      const fetchStudents = async () => {
        setStudentsLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_BASE_URL}/instructor/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.data && response.data.data) {
            setStudents(response.data.data);
          }
        } catch (err) {
          console.error('Lỗi lấy danh sách học viên:', err);
        } finally {
          setStudentsLoading(false);
        }
      };
      fetchStudents();
    }
  }, [activeTab]);

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCourse = 
      filterCourse === 'all' || 
      String(student.courseId) === filterCourse;
      
    return matchesSearch && matchesCourse;
  });

  const getInitials = (name) => {
    if (!name) return 'S';
    return name
      .split(' ')
      .filter(w => w)
      .map(w => w[0].toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const getAvatarColor = (userId) => {
    const colors = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    return colors[userId % colors.length];
  };

  // --- TAB 3: PERFORMANCE STATES ---
  const [performanceData, setPerformanceData] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'performance') {
      const fetchPerformance = async () => {
        setPerformanceLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_BASE_URL}/instructor/performance`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.data && response.data.data) {
            setPerformanceData(response.data.data);
          }
        } catch (err) {
          console.error('Lỗi lấy dữ liệu hiệu suất:', err);
        } finally {
          setPerformanceLoading(false);
        }
      };
      fetchPerformance();
    }
  }, [activeTab]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Compute maximum enrollments for SVG bar sizing
  const maxEnrollments = performanceData?.monthlyData?.length > 0 
    ? Math.max(...performanceData.monthlyData.map(d => d.enrollments), 10) 
    : 10;

  // Settings Tab removed

  return (
    <div className="instructor-page">
      <Header />
      
      <main className="instructor-container">
        {/* Sidebar */}
        <div className="instructor-sidebar">
          <div className="sidebar-brand">
            <h2>Instructor Hub</h2>
          </div>
          <nav className="sidebar-nav">
            <button className={activeTab === 'courses' ? 'active' : ''} onClick={() => setActiveTab('courses')}>
              <FiBook /> My Courses
            </button>
            <button className={activeTab === 'students' ? 'active' : ''} onClick={() => setActiveTab('students')}>
              <FiUsers /> Students
            </button>
            <button className={activeTab === 'performance' ? 'active' : ''} onClick={() => setActiveTab('performance')}>
              <FiTrendingUp /> Performance
            </button>
            <button className={activeTab === 'quizzes' ? 'active' : ''} onClick={() => setActiveTab('quizzes')}>
              <FiCheckSquare /> Quizzes
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="instructor-content">
          {activeTab !== 'quizzes' && (
            <header className="content-header">
              <div className="header-text">
                {activeTab === 'courses' && (
                  <>
                    <h1>My Courses</h1>
                    <p>Manage your educational content and student engagement.</p>
                  </>
                )}
                {activeTab === 'students' && (
                  <>
                    <h1>Student Directory</h1>
                    <p>Track your students' enrollment status, activity, and learning progress.</p>
                  </>
                )}
                {activeTab === 'performance' && (
                  <>
                    <h1>Performance Analytics</h1>
                    <p>Evaluate your course engagement, enrollments, and student progress metrics.</p>
                  </>
                )}
              </div>
              
              {activeTab === 'courses' && (
                <button className="btn-create-course" onClick={() => navigate('/instructor/create-course')}>
                  <FiPlus /> Create New Course
                </button>
              )}
            </header>
          )}

          {/* --- 1. COURSES TAB CONTENT --- */}
          {activeTab === 'courses' && (
            <>
              {/* Stats Overview */}
              <div className="stats-overview">
                <div className="stat-card">
                  <span className="stat-label">Total Courses</span>
                  <span className="stat-value">{totalCourses}</span>
                  <span className="stat-change">Khóa học hiện tại</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Total Lessons</span>
                  <span className="stat-value">{totalLessons}</span>
                  <span className="stat-change">Bài giảng (Video / PDF)</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Published Courses</span>
                  <span className="stat-value">{publishedCourses}</span>
                  <span className="stat-change">Khóa học đang kích hoạt</span>
                </div>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', 
                  padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <FiAlertCircle /> <span>{errorMsg}</span>
                </div>
              )}

              {/* Courses Table */}
              <div className="course-list-table-wrapper">
                {loading ? (
                  <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px', color: '#64748b' }}>
                    <FiLoader className="spin" style={{ fontSize: '28px' }} />
                    <span>Đang tải danh sách khóa học...</span>
                  </div>
                ) : myCourses.length === 0 ? (
                  <div style={{ padding: '60px', textAlignment: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: '#64748b' }}>
                    <FiBook style={{ fontSize: '48px' }} />
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>Chưa có khóa học nào được tạo.</span>
                    <button className="btn-create-course" onClick={() => navigate('/instructor/create-course')} style={{ padding: '10px 20px', fontSize: '13px' }}>
                      <FiPlus /> Tạo khóa học đầu tiên
                    </button>
                  </div>
                ) : (
                  <table className="course-list-table">
                    <thead>
                      <tr>
                        <th>Course Details</th>
                        <th>Subject</th>
                        <th>Curriculum</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myCourses.map(course => (
                        <tr key={course.course_id}>
                          <td>
                            <div className="course-info-cell">
                              <div className="course-thumb-mini">
                                <img src={course.thumbnail_url || "/images/hero_illustration.png"} alt="" />
                              </div>
                              <div className="course-details">
                                <span className="course-name">{course.course_name}</span>
                                <span className="course-date">Khai giảng: {new Date(course.start_date).toLocaleDateString('vi-VN')}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: '600', color: '#475569' }}>{course.subject_name}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', color: '#64748b' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiLayers /> {course.sections_count} chương</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiBook /> {course.lessons_count} bài học</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${course.status === 1 ? 'published' : 'draft'}`} style={{
                              background: course.status === 1 ? '#ecfdf5' : '#f1f5f9',
                              color: course.status === 1 ? '#059669' : '#64748b'
                            }}>
                              {course.status === 1 ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button className="action-btn" title="Edit" onClick={() => navigate(`/instructor/edit-course/${course.course_id}`)}><FiEdit /></button>
                            <button className="action-btn" title="View" onClick={() => navigate(`/lessons?courseId=${course.course_id}`)}><FiEye /></button>
                            <button className="action-btn delete" title="Delete" onClick={() => handleDeleteCourse(course.course_id)}><FiTrash2 /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* --- 2. STUDENTS TAB CONTENT --- */}
          {activeTab === 'students' && (
            <>
              {/* Search & Filter Bar */}
              <div className="filter-bar">
                <div className="search-input-wrapper">
                  <FiSearch />
                  <input 
                    type="text" 
                    placeholder="Tìm học viên bằng tên, username, email..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="filter-select"
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                >
                  <option value="all">Tất cả khóa học</option>
                  {myCourses.map(c => (
                    <option key={c.course_id} value={String(c.course_id)}>{c.course_name}</option>
                  ))}
                </select>
              </div>

              {/* Students Table */}
              <div className="course-list-table-wrapper">
                {studentsLoading ? (
                  <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px', color: '#64748b' }}>
                    <FiLoader className="spin" style={{ fontSize: '28px' }} />
                    <span>Đang tải danh sách học viên...</span>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ padding: '60px', textAlignment: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: '#64748b' }}>
                    <FiUsers style={{ fontSize: '48px' }} />
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>Không tìm thấy học viên nào.</span>
                    <span style={{ fontSize: '13px' }}>Học viên của các khóa học bạn dạy sẽ xuất hiện tại đây sau khi họ tham gia và học bài.</span>
                  </div>
                ) : (
                  <table className="course-list-table">
                    <thead>
                      <tr>
                        <th>Học viên</th>
                        <th>Thông tin liên hệ</th>
                        <th>Giới tính</th>
                        <th>Khóa học tham gia</th>
                        <th>Tiến độ học tập</th>
                        <th>Ngày đăng ký</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(student => (
                        <tr key={`${student.userId}-${student.courseId}`}>
                          <td>
                            <div className="student-info-cell">
                              <div 
                                className="student-avatar" 
                                style={{ 
                                  backgroundColor: student.profilePictureUrl ? 'transparent' : getAvatarColor(student.userId) 
                                }}
                              >
                                {student.profilePictureUrl ? (
                                  <img src={student.profilePictureUrl} alt="" />
                                ) : (
                                  getInitials(student.fullName)
                                )}
                              </div>
                              <div className="student-meta">
                                <span className="student-name">{student.fullName}</span>
                                <span className="student-username">@{student.username}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                                <FiMail style={{ flexShrink: 0 }} /> {student.email}
                              </span>
                              {student.phone && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                                  <FiPhone style={{ flexShrink: 0 }} /> {student.phone}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>
                              {student.gender === 'Male' ? 'Nam' : student.gender === 'Female' ? 'Nữ' : 'Khác'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: '600', color: '#1e3a8a', display: 'block', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={student.courseName}>
                              {student.courseName}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div className="progress-bar-container">
                                <div className="progress-bar-fill" style={{ transform: `scaleX(${student.progress / 100})`, transformOrigin: 'left' }}></div>
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>
                                {student.progress}% ({student.completedLessons}/{student.totalLessons} bài)
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: '#64748b', fontSize: '13px' }}>
                              {new Date(student.joinDate).toLocaleDateString('vi-VN')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* --- 3. PERFORMANCE TAB CONTENT --- */}
          {activeTab === 'performance' && (
            <>
              {performanceLoading ? (
                <div style={{ padding: '100px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px', color: '#64748b' }}>
                  <FiLoader className="spin" style={{ fontSize: '32px' }} />
                  <span>Đang tổng hợp dữ liệu hiệu suất của bạn...</span>
                </div>
              ) : !performanceData ? (
                <div style={{ padding: '60px', textAlignment: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: '#64748b' }}>
                  <FiTrendingUp style={{ fontSize: '48px' }} />
                  <span>Không tìm thấy dữ liệu thống kê nào.</span>
                </div>
              ) : (
                <>
                  {/* Overview Stats */}
                  <div className="stats-overview" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div className="stat-card">
                      <span className="stat-label">Tổng số khóa học</span>
                      <span className="stat-value">{performanceData.overview.totalCourses}</span>
                      <span className="stat-change">Được tạo bởi bạn</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Tổng học viên học</span>
                      <span className="stat-value">{performanceData.overview.totalStudents}</span>
                      <span className="stat-change">Đã bắt đầu học bài</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Tổng lượt hoàn thành</span>
                      <span className="stat-value" style={{ color: '#059669' }}>
                        {performanceData.overview.totalCompletions}
                      </span>
                      <span className="stat-change">Bài giảng đã học xong</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Đánh giá trung bình</span>
                      <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {performanceData.overview.ratingAverage} <FiStar style={{ fill: '#f59e0b', stroke: '#f59e0b', fontSize: '20px' }} />
                      </span>
                      <span className="stat-change">Từ phản hồi học viên</span>
                    </div>
                  </div>

                  {/* Monthly Enrollments Custom SVG Bar Chart */}
                  <div className="chart-card">
                    <div className="chart-header">
                      <h3>Thống kê lượt đăng ký học theo tháng</h3>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Biểu đồ lượt tham gia học bài mới</span>
                    </div>
                    
                    {performanceData.monthlyData.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
                        Chưa có dữ liệu theo tháng. Lượt đăng ký học của học sinh sẽ được vẽ tại đây.
                      </div>
                    ) : (
                      <div className="chart-container">
                        {/* Grid lines */}
                        <div className="chart-y-axis">
                          <div className="grid-line"><span>{maxEnrollments}</span></div>
                          <div className="grid-line"><span>{Math.round(maxEnrollments * 0.67)}</span></div>
                          <div className="grid-line"><span>{Math.round(maxEnrollments * 0.33)}</span></div>
                          <div className="grid-line"><span>0</span></div>
                        </div>

                        {/* Bars */}
                        {performanceData.monthlyData.map((item, idx) => {
                          const heightPercent = (item.enrollments / maxEnrollments) * 100;
                          return (
                            <div className="chart-bar-item" key={item.month}>
                              <span className="chart-bar-value">{item.enrollments} hs</span>
                              <div 
                                className="chart-bar" 
                                style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                title={`${item.month}: ${item.enrollments} lượt đăng ký`}
                              ></div>
                              <span className="chart-bar-label">{item.month}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Individual Course Performance Breakdown */}
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}>
                    Hiệu suất chi tiết từng khóa học
                  </h2>
                  <div className="course-list-table-wrapper">
                    <table className="course-list-table">
                      <thead>
                        <tr>
                          <th>Tên khóa học</th>
                          <th>Số chương học</th>
                          <th>Số bài học</th>
                          <th>Số học viên tham gia</th>
                          <th>Tổng lượt hoàn thành bài</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceData.courses.map(c => (
                          <tr key={c.courseId}>
                            <td>
                              <span style={{ fontWeight: '700', color: '#0f172a' }}>{c.courseName}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: '600' }}>{c.sectionsCount} chương</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: '600' }}>{c.lessonsCount} bài</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: '600', color: '#1e3a8a' }}>{c.studentCount} học viên</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: '700', color: '#059669' }}>
                                {c.completedLessonsCount} lượt
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* --- 4. QUIZZES TAB CONTENT --- */}
          {activeTab === 'quizzes' && quizMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {/* Header Title & Subtitle + Top Right Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '28px' }}>
                <div>
                  <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
                    Quizzes của tôi
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                    Quản lý, tìm kiếm và thiết lập lộ trình luyện tập trắc nghiệm của bạn.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (myCourses.length === 0) return alert('Vui lòng tạo khóa học trước.');
                      setCreateCourseId(String(myCourses[0].course_id));
                      setShowAiModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#a855f7',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(168, 85, 247, 0.15)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ display: 'inline-flex' }}>✨</span> Tạo bằng AI
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (myCourses.length === 0) return alert('Vui lòng tạo khóa học trước.');
                      setCreateCourseId(String(myCourses[0].course_id));
                      setShowCreateModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#1d4ed8',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(29, 78, 216, 0.15)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <FiPlus /> Tạo bộ trắc nghiệm mới
                  </button>
                </div>
              </div>

              {/* Filters & Search Row (matching image.png structure) */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '20px'
              }}>
                {/* Left: Filters */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <select 
                    value={filterCourseId} 
                    onChange={(e) => setFilterCourseId(e.target.value)}
                    style={{ borderRadius: '20px', padding: '10px 16px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '13.5px', fontWeight: '600', color: '#475569', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="all">Tất cả danh mục</option>
                    {myCourses.map(c => (
                      <option key={c.course_id} value={String(c.course_id)}>{c.course_name}</option>
                    ))}
                  </select>

                  <select 
                    value={filterDifficulty} 
                    onChange={(e) => setFilterDifficulty(e.target.value)}
                    style={{ borderRadius: '20px', padding: '10px 16px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '13.5px', fontWeight: '600', color: '#475569', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="all">Tất cả trình độ</option>
                    <option value="Easy">Cơ bản (Easy)</option>
                    <option value="Medium">Trung cấp (Medium)</option>
                    <option value="Hard">Nâng cao (Hard)</option>
                  </select>

                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ borderRadius: '20px', padding: '10px 16px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '13.5px', fontWeight: '600', color: '#475569', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="questions">Nhiều câu hỏi nhất</option>
                  </select>
                </div>

                {/* Right: Search */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                  <FiSearch style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm chủ đề..." 
                    value={quizSearchQuery}
                    onChange={(e) => setQuizSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 16px 10px 42px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '20px',
                      fontSize: '13.5px',
                      fontWeight: '500',
                      outline: 'none',
                      backgroundColor: '#fff'
                    }}
                  />
                </div>
              </div>

              {/* Counts Label */}
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '24px' }}>
                Hiển thị {sortedQuizItems.length} trên {quizItems.length} bộ trắc nghiệm
              </div>

              {/* Grid of Quizzes */}
              {loadingAllLessons ? (
                <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px', color: '#64748b' }}>
                  <FiLoader className="spin" style={{ fontSize: '32px' }} />
                  <span>Đang tải danh sách bài tập trắc nghiệm...</span>
                </div>
              ) : sortedQuizItems.length === 0 ? (
                <div style={{
                  padding: '60px 40px',
                  textAlign: 'center',
                  backgroundColor: '#fff',
                  borderRadius: '24px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                  color: '#64748b',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <FiAlertCircle style={{ fontSize: '48px', color: '#cbd5e1' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>Không tìm thấy bộ trắc nghiệm nào</h3>
                  <p style={{ fontSize: '14px', maxWidth: '400px', lineHeight: '1.6' }}>
                    Không tìm thấy bài trắc nghiệm nào khớp với điều kiện tìm kiếm hoặc bộ lọc của bạn.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '24px',
                  marginBottom: '40px'
                }}>
                  {sortedQuizItems.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => enterEditMode(item)}
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: '24px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                        padding: '24px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                      }}
                      className="quiz-card-item"
                    >
                      {/* Card Top: Icon, Course Name, Menu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          flexShrink: 0
                        }}>
                          {item.iconType === 'video' ? <FiVideo /> : <FiFileText />}
                        </div>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: '800', 
                          color: '#64748b', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '160px'
                        }} title={item.courseName}>
                          {item.courseName}
                        </span>
                        
                        {/* More Menu Dropdown */}
                        <div style={{ position: 'relative', marginLeft: 'auto' }}>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownQuizId(activeDropdownQuizId === item.id ? null : item.id);
                            }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px', display: 'flex', padding: '4px' }}
                          >
                            <FiMoreVertical />
                          </button>
                          {activeDropdownQuizId === item.id && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '28px',
                              backgroundColor: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                              zIndex: 10,
                              minWidth: '130px',
                              overflow: 'hidden'
                            }}>
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  enterEditMode(item);
                                  setActiveDropdownQuizId(null);
                                }}
                                style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#0f172a', cursor: 'pointer' }}
                              >
                                Sửa câu hỏi
                              </button>
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteQuiz(item);
                                  setActiveDropdownQuizId(null);
                                }}
                                style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#b91c1c', cursor: 'pointer' }}
                              >
                                Xóa đề thi
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Middle: Title & Description */}
                      <h3 style={{
                        fontSize: '15px',
                        fontWeight: '800',
                        color: '#0f172a',
                        margin: '16px 0 6px 0',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: '42px'
                      }} title={item.lessonTitle}>
                        {item.lessonTitle}
                      </h3>
                      <p style={{
                        fontSize: '12.5px',
                        color: '#64748b',
                        margin: '0 0 16px 0',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: '38px'
                      }}>
                        Đề trắc nghiệm kiểm tra và củng cố kiến thức ngữ pháp, từ vựng tiếng Anh theo bài học: {item.lessonTitle}.
                      </p>

                      {/* Card Progress */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
                        <span>Trạng thái: {item.questionCount > 0 ? 'Đã biên soạn' : 'Chưa tạo'}</span>
                        <span>{item.questionCount > 0 ? '100%' : '0%'}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '20px' }}>
                        <div style={{
                          width: item.questionCount > 0 ? '100%' : '0%',
                          height: '100%',
                          backgroundColor: item.questionCount > 0 ? '#10b981' : '#cbd5e1',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>

                      {/* Card Footer: Difficulty Badge & Question Count */}
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '4px 10px',
                          borderRadius: '50px',
                          backgroundColor: item.difficulty === 'Hard' ? '#fef2f2' : item.difficulty === 'Medium' ? '#fff7ed' : '#f0fdf4',
                          color: item.difficulty === 'Hard' ? '#b91c1c' : item.difficulty === 'Medium' ? '#c2410c' : '#15803d'
                        }}>
                          {item.difficulty === 'Hard' ? 'Nâng cao' : item.difficulty === 'Medium' ? 'Trung cấp' : 'Cơ bản'}
                        </span>
                        
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#64748b',
                          marginLeft: 'auto'
                        }}>
                          {item.questionCount > 0 ? `${item.questionCount} câu hỏi` : 'Chưa có câu hỏi'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Auto-generate Modal */}
              {showAiModal && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '20px'
                }}>
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: '24px',
                      padding: '32px',
                      maxWidth: '500px',
                      width: '100%',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px 0' }}>
                      ✨ Tạo trắc nghiệm tự động bằng AI
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                      Công nghệ AI sẽ phân tích chủ đề và biên soạn câu hỏi trắc nghiệm tiếng Anh phù hợp kèm theo giải thích đáp án chi tiết.
                    </p>

                    <form onSubmit={handleGenerateAiQuiz}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div className="form-group">
                          <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Chủ đề hoặc nội dung cần tạo</label>
                          <input 
                            type="text"
                            placeholder="Ví dụ: Passive Voice, IELTS Vocabulary,..."
                            value={aiTopic}
                            onChange={(e) => setAiTopic(e.target.value)}
                            required
                            style={{ borderRadius: '20px', padding: '12px 18px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
                          />
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Chọn khóa học gán đề thi</label>
                          <select
                            value={createCourseId}
                            onChange={(e) => setCreateCourseId(e.target.value)}
                            style={{ borderRadius: '20px', padding: '12px 18px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                          >
                            {myCourses.map(c => (
                              <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Chọn bài học</label>
                          <select
                            value={createLessonId}
                            onChange={(e) => setCreateLessonId(e.target.value)}
                            style={{ borderRadius: '20px', padding: '12px 18px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                          >
                            {createLessons.map(l => (
                              <option key={l.id} value={l.id}>{l.title}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Số câu hỏi</label>
                            <select
                              value={aiNumQuestions}
                              onChange={(e) => setAiNumQuestions(parseInt(e.target.value))}
                              style={{ borderRadius: '20px', padding: '12px 18px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                            >
                              <option value={5}>5 câu hỏi</option>
                              <option value={10}>10 câu hỏi</option>
                              <option value={15}>15 câu hỏi</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Độ khó</label>
                            <select
                              value={aiDifficulty}
                              onChange={(e) => setAiDifficulty(e.target.value)}
                              style={{ borderRadius: '20px', padding: '12px 18px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                            >
                              <option value="Easy">Cơ bản (Easy)</option>
                              <option value="Medium">Trung cấp (Medium)</option>
                              <option value="Hard">Nâng cao (Hard)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                        <button 
                          type="submit"
                          disabled={aiGenerating}
                          style={{
                            flex: 1,
                            backgroundColor: '#a855f7',
                            color: '#fff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          {aiGenerating ? (
                            <>
                              <FiLoader className="spin" /> Đang khởi tạo đề...
                            </>
                          ) : (
                            'Khởi tạo bằng AI'
                          )}
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowAiModal(false)}
                          disabled={aiGenerating}
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}
                        >
                          Hủy bỏ
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Standalone Create Quiz Modal */}
              {showCreateModal && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '20px'
                }}>
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: '24px',
                      padding: '32px',
                      maxWidth: '500px',
                      width: '100%',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px 0' }}>
                      ➕ Tạo bộ trắc nghiệm luyện tập mới
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                      Chọn bài học bạn muốn biên soạn câu hỏi. Đề thi sẽ được hiển thị ngay trong bài học đó cho học sinh.
                    </p>

                    <form onSubmit={handleCreateNewQuiz}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div className="form-group">
                          <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Chọn khóa học sở hữu</label>
                          <select
                            value={createCourseId}
                            onChange={(e) => setCreateCourseId(e.target.value)}
                            style={{ borderRadius: '20px', padding: '12px 18px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                          >
                            {myCourses.map(c => (
                              <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Chọn bài học thiết lập trắc nghiệm</label>
                          <select
                            value={createLessonId}
                            onChange={(e) => setCreateLessonId(e.target.value)}
                            style={{ borderRadius: '20px', padding: '12px 18px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                          >
                            {createLessons.map(l => (
                              <option key={l.id} value={l.id}>{l.title}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                        <button 
                          type="submit"
                          style={{
                            flex: 1,
                            backgroundColor: '#1d4ed8',
                            color: '#fff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Thiết lập đề thi
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowCreateModal(false)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}
                        >
                          Hủy bỏ
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quizzes' && quizMode === 'edit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
              {/* Back to List Navigation */}
              <button 
                type="button"
                onClick={() => setQuizMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '700',
                  padding: 0,
                  width: 'fit-content',
                  transition: 'color 0.2s'
                }}
                className="btn-back-to-list"
              >
                ← Quay lại danh sách đề thi
              </button>

              {/* Breadcrumb Information Card */}
              <div className="settings-card" style={{ width: '100%', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px', border: 'none' }}>
                  Biên soạn câu hỏi đề trắc nghiệm
                </h2>
                <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#475569', flexWrap: 'wrap' }}>
                  <div>
                    <strong>Khóa học:</strong> <span style={{ color: '#0f172a', fontWeight: '700' }}>{allLessons.find(l => l.id === selectedQuizLessonId)?.courseName || 'Khóa học của tôi'}</span>
                  </div>
                  <div style={{ width: '1px', backgroundColor: '#cbd5e1' }}></div>
                  <div>
                    <strong>Bài học:</strong> <span style={{ color: '#0f172a', fontWeight: '700' }}>{allLessons.find(l => l.id === selectedQuizLessonId)?.title || 'Bài học'}</span>
                  </div>
                </div>
              </div>

              {selectedQuizLessonId && (
                <div className="settings-layout" style={{ width: '100%' }}>
                  {/* Questions List Card */}
                  <div className="settings-card" style={{ borderRadius: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', border: 'none', padding: 0 }}>
                        Danh sách câu hỏi ({quizQuestions.length})
                      </h2>
                      <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#e2e8f0', color: '#475569', padding: '4px 10px', borderRadius: '50px' }}>
                        Interactive Quiz
                      </span>
                    </div>
                    
                    {quizQuestions.length === 0 ? (
                      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <FiAlertCircle style={{ fontSize: '32px', color: '#cbd5e1' }} />
                        <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Chưa có câu hỏi trắc nghiệm nào cho bài học này.</p>
                        <p style={{ fontSize: '12px', margin: 0 }}>Hãy tạo câu hỏi đầu tiên bằng cách điền thông tin vào bảng "Thêm câu hỏi mới" bên phải.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
                        {quizQuestions.map((q, idx) => (
                          <div 
                            key={q.id} 
                            style={{ 
                              padding: '20px', 
                              borderRadius: '20px', 
                              border: '1px solid #e2e8f0', 
                              backgroundColor: '#f8fafc',
                              transition: 'all 0.2s',
                              position: 'relative'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '8px' }}>
                                Câu hỏi {idx + 1}
                              </span>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <button 
                                  type="button"
                                  onClick={() => handleEditQuestion(idx)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#1d4ed8',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <FiEdit /> Sửa
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteQuestion(idx)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <FiTrash2 /> Xóa
                                </button>
                              </div>
                            </div>

                            <p style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', lineHeight: '1.5', marginBottom: '16px' }}>
                              {q.question}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                              {q.options.map((opt, oIdx) => {
                                const optLetter = String.fromCharCode(65 + oIdx);
                                const isCorrect = q.correctAnswer === optLetter;
                                return (
                                  <div 
                                    key={oIdx} 
                                    style={{ 
                                      padding: '10px 14px', 
                                      borderRadius: '12px', 
                                      border: isCorrect ? '1px solid #10b981' : '1px solid #e2e8f0', 
                                      backgroundColor: isCorrect ? '#ecfdf5' : '#fff',
                                      color: isCorrect ? '#047857' : '#475569',
                                      fontWeight: isCorrect ? '700' : '500',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}
                                  >
                                    <span style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      backgroundColor: isCorrect ? '#10b981' : '#f1f5f9',
                                      color: isCorrect ? '#fff' : '#64748b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '11px',
                                      fontWeight: '700'
                                    }}>
                                      {optLetter}
                                    </span>
                                    <span>{opt.replace(/^[A-D]\.\s*/, '')}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {q.explanation && (
                              <div style={{ 
                                fontSize: '12.5px', 
                                color: '#64748b', 
                                borderTop: '1px dashed #e2e8f0', 
                                paddingTop: '12px', 
                                marginTop: '16px',
                                display: 'flex',
                                gap: '6px',
                                lineHeight: '1.5'
                              }}>
                                <span style={{ fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Giải thích:</span>
                                <span>{q.explanation}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add/Edit Question Form Card */}
                  <div className="settings-card" style={{ borderRadius: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', position: 'sticky', top: '100px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', border: 'none', padding: 0 }}>
                        {isEditingIdx !== null ? 'Cập nhật câu hỏi' : 'Thêm câu hỏi mới'}
                      </h2>
                      {isEditingIdx !== null && (
                        <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#fff7ed', color: '#c2410c', padding: '4px 10px', borderRadius: '50px', border: '1px solid #ffedd5' }}>
                          Đang sửa Câu {isEditingIdx + 1}
                        </span>
                      )}
                    </div>
                    <form onSubmit={handleSaveQuestion}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div className="form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '700' }}>
                            Nội dung câu hỏi
                          </label>
                          <textarea 
                            placeholder="Ví dụ: What is the past participle of 'write'?" 
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            required
                            style={{ borderRadius: '20px', padding: '14px 18px', minHeight: '90px' }}
                          />
                        </div>

                        {options.map((opt, idx) => (
                          <div className="form-group" key={idx}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '700' }}>
                              Phương án {String.fromCharCode(65 + idx)}
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type="text"
                                placeholder={`Nhập phương án ${String.fromCharCode(65 + idx)}...`}
                                value={opt}
                                onChange={(e) => {
                                  const nextOpts = [...options];
                                  nextOpts[idx] = e.target.value;
                                  setOptions(nextOpts);
                                }}
                                required
                                style={{ borderRadius: '20px', padding: '12px 18px', width: '100%' }}
                              />
                              <span style={{
                                position: 'absolute',
                                right: '16px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontWeight: '800',
                                fontSize: '12px',
                                color: correctAnswer === String.fromCharCode(65 + idx) ? '#10b981' : '#94a3b8',
                                cursor: 'pointer',
                                backgroundColor: correctAnswer === String.fromCharCode(65 + idx) ? '#ecfdf5' : '#f1f5f9',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: correctAnswer === String.fromCharCode(65 + idx) ? '1px solid #10b981' : '1px solid transparent'
                              }}
                              onClick={() => setCorrectAnswer(String.fromCharCode(65 + idx))}
                              title="Đặt làm đáp án đúng"
                              >
                                {correctAnswer === String.fromCharCode(65 + idx) ? 'Correct' : 'Select'}
                              </span>
                            </div>
                          </div>
                        ))}

                        <div className="form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '700' }}>
                            Đáp án đúng
                          </label>
                          <select 
                            value={correctAnswer} 
                            onChange={(e) => setCorrectAnswer(e.target.value)}
                            style={{ borderRadius: '20px', padding: '12px 18px' }}
                          >
                            <option value="A">Phương án A</option>
                            <option value="B">Phương án B</option>
                            <option value="C">Phương án C</option>
                            <option value="D">Phương án D</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '700' }}>
                            Giải thích đáp án (Không bắt buộc)
                          </label>
                          <textarea 
                            placeholder="Ví dụ: 'Written' là quá khứ phân từ (V3) của động từ bất quy tắc 'write'."
                            value={explanationText}
                            onChange={(e) => setExplanationText(e.target.value)}
                            style={{ minHeight: '80px', borderRadius: '20px', padding: '14px 18px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        <button 
                          type="submit" 
                          className="btn-save-settings" 
                          style={{ 
                            marginTop: 0, 
                            borderRadius: '12px', 
                            padding: '12px 24px',
                            backgroundColor: '#1d4ed8',
                            flex: 1
                          }}
                        >
                          {isEditingIdx !== null ? 'Cập nhật câu hỏi' : 'Thêm câu hỏi'}
                        </button>
                        {isEditingIdx !== null && (
                          <button 
                            type="button" 
                            className="btn-save-settings" 
                            style={{ 
                              marginTop: 0, 
                              backgroundColor: '#f1f5f9', 
                              color: '#475569', 
                              border: '1px solid #cbd5e1',
                              borderRadius: '12px',
                              padding: '12px 24px'
                            }}
                            onClick={handleCancelEdit}
                          >
                            Hủy bỏ
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}


        </div>
      </main>

      <Footer />
    </div>
  );
};

export default InstructorDashboard;
