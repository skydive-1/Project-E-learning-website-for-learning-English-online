import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useLanguage } from '../../../context/LanguageContext';
import { FiArrowRight, FiCheckCircle, FiClock, FiBookOpen, FiX, FiAward, FiTarget, FiLayers } from 'react-icons/fi';
import '../styles/academy.scss';

const roadmapPaths = [
  {
    id: 'basic',
    title: 'Tiếng Anh Cơ Bản',
    description: 'Dành cho người mới bắt đầu hoặc mất gốc. Tập trung vào phát âm chuẩn IPA và ngữ pháp nền tảng.',
    coursesCount: 5,
    students: '12.5k+',
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
    description: 'Xây dựng kỹ năng làm bài thi TOEIC chuyên sâu. Tập trung vào Listening & Reading thực chiến.',
    coursesCount: 8,
    students: '8.2k+',
    time: '4-6 tháng',
    skills: ['Chiến thuật Part 1-7', 'Nghe hiểu công sở', 'Đọc hiểu báo chí & Email', 'Quản lý thời gian thi'],
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
        name: 'Phương pháp Giải đề Part 1 đến Part 7',
        desc: 'Bắt bài các bẫy thường gặp trong Part 1 (Hình ảnh), Part 2 (Hỏi đáp), Part 5 (Điền từ) và Part 7 (Đoạn văn).'
      },
      {
        step: 'Giai đoạn 3 (Tháng 5-6)',
        name: 'Luyện đề Thực chiến & Chấm điểm AI',
        desc: 'Làm đề thi thử trọn gói 200 câu trong 120 phút, phân tích lỗi sai chi tiết để đạt mốc TOEIC 700+.'
      }
    ]
  },
  {
    id: 'ielts',
    title: 'Lộ trình IELTS 6.5+',
    description: 'Rèn luyện 4 kỹ năng Nghe - Nói - Đọc - Viết toàn diện. Chuẩn bị vững chắc cho kỳ thi quốc tế.',
    coursesCount: 12,
    students: '15.1k+',
    time: '6-8 tháng',
    skills: ['Academic Writing Task 1 & 2', 'Speaking Reflexes (Part 1-3)', 'Critical Reading & Skimming', 'Advanced Listening'],
    image: '/images/hero_illustration.png',
    isPro: false,
    subjectFilter: '1', // IELTS Masterclass
    phases: [
      {
        step: 'Giai đoạn 1 (Tháng 1-2)',
        name: 'Xây dựng Nền tảng Academic (IELTS Foundation)',
        desc: 'Tích lũy từ vựng学术 theo 20 chủ đề IELTS quen thuộc (Environment, Technology, Education, Health).'
      },
      {
        step: 'Giai đoạn 2 (Tháng 3-5)',
        name: 'Rèn luyện Chi tiết 4 Kỹ năng Nghe - Nói - Đọc - Viết',
        desc: 'Luyện Viết Essay Task 2 (Opinion, Discussion), luyện Nói Speaking Part 2-3 với AI chấm câu và từ vựng.'
      },
      {
        step: 'Giai đoạn 3 (Tháng 6-8)',
        name: 'Luyện đề Cam-IELTS & Mock Test Thực tế',
        desc: 'Giải đề Cambridge IELTS mới nhất, canh thời gian áp lực thực tế và hoàn thiện kỹ năng đạt Band 6.5+ - 7.5+.'
      }
    ]
  }
];

const RoadmapCard = ({ path, onSelectDetail, t }) => (
  <div className="roadmap-path-card scroll-animate">
    <div className="path-image">
      <img src={path.image} alt={t(path.title)} />
    </div>
    <div className="path-content">
      <h2 className="path-title">{t(path.title)}</h2>
      <p className="path-desc">{t(path.description)}</p>
      
      <div className="path-stats">
        <span><FiBookOpen /> {path.coursesCount} {t('courses')}</span>
        <span><FiClock /> {t(path.time)}</span>
      </div>

      <div className="path-skills">
        <h3>{t('Bạn sẽ học được:')}</h3>
        <ul>
          {path.skills.map((skill, idx) => (
            <li key={idx}><FiCheckCircle /> {t(skill)}</li>
          ))}
        </ul>
      </div>

      <button 
        type="button" 
        onClick={() => onSelectDetail(path)}
        className="btn-view-path"
      >
        {t('Xem chi tiết lộ trình')} <FiArrowRight />
      </button>
    </div>
  </div>
);

const RoadmapPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [selectedPath, setSelectedPath] = useState(null);

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

  return (
    <div className="academy-page-modern">
      <Header />
      
      <main className="academy-main">
        <section className="academy-hero-section">
          <div className="container">
            <div className="hero-content scroll-animate">
              <h1>{t('Lộ trình học thông minh')}</h1>
              <p>{t('Học theo lộ trình bài bản giúp bạn tiết kiệm 50% thời gian học tập mà vẫn đạt hiệu quả tối ưu.')}</p>
              <div className="hero-info-cards">
                <div className="info-item">
                  <strong>{t('Khởi đầu')}</strong>
                  <span>{t('Xác định trình độ')}</span>
                </div>
                <div className="info-arrow"><FiArrowRight /></div>
                <div className="info-item">
                  <strong>{t('Tăng tốc')}</strong>
                  <span>{t('Học theo lộ trình')}</span>
                </div>
                <div className="info-arrow"><FiArrowRight /></div>
                <div className="info-item">
                  <strong>{t('Về đích')}</strong>
                  <span>{t('Làm chủ kỹ năng')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="roadmap-paths-section">
          <div className="container">
            <div className="section-title">
              <h2>{t('Các lộ trình dành cho bạn')}</h2>
              <p>{t('Dựa trên mục tiêu sự nghiệp và trình độ hiện tại, hãy chọn cho mình một lộ trình phù hợp nhất.')}</p>
            </div>

            <div className="roadmap-grid">
              {roadmapPaths.map(path => (
                <RoadmapCard 
                  key={path.id} 
                  path={path} 
                  onSelectDetail={(targetPath) => setSelectedPath(targetPath)} 
                  t={t}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Why Roadmap Section (F8 Style) */}
        <section className="roadmap-benefits-section">
          <div className="container">
            <div className="benefits-card scroll-animate">
              <div className="benefit-text">
                <h2>{t('Tại sao nên học theo lộ trình?')}</h2>
                <ul>
                  <li><FiCheckCircle /> <strong>{t('Không lạc hướng:')}</strong> {t('Luôn biết mình cần học gì tiếp theo.')}</li>
                  <li><FiCheckCircle /> <strong>{t('Tiết kiệm thời gian:')}</strong> {t('Tập trung vào những kiến thức thực sự quan trọng.')}</li>
                  <li><FiCheckCircle /> <strong>{t('Kết quả bền vững:')}</strong> {t('Xây dựng kiến thức từ gốc đến ngọn.')}</li>
                </ul>
              </div>
              <div className="benefit-image">
                <img src="/images/hero_illustration.png" alt="Roadmap benefits" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modal Popup Chi tiết Lộ trình */}
      {selectedPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 relative max-h-[90vh] overflow-y-auto no-scrollbar">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedPath(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FiX className="text-xl" />
            </button>

            {/* Header Modal */}
            <div className="flex items-center space-x-3 mb-4">
              <span className="p-3 bg-smart-indigo/10 text-smart-indigo rounded-2xl">
                <FiAward className="text-2xl" />
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl sm:text-2xl font-bold">{t(selectedPath.title)}</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedPath.coursesCount} {t('courses')} • {t(selectedPath.time)}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-medium">
              {t(selectedPath.description)}
            </p>

            {/* Timeline các Giai đoạn */}
            <div className="space-y-4 mb-8">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FiLayers className="text-sm" /> {t('Chi tiết các giai đoạn học tập:')}
              </h4>

              <div className="space-y-3">
                {selectedPath.phases.map((phase, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl space-y-1">
                    <span className="text-[11px] font-bold text-smart-indigo dark:text-indigo-400 uppercase tracking-wider">
                      {t(phase.step)}
                    </span>
                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {t(phase.name)}
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                      {t(phase.desc)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  const p = selectedPath;
                  setSelectedPath(null);
                  handleExploreCourses(p);
                }}
                className="w-full py-3.5 px-5 bg-smart-indigo hover:bg-smart-indigo-hover text-white text-sm font-bold rounded-2xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>{t('Khám phá các khóa học ngay')}</span>
                <FiArrowRight className="text-base" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default RoadmapPage;
