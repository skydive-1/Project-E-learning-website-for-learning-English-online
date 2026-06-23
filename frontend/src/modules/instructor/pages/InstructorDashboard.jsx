import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FiPlus, FiBook, FiUsers, FiTrendingUp, FiSettings, 
  FiEdit, FiTrash2, FiEye, FiLoader, FiAlertCircle, FiLayers
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

const API_BASE_URL = 'http://localhost:5000/api';

const InstructorDashboard = () => {
  const navigate = useNavigate();

  // Auth check
  useEffect(() => {
    const role = getRoleFromToken();
    if (role !== 2 && role !== 1) { // Instructor or Admin
      navigate('/');
    }
  }, [navigate]);

  // States
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

  // Compute stats
  const totalCourses = courses.length;
  const totalLessons = courses.reduce((sum, c) => sum + (c.lessons_count || 0), 0);
  const publishedCourses = courses.filter(c => c.status === 1).length;

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
            <button className="active"><FiBook /> My Courses</button>
            <button><FiUsers /> Students</button>
            <button><FiTrendingUp /> Performance</button>
            <button><FiSettings /> Settings</button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="instructor-content">
          <header className="content-header">
            <div className="header-text">
              <h1>My Courses</h1>
              <p>Manage your educational content and student engagement.</p>
            </div>
            <button className="btn-create-course" onClick={() => navigate('/instructor/create-course')}>
              <FiPlus /> Create New Course
            </button>
          </header>

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
            ) : courses.length === 0 ? (
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
                  {courses.map(course => (
                    <tr key={course.course_id}>
                      <td>
                        <div className="course-info-cell">
                          <div className="course-thumb-mini">
                            <img src="/images/hero_illustration.png" alt="" />
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
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default InstructorDashboard;
