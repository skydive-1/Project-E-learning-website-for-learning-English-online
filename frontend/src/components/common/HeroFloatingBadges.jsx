import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMap, FiZap, FiVideo, FiChevronRight } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';

const FLOATING_LINKS = [
  {
    id: 'roadmap',
    icon: FiMap,
    label: 'Lộ trình bài bản',
    color: 'teal',
    colorClass: 'hover:border-teal-500/40 text-teal-400 group-hover:text-teal-300',
    dotBg: 'bg-teal-400',
    target: '#roadmap-sec',
    fallbackRoute: '/academy'
  },
  {
    id: 'quizzes',
    icon: FiZap,
    label: 'Trắc nghiệm vui',
    color: 'indigo',
    colorClass: 'hover:border-indigo-500/40 text-indigo-400 group-hover:text-indigo-300',
    dotBg: 'bg-indigo-400',
    target: '#fun-quizzes-sec',
    fallbackRoute: '/quizzes'
  },
  {
    id: 'courses',
    icon: FiVideo,
    label: 'Kho bài giảng Video',
    color: 'orange',
    colorClass: 'hover:border-orange-500/40 text-orange-400 group-hover:text-orange-300',
    dotBg: 'bg-orange-400',
    target: '#courses-sec',
    fallbackRoute: '/courses'
  }
];

const HeroFloatingBadges = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleNavClick = (link) => {
    const el = document.querySelector(link.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (link.fallbackRoute) {
      navigate(link.fallbackRoute);
    }
  };

  return (
    <div className="hidden lg:flex flex-col gap-3 fixed right-4 top-1/2 -translate-y-1/2 z-40">
      {FLOATING_LINKS.map((link) => {
        const IconComponent = link.icon;
        return (
          <button
            key={link.id}
            onClick={() => handleNavClick(link)}
            className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800 shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-x-1 ${link.colorClass}`}
            title={t(link.label)}
          >
            <span className={`w-2 h-2 rounded-full ${link.dotBg} animate-pulse`} />
            <IconComponent className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
              {t(link.label)}
            </span>
            <FiChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-transform" />
          </button>
        );
      })}
    </div>
  );
};

export default HeroFloatingBadges;
