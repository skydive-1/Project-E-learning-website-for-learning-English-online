import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FiActivity,
  FiAward,
  FiBookOpen,
  FiCheckCircle,
  FiHelpCircle,
  FiMic,
  FiPause,
  FiPlay,
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

const ProductPanel = ({ icon: Icon, title, subtitle, slot, isActive, children }) => (
  <article
    className="platform-showcase-panel"
    data-slot={slot}
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
    <div className="showcase-panel-body">{children}</div>
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
  const [isKeyboardFocusInside, setIsKeyboardFocusInside] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
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
    && !isKeyboardFocusInside
    && !isUserPaused
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
              <dd>{isCatalogLoading ? '—' : (courseCount ?? '—')}</dd>
            </div>
            <div>
              <dt>{t('Quiz công khai')}</dt>
              <dd>{isCatalogLoading ? '—' : (quizCount ?? '—')}</dd>
            </div>
            <div>
              <dt>{t('Huy hiệu đã mở')}</dt>
              <dd>{user ? unlockedBadges.length : '—'}</dd>
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
            <strong>{streak.currentStreak ?? 0}</strong>
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
            {t('Chuỗi dài nhất')}: <strong>{streak.longestStreak ?? streak.currentStreak ?? 0} {t('ngày')}</strong>
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
            <strong>{unlockedBadges.length}</strong>
            <span>/ {badges.length} {t('huy hiệu đã mở')}</span>
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

  const activePanelId = panels[panelOrder[2]]?.id;

  const selectPanel = (panelIndex) => {
    if (isShifting) return;
    const currentPosition = panelOrder.indexOf(panelIndex);
    if (currentPosition === 2) return;

    const rotation = (currentPosition - 2 + panelOrder.length) % panelOrder.length;
    setPanelOrder((currentOrder) => [
      ...currentOrder.slice(rotation),
      ...currentOrder.slice(0, rotation)
    ]);
    setIsUserPaused(true);
  };

  return (
    <section className="video-reviews-section">
      <div className="container">
        <div className="section-header-annotated scroll-animate">
          <span className="badge-pill-light">{t('BÊN TRONG NỀN TẢNG')}</span>
          <h2 className="section-main-heading">
            {t('Nền tảng trông như thế nào khi bạn học')}
          </h2>
          <p className="section-sub-desc">
            {t('Trợ lý AI, theo dõi tiến độ và chấm điểm phát âm — mọi thứ bạn thấy trong ảnh dưới đây đều là tính năng thật, không phải hình minh họa dựng sẵn.')}
          </p>
        </div>

        <div
          ref={carouselRef}
          className={`platform-carousel-shell${isShifting ? ' is-shifting' : ''}`}
          style={{ '--showcase-move-duration': `${MOVE_DURATION_MS}ms` }}
          data-autoplay={shouldAutoPlay ? 'true' : 'false'}
          onFocusCapture={() => setIsKeyboardFocusInside(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsKeyboardFocusInside(false);
          }}
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
                  >
                    {panel.content}
                  </ProductPanel>
                );
              })}
            </div>
          </div>

          <div className="platform-carousel-controls">
            <div className="platform-carousel-tabs" aria-label={t('Chọn nội dung xem trước')}>
              {panels.map((panel, panelIndex) => (
                <button
                  key={panel.id}
                  type="button"
                  className={activePanelId === panel.id ? 'is-active' : ''}
                  onClick={() => selectPanel(panelIndex)}
                  aria-pressed={activePanelId === panel.id}
                >
                  {panel.title}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="platform-carousel-pause"
              onClick={() => setIsUserPaused((paused) => !paused)}
              disabled={prefersReducedMotion}
              aria-label={prefersReducedMotion
                ? t('Chuyển động đã được giảm theo cài đặt thiết bị')
                : isUserPaused
                  ? t('Tiếp tục chuyển động')
                  : t('Tạm dừng chuyển động')}
              title={prefersReducedMotion ? t('Chuyển động đã được giảm theo cài đặt thiết bị') : undefined}
            >
              {isUserPaused || prefersReducedMotion
                ? <FiPlay aria-hidden="true" />
                : <FiPause aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoReviewsSection;
