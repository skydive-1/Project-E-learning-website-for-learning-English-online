import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useLanguage } from '../../../context/LanguageContext';
import { FiSearch, FiStar, FiUsers, FiPlayCircle, FiFilter, FiLoader, FiX, FiCheckCircle } from 'react-icons/fi';
import '../styles/courses.scss';

// Mẫu dữ liệu Mock đồng bộ với database subject_id
const mockCoursesData = [
  {
    id: 'course-1',
    title: 'IELTS Masterclass: Target Band 7.5+',
    instructor: 'Dr. Alexander Wright',
    rating: 4.9,
    reviews: 2400,
    students: 15600,
    price: 'Miễn phí',
    image: '/images/hero_illustration.png',
    badge: 'Đề xuất',
    level: 'Advanced',
    duration: '45 giờ',
    subjectId: 1,
    subjectName: 'IELTS Masterclass'
  },
  {
    id: 'course-2',
    title: 'Business English: Communication Mastery',
    instructor: 'Sarah Jenkins',
    rating: 4.8,
    reviews: 1850,
    students: 8900,
    price: 'Miễn phí',
    image: '/images/meeting_group.png',
    badge: 'Mới',
    level: 'Intermediate',
    duration: '32 giờ',
    subjectId: 3,
    subjectName: 'Business English'
  },
  {
    id: 'course-3',
    title: 'English for Beginners: Pronunciation',
    instructor: 'Michael Ross',
    rating: 4.7,
    reviews: 4200,
    students: 45000,
    price: 'Miễn phí',
    image: '/images/teacher_virtual.png',
    level: 'Beginner',
    duration: '12 giờ',
    subjectId: 4,
    subjectName: 'General English Communication'
  },
  {
    id: 'course-4',
    title: 'Daily Conversation Patterns',
    instructor: 'Jessica Lee',
    rating: 4.6,
    reviews: 3100,
    students: 28000,
    price: 'Miễn phí',
    image: '/images/hero_illustration.png',
    level: 'Elementary',
    duration: '15 giờ',
    subjectId: 4,
    subjectName: 'General English Communication'
  },
  {
    id: 'course-5',
    title: 'Grammar Essentials for TOEIC',
    instructor: 'David Pham',
    rating: 4.8,
    reviews: 5600,
    students: 32000,
    price: 'Miễn phí',
    image: '/images/meeting_group.png',
    badge: 'Đề xuất',
    level: 'Intermediate',
    duration: '20 giờ',
    subjectId: 2,
    subjectName: 'TOEIC Prep'
  }
];

// Hàm phụ trợ tự động phân loại trình độ tiếng Anh từ tiêu đề/môn học
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

// Hàm chuyển đổi tiếng Việt có dấu thành không dấu để tìm kiếm thông minh
const removeVietnameseTones = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

// Skeleton Card Component
const CourseCardSkeleton = () => {
  return (
    <div className="course-card-skeleton">
      <div className="skeleton-thumb animate-pulse"></div>
      <div className="skeleton-body">
        <div className="skeleton-tags">
          <span className="skeleton-tag animate-pulse"></span>
          <span className="skeleton-tag animate-pulse"></span>
        </div>
        <div className="skeleton-title animate-pulse"></div>
        <div className="skeleton-title short animate-pulse"></div>
        <div className="skeleton-text animate-pulse"></div>
        <div className="skeleton-rating animate-pulse"></div>
        <div className="skeleton-meta animate-pulse"></div>
      </div>
    </div>
  );
};

