import React, { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiClock,
  FiInfo,
  FiRefreshCw,
  FiTarget
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useLanguage } from '../../../context/LanguageContext';
import { getRoadmapById } from '../data/roadmapPaths';
import {
  ACADEMY_COURSES_QUERY_KEY,
  fetchAcademyCourses,
  getCoursesForRoadmap
} from '../utils/courseRoadmap';
import '../styles/roadmap-detail.scss';

/*
 * THESIS: Biến lộ trình thành một giáo trình có thể hành động, không phải một modal tóm tắt.
 * OWN-WORLD: Nền sáng yên tĩnh, Smart Indigo cho hành động, Orange chỉ làm điểm nhấn minh họa, bề mặt phẳng radius 16px.
 * STORY: Người học hiểu mục tiêu, xem từng chặng, chọn khóa học thật và bắt đầu.
 * FIRST VIEWPORT: Breadcrumb, tiêu đề và mô tả ở trái; bảng tổng quan hữu ích ở phải trên desktop.
 * FORM: Editorial learning guide, seed ELRN-RD-20260910. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */

const CourseSkeleton = () => (
  <div className="roadmap-course-skeleton" aria-hidden="true">
    <span className="skeleton-media" />
    <span className="skeleton-copy">
      <i />
      <i />
      <i />
    </span>
  </div>
);

