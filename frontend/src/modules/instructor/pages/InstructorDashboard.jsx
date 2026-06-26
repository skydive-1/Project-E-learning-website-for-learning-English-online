import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FiPlus, FiBook, FiUsers, FiTrendingUp, FiSettings, 
  FiEdit, FiTrash2, FiEye, FiLoader, FiAlertCircle, FiLayers,
  FiSearch, FiMail, FiPhone, FiLock, FiCalendar, FiDollarSign, FiStar
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import '../styles/instructor.scss';

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

  // --- TAB 4: SETTINGS STATES ---
  const [profile, setProfile] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    gender: 'Other',
    birthDate: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  const [changePwd, setChangePwd] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [pwdUpdating, setPwdUpdating] = useState(false);

  useEffect(() => {
    if (activeTab === 'settings') {
      const fetchProfile = async () => {
        setProfileLoading(true);
        setSettingsSuccess('');
        setSettingsError('');
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.data && response.data.data) {
            const d = response.data.data;
            setProfile({
              fullName: d.fullName || '',
              username: d.username || '',
              email: d.email || '',
              phone: d.phone || '',
              gender: d.gender || 'Other',
              birthDate: d.birthDate ? d.birthDate.split('T')[0] : ''
            });
          }
        } catch (err) {
          console.error('Lỗi lấy hồ sơ giảng viên:', err);
          setSettingsError('Không thể tải thông tin cá nhân của bạn.');
        } finally {
          setProfileLoading(false);
        }
      };
      fetchProfile();
    }
  }, [activeTab]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSettingsSuccess('');
    setSettingsError('');
    setProfileUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_BASE_URL}/auth/profile`, {
        username: profile.username,
        fullName: profile.fullName,
        phone: profile.phone,
        gender: profile.gender,
        birthDate: profile.birthDate
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data && response.data.success) {
        setSettingsSuccess('Cập nhật thông tin cá nhân thành công!');
      }
    } catch (err) {
      console.error('Lỗi lưu hồ sơ:', err);
      setSettingsError(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin cá nhân.');
    } finally {
      setProfileUpdating(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSettingsSuccess('');
    setSettingsError('');
    
    if (changePwd.newPassword !== changePwd.confirmPassword) {
      setSettingsError('Mật khẩu mới và xác thực mật khẩu không khớp nhau.');
      return;
    }
    
    setPwdUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/auth/change-password`, {
        oldPassword: changePwd.oldPassword,
        newPassword: changePwd.newPassword
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSettingsSuccess('Thay đổi mật khẩu thành công!');
      setChangePwd({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error('Lỗi đổi mật khẩu:', err);
      setSettingsError(err.response?.data?.message || 'Mật khẩu cũ không chính xác.');
    } finally {
      setPwdUpdating(false);
    }
  };

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
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
              <FiSettings /> Settings
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="instructor-content">
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
              {activeTab === 'settings' && (
                <>
                  <h1>Account Settings</h1>
                  <p>Modify your instructor biography, contact info, and security credentials.</p>
                </>
              )}
            </div>
            
            {activeTab === 'courses' && (
              <button className="btn-create-course" onClick={() => navigate('/instructor/create-course')}>
                <FiPlus /> Create New Course
              </button>
            )}
          </header>

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

          {/* --- 4. SETTINGS TAB CONTENT --- */}
          {activeTab === 'settings' && (
            <>
              {/* Alert Toasts */}
              {settingsSuccess && <div className="alert-toast success">{settingsSuccess}</div>}
              {settingsError && <div className="alert-toast error"><FiAlertCircle /> {settingsError}</div>}

              {profileLoading ? (
                <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px', color: '#64748b' }}>
                  <FiLoader className="spin" style={{ fontSize: '32px' }} />
                  <span>Đang tải thông tin tài khoản của bạn...</span>
                </div>
              ) : (
                <div className="settings-layout">
                  {/* Profile Edit Card */}
                  <div className="settings-card">
                    <h2>Thông tin cá nhân</h2>
                    <form onSubmit={handleSaveProfile}>
                      <div className="form-grid">
                        <div className="form-group">
                          <label htmlFor="fullName">Họ và tên</label>
                          <input 
                            type="text" 
                            id="fullName" 
                            value={profile.fullName} 
                            onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="username">Tên người dùng (Username)</label>
                          <input 
                            type="text" 
                            id="username" 
                            value={profile.username} 
                            onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="form-group form-group-full">
                          <label htmlFor="email">Địa chỉ Email (Không được đổi)</label>
                          <input 
                            type="email" 
                            id="email" 
                            value={profile.email} 
                            disabled
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="phone">Số điện thoại</label>
                          <input 
                            type="tel" 
                            id="phone" 
                            value={profile.phone} 
                            onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="gender">Giới tính</label>
                          <select 
                            id="gender" 
                            value={profile.gender} 
                            onChange={(e) => setProfile(prev => ({ ...prev, gender: e.target.value }))}
                          >
                            <option value="Male">Nam</option>
                            <option value="Female">Nữ</option>
                            <option value="Other">Khác</option>
                          </select>
                        </div>
                        <div className="form-group form-group-full">
                          <label htmlFor="birthDate">Ngày sinh</label>
                          <input 
                            type="date" 
                            id="birthDate" 
                            value={profile.birthDate} 
                            onChange={(e) => setProfile(prev => ({ ...prev, birthDate: e.target.value }))}
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn-save-settings" disabled={profileUpdating}>
                        {profileUpdating ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </form>
                  </div>

                  {/* Change Password Card */}
                  <div className="settings-card">
                    <h2>Đổi mật khẩu</h2>
                    <form onSubmit={handleChangePassword}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-group">
                          <label htmlFor="oldPassword">Mật khẩu hiện tại</label>
                          <input 
                            type="password" 
                            id="oldPassword" 
                            value={changePwd.oldPassword}
                            onChange={(e) => setChangePwd(prev => ({ ...prev, oldPassword: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="newPassword">Mật khẩu mới</label>
                          <input 
                            type="password" 
                            id="newPassword" 
                            value={changePwd.newPassword}
                            onChange={(e) => setChangePwd(prev => ({ ...prev, newPassword: e.target.value }))}
                            required
                            minLength={6}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
                          <input 
                            type="password" 
                            id="confirmPassword" 
                            value={changePwd.confirmPassword}
                            onChange={(e) => setChangePwd(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn-save-settings" style={{ backgroundColor: '#475569' }} disabled={pwdUpdating}>
                        {pwdUpdating ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default InstructorDashboard;
