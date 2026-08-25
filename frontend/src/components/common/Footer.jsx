import React from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiGlobe, FiHeart, FiCpu, FiShield } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="main-footer border-t border-teal-500/20 bg-slate-900/90 text-slate-300 py-12 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 text-xl font-extrabold text-teal-400 hover:text-teal-300 transition-colors">
              <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400">
                <FiBookOpen className="w-5 h-5" />
              </div>
              <span className="tracking-tight">EngLearn Pro</span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              {t('Nền tảng học tiếng Anh trực tuyến thế hệ mới tích hợp Trợ lý AI cá nhân hóa, phương pháp ghi nhớ phản xạ chủ động.')}
            </p>
            <div className="flex items-center space-x-3 text-slate-400">
              <span className="inline-flex items-center text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-1 rounded-full font-medium">
                <FiGlobe className="mr-1.5 w-3.5 h-3.5" /> Global English 2026
              </span>
              <span className="inline-flex items-center text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full font-medium">
                <FiCpu className="mr-1.5 w-3.5 h-3.5" /> AI Powered Platform
              </span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">{t('Khám phá')}</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link to="/courses" className="hover:text-teal-400 transition-colors">{t('Chương trình học')}</Link></li>
              <li><Link to="/academy" className="hover:text-teal-400 transition-colors">{t('Lộ trình Academy')}</Link></li>
              <li><Link to="/quizzes" className="hover:text-teal-400 transition-colors">{t('Quiz & Trắc nghiệm')}</Link></li>
              <li><Link to="/my-courses" className="hover:text-teal-400 transition-colors">{t('Khóa học của tôi')}</Link></li>
            </ul>
          </div>

          {/* Technology & Security */}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">{t('Nền Tảng')}</h3>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center gap-1.5 text-slate-300">
                <FiCpu className="w-3.5 h-3.5 text-teal-400 shrink-0" /> Trợ lý AI RAG 24/7
              </li>
              <li className="flex items-center gap-1.5 text-slate-300">
                <FiShield className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Bảo mật DRM Stream Video
              </li>
              <li className="flex items-center gap-1.5 text-slate-300">
                <FiGlobe className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Khung chuẩn CEFR Quốc Tế
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 EngLearn Pro. All rights reserved.</p>
          <p className="flex items-center gap-1 mt-2 sm:mt-0">
            {t('Phát triển với')} <FiHeart className="text-red-500 w-3.5 h-3.5" /> {t('cho trải nghiệm học chuẩn Impeccable & UI-UX Pro Max')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