const RoadmapCourseCard = ({ course, locale, t }) => {
  const price = Number(course.price) > 0
    ? `${Number(course.price).toLocaleString(locale)} ₫`
    : t('Miễn phí');

  return (
    <article className="roadmap-course-card">
      <Link
        className="roadmap-course-media"
        to={`/lessons?courseId=${course.course_id}`}
        aria-label={`${t('Mở khóa học')}: ${course.course_name}`}
      >
        <img
          src={course.thumbnail_url || '/images/hero_illustration.png'}
          alt=""
          loading="lazy"
        />
      </Link>

      <div className="roadmap-course-copy">
        <div>
          <h3>
            <Link to={`/lessons?courseId=${course.course_id}`}>{course.course_name}</Link>
          </h3>
          <p>{course.instructor_name || 'E-Learn Academy'}</p>
        </div>

        <div className="roadmap-course-footer">
          <strong>{price}</strong>
          <Link to={`/lessons?courseId=${course.course_id}`}>
            {t('Học khóa này')}
            <FiArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
};

const RoadmapDetailPage = () => {
  const { roadmapId } = useParams();
  const { language, t } = useLanguage();
  const roadmap = getRoadmapById(roadmapId);
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';

  const {
    data: courses = [],
    isLoading,
    isError,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ACADEMY_COURSES_QUERY_KEY,
    queryFn: fetchAcademyCourses,
    enabled: Boolean(roadmap),
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const roadmapCourses = useMemo(() => {
    if (!roadmap) return [];
    return getCoursesForRoadmap(courses, roadmap);
  }, [courses, roadmap]);

  useEffect(() => {
    if (!roadmap) return undefined;
    const previousTitle = document.title;
    document.title = `${roadmap.title} | E-Learn`;
    return () => { document.title = previousTitle; };
  }, [roadmap]);

  if (!roadmap) {
    return (
      <div className="roadmap-detail-page">
        <Header />
        <main className="roadmap-not-found">
          <FiBookOpen aria-hidden="true" />
          <h1>{t('Không tìm thấy lộ trình')}</h1>
          <p>{t('Lộ trình bạn mở không tồn tại hoặc đã được thay đổi.')}</p>
          <Link to="/academy">
            <FiArrowLeft aria-hidden="true" />
            {t('Quay lại danh sách lộ trình')}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const displayedCourseCount = !isLoading && !isError ? roadmapCourses.length : '—';

  return (
    <div className="roadmap-detail-page" data-design-contract="ELRN-RD-20260910">
      <Header />

      <main>
        <header className="roadmap-detail-hero">
          <div className="roadmap-detail-container">
            <nav className="roadmap-breadcrumb" aria-label={t('Điều hướng lộ trình')}>
              <Link to="/academy">
                <FiArrowLeft aria-hidden="true" />
                {t('Tất cả lộ trình')}
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{t(roadmap.shortTitle)}</span>
            </nav>

            <div className="roadmap-heading-block">
              <h1>{t(roadmap.title)}</h1>
              <p>{t(roadmap.description)}</p>
            </div>
          </div>
        </header>

        <div className="roadmap-detail-container roadmap-detail-layout">
          <aside className="roadmap-detail-rail" aria-label={t('Tổng quan lộ trình')}>
            <div className="roadmap-summary-card">
              <div className="roadmap-summary-image">
                <img src={roadmap.image} alt={t(`Minh họa cho ${roadmap.title}`)} />
              </div>

              <div className="roadmap-summary-body">
                <h2>{t('Tổng quan lộ trình')}</h2>
                <dl>
                  <div>
                    <dt><FiBookOpen aria-hidden="true" /> {t('Khóa học')}</dt>
                    <dd>{displayedCourseCount}</dd>
                  </div>
                  <div>
                    <dt><FiCalendar aria-hidden="true" /> {t('Thời gian dự kiến')}</dt>
                    <dd>{t(roadmap.time)}</dd>
                  </div>
                  <div>
                    <dt><FiClock aria-hidden="true" /> {t('Nhịp học gợi ý')}</dt>
                    <dd>{t(roadmap.weeklyCommitment)}</dd>
                  </div>
                </dl>

                <nav className="roadmap-page-nav" aria-label={t('Mục lục trang')}>
                  <a href="#tong-quan">{t('Bạn sẽ đạt được gì?')}</a>
                  <a href="#noi-dung">{t('Nội dung lộ trình')}</a>
                  <a href="#khoa-hoc">{t('Khóa học phù hợp')}</a>
                </nav>

                <a className="roadmap-primary-action" href="#khoa-hoc">
                  {t('Bắt đầu với khóa học')}
                  <FiArrowRight aria-hidden="true" />
                </a>
              </div>
            </div>
          </aside>

          <article className="roadmap-detail-content">
            <section id="tong-quan" className="roadmap-copy-section">
              <h2>{t('Học theo một thứ tự rõ ràng')}</h2>
              {roadmap.introduction.map((paragraph) => (
                <p key={paragraph}>{t(paragraph)}</p>
              ))}

              <div className="roadmap-note" role="note">
                <FiInfo aria-hidden="true" />
                <div>
                  <h3>{t('Trước khi bắt đầu')}</h3>
                  <p>{t(roadmap.note)}</p>
                </div>
              </div>
            </section>

            <section className="roadmap-outcomes" aria-labelledby="roadmap-outcomes-title">
              <h2 id="roadmap-outcomes-title">{t('Sau lộ trình, bạn tập trung được vào')}</h2>
              <ul>
                {roadmap.skills.map((skill) => (
                  <li key={skill}><FiCheck aria-hidden="true" /> {t(skill)}</li>
                ))}
              </ul>
            </section>

            <section id="noi-dung" className="roadmap-curriculum" aria-labelledby="roadmap-curriculum-title">
              <div className="roadmap-section-heading">
                <h2 id="roadmap-curriculum-title">{t('Nội dung lộ trình')}</h2>
                <p>{t('Đi lần lượt qua từng chặng để kiến thức mới luôn có nền tảng hỗ trợ.')}</p>
              </div>

              <div className="roadmap-phase-list">
                {roadmap.phases.map((phase) => (
                  <article className="roadmap-phase" key={phase.name}>
                    <header>
                      <span className="roadmap-phase-icon"><FiTarget aria-hidden="true" /></span>
                      <div>
                        <span className="roadmap-phase-time">{t(phase.step)}</span>
                        <h3>{t(phase.name)}</h3>
                      </div>
                    </header>
                    <p>{t(phase.desc)}</p>
                    <ul>
                      {phase.focus.map((item) => (
                        <li key={item}><FiCheck aria-hidden="true" /> {t(item)}</li>
                      ))}
                    </ul>
                    <div className="roadmap-practice">
                      <strong>{t('Bài thực hành gợi ý')}</strong>
                      <span>{t(phase.practice)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section id="khoa-hoc" className="roadmap-courses" aria-labelledby="roadmap-courses-title">
              <div className="roadmap-section-heading">
                <h2 id="roadmap-courses-title">{t('Khóa học phù hợp')}</h2>
                <p>{t('Danh sách này được lấy trực tiếp từ danh mục khóa học hiện có của E-Learn.')}</p>
              </div>

              {isLoading ? (
                <div className="roadmap-course-list" role="status" aria-label={t('Đang tải khóa học')}>
                  <CourseSkeleton />
                  <CourseSkeleton />
                  <CourseSkeleton />
                </div>
              ) : isError ? (
                <div className="roadmap-course-state" role="alert">
                  <FiRefreshCw aria-hidden="true" />
                  <div>
                    <h3>{t('Chưa tải được danh sách khóa học')}</h3>
                    <p>{t('Kết nối hiện chưa ổn định. Bạn có thể thử lại mà không mất vị trí đang đọc.')}</p>
                    <button type="button" onClick={() => refetch()} disabled={isFetching}>
                      {isFetching ? t('Đang thử lại...') : t('Thử lại')}
                    </button>
                  </div>
                </div>
              ) : roadmapCourses.length === 0 ? (
                <div className="roadmap-course-state" role="status">
                  <FiBookOpen aria-hidden="true" />
                  <div>
                    <h3>{t('Khóa học cho lộ trình đang được cập nhật')}</h3>
                    <p>{t('Bạn vẫn có thể xem toàn bộ danh mục và chọn nội dung phù hợp với mục tiêu hiện tại.')}</p>
                    <Link to="/courses">{t('Xem tất cả khóa học')}</Link>
                  </div>
                </div>
              ) : (
                <div className="roadmap-course-list">
                  {roadmapCourses.map((course) => (
                    <RoadmapCourseCard key={course.course_id} course={course} locale={locale} t={t} />
                  ))}
                </div>
              )}
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RoadmapDetailPage;
