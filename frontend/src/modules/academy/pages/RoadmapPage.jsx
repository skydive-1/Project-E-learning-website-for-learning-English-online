import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { Button } from '../../../components/ui/button';
import { useLanguage } from '../../../context/LanguageContext';
import apiClient from '../../../config/api.config';
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiClock } from 'react-icons/fi';
import { roadmapPaths } from '../data/roadmapPaths';
import '../styles/academy.scss';

const RoadmapCard = ({ path, liveCoursesCount, onOpenDetail, t }) => (
  <article className="roadmap-path-card scroll-animate">
    <div className="path-content">
      <h2 className="path-title">{t(path.title)}</h2>
      <p className="path-desc">{t(path.description)}</p>

      <div className="path-stats">
        <span>
          <FiBookOpen aria-hidden="true" /> {liveCoursesCount ?? path.coursesCount} {t('courses')}
        </span>
        <span><FiClock aria-hidden="true" /> {t(path.time)}</span>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => onOpenDetail(path)}
        className="btn-view-path"
        aria-label={`${t('Xem chi tiết lộ trình')}: ${t(path.title)}`}
      >
        <span>{t('Xem chi tiết')}</span>
        <FiArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>
    </div>

    <div className="path-image" aria-hidden="true">
      <img src={path.image} alt="" />
    </div>
  </article>
);

const RoadmapPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [liveCourseCounts, setLiveCourseCounts] = useState(null);

  useEffect(() => {
    let active = true;

    apiClient.get('/courses')
      .then((res) => {
        if (!active) return;
        const courses = res?.data?.courses || [];
        const counts = {};
        for (const course of courses) {
          const subjectId = String(course.subject_id ?? '');
          if (!subjectId) continue;
          counts[subjectId] = (counts[subjectId] || 0) + 1;
        }
        setLiveCourseCounts(counts);
      })
      .catch(() => {
        // Dùng số dự phòng trong cấu hình khi danh sách khóa học chưa tải được.
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('animate-in');
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-animate').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const getCourseCount = (path) => {
    if (!path.subjectFilter || liveCourseCounts === null) return path.coursesCount;
    return liveCourseCounts[path.subjectFilter] ?? 0;
  };

  return (
    <div className="academy-page-modern">
      <Header />

      <main className="academy-main">
        <section className="academy-hero-section">
          <div className="container">
            <div className="hero-content scroll-animate">
              <h1>{t('Lộ trình học')}</h1>
              <p>{t('Chọn lộ trình phù hợp với mục tiêu và trình độ hiện tại của bạn. Mỗi lộ trình giúp bạn biết nên bắt đầu từ đâu và học gì tiếp theo.')}</p>
            </div>
          </div>
        </section>

        <section className="roadmap-paths-section">
          <div className="container">
            <h2 className="sr-only">{t('Các lộ trình gợi ý')}</h2>

            <div className="roadmap-grid">
              {roadmapPaths.map((path) => (
                <RoadmapCard
                  key={path.id}
                  path={path}
                  liveCoursesCount={getCourseCount(path)}
                  onOpenDetail={(targetPath) => navigate(`/academy/${targetPath.id}`)}
                  t={t}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="roadmap-benefits-section">
          <div className="container">
            <div className="benefits-layout">
              <div className="benefit-text scroll-animate">
                <h2>{t('Tại sao nên học theo lộ trình?')}</h2>
                <p>{t('Một kế hoạch rõ ràng giúp bạn tập trung vào đúng nội dung ở từng giai đoạn và duy trì tiến độ học tập.')}</p>
                <ul>
                  <li><FiCheckCircle aria-hidden="true" /> <span><strong>{t('Không lạc hướng:')}</strong> {t('Luôn biết mình cần học gì tiếp theo.')}</span></li>
                  <li><FiCheckCircle aria-hidden="true" /> <span><strong>{t('Tiết kiệm thời gian:')}</strong> {t('Tập trung vào những kiến thức thực sự quan trọng.')}</span></li>
                  <li><FiCheckCircle aria-hidden="true" /> <span><strong>{t('Kết quả bền vững:')}</strong> {t('Xây dựng kiến thức từ gốc đến ngọn.')}</span></li>
                </ul>
              </div>
              <div className="benefit-image scroll-animate">
                <img src="/images/hero_illustration.png" alt={t('Học tiếng Anh cùng nhau')} />
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
