import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { getCourseDetails } from '../../lessons/services/lessons.service';
import { 
  FiAlertCircle, FiSearch, FiBook, FiAward, FiClock,
  FiCheckCircle, FiRefreshCw
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

// Component Skeleton Loading cho thẻ khóa học
const MyCourseCardSkeleton = () => {
  return (
    <div className="course-card-premium animate-pulse" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '24px', overflow: 'hidden' }}>
      <div style={{ height: '170px', backgroundColor: 'var(--border-color, #cbd5e1)', opacity: 0.2 }}></div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '220px', gap: '12px' }}>
        <div style={{ height: '20px', width: '40%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.2 }}></div>
        <div style={{ height: '24px', width: '90%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', marginTop: '4px', opacity: 0.2 }}></div>
        <div style={{ height: '16px', width: '60%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.2 }}></div>
        <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px', marginTop: 'auto', opacity: 0.2 }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
          <div style={{ height: '16px', width: '30%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.2 }}></div>
          <div style={{ height: '16px', width: '30%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.2 }}></div>
        </div>
      </div>
    </div>
  );
};

const MyCoursesPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'in_progress', 'completed'

  // 1. Fetch all courses
  const {
    data: rawCourses = [],
    isLoading: isCoursesLoading,
    isFetching: isCoursesFetching,
    isError: isCoursesError,
    refetch: refetchCourses
  } = useQuery({
    queryKey: ['courses-raw'],
    queryFn: async () => {
      const response = await apiClient.get('/courses');
      return response.data.courses || [];
    }
  });

  // 2. Fetch details for each course to calculate the progress dynamically
  const {
    data: myCourses = [],
    isLoading: isProgressLoading,
    isFetching: isProgressFetching,
    isError: isProgressError,
    refetch: refetchProgress
  } = useQuery({
    queryKey: ['my-courses-progress', rawCourses.map(c => c.course_id).join(',')],
    queryFn: async () => {
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
            throw e;
          }
        })
      );
      return coursesWithProgress;
    },
    enabled: rawCourses.length > 0
  });

  const isLoading = isCoursesLoading || isProgressLoading;
  const isFetching = isCoursesFetching || isProgressFetching;
  const isError = isCoursesError || isProgressError;

  // Filter courses based on search & completion status
  const filteredCourses = myCourses.filter(c => {
    const matchSearch = (c.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (c.subjectName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
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
    const dbId = course.id?.startsWith('db-') ? course.id.slice(3) : null;
    if (dbId) navigate(`/lessons?courseId=${dbId}`);
  };

  const handleRetry = () => {
    if (isCoursesError) return refetchCourses();
    return refetchProgress();
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
                <strong style={{ display: 'block', fontSize: '28px', fontWeight: '800', color: 'var(--text-color)' }}>{isLoading || isError ? '—' : totalCourses}</strong>
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
                <strong style={{ display: 'block', fontSize: '28px', fontWeight: '800', color: 'var(--text-color)' }}>{isLoading || isError ? '—' : completedCourses}</strong>
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
                <strong style={{ display: 'block', fontSize: '28px', fontWeight: '800', color: 'var(--text-color)' }}>{isLoading || isError ? '—' : `${averageProgress}%`}</strong>
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
            <div className="courses-grid-premium" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '30px'
            }}>
              {[...Array(6)].map((_, i) => <MyCourseCardSkeleton key={i} />)}
            </div>
          ) : isError ? (
            <div
              role="alert"
              style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '16px',
                padding: '60px 24px',
                textAlign: 'center'
              }}
            >
              <FiAlertCircle aria-hidden="true" style={{ fontSize: '48px', color: '#be123c', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-color)' }}>
                Không thể tải khóa học của bạn, vui lòng thử lại sau
              </h3>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isFetching}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  cursor: isFetching ? 'wait' : 'pointer',
                  opacity: isFetching ? 0.7 : 1
                }}
              >
                <FiRefreshCw aria-hidden="true" />
                {isFetching ? 'Đang thử lại...' : 'Thử lại'}
              </button>
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
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-color)' }}>
                {searchTerm || statusFilter !== 'all'
                  ? 'Không tìm thấy khóa học nào'
                  : 'Bạn chưa đăng ký/xem khóa học nào'}
              </h3>
              <p style={{ color: 'var(--text-light)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
                {searchTerm || statusFilter !== 'all' 
                  ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.' 
                  : 'Khám phá danh sách khóa học và bắt đầu lộ trình học của bạn.'}
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
