import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../config/api.config';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import './DolHeroSection.css';

// 24 authentic high-resolution photos 100% focused on English learning and education
const BASE_PHOTO_CARDS = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400',
    title: 'Học từ vựng & Đọc sách tiếng Anh'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=400',
    title: 'Nhóm học IELTS tương tác'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400',
    title: 'Luyện đề trực tuyến trên máy tính'
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400',
    title: 'Sửa ngữ pháp & Viết luận Writing'
  },
  {
    id: 5,
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=400',
    title: 'Lớp học tiếng Anh cùng giảng viên'
  },
  {
    id: 6,
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=400',
    title: 'Thư viện giáo trình chuẩn Cambridge'
  },
  {
    id: 7,
    image: 'https://images.unsplash.com/photo-1590650516494-0c8e4a4dd67e?auto=format&fit=crop&q=80&w=400',
    title: 'Luyện nghe Listening cùng tai nghe'
  },
  {
    id: 8,
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=400',
    title: 'Kèm Speaking phản xạ 1-1'
  },
  {
    id: 9,
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=400',
    title: 'Nghiên cứu tài liệu IELTS tại thư viện'
  },
  {
    id: 10,
    image: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&q=80&w=400',
    title: 'Làm bài thi thử TOEIC chuẩn giờ'
  },
  {
    id: 11,
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400',
    title: 'Thảo luận nhóm bài học giao tiếp'
  },
  {
    id: 12,
    image: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&q=80&w=400',
    title: 'Học viên đạt chứng chỉ quốc tế'
  },
  {
    id: 13,
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=400',
    title: 'Ghi chép từ vựng chuyên ngành'
  },
  {
    id: 14,
    image: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=80&w=400',
    title: 'Không gian học tập yên tĩnh'
  },
  {
    id: 15,
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=400',
    title: 'Tự tin thuyết trình tiếng Anh'
  },
  {
    id: 16,
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=400',
    title: 'Lớp học tương tác đa phương tiện'
  },
  {
    id: 17,
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400',
    title: 'Giáo trình ngữ pháp tiếng Anh'
  },
  {
    id: 18,
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=400',
    title: 'Luyện thi cấp tốc cùng bạn học'
  },
  {
    id: 19,
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80&w=400',
    title: 'Luyện nghe Podcast tiếng Anh'
  },
  {
    id: 20,
    image: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&q=80&w=400',
    title: 'Giảng viên hướng dẫn phát âm IPA'
  },
  {
    id: 21,
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=400',
    title: 'Góc học tập & rèn luyện hàng ngày'
  },
  {
    id: 22,
    image: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&q=80&w=400',
    title: 'Luyện phản xạ bài tập thực hành'
  },
  {
    id: 23,
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=400',
    title: 'Học nhóm trao đổi phương pháp học'
  },
  {
    id: 24,
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=400',
    title: 'Chinh phục mục tiêu tiếng Anh thành công'
  }
];

const SIZE = 3200;
const TICK_RADIUS = 1500; // 1500px radius for ruler ticks
const CARD_RADIUS = 1445; // 1445px radius (lowered slightly down into the wheel)
const CENTER = 1600; // 1600px center

