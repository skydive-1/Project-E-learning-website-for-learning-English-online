import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../../components/ui/dialog';
import { useLanguage } from '../../../context/LanguageContext';
import apiClient from '../../../config/api.config';
import { FiArrowRight, FiCheckCircle, FiClock, FiBookOpen, FiAward, FiLayers } from 'react-icons/fi';
import '../styles/academy.scss';

// coursesCount dưới đây là số dự phòng, chỉ hiển thị khi API /courses chưa
// phản hồi kịp (loading) hoặc lỗi mạng. Ngay khi có dữ liệu thật, con số
// hiển thị luôn được ghi đè bằng COUNT khóa học thật theo subject_id
// (xem hàm fetchRealCourseCounts bên dưới) để không lệch với danh mục
// khóa học thực tế trong hệ thống.

const roadmapPaths = [
  {
    id: 'basic',
    title: 'Tiếng Anh Cơ Bản',
    description: 'Dành cho người mới bắt đầu hoặc mất gốc. Tập trung vào phát âm chuẩn IPA và ngữ pháp nền tảng.',
    coursesCount: 5,
    time: '3-4 tháng',
    skills: ['Phát âm IPA chuẩn', 'Ngữ pháp cơ bản', 'Từ vựng thông dụng (1,000+ từ)', 'Giao tiếp hàng ngày'],
    image: '/images/hero_illustration.png',
    isPro: false,
    subjectFilter: '4', // General English
    phases: [
      {
        step: 'Giai đoạn 1 (Tháng 1)',
        name: 'Chuẩn hóa Bảng Phiên âm IPA & Từ vựng Nền tảng',
        desc: 'Học cách phát âm chuẩn 44 âm trong bảng IPA, tập thói quen ghi âm và sửa lỗi bằng Trợ lý AI.'
      },
      {
        step: 'Giai đoạn 2 (Tháng 2)',
        name: 'Ngữ pháp Căn bản & Ghép câu Giao tiếp',
        desc: 'Nắm vững 6 thì tiếng Anh thông dụng, cấu trúc câu giao tiếp hàng ngày và cách đặt câu hỏi phản xạ.'
      },
      {
        step: 'Giai đoạn 3 (Tháng 3-4)',
        name: 'Thực hành Phản xạ Giao tiếp tự nhiên',
        desc: 'Luyện nói phản xạ Q&A theo tình huống thực tế (chào hỏi, mua sắm, chỉ đường, hỏi đáp bản thân).'
      }
    ]
  },
  {
    id: 'toeic',
    title: 'Lộ trình TOEIC 700+',
    description: 'Củng cố nền tảng TOEIC thực tế qua trắc nghiệm từ vựng, ngữ pháp theo cấp độ và phòng thi đấu Quiz PIN trực tiếp.',
    coursesCount: 8,
    time: '4-6 tháng',
    skills: ['Trắc nghiệm ngữ pháp & từ vựng TOEIC', 'Luyện phát âm chuẩn phản xạ cùng AI', 'Luyện viết câu & đoạn văn có AI chấm điểm', 'Đấu trí trực tiếp qua phòng Quiz PIN'],
    image: '/images/meeting_group.png',
    isPro: false,
    subjectFilter: '2', // TOEIC Prep
    phases: [
      {
        step: 'Giai đoạn 1 (Tháng 1-2)',
        name: 'Củng cố Từ vựng TOEIC 600+ & Ngữ pháp trọng tâm',
        desc: 'Học bộ từ vựng 600 Essential Words for TOEIC, lấy lại nền tảng ngữ pháp câu ghép & mệnh đề quan hệ.'
      },
      {
        step: 'Giai đoạn 2 (Tháng 3-4)',
        name: 'Luyện tập Trắc nghiệm & Phản xạ Câu hỏi',
        desc: 'Luyện trắc nghiệm từ vựng, ngữ pháp trọng tâm theo cấp độ và rèn phản xạ xử lý câu hỏi dưới áp lực thời gian.'
      },
      {
        step: 'Giai đoạn 3 (Tháng 5-6)',
        name: 'Luyện đề Thực chiến & Chấm điểm AI',
        desc: 'Làm đề thi thử trọn gói, phân tích điểm mạnh điểm yếu chi tiết và thi đấu phản xạ để đạt mốc TOEIC 700+.'
      }
    ]
  },
  {
    id: 'ielts',
    title: 'Lộ trình IELTS 6.5+',
    description: 'Nâng cao năng lực tiếng Anh với luyện phát âm AI chấm điểm (Speaking) và luyện viết bài luận có AI phản hồi (Writing).',
    coursesCount: 12,
    time: '6-8 tháng',
    skills: ['Luyện viết có AI chấm điểm và feedback (Writing)', 'Luyện phát âm có AI chấm điểm (Speaking)', 'Trắc nghiệm ngữ pháp/từ vựng theo cấp độ', 'Quiz PIN thi đấu trực tiếp phản xạ'],
    image: '/images/hero_illustration.png',
    isPro: false,
    subjectFilter: '1', // IELTS Masterclass
    phases: [
      {
        step: 'Giai đoạn 1 (Tháng 1-2)',
        name: 'Xây dựng Nền tảng Academic (IELTS Foundation)',
        desc: 'Tích lũy từ vựng học thuật theo 20 chủ đề IELTS quen thuộc (Environment, Technology, Education, Health).'
      },
      {
        step: 'Giai đoạn 2 (Tháng 3-5)',
        name: 'Thực hành Viết & Nói Chuyên sâu cùng Trợ lý AI',
        desc: 'Luyện viết Essay có AI chấm điểm và feedback chi tiết, luyện phát âm chuẩn xác từng câu với trợ lý AI thông minh.'
      },
      {
        step: 'Giai đoạn 3 (Tháng 6-8)',
        name: 'Luyện đề Tổng hợp & Thi đấu Phản xạ',
        desc: 'Luyện bộ đề trắc nghiệm học thuật, hoàn thiện kỹ năng Viết - Nói và tham gia thi đấu Quiz PIN trực tiếp.'
      }
    ]
  }
];

