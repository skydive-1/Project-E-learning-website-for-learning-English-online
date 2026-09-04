import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiAward, FiTrendingUp, FiBriefcase, FiMessageCircle, 
  FiArrowRight, FiCheckCircle, FiStar, FiUsers
} from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';

// 4 categories directly mapped to real database subjects
const AUDIENCE_CATEGORIES = [
  {
    id: 'ielts',
    subjectId: 1,
    subjectMapping: 'IELTS Masterclass',
    chipLabel: 'IELTS ACADEMIC',
    chipColor: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/30',
    iconBg: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
    icon: FiAward,
    title: 'Luyện thi IELTS & Du học',
    description: 'Chinh phục 4 kỹ năng Nghe, Nói, Đọc, Viết với giáo trình chuẩn quốc tế, bứt phá band điểm mục tiêu.',
    highlight: 'Mục tiêu: Band 6.5 - 7.5+'
  },
  {
    id: 'toeic',
    subjectId: 2,
    subjectMapping: 'TOEIC Prep',
    chipLabel: 'TOEIC DOANH NGHIỆP',
    chipColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    icon: FiTrendingUp,
    title: 'Luyện thi TOEIC Chuẩn đầu ra',
    description: 'Tối ưu hóa điểm số nghe đọc và kỹ năng thực hành phục vụ tốt nghiệp và nộp hồ sơ xin việc.',
    highlight: 'Mục tiêu: TOEIC 650 - 850+'
  },
  {
    id: 'business',
    subjectId: 3,
    subjectMapping: 'Business English',
    chipLabel: 'TIẾNG ANH ĐI LÀM',
    chipColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: FiBriefcase,
    title: 'Thương Mại & Công Sở',
    description: 'Viết email chuyên nghiệp, thuyết trình báo cáo và tự tin đàm phán trong môi trường toàn cầu.',
    highlight: 'Thực tế công sở đa ngành'
  },
  {
    id: 'general',
    subjectId: 4,
    subjectMapping: 'General English & Grammar',
    chipLabel: 'GIAO TIẾP & LẤY GỐC',
    chipColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
    iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    icon: FiMessageCircle,
    title: 'Giao Tiếp & Cốt Lõi IPA',
    description: 'Chuẩn hóa phát âm IPA, xóa bỏ nỗi sợ nói sai, rèn luyện phản xạ tiếng Anh tự nhiên 24/7.',
    highlight: 'Dành cho người mới bắt đầu'
  }
];

const TargetAudienceCard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-5xl mx-auto my-12 px-4 sm:px-6">
      <div className="relative rounded-3xl bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 shadow-2xl transition-all duration-300">
        {/* Glow ambient background effect */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-blue-500/10 dark:bg-blue-500/5 blur-3xl pointer-events-none -z-10 rounded-full" />

        {/* Card Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.18em] uppercase text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 mb-3">
              <FiStar className="w-3.5 h-3.5" />
              <span>{t('ĐỐI TƯỢNG HỌC VIÊN PHÙ HỢP')}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('Lựa chọn lộ trình tối ưu theo mục tiêu của bạn')}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
              {t('Chương trình đào tạo được phân lớp khoa học dựa trên năng lực và nhu cầu thực tế của từng học viên.')}
            </p>
          </div>

          <button
            onClick={() => navigate('/courses')}
            className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20 whitespace-nowrap"
          >
            <span>{t('Xem tất cả khóa học')}</span>
            <FiArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 2x2 Grid of Audiences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
          {AUDIENCE_CATEGORIES.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/courses?subject=${item.subjectId || item.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/courses?subject=${item.subjectId || item.id}`);
                  }
                }}
                className="group relative rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-6 transition-all duration-300 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-1 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <span className={`inline-block text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-md border ${item.chipColor}`}>
                    {item.chipLabel}
                  </span>
                  <div className={`p-2.5 rounded-xl ${item.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                </div>

                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t(item.title)}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  {t(item.description)}
                </p>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <FiCheckCircle className="w-3.5 h-3.5" />
                    <span>{item.highlight}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">
                    {item.subjectMapping}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Statistics & Method Badge */}
        <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2 overflow-hidden">
              <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100" alt="Student 1" />
              <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" alt="Student 2" />
              <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100" alt="Student 3" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-white font-bold">Hàng nghìn</strong> bài học & bài thi trực tuyến
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('Trợ lý ảo AI Tutor phản xạ 24/7 đồng hành độc quyền')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetAudienceCard;