const DolHeroSection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const showToast = useToast();

  const { data: dbCourses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/courses');
        return Array.isArray(response.data?.courses) ? response.data.courses : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000
  });

  const HERO_QUADRANTS = useMemo(() => [
    {
      id: 'ielts',
      subjectId: 1,
      subjectName: 'IELTS Masterclass',
      pillClass: 'pill-red',
      pillText: 'IELTS',
      title: 'IELTS Masterclass',
      desc: 'Học sinh THPT & sinh viên',
      cellClass: 'hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
    },
    {
      id: 'toeic',
      subjectId: 2,
      subjectName: 'TOEIC Prep',
      pillClass: 'pill-blue',
      pillText: 'TOEIC',
      title: 'TOEIC Chuẩn đầu ra',
      desc: 'Sinh viên & người đi làm',
      cellClass: 'hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
    },
    {
      id: 'business',
      subjectId: 3,
      subjectName: 'Business English',
      pillClass: 'pill-orange',
      pillText: 'BUSINESS',
      title: 'Tiếng Anh Thương Mại',
      desc: 'Nhân sự công sở & đàm phán',
      cellClass: 'border-top-divider hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
    },
    {
      id: 'general',
      subjectId: 4,
      subjectName: 'General English Communication',
      pillClass: 'pill-purple',
      pillText: 'GIAO TIẾP',
      title: 'Luyện nói & Phản xạ IPA',
      desc: 'Người mất gốc & bắt đầu lại',
      cellClass: 'border-top-divider hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
    }
  ], []);

  const handleQuadrantClick = (quadrant) => {
    const hasCourse = dbCourses && dbCourses.length > 0
      ? dbCourses.some(c => 
          Number(c.subject_id) === Number(quadrant.subjectId) ||
          (c.subject_name && c.subject_name.toLowerCase().includes(quadrant.subjectName.toLowerCase()))
        )
      : true;

    if (!hasCourse && dbCourses && dbCourses.length > 0) {
      if (typeof showToast === 'function') {
        showToast('Hiện chưa có khóa học phù hợp', 'info');
      }
    }

    navigate(`/courses?subject=${quadrant.subjectId}`);
  };

  // 24 cards spaced evenly at 15-degree steps along CARD_RADIUS (1445px)
  const positionedCards = useMemo(() => {
    const total = BASE_PHOTO_CARDS.length;
    const angleStep = 360 / total; // 15 deg each for 24 cards

    return BASE_PHOTO_CARDS.map((card, index) => {
      const angle = 90 + index * angleStep;
      const radians = (angle * Math.PI) / 180;
      const x = -CARD_RADIUS * Math.cos(radians);
      const y = -CARD_RADIUS * Math.sin(radians);

      return {
        ...card,
        style: {
          transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${angle - 90}deg)`
        }
      };
    });
  }, []);

  return (
    <section className="dol-hero-container" id="hero">
      {/* 1. TOP HEADLINE & BRANDING */}
      <div className="dol-hero-header">
        <h1 className="dol-main-title">
          {t('Học viện Tiếng Anh Thông Minh')}
        </h1>
        <div className="dol-brand-wrapper">
          <span className="dol-brand-name">E-Learn Academy</span>
          <span className="dol-sparkle-star">✦</span>
        </div>
      </div>

      {/* 2. EXACT DOL DUAL-ROTATION PARALLAX SYSTEM WITH CENTER-FADE MASK */}
      <div className="dol-rotating-container">
        {/* Full-width screen-anchored mask wrapper */}
        <div className="dol-wheel-mask-wrapper">
          {/* Full 3200px rotating wheel stage */}
          <div className="dol-wheel-stage">
            {/* Clockwise-Rotating SVG Concentric Radial Tick Rings (Full 360° continuous) */}
            <svg className="dol-ticks-svg" viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <g
                className="dol-ticks-rotator"
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
              >
                {/* Outer thick dash ring */}
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={TICK_RADIUS + 16}
                  fill="none"
                  stroke="rgba(203, 213, 225, 0.65)"
                  strokeWidth="32"
                  strokeDasharray="1.5 38"
                />
                {/* Center dashed line */}
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={TICK_RADIUS}
                  fill="none"
                  stroke="rgba(203, 213, 225, 0.45)"
                  strokeWidth="1.5"
                  strokeDasharray="4 8"
                />
                {/* Inner thin dash ring */}
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={TICK_RADIUS - 18}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.45)"
                  strokeWidth="12"
                  strokeDasharray="1.5 38"
                />
              </g>
            </svg>

            {/* Counter-Clockwise Rotating Card Track (24 Continuous Cards) */}
            <div className="dol-card-track">
              {positionedCards.map((card, idx) => (
                <div
                  key={card.id}
                  className="dol-card-item-container"
                  style={card.style}
                >
                  <div 
                    className="dol-card-float-wrapper"
                    style={{ animationDelay: `${(idx % 6) * 1.0}s` }}
                  >
                    <img
                      src={card.image}
                      alt={card.title}
                      loading="lazy"
                      className="dol-card-img"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400';
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. CENTER 2X2 FLOATING WHITE CARD */}
        <div className="dol-center-card-anchor">
          <div className="dol-center-card">
            {/* Top 4 Quadrants Grid */}
            <div className="dol-quadrants-grid">
              {HERO_QUADRANTS.map((quadrant) => (
                <div 
                  key={quadrant.id}
                  className={`dol-quadrant-cell ${quadrant.cellClass} transition-colors cursor-pointer`}
                  onClick={() => handleQuadrantClick(quadrant)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuadrantClick(quadrant);
                    }
                  }}
                  title={`Khóa học ${quadrant.title}`}
                >
                  <span className={`dol-cell-pill ${quadrant.pillClass}`}>{quadrant.pillText}</span>
                  <h3 className="dol-cell-title">{quadrant.title}</h3>
                  <p className="dol-cell-desc">{quadrant.desc}</p>
                </div>
              ))}
            </div>

            {/* Bottom Info Footer - Project Development Status */}
            <div className="dol-card-bottom-bar">
              <div className="flex items-center justify-center w-full gap-2.5 text-slate-600 dark:text-slate-400">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  {t('Dự án đang còn phát triển')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. FLOATING RIGHT-SIDE ACTION BUTTONS */}
      <aside className="dol-floating-right-actions">
        <button 
          onClick={() => {
            const el = document.getElementById('fun-quizzes-sec');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            else navigate('/quizzes');
          }}
          className="dol-float-btn btn-green"
          title="Trắc nghiệm phản xạ"
        >
          <div className="float-pill-label">
            <span className="badge-stars">★★★★★</span>
            <span>Trắc nghiệm</span>
          </div>
        </button>

        <button 
          onClick={() => {
            const el = document.getElementById('roadmap-sec');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            else navigate('/academy');
          }}
          className="dol-float-btn btn-red"
          title="Lộ trình học"
        >
          <div className="float-pill-label">
            <span>Lộ trình</span>
          </div>
        </button>

        <button 
          onClick={() => navigate('/courses')}
          className="dol-float-btn btn-purple"
          title="Kho bài giảng"
        >
          <div className="float-pill-label">
            <span>Khóa học</span>
          </div>
        </button>
      </aside>
    </section>
  );
};

export default DolHeroSection;
