import React from 'react';
import { FiCode, FiShield, FiDatabase } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';
import './TeamMarquee.css';

const TEAM_MEMBERS = [
  {
    id: 'quoc-anh',
    name: 'NGUYỄN DŨNG QUỐC ANH',
    roleVi: 'Frontend & AI UI Integration',
    roleEn: 'Frontend & AI UI Integration',
    icon: FiCode,
    iconColor: 'text-teal-400',
    iconBg: 'bg-teal-500/10 border-teal-500/20'
  },
  {
    id: 'thanh-liem',
    name: 'NGUYỄN THANH LIÊM',
    roleVi: 'Backend & Security',
    roleEn: 'Backend & Security',
    icon: FiShield,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10 border-blue-500/20'
  },
  {
    id: 'dinh-chuong',
    name: 'LÊ ĐÌNH CHƯƠNG',
    roleVi: 'Database & Infrastructure',
    roleEn: 'Database & Infrastructure',
    icon: FiDatabase,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/20'
  }
];

/**
 * Minimalist Pill Team Marquee
 * Fully transparent, anti-slop, seamlessly blending into the page background.
 */
const TeamMarquee = ({ className = '' }) => {
  const { language } = useLanguage();
  const isEn = language === 'ENG';

  // Duplicate list 6 times for seamless continuous glide across all viewports
  const marqueeItems = [
    ...TEAM_MEMBERS,
    ...TEAM_MEMBERS,
    ...TEAM_MEMBERS,
    ...TEAM_MEMBERS,
    ...TEAM_MEMBERS,
    ...TEAM_MEMBERS
  ];

  return (
    <section id="team" className={`py-12 relative overflow-hidden bg-transparent ${className}`}>
      {/* Subdued, elegant uppercase header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-400 opacity-90">
          {isEn ? 'Project Development Team' : 'Đội ngũ thực hiện'}
        </p>
      </div>

      {/* Transparent Infinite Marquee Slider */}
      <div className="team-marquee-wrapper py-1">
        <div className="team-marquee-track">
          {marqueeItems.map((member, index) => {
            const Icon = member.icon;
            return (
              <div
                key={`${member.id}-${index}`}
                className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/60 dark:bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 shadow-sm backdrop-blur-sm transition-colors duration-200 shrink-0"
              >
                {/* Minimal vector icon badge */}
                <div className={`w-6 h-6 rounded-full ${member.iconBg} border flex items-center justify-center shrink-0`}>
                  <Icon className={`w-3 h-3 ${member.iconColor}`} />
                </div>

                {/* Member Name & Role */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-tight text-white whitespace-nowrap">
                    {member.name}
                  </span>
                  <span className="text-slate-600 text-xs select-none">•</span>
                  <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    {isEn ? member.roleEn : member.roleVi}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TeamMarquee;
