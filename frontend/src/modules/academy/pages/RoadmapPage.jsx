import React from 'react';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { FiArrowRight, FiCheckCircle, FiClock, FiBookOpen } from 'react-icons/fi';
import '../styles/academy.scss';

const roadmapPaths = [
  {
    id: 'basic',
    title: 'Tiếng Anh Cơ Bản',
    description: 'Dành cho người mới bắt đầu hoặc mất gốc. Tập trung vào phát âm chuẩn IPA và ngữ pháp nền tảng.',
    coursesCount: 5,
    students: '12.5k+',
    time: '3-4 tháng',
    skills: ['Phát âm IPA', 'Ngữ pháp cơ bản', 'Từ vựng thông dụng', 'Giao tiếp hàng ngày'],
    image: '/images/hero_illustration.png',
    isPro: false
  },
  {
    id: 'toeic',
    title: 'Lộ trình TOEIC 700+',
    description: 'Xây dựng kỹ năng làm bài thi TOEIC chuyên sâu. Tập trung vào Listening & Reading thực chiến.',
    coursesCount: 8,
    students: '8.2k+',
    time: '4-6 tháng',
    skills: ['Chiến thuật Part 1-7', 'Nghe hiểu công sở', 'Đọc hiểu báo chí', 'Quản lý thời gian thi'],
    image: '/images/meeting_group.png',
    isPro: true
  },
  {
    id: 'ielts',
    title: 'IELTS General Mastery',
    description: 'Lộ trình toàn diện 4 kỹ năng giúp bạn đạt band 6.5+ IELTS để định cư hoặc làm việc quốc tế.',
    coursesCount: 12,
    students: '5.6k+',
    time: '8-12 tháng',
    skills: ['Academic Writing', 'Critical Listening', 'Speaking Fluency', 'Advanced Reading'],
    image: '/images/teacher_virtual.png',
    isPro: true
  }
];

const RoadmapCard = ({ path }) => (
  <div className="roadmap-path-card scroll-animate">
    <div className="path-image">
      <img src={path.image} alt={path.title} />
      {path.isPro && <span className="pro-badge">PRO</span>}
    </div>
    <div className="path-content">
      <h2 className="path-title">{path.title}</h2>
      <p className="path-desc">{path.description}</p>
      
      <div className="path-stats">
        <span><FiBookOpen /> {path.coursesCount} khóa học</span>
        <span><FiClock /> {path.time}</span>
      </div>

      <div className="path-skills">
        <h3>Bạn sẽ học được:</h3>
        <ul>
          {path.skills.map((skill, idx) => (
            <li key={idx}><FiCheckCircle /> {skill}</li>
          ))}
        </ul>
      </div>

      <button className={`btn-view-path ${path.isPro ? 'btn-pro' : ''}`}>
        Xem chi tiết lộ trình <FiArrowRight />
      </button>
    </div>
  </div>
);

const RoadmapPage = () => {
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
    <div className="academy-page-modern">
      <Header />
      
      <main className="academy-main">
        <section className="academy-hero-section">
          <div className="container">
            <div className="hero-content scroll-animate">
              <h1>Lộ trình học <span>thông minh</span></h1>
              <p>Học theo lộ trình bài bản giúp bạn tiết kiệm 50% thời gian học tập mà vẫn đạt hiệu quả tối ưu.</p>
              <div className="hero-info-cards">
                <div className="info-item">
                  <strong>Khởi đầu</strong>
                  <span>Xác định trình độ</span>
                </div>
                <div className="info-arrow"><FiArrowRight /></div>
                <div className="info-item">
                  <strong>Tăng tốc</strong>
                  <span>Học theo lộ trình</span>
                </div>
                <div className="info-arrow"><FiArrowRight /></div>
                <div className="info-item">
                  <strong>Về đích</strong>
                  <span>Làm chủ kỹ năng</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="roadmap-paths-section">
          <div className="container">
            <div className="section-title">
              <h2>Các lộ trình dành cho bạn</h2>
              <p>Dựa trên mục tiêu sự nghiệp và trình độ hiện tại, hãy chọn cho mình một lộ trình phù hợp nhất.</p>
            </div>

            <div className="roadmap-grid">
              {roadmapPaths.map(path => <RoadmapCard key={path.id} path={path} />)}
            </div>
          </div>
        </section>

        {/* Why Roadmap Section (F8 Style) */}
        <section className="roadmap-benefits-section">
          <div className="container">
            <div className="benefits-card scroll-animate">
              <div className="benefit-text">
                <h2>Tại sao nên học theo lộ trình?</h2>
                <ul>
                  <li><FiCheckCircle /> <strong>Không lạc hướng:</strong> Luôn biết mình cần học gì tiếp theo.</li>
                  <li><FiCheckCircle /> <strong>Tiết kiệm thời gian:</strong> Tập trung vào những kiến thức thực sự quan trọng.</li>
                  <li><FiCheckCircle /> <strong>Kết quả bền vững:</strong> Xây dựng kiến thức từ gốc đến ngọn.</li>
                </ul>
              </div>
              <div className="benefit-image">
                <img src="/images/hero_illustration.png" alt="Roadmap benefits" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default RoadmapPage;
