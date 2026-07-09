import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { getCourseDetails } from '../../lessons/services/lessons.service';
import { 
  FiSearch, FiBook, FiAward, FiClock, FiPlay, 
  FiChevronRight, FiCheckCircle, FiLoader, FiSliders 
} from 'react-icons/fi';
import '../styles/courses.scss';

const getCourseLevel = (courseName, subjectName) => {
  const name = `${courseName || ''} ${subjectName || ''}`.toLowerCase();
  if (name.includes('căn bản') || name.includes('begin') || name.includes('cơ bản') || name.includes('nhập môn') || name.includes('elementary')) {
    return 'Beginner';
  }
  if (name.includes('communication') || name.includes('giao tiếp') || name.includes('conversation') || name.includes('business')) {
    return 'Intermediate';
  }
  if (name.includes('ielts') || name.includes('advanced') || name.includes('chuyên sâu') || name.includes('nâng cao') || name.includes('masterclass')) {
    return 'Advanced';
  }
  return 'Intermediate';
};

const MyCoursesPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'in_progress', 'completed'

  // 1. Fetch all courses
  const { data: rawCourses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['courses-raw'],
    queryFn: async () => {
      const response = await apiClient.get('/courses');
      return response.data.courses || [];
    }
  });

  // 2. Fetch details for each course to calculate the progress dynamically
  const { data: myCourses = [], isLoading: isProgressLoading } = useQuery({
    queryKey: ['my-courses-progress', rawCourses.map(c => c.course_id).join(',')],
    queryFn: async () => {
      if (rawCourses.length === 0) {
        // Fallback to mock data with mock progress if database has no courses
        return [
          {
            id: 'mock-1',
            title: 'IELTS Masterclass: Target Band 7.5+',
            instructor: 'Dr. Alexander Wright',
            image: '/images/hero_illustration.png',
            level: 'Advanced',
            subjectName: 'IELTS Masterclass',
            progress: 80,
            lessonsCount: 12,
            sectionsCount: 3
          },
          {
            id: 'mock-2',
            title: 'Business English: Communication Mastery',
            instructor: 'Sarah Jenkins',
            image: '/images/meeting_group.png',
            level: 'Intermediate',
            subjectName: 'Business English',
            progress: 45,
            lessonsCount: 8,
            sectionsCount: 2
          },
          {
            id: 'mock-3',
            title: 'English for Beginners: Pronunciation',
            instructor: 'Michael Ross',
            image: '/images/teacher_virtual.png',
            level: 'Beginner',
            subjectName: 'General English',
            progress: 100,
            lessonsCount: 6,
            sectionsCount: 1
          },
          {
            id: 'mock-4',
            title: 'Daily Conversation Patterns',
            instructor: 'Jessica Lee',
            image: '/images/hero_illustration.png',
            level: 'Elementary',
            subjectName: 'General English',
            progress: 0,
            lessonsCount: 10,
            sectionsCount: 2
          }
        ];
      }

      // Map through all database courses and fetch their details (which computes progress under-the-hood)
      const coursesWithProgress = await Promise.all(
        rawCourses.map(async (c) => {
          try {
            const details = await getCourseDetails(c.course_id);
            return {
              id: `db-${c.course_id}`,
              title: c.course_name,
              instructor: c.instructor_name || 'Hệ thống E-Learning',
              image: c.thumbnail_url || '/images/hero_illustration.png',
              level: getCourseLevel(c.course_name, c.subject_name),
              subjectName: c.subject_name,
              progress: details.progress || 0,
              lessonsCount: c.lessons_count || 0,
              sectionsCount: c.sections_count || 0,
              startDate: details.startDate || c.start_date,
              instructorId: details.instructorId || c.instructor_id
            };
          } catch (e) {
            console.error(`Error loading details for course ${c.course_id}:`, e);
            return {
              id: `db-${c.course_id}`,
              title: c.course_name,
              instructor: c.instructor_name || 'Hệ thống E-Learning',
              image: c.thumbnail_url || '/images/hero_illustration.png',
              level: getCourseLevel(c.course_name, c.subject_name),
              subjectName: c.subject_name,
              progress: 0,
              lessonsCount: c.lessons_count || 0,
              sectionsCount: c.sections_count || 0,
              startDate: c.start_date,
              instructorId: c.instructor_id
            };
          }
        })
      );
      return coursesWithProgress;
    },
    enabled: rawCourses.length >= 0
  });

  const isLoading = isCoursesLoading || isProgressLoading;

  // Filter courses based on search & completion status
  const filteredCourses = myCourses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.subjectName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'completed') {
      return matchSearch && c.progress === 100;
    }
    if (statusFilter === 'in_progress') {
      return matchSearch && c.progress > 0 && c.progress < 100;
    }
    return matchSearch;
  });

  // Calculate statistics
  const totalCourses = myCourses.length;
  const completedCourses = myCourses.filter(c => c.progress === 100).length;
  const averageProgress = totalCourses > 0 
    ? Math.round(myCourses.reduce((sum, c) => sum + c.progress, 0) / totalCourses) 
    : 0;

  const handleStartLearning = (course) => {
    if (course.id.startsWith('db-')) {
      const dbId = course.id.split('-')[1];
      navigate(`/lessons?courseId=${dbId}`);
    } else {
      const mockId = course.id === 'mock-1' ? 1 : 
                     course.id === 'mock-2' ? 3 : 
                     course.id === 'mock-3' ? 4 : 2;
      navigate(`/lessons?courseId=${mockId}`);
    }
  };

  // Trigger fade-in animation
  useEffect(() => {
    if (filteredCourses.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      }, { threshold: 0.05 });

      const timer = setTimeout(() => {
        document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
      }, 100);

      return () => {
        clearTimeout(timer);
        observer.disconnect();
      };
    }
  }, [filteredCourses]);

  return (
    <div className="courses-page-new my-courses-dashboard" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', minHeight: '100vh' }}>
      <Header />

      <main style={{ paddingTop: '120px', paddingBottom: '60px' }}>
        <div className="container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
          
          {/* Dashboard Header */}
          <div className="dashboard-header" style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-color)' }}>
              Bài học của tôi
            </h1>
            <p style={{ color: 'var(--text-light)', fontSize: '16px' }}>
              Theo dõi lộ trình học tập, hoàn thành bài giảng và nâng cao trình độ tiếng Anh của bạn.
            </p>
          </div>

          {/* Stats Overview */}
          <div className="stats-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            marginBottom: '40px'
          }}>
            {/* Stat Item 1 */}
            <div className="stat-card" style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '24px',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div className="stat-icon-wrapper" style={{
                background: 'rgba(29, 78, 216, 0.1)',
                color: '#1d4ed8',
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                <FiBook />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '14px', color: 'var(--text-light)', fontWeight: '500' }}>Khóa học đã đăng ký</span>
                <strong style={{ display: 'block', fontSize: '28px', fontWeight: '800', color: 'var(--text-color)' }}>{totalCourses}</strong>
              </div>
            </div>

            {/* Stat Item 2 */}
            <div className="stat-card" style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '24px',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div className="stat-icon-wrapper" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                <FiCheckCircle />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '14px', color: 'var(--text-light)', fontWeight: '500' }}>Khóa học hoàn thành</span>
                <strong style={{ display: 'block', fontSize: '28px', fontWeight: '800', color: 'var(--text-color)' }}>{completedCourses}</strong>
              </div>
            </div>

            {/* Stat Item 3 */}
            <div className="stat-card" style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '24px',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div className="stat-icon-wrapper" style={{
                background: 'rgba(249, 115, 22, 0.1)',
                color: '#f97316',
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                <FiAward />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '14px', color: 'var(--text-light)', fontWeight: '500' }}>Tiến độ trung bình</span>
                <strong style={{ display: 'block', fontSize: '28px', fontWeight: '800', color: 'var(--text-color)' }}>{averageProgress}%</strong>
              </div>
            </div>
          </div>

          {/* Filtering & Search Toolbar */}
          <div className="toolbar-wrapper" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {/* Filter Pills */}
            <div className="filter-pills" style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setStatusFilter('all')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: statusFilter === 'all' ? '#1d4ed8' : 'var(--border-color, #cbd5e1)',
                  background: statusFilter === 'all' ? '#1d4ed8' : 'var(--card-bg, #ffffff)',
                  color: statusFilter === 'all' ? '#ffffff' : 'var(--text-color)',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Tất cả
              </button>
              <button 
                onClick={() => setStatusFilter('in_progress')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: statusFilter === 'in_progress' ? '#1d4ed8' : 'var(--border-color, #cbd5e1)',
                  background: statusFilter === 'in_progress' ? '#1d4ed8' : 'var(--card-bg, #ffffff)',
                  color: statusFilter === 'in_progress' ? '#ffffff' : 'var(--text-color)',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Đang học
              </button>
              <button 
                onClick={() => setStatusFilter('completed')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: statusFilter === 'completed' ? '#1d4ed8' : 'var(--border-color, #cbd5e1)',
                  background: statusFilter === 'completed' ? '#1d4ed8' : 'var(--card-bg, #ffffff)',
                  color: statusFilter === 'completed' ? '#ffffff' : 'var(--text-color)',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Đã hoàn thành
              </button>
            </div>

            {/* Search Input */}
            <div className="search-box-wrapper" style={{
              position: 'relative',
              width: '100%',
              maxWidth: '360px'
            }}>
              <FiSearch style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-light)',
                fontSize: '18px'
              }} />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm khóa học..."
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 48px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-color)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
              <FiLoader className="spin" style={{ fontSize: '36px', color: '#1d4ed8' }} />
              <span style={{ fontSize: '14px', color: 'var(--text-light)', fontWeight: '600' }}>Đang tải tiến trình học tập...</span>
            </div>
          ) : filteredCourses.length === 0 ? (
            /* Empty State */
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '24px',
              padding: '60px 24px',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.01)'
            }}>
              <FiBook style={{ fontSize: '48px', color: 'var(--text-light)', marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-color)' }}>Không tìm thấy khóa học nào</h3>
              <p style={{ color: 'var(--text-light)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
                {searchTerm || statusFilter !== 'all' 
                  ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.' 
                  : 'Bạn chưa có khóa học nào hoạt động trên hệ thống.'}
              </p>
              <button 
                onClick={() => navigate('/courses')}
                style={{
                  padding: '12px 24px',
                  background: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Khám phá khóa học
              </button>
            </div>
          ) : (
            /* Courses Grid */
            <div className="courses-grid-premium" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '30px'
            }}>
              {filteredCourses.map(course => {
                const startDate = course.startDate ? new Date(course.startDate) : null;
                const currentDate = new Date();
                const hasNotStarted = startDate && startDate > currentDate;

                return (
                  <div 
                    key={course.id} 
                    className="course-card-premium scroll-animate"
                    onClick={() => handleStartLearning(course)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-thumb">
                      <img src={course.image} alt={course.title} />
                      {hasNotStarted ? (
                        <span className="badge-status" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', fontWeight: 'bold' }}>
                          Chưa mở: {startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                      ) : (
                        <span className="badge-status" style={{ background: '#ecfdf5', color: '#059669' }}>
                          {course.level}
                        </span>
                      )}
                      <div className="thumb-overlay">
                        <button className="btn-preview">{hasNotStarted ? 'Xem đếm ngược' : 'Vào học ngay'}</button>
                      </div>
                    </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: 'auto', minHeight: '220px' }}>
                    <div className="card-tags">
                      <span className="tag-level" style={{ background: 'rgba(29,78,216,0.06)', color: '#1d4ed8' }}>
                        {course.subjectName}
                      </span>
                    </div>
                    <h3 className="course-title" style={{ minHeight: '48px', fontSize: '16px', lineHeight: '1.4', fontWeight: '700' }}>
                      {course.title}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
                      Giảng viên: <span style={{ fontWeight: '500' }}>{course.instructor}</span>
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="progress-container" style={{ marginTop: 'auto', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', marginBottom: '6px' }}>
                        <span>Tiến độ</span>
                        <span>{course.progress}%</span>
                      </div>
                      <div className="progress-bar-bg" style={{
                        background: 'var(--border-color, #e2e8f0)',
                        height: '8px',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div 
                          className="progress-bar-fill" 
                          style={{
                            width: `${course.progress}%`,
                            background: course.progress === 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
                            height: '100%',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease'
                          }}
                        ></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--text-light)', fontWeight: '500' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiBook /> {course.sectionsCount} chương
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiClock /> {course.lessonsCount} bài học
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MyCoursesPage;
