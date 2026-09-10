import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FiActivity,
  FiAward,
  FiBookOpen,
  FiCheckCircle,
  FiHelpCircle,
  FiMic,
  FiTrendingUp,
  FiZap
} from 'react-icons/fi';
import apiClient from '../../../config/api.config';
import { useAuth } from '../../../context/AuthContext';
import { useGamification } from '../../../context/GamificationContext';
import { useLanguage } from '../../../context/LanguageContext';

const PANEL_SLOTS = [-2, -1, 0, 1, 2, 3];
const MOVE_DURATION_MS = 800;
const HOLD_DURATION_MS = 1800;
const NUMBER_DURATION_MS = 650;
const ShowcaseMotionContext = createContext({
  isMotionActive: false,
  prefersReducedMotion: false
});
const numberFormatter = new Intl.NumberFormat('vi-VN');

const loadPlatformShowcaseData = async () => {
  const [coursesResult, quizzesResult] = await Promise.allSettled([
    apiClient.get('/courses'),
    apiClient.get('/quizzes/free')
  ]);

  const coursesAvailable = coursesResult.status === 'fulfilled'
    && Array.isArray(coursesResult.value?.data?.courses);
  const quizzesAvailable = quizzesResult.status === 'fulfilled'
    && Array.isArray(quizzesResult.value?.data?.data);
  const courses = coursesAvailable ? coursesResult.value.data.courses : [];
  const quizzes = quizzesAvailable ? quizzesResult.value.data.data : [];

  return {
    courses,
    quizzes,
    coursesAvailable,
    quizzesAvailable
  };
};

const getItemName = (item) => item?.title || item?.course_name || item?.name || '';

const AnimatedNumber = ({ value }) => {
  const valueRef = useRef(null);
  const { isMotionActive, prefersReducedMotion } = useContext(ShowcaseMotionContext);
  const numericValue = typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : null;
  const finalText = numericValue === null ? String(value) : numberFormatter.format(numericValue);

  useEffect(() => {
    const target = valueRef.current;
    if (!target) return undefined;

    if (numericValue === null || !isMotionActive || prefersReducedMotion) {
      target.textContent = finalText;
      return undefined;
    }

    let animationFrameId;
    const startedAt = performance.now();
    target.textContent = numberFormatter.format(0);

    const updateValue = (now) => {
      const progress = Math.min((now - startedAt) / NUMBER_DURATION_MS, 1);
      const easedProgress = 1 - ((1 - progress) ** 3);
      target.textContent = numberFormatter.format(Math.round(numericValue * easedProgress));

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(updateValue);
      }
    };

    animationFrameId = window.requestAnimationFrame(updateValue);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [finalText, isMotionActive, numericValue, prefersReducedMotion]);

  return (
    <span ref={valueRef} className="showcase-animated-number" aria-label={finalText}>
      {finalText}
    </span>
  );
};

const ProductPanel = ({
  icon: Icon,
  title,
  subtitle,
  slot,
  isActive,
  isMotionActive,
  prefersReducedMotion,
  children
}) => (
  <article
    className="platform-showcase-panel"
    data-slot={slot}
    data-active={isActive ? 'true' : 'false'}
    data-motion-active={isMotionActive ? 'true' : 'false'}
    aria-hidden={!isActive}
  >
    <header className="showcase-panel-header">
      <span className="showcase-panel-icon" aria-hidden="true">
        <Icon />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </header>
    <ShowcaseMotionContext.Provider value={{ isMotionActive, prefersReducedMotion }}>
      <div className="showcase-panel-body">{children}</div>
    </ShowcaseMotionContext.Provider>
  </article>
);

const DataUnavailable = ({ children }) => (
  <div className="showcase-data-state">
    <FiActivity aria-hidden="true" />
    <span>{children}</span>
  </div>
);