const CourseCard = ({ course }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const startDate = course.startDate ? new Date(course.startDate) : null;
  const currentDate = new Date();
  const hasNotStarted = startDate && startDate > currentDate;

  const handleStartLearning = () => {
    if (course.id && course.id.startsWith('db-')) {
      const dbId = course.id.split('-')[1];
      navigate(`/lessons?courseId=${dbId}`);
    } else {
      // Map mock course id dynamically to corresponding subject values
      const mockId = course.id === 'course-1' ? 1 : 
                     course.id === 'course-2' ? 3 : 
                     course.id === 'course-3' ? 4 : 
                     course.id === 'course-4' ? 4 : 2;
      navigate(`/lessons?courseId=${mockId}`);
    }
  };

  return (
    <div className="course-card-premium scroll-animate" onClick={handleStartLearning}>
      <div className="card-thumb">
        <img src={course.image || '/images/hero_illustration.png'} alt={t(course.title)} />
        {hasNotStarted ? (
          <span className="badge-status" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', fontWeight: 'bold' }}>
            {t('Sắp mở:')} {startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
          </span>
        ) : (
          course.badge && <span className="badge-status">{t(course.badge)}</span>
        )}
        <div className="thumb-overlay">
          <button className="btn-preview">{hasNotStarted ? t('Sắp mở') : t('Học ngay')}</button>
        </div>
      </div>
      <div className="card-body">
        <div className="card-tags">
          <span className="tag-level">{t(course.level)}</span>
          {course.subjectName && <span className="tag-subject">{t(course.subjectName)}</span>}
        </div>
        <h3 className="course-title">{t(course.title)}</h3>
        <p className="instructor">{t(course.instructor)}</p>
        <div className="rating-row">
          <span className="rating-score">{course.rating}</span>
          <div className="stars">
            {[...Array(5)].map((_, i) => (
              <FiStar key={i} className={i < Math.floor(course.rating) ? 'star-filled' : 'star-empty'} />
            ))}
          </div>
          <span className="reviews-count">({course.reviews.toLocaleString()})</span>
        </div>
        <div className="meta-info">
          <span><FiUsers /> {course.students.toLocaleString()} {t('student')}</span>
          <span><FiPlayCircle /> {course.duration}</span>
        </div>
        <div className="price-row">
          <span className="current-price text-emerald-600">{t(course.price)}</span>
        </div>
      </div>
    </div>
  );
};

const CourseListPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Fetch danh sách môn học phục vụ cho việc hiển thị bộ lọc động
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/courses/subjects');
        return response.data?.subjects || [];
      } catch (err) {
        console.error('Lỗi fetch subjects từ DB:', err);
        return [];
      }
    }
  });

  // Fetch danh sách khóa học từ DB
  const { data: courses = [], isLoading: loading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/courses');
        if (response.data && response.data.courses && response.data.courses.length > 0) {
          const dbCoursesMapped = response.data.courses.map(c => {
            const calculatedLevel = getCourseLevel(c.course_name, c.subject_name);
            return {
              id: `db-${c.course_id}`,
              title: c.course_name,
              instructor: 'Hệ thống E-Learning',
              rating: 4.8,
              reviews: 15,
              students: 120,
              price: 'Miễn phí',
              image: c.thumbnail_url || '/images/hero_illustration.png',
              badge: 'Thực tế',
              level: calculatedLevel,
              subjectId: c.subject_id,
              subjectName: c.subject_name,
              duration: `${c.lessons_count || 0} bài giảng`,
              startDate: c.start_date,
              instructorId: c.instructor_id
            };
          });
          return dbCoursesMapped; // Trả về duy nhất dữ liệu thật nếu có trong DB
        }
        return mockCoursesData; // Fallback về mock data nếu DB rỗng
      } catch (err) {
        console.error('Lỗi fetch courses từ DB:', err);
        return mockCoursesData; // Fallback về mock data nếu có lỗi kết nối DB
      }
    }
  });

  // Lọc danh sách môn học để hiển thị lên thanh danh mục
  const displayedSubjects = subjects.length > 0 ? subjects : [
    { subject_id: 1, subject_name: 'IELTS Masterclass' },
    { subject_id: 2, subject_name: 'TOEIC Prep' },
    { subject_id: 3, subject_name: 'Business English' },
    { subject_id: 4, subject_name: 'General English Communication' },
    { subject_id: 5, subject_name: 'English Grammar Essentials' }
  ];

  // Xử lý bộ lọc và tìm kiếm
  const filteredCourses = courses.filter(course => {
    // 1. Tìm kiếm không dấu thông minh
    const rawSearch = removeVietnameseTones(searchTerm.trim());
    const matchSearch = !rawSearch || 
      removeVietnameseTones(course.title || '').includes(rawSearch) ||
      removeVietnameseTones(course.level || '').includes(rawSearch) ||
      removeVietnameseTones(course.instructor || '').includes(rawSearch) ||
      (course.subjectName && removeVietnameseTones(course.subjectName).includes(rawSearch));

    // 2. Bộ lọc theo môn học (subject)
    const matchSubject = selectedSubjectId === 'all' || course.subjectId === Number(selectedSubjectId);

    // 3. Bộ lọc theo trình độ
    const matchLevel = selectedLevel === 'all' || 
      (course.level && course.level.toLowerCase() === selectedLevel.toLowerCase());

    return matchSearch && matchSubject && matchLevel;
  });

  // Xử lý sắp xếp kết quả
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    if (sortBy === 'rating') {
      return b.rating - a.rating;
    }
    if (sortBy === 'students') {
      return b.students - a.students;
    }
    if (sortBy === 'newest') {
      const getNumId = (id) => {
        if (id.startsWith('db-')) return parseInt(id.split('-')[1], 10);
        return 0; // Mock data có thứ tự thấp hơn
      };
      return getNumId(b.id) - getNumId(a.id);
    }
    return 0;
  });

  // Sửa lỗi IntersectionObserver: Đảm bảo trigger lại hoạt ảnh khi danh sách hiển thị thực tế thay đổi
  const courseIdsString = sortedCourses.map(c => c.id).join(',');
  useEffect(() => {
    if (sortedCourses.length > 0) {
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
  }, [courseIdsString]);

  const { t } = useLanguage();
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedSubjectId('all');
    setSelectedLevel('all');
    setSortBy('newest');
  };

  return (
    <div className="courses-page-new">
      <Header />
      
      <main className="courses-main">
        {/* Hero Section */}
        <section className="courses-hero-section">
          <div className="container">
            <div className="hero-flex">
              <div className="hero-text scroll-animate">
                <h1>{t('coursesTitle')}</h1>
                <p>{t('coursesSubtitle')}</p>
                <div className="search-bar-wrapper">
                  <FiSearch className="search-icon" />
                  <input 
                    type="text" 
                    placeholder={t('searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="btn-clear-search" onClick={() => setSearchTerm('')} title="Xóa tìm kiếm">
                      <FiX />
                    </button>
                  )}
                  <button className="btn-search">{t('searchPlaceholder').split('...')[0]}</button>
                </div>
              </div>
              <div className="hero-stats scroll-animate">
                <div className="stat-pill"><strong>100k+</strong> {t('student')}</div>
                <div className="stat-pill"><strong>50+</strong> {t('courses')}</div>
                <div className="stat-pill"><strong>24/7</strong> AI Tutor</div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories / Subjects Filter Bar */}
        <nav className="category-filter-bar">
          <div className="container">
            <div className="filter-list">
              <button 
                className={selectedSubjectId === 'all' ? 'active' : ''} 
                onClick={() => setSelectedSubjectId('all')}
              >
                <FiFilter /> {t('Tất cả môn học')}
              </button>
              {displayedSubjects.map(sub => (
                <button 
                  key={sub.subject_id}
                  className={selectedSubjectId === sub.subject_id ? 'active' : ''}
                  onClick={() => setSelectedSubjectId(sub.subject_id)}
                >
                  {t(sub.subject_name)}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Catalog Control Panel (Counts, Sorting & Advanced Level Filter) */}
        <section className="catalog-controls-section">
          <div className="container">
            <div className="catalog-controls-bar">
              <div className="results-count">
                {t('Tìm thấy')} <strong>{sortedCourses.length}</strong> {t('khóa học')}
              </div>
              
              <div className="controls-group">
                {/* Bộ lọc trình độ */}
                <div className="filter-select-wrapper">
                  <label htmlFor="level-select">{t('Trình độ:')}</label>
                  <select 
                    id="level-select"
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                  >
                    <option value="all">{t('Tất cả trình độ')}</option>
                    <option value="beginner">{t('Beginner (Bắt đầu)')}</option>
                    <option value="elementary">{t('Elementary (Sơ cấp)')}</option>
                    <option value="intermediate">{t('Intermediate (Trung cấp)')}</option>
                    <option value="advanced">{t('Advanced (Nâng cao)')}</option>
                  </select>
                </div>

                {/* Sắp xếp kết quả */}
                <div className="filter-select-wrapper">
                  <label htmlFor="sort-select">{t('Sắp xếp:')}</label>
                  <select 
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="newest">{t('Mới nhất')}</option>
                    <option value="students">{t('Học viên đông nhất')}</option>
                    <option value="rating">{t('Đánh giá cao nhất')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* All Courses Grid */}
        <section className="course-section">
          <div className="container">
            {loading ? (
              <div className="course-grid">
                {[...Array(6)].map((_, i) => <CourseCardSkeleton key={i} />)}
              </div>
            ) : sortedCourses.length === 0 ? (
              <div className="courses-empty-state">
                <div className="empty-illustration">🔍</div>
                <h3>{t('Không tìm thấy kết quả phù hợp')}</h3>
                <p>{t('Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc của bạn để khám phá các khóa học khác.')}</p>
                <button className="btn-reset-filters" onClick={handleResetFilters}>
                  {t('Thiết lập lại bộ lọc')}
                </button>
              </div>
            ) : (
              <div className="course-grid">
                {sortedCourses.map(course => <CourseCard key={course.id} course={course} />)}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CourseListPage;