const RoadmapCard = ({ path, liveCoursesCount, onSelectDetail, t }) => (
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
        onClick={() => onSelectDetail(path)}
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
  const [selectedPath, setSelectedPath] = useState(null);
  // Số khóa học thật theo subject_id, ví dụ { '1': 9, '2': 6, '4': 5 }.
  // null = chưa tải xong -> card hiển thị coursesCount tĩnh làm số dự phòng.
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
        // Giữ nguyên coursesCount tĩnh làm số dự phòng nếu API lỗi -
        // không để trang lộ trình trắng xóa chỉ vì 1 request phụ thất bại.
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
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

  const handleExploreCourses = (path) => {
    if (path.subjectFilter) {
      navigate(`/courses?subject=${path.subjectFilter}`);
    } else {
      navigate(`/courses?search=${encodeURIComponent(path.title)}`);
    }
  };

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
              {roadmapPaths.map(path => (
                <RoadmapCard 
                  key={path.id} 
                  path={path} 
                  liveCoursesCount={getCourseCount(path)}
                  onSelectDetail={(targetPath) => setSelectedPath(targetPath)} 
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

      {/* Modal Popup Chi tiết Lộ trình */}
      <Dialog
        open={Boolean(selectedPath)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedPath(null);
        }}
      >
        {selectedPath && (
          <DialogContent
            closeLabel={t('Đóng')}
            className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl"
          >
            <DialogHeader className="shrink-0 gap-4 border-b px-6 pt-6 pr-14 pb-5 text-left sm:px-8 sm:pt-8 sm:pr-16">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FiAward className="text-2xl" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-xl leading-tight font-bold sm:text-2xl">
                    {t(selectedPath.title)}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs font-medium">
                    {getCourseCount(selectedPath)} {t('courses')} • {t(selectedPath.time)}
                  </DialogDescription>
                </div>
              </div>

              <p className="text-sm leading-relaxed font-medium text-muted-foreground">
                {t(selectedPath.description)}
              </p>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-4">
                <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <FiLayers aria-hidden="true" /> {t('Chi tiết các giai đoạn học tập:')}
                </h4>

                <div className="flex flex-col gap-3">
                  {selectedPath.phases.map((phase, idx) => (
                    <div key={idx} className="flex flex-col gap-1 rounded-xl border bg-muted/50 p-4">
                      <span className="text-[11px] font-bold tracking-wider text-primary uppercase">
                        {t(phase.step)}
                      </span>
                      <h5 className="text-sm font-bold text-foreground">
                        {t(phase.name)}
                      </h5>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {t(phase.desc)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="m-0 shrink-0 rounded-none border-t bg-popover px-6 py-4 sm:px-8">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  const p = selectedPath;
                  setSelectedPath(null);
                  handleExploreCourses(p);
                }}
                className="w-full font-bold"
              >
                <span>{t('Khám phá các khóa học ngay')}</span>
                <FiArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Footer />
    </div>
  );
};

export default RoadmapPage;
