import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { Button } from '../../../components/ui/button';
import { useLanguage } from '../../../context/LanguageContext';
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiClock, FiRefreshCw } from 'react-icons/fi';
import { roadmapPaths } from '../data/roadmapPaths';
import {
  ACADEMY_COURSES_QUERY_KEY,
  fetchAcademyCourses,
  getCoursesForRoadmap,
  getRoadmapCatalogUrl
} from '../utils/courseRoadmap';
import '../styles/academy.scss';

const RoadmapCard = ({ path, courses, isLoading, isError, onOpenDetail, t }) => (
  <article className="roadmap-path-card scroll-animate">
    <div className="path-content">
      <h2 className="path-title">{t(path.title)}</h2>
      <p className="path-desc">{t(path.description)}</p>

      <div className="path-stats">
        <span>
          <FiBookOpen aria-hidden="true" />
          {isLoading
            ? t('Đang cập nhật...')
            : isError
              ? `— ${t('khóa học')}`
              : `${courses.length} ${t('khóa học')}`}
        </span>
        <span><FiClock aria-hidden="true" /> {t(path.time)}</span>
      </div>

      {!isLoading && !isError && courses.length > 0 && (
        <div className="path-live-courses">
          <h3>{t('Khóa học đang có')}</h3>
          <ul>
            {courses.slice(0, 2).map((course) => (
              <li key={course.course_id}>
                <Link to={`/lessons?courseId=${course.course_id}`}>
                  <span>{course.course_name}</span>
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="path-actions">
        <Button
          type="button"
          size="sm"
          onClick={() => onOpenDetail(path)}
          className="btn-view-path"
          aria-label={`${t('Xem chi tiết lộ trình')}: ${t(path.title)}`}
        >
          <span>{t('Xem lộ trình')}</span>
          <FiArrowRight data-icon="inline-end" aria-hidden="true" />
        </Button>
        {!isLoading && !isError && courses.length > 0 && (
          <Link className="path-catalog-link" to={getRoadmapCatalogUrl(path.id)}>
            {t('Xem tất cả khóa học')}
          </Link>
        )}
      </div>
    </div>

    <div className="path-image" aria-hidden="true">
      <img src={path.image} alt="" />
    </div>
  </article>
);

const RoadmapPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const {
    data: courses = [],
    isLoading,
    isError,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ACADEMY_COURSES_QUERY_KEY,
    queryFn: fetchAcademyCourses,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

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

            <div className={`roadmap-live-status ${isError ? 'is-error' : ''}`} role={isError ? 'alert' : 'status'}>
              <span>
                <i aria-hidden="true" />
                {isError
                  ? t('Chưa thể đồng bộ danh mục khóa học.')
                  : t('Danh mục tự cập nhật mỗi phút từ các khóa học đang xuất bản.')}
              </span>
              <button type="button" onClick={() => refetch()} disabled={isFetching}>
                <FiRefreshCw aria-hidden="true" />
                {isFetching ? t('Đang cập nhật...') : t('Cập nhật ngay')}
              </button>
            </div>

            <div className="roadmap-grid">
              {roadmapPaths.map((path) => (
                <RoadmapCard
                  key={path.id}
                  path={path}
                  courses={getCoursesForRoadmap(courses, path)}
                  isLoading={isLoading}
                  isError={isError}
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
