import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { FiSearch, FiStar, FiUsers, FiPlayCircle, FiFilter } from 'react-icons/fi';
import '../styles/courses.scss';

const coursesData = [
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
    duration: '45 hours'
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
    duration: '32 hours'
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
    duration: '12 hours'
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
    duration: '15 hours'
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
    level: 'Intermediate',
    duration: '20 hours'
  }
];

const CourseCard = ({ course }) => {
  const navigate = useNavigate();

  const handleStartLearning = () => {
    // Navigate to lessons page. In a real app, we would pass the course ID.
    // For now, it will open the default lesson detail page.
    navigate('/lessons');
  };

  return (
    <div className="course-card-premium scroll-animate" onClick={handleStartLearning}>
      <div className="card-thumb">
        <img src={course.image} alt={course.title} />
        {course.badge && <span className="badge-status">{course.badge}</span>}
        <div className="thumb-overlay">
          <button className="btn-preview">Học ngay</button>
        </div>
      </div>
      <div className="card-body">
        <h3 className="course-title">{course.title}</h3>
        <p className="instructor">{course.instructor}</p>
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
          <span><FiUsers /> {course.students.toLocaleString()} học viên</span>
          <span><FiPlayCircle /> {course.duration}</span>
        </div>
        <div className="price-row">
          <span className="current-price text-emerald-600">{course.price}</span>
        </div>
      </div>
    </div>
  );
};

const CourseListPage = () => {
  const [searchTerm, setSearchText] = useState('');

  // Scroll animation observer
  React.useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="courses-page-new">
      <Header />
      
      <main className="courses-main">
        {/* F8 Style Hero with Udemy Search functionality */}
        <section className="courses-hero-section">
          <div className="container">
            <div className="hero-flex">
              <div className="hero-text scroll-animate">
                <h1>Học Tiếng Anh Miễn Phí</h1>
                <p>Hệ thống bài giảng chất lượng cao, giúp bạn làm chủ tiếng Anh hoàn toàn miễn phí.</p>
                <div className="search-bar-wrapper">
                  <FiSearch className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Bạn muốn học gì hôm nay?"
                    value={searchTerm}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                  <button className="btn-search">Tìm kiếm</button>
                </div>
              </div>
              <div className="hero-stats scroll-animate">
                <div className="stat-pill"><strong>100k+</strong> Học viên</div>
                <div className="stat-pill"><strong>50+</strong> Khóa học</div>
                <div className="stat-pill"><strong>24/7</strong> Hỗ trợ AI</div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Bar */}
        <nav className="category-filter-bar">
          <div className="container">
            <div className="filter-list">
              <button className="active"><FiFilter /> Tất cả</button>
              <button>Giao tiếp</button>
              <button>IELTS</button>
              <button>TOEIC</button>
              <button>Ngữ pháp</button>
              <button>Phát âm</button>
            </div>
          </div>
        </nav>

        {/* All Courses Section */}
        <section className="course-section">
          <div className="container">
            <div className="section-header">
              <h2>Tất cả khóa học</h2>
              <p>Danh sách các khóa học trực tuyến dành cho mọi cấp độ.</p>
            </div>
            <div className="course-grid">
              {coursesData.map(course => <CourseCard key={course.id} course={course} />)}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CourseListPage;