const VideoReviewsSection = () => {
  const { t } = useLanguage();
  const { user, loading: isAuthLoading } = useAuth();
  const {
    streak,
    badges = [],
    streakError,
    badgesError,
    isGamificationLoading
  } = useGamification() || {};
  const carouselRef = useRef(null);
  const [panelOrder, setPanelOrder] = useState([0, 1, 2, 3, 4, 5]);
  const [isShifting, setIsShifting] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(
    typeof document !== 'undefined' ? document.hidden : false
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const { data: catalogData, isLoading: isCatalogLoading } = useQuery({
    queryKey: ['homepage', 'platform-showcase'],
    queryFn: loadPlatformShowcaseData,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(Boolean(mediaQuery?.matches));
    updateMotionPreference();
    mediaQuery?.addEventListener?.('change', updateMotionPreference);

    return () => mediaQuery?.removeEventListener?.('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const target = carouselRef.current;
    if (!target) return undefined;

    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting && entry.intersectionRatio > 0);
    }, { threshold: [0, 0.08] });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const shouldAutoPlay = isInView
    && !isDocumentHidden
    && !prefersReducedMotion;

  useEffect(() => {
    if (!shouldAutoPlay || isShifting) return undefined;

    const holdTimer = window.setTimeout(() => setIsShifting(true), HOLD_DURATION_MS);
    return () => window.clearTimeout(holdTimer);
  }, [panelOrder, shouldAutoPlay, isShifting]);

  useEffect(() => {
    if (!isShifting) return undefined;

    const moveTimer = window.setTimeout(() => {
      setPanelOrder((currentOrder) => [...currentOrder.slice(1), currentOrder[0]]);
      setIsShifting(false);
    }, MOVE_DURATION_MS);

    return () => window.clearTimeout(moveTimer);
  }, [isShifting]);

  const weeklyStatus = Array.isArray(streak?.weeklyStatus) ? streak.weeklyStatus : [];
  const activeWeekDays = weeklyStatus.filter((day) => day?.active).length;
  const unlockedBadges = badges.filter((badge) => badge?.unlocked);
  const courses = catalogData?.courses || [];
  const quizzes = catalogData?.quizzes || [];
  const courseCount = catalogData?.coursesAvailable ? courses.length : null;
  const quizCount = catalogData?.quizzesAvailable ? quizzes.length : null;

  const panels = useMemo(() => [
    {
      id: 'overview',
      title: t('Tổng quan nền tảng'),
      subtitle: t('Dữ liệu đang có trong hệ thống'),
      icon: FiActivity,
      content: (
        <>
          <div className="showcase-summary-copy">
            <strong>{t('Học tập trong một không gian thống nhất')}</strong>
            <span>{t('Khóa học, quiz, tiến độ và trợ lý học tập được kết nối trong cùng một tài khoản.')}</span>
          </div>
          <dl className="showcase-metrics">
            <div>
              <dt>{t('Khóa học')}</dt>
              <dd><AnimatedNumber value={isCatalogLoading ? '—' : (courseCount ?? '—')} /></dd>
            </div>
            <div>
              <dt>{t('Quiz công khai')}</dt>
              <dd><AnimatedNumber value={isCatalogLoading ? '—' : (quizCount ?? '—')} /></dd>
            </div>
            <div>
              <dt>{t('Huy hiệu đã mở')}</dt>
              <dd><AnimatedNumber value={user ? unlockedBadges.length : '—'} /></dd>
            </div>
          </dl>
        </>
      )
    },
    {
      id: 'courses',
      title: t('Kho khóa học'),
      subtitle: courseCount === null ? t('Dữ liệu tạm thời chưa khả dụng') : `${courseCount} ${t('khóa học đang hiển thị')}`,
      icon: FiBookOpen,
      content: isCatalogLoading ? (
        <DataUnavailable>{t('Đang tải danh sách khóa học...')}</DataUnavailable>
      ) : courseCount === null ? (
        <DataUnavailable>{t('Không thể tải khóa học lúc này.')}</DataUnavailable>
      ) : courses.length === 0 ? (
        <DataUnavailable>{t('Chưa có khóa học được xuất bản.')}</DataUnavailable>
      ) : (
        <ul className="showcase-record-list">
          {courses.slice(0, 3).map((course, index) => (
            <li key={course.course_id || index}>
              <FiCheckCircle aria-hidden="true" />
              <span>{getItemName(course)}</span>
            </li>
          ))}
        </ul>
      )
    },
    {
      id: 'quizzes',
      title: t('Kho trắc nghiệm'),
      subtitle: quizCount === null ? t('Dữ liệu tạm thời chưa khả dụng') : `${quizCount} ${t('bài quiz công khai')}`,
      icon: FiHelpCircle,
      content: isCatalogLoading ? (
        <DataUnavailable>{t('Đang tải kho trắc nghiệm...')}</DataUnavailable>
      ) : quizCount === null ? (
        <DataUnavailable>{t('Không thể tải quiz lúc này.')}</DataUnavailable>
      ) : quizzes.length === 0 ? (
        <DataUnavailable>{t('Chưa có quiz công khai.')}</DataUnavailable>
      ) : (
        <ul className="showcase-record-list">
          {quizzes.slice(0, 3).map((quiz, index) => (
            <li key={quiz.quiz_id || index}>
              <FiCheckCircle aria-hidden="true" />
              <span>{getItemName(quiz)}</span>
              {quiz.difficulty && <small>{t(quiz.difficulty)}</small>}
            </li>
          ))}
        </ul>
      )
    },
    {
      id: 'streak',
      title: t('Nhịp học trong tuần'),
      subtitle: t('Đồng bộ từ lịch sử hoạt động'),
      icon: FiTrendingUp,
      content: isAuthLoading || isGamificationLoading ? (
        <DataUnavailable>{t('Đang đồng bộ tiến độ...')}</DataUnavailable>
      ) : !user ? (
        <DataUnavailable>{t('Đăng nhập để xem chuỗi học của bạn.')}</DataUnavailable>
      ) : streakError || !streak ? (
        <DataUnavailable>{t('Chưa thể tải tiến độ lúc này.')}</DataUnavailable>
      ) : (
        <>
          <div className="showcase-streak-value">
            <FiTrendingUp aria-hidden="true" />
            <strong><AnimatedNumber value={streak.currentStreak ?? 0} /></strong>
            <span>{t('ngày liên tiếp')}</span>
          </div>
          <div className="showcase-week" aria-label={`${activeWeekDays}/7 ${t('ngày hoạt động')}`}>
            {weeklyStatus.length > 0 ? weeklyStatus.map((day, index) => (
              <span
                key={day.date || day.day || index}
                className={day.active ? 'is-active' : ''}
                title={day.day || day.date || ''}
              />
            )) : <small>{t('Chưa có dữ liệu hoạt động trong tuần.')}</small>}
          </div>
          <p className="showcase-footnote">
            {t('Chuỗi dài nhất')}: <strong><AnimatedNumber value={streak.longestStreak ?? streak.currentStreak ?? 0} /> {t('ngày')}</strong>
          </p>
        </>
      )
    },
    {
      id: 'badges',
      title: t('Huy hiệu học tập'),
      subtitle: t('Ghi nhận các cột mốc đã đạt'),
      icon: FiAward,
      content: isAuthLoading || isGamificationLoading ? (
        <DataUnavailable>{t('Đang tải huy hiệu...')}</DataUnavailable>
      ) : !user ? (
        <DataUnavailable>{t('Đăng nhập để xem huy hiệu của bạn.')}</DataUnavailable>
      ) : badgesError ? (
        <DataUnavailable>{t('Chưa thể tải huy hiệu lúc này.')}</DataUnavailable>
      ) : (
        <>
          <div className="showcase-badge-total">
            <strong><AnimatedNumber value={unlockedBadges.length} /></strong>
            <span>/ <AnimatedNumber value={badges.length} /> {t('huy hiệu đã mở')}</span>
          </div>
          {unlockedBadges.length > 0 ? (
            <ul className="showcase-record-list compact">
              {unlockedBadges.slice(0, 3).map((badge, index) => (
                <li key={badge.id || index}>
                  <FiAward aria-hidden="true" />
                  <span>{badge.name || badge.title || t('Huy hiệu học tập')}</span>
                </li>
              ))}
            </ul>
          ) : <DataUnavailable>{t('Chưa có huy hiệu nào được mở khóa.')}</DataUnavailable>}
        </>
      )
    },
    {
      id: 'ai-practice',
      title: t('Luyện tập với AI'),
      subtitle: t('Các công cụ đã tích hợp trong bài học'),
      icon: FiZap,
      content: (
        <ul className="showcase-feature-list">
          <li>
            <FiZap aria-hidden="true" />
            <span><strong>{t('Trợ lý theo bài học')}</strong><small>{t('Hỏi và nhận giải thích theo nội dung đang học.')}</small></span>
          </li>
          <li>
            <FiMic aria-hidden="true" />
            <span><strong>{t('Chấm phát âm')}</strong><small>{t('Ghi âm và nhận phản hồi sau khi luyện nói.')}</small></span>
          </li>
          <li>
            <FiCheckCircle aria-hidden="true" />
            <span><strong>{t('Phản hồi bài viết')}</strong><small>{t('Nhận góp ý cho câu trả lời tự luận.')}</small></span>
          </li>
        </ul>
      )
    }
  ], [
    t,
    isCatalogLoading,
    courseCount,
    quizCount,
    courses,
    quizzes,
    isAuthLoading,
    isGamificationLoading,
    user,
    unlockedBadges,
    badges,
    badgesError,
    streak,
    streakError,
    weeklyStatus,
    activeWeekDays
  ]);

  return (
    <section className="video-reviews-section">
      <div className="container">
        <div
          ref={carouselRef}
          className={`platform-carousel-shell${isShifting ? ' is-shifting' : ''}`}
          style={{ '--showcase-move-duration': `${MOVE_DURATION_MS}ms` }}
          data-autoplay={shouldAutoPlay ? 'true' : 'false'}
          role="region"
          aria-roledescription="carousel"
          aria-label={t('Xem trước các tính năng và dữ liệu nền tảng')}
        >
          <div className="platform-carousel-viewport">
            <div className="platform-carousel-stage">
              {panelOrder.map((panelIndex, position) => {
                const panel = panels[panelIndex];
                const slot = PANEL_SLOTS[position] - (isShifting ? 1 : 0);
                const isActive = position === (isShifting ? 3 : 2);

                return (
                  <ProductPanel
                    key={panel.id}
                    icon={panel.icon}
                    title={panel.title}
                    subtitle={panel.subtitle}
                    slot={slot}
                    isActive={isActive}
                    isMotionActive={isActive && isInView}
                    prefersReducedMotion={prefersReducedMotion}
                  >
                    {panel.content}
                  </ProductPanel>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoReviewsSection;
