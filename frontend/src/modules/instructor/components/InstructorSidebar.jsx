import React from 'react';
import { 
  FiBook, 
  FiUsers, 
  FiTrendingUp, 
  FiCheckSquare, 
  FiMessageSquare, 
  FiBell, 
  FiChevronRight 
} from 'react-icons/fi';

/**
 * InstructorSidebar Component
 * 
 * A modern, premium sidebar component for "Instructor Hub" in Dark & Light mode,
 * strictly adhering to Apple Human Interface Guidelines (macOS / iOS style).
 * 
 * Features:
 * 1. Typography: SF Pro / Inter font stack with refined tracking & weights
 * 2. Layout: Vertical navigation (My Courses active capsule, Students, Performance, Quizzes, Interactions)
 * 3. Status & Notifications Area (The fix):
 *    - "Disconnected" Status: Minimal, sleek pill-shaped badge with low-opacity semi-transparent red
 *      and soft-glowing red dot indicator next to thin, elegant red text.
 *    - "Pending Message" Notification: Frosted glassmorphism card (backdrop-blur-xl) with 0.5px
 *      low-opacity border, clean wireframe SF Symbols-style bell icon, and a vibrant Apple red badge.
 * 4. Squircle Radius: 12px-16px squircle curves across all components with responsive tactile feel.
 */
const InstructorSidebar = ({
  activeTab = 'courses',
  setActiveTab = () => {},
  sseConnected = false,
  notifications = [],
  interactionPendingCount = 0,
}) => {
  // Navigation items configuration
  const navItems = [
    {
      id: 'courses',
      label: 'My Courses',
      icon: FiBook,
    },
    {
      id: 'students',
      label: 'Students',
      icon: FiUsers,
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: FiTrendingUp,
    },
    {
      id: 'quizzes',
      label: 'Quizzes',
      icon: FiCheckSquare,
    },
    {
      id: 'interaction',
      label: 'Tương tác',
      sublabel: 'Interactions',
      icon: FiMessageSquare,
      badge: interactionPendingCount > 0 ? interactionPendingCount : null,
    },
  ];

  const totalNotifications = notifications.length > 0 ? notifications.length : interactionPendingCount;

  return (
    <aside 
      className="instructor-sidebar-apple w-[260px] flex-shrink-0 flex flex-col p-3.5 rounded-2xl 
                 bg-white/80 dark:bg-[#111318]/95 backdrop-blur-2xl 
                 border border-slate-200/80 dark:border-white/[0.08] 
                 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.4)] 
                 font-apple 
                 transition-all duration-200 select-none h-fit"
      aria-label="Instructor Sidebar"
    >
      {/* Brand Header */}
      <div className="px-2 pt-1 pb-3.5">
        <h2 className="text-[17px] font-bold tracking-tight text-blue-600 dark:text-[#2997FF] flex items-center gap-2">
          Instructor Hub
        </h2>
      </div>

      {/* ── Status & Notifications Area (The fix) ────────────────────── */}
      <div className="flex flex-col gap-2.5 mb-5 px-1">
        {/* 1. "Disconnected" Status: Minimal, sleek pill-shaped badge */}
        <div className="flex items-center">
          <div 
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-300 ${
              sseConnected
                ? 'bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12] border border-emerald-500/20 dark:border-emerald-400/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/[0.08] dark:bg-rose-500/[0.12] border border-rose-500/20 dark:border-rose-400/20 text-rose-500 dark:text-rose-400'
            }`}
            title={sseConnected ? 'Real-time: Đang kết nối ổn định' : 'Real-time: Đã ngắt kết nối'}
          >
            {/* Soft-glowing indicator dot */}
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span 
                className={`absolute inline-flex h-2.5 w-2.5 rounded-full blur-[1.5px] opacity-60 ${
                  sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'
                }`} 
              />
              <span 
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  sseConnected 
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]' 
                    : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                }`} 
              />
            </span>
            {/* Thin, elegant status text */}
            <span className="text-[11.5px] font-normal tracking-wide">
              {sseConnected ? 'Đang kết nối' : 'Đã ngắt kết nối'}
            </span>
          </div>
        </div>

        {/* 2. "Pending Message" Notification: Frosted glassmorphism card */}
        {totalNotifications > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('interaction')}
            className="group relative flex items-center justify-between w-full p-2.5 rounded-[14px] 
                       bg-white/50 dark:bg-white/[0.04] backdrop-blur-xl 
                       border border-slate-200/80 dark:border-white/[0.08] 
                       shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)] 
                       hover:bg-white/80 dark:hover:bg-white/[0.08] 
                       hover:border-slate-300 dark:hover:border-white/15 
                       active:scale-[0.98] transition-all duration-200 text-left cursor-pointer"
            title="Nhấn để xem tin nhắn và thông báo chờ xử lý"
          >
            {/* Left side: Wireframe bell icon (SF Symbols style) + Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center w-7 h-7 rounded-[10px] 
                              bg-blue-500/10 dark:bg-white/[0.06] 
                              text-blue-600 dark:text-slate-300 
                              group-hover:text-blue-500 dark:group-hover:text-white 
                              transition-colors flex-shrink-0">
                <FiBell className="w-3.5 h-3.5 stroke-[1.6]" />
              </div>
              <span className="text-[12px] font-medium tracking-tight text-slate-700 dark:text-slate-200 truncate">
                {notifications.length > 0
                  ? `${notifications.length} thông báo mới`
                  : `${interactionPendingCount} tin nhắn chờ xử lý`}
              </span>
            </div>

            {/* Right side: Vibrant Apple Red Badge */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 
                               rounded-full bg-[#FF3B30] text-white text-[11px] font-semibold 
                               shadow-[0_2px_6px_rgba(255,59,48,0.35)] tracking-tight">
                {totalNotifications}
              </span>
              <FiChevronRight className="w-3.5 h-3.5 text-slate-400/60 dark:text-slate-500/70 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        )}
      </div>

      {/* ── Navigation List ────────────────────────────────────────── */}
      <nav className="flex flex-col gap-1 w-full" aria-label="Instructor Sections">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`group flex items-center justify-between w-full px-3.5 py-2.5 rounded-[12px] 
                         text-[13.5px] font-medium tracking-[-0.01em] transition-all duration-150 
                         active:scale-[0.98] cursor-pointer ${
                isActive
                  ? 'bg-[#007AFF] dark:bg-[#0A84FF] text-white shadow-[0_2px_10px_rgba(10,132,255,0.3)] font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon 
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive 
                      ? 'text-white stroke-[2]' 
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 stroke-[1.75]'
                  }`} 
                />
                <span className="truncate">{item.label}</span>
              </div>

              {/* Auxiliary badge (e.g. Interactions count) */}
              {item.badge && (
                <span 
                  className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center transition-colors ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-amber-500/15 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default InstructorSidebar;
