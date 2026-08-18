import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiHome, FiBook, FiBookmark, FiAward, FiUser, FiCompass, FiLogIn } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

/**
 * MobileBottomNav Component (PWA & Mobile Navigation Bar)
 * - Tối ưu hóa trải nghiệm điều hướng ngón tay cái (Thumb Zone UX) cho điện thoại di động
 * - Hiển thị cố định ở chân màn hình (Bottom Navigation) trên màn hình < 768px
 * - Hỗ trợ safe-area-inset-bottom cho iPhone/iPad (tai thỏ / home bar)
 * - Touch target chuẩn >= 44x44px, phân quyền theo trạng thái đăng nhập
 */
const MobileBottomNav = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  // Ẩn Bottom Navigation khi đang học bài trong Lesson Detail để nhường toàn bộ không gian cho Video và AI Assistant
  const isLessonPage = location.pathname.startsWith('/lessons');
  if (isLessonPage) {
    return null;
  }

  const loggedInNavItems = [
    {
      to: '/',
      label: t('home') || 'Trang chủ',
      icon: <FiHome className="text-lg" />
    },
    {
      to: '/courses',
      label: t('courses') || 'Khóa học',
      icon: <FiBook className="text-lg" />
    },
    {
      to: '/my-courses',
      label: t('my_courses') || 'Của tôi',
      icon: <FiBookmark className="text-lg" />
    },
    {
      to: '/quizzes',
      label: t('quizzes') || 'Trắc nghiệm',
      icon: <FiAward className="text-lg" />
    },
    {
      to: '/profile',
      label: t('profile') || 'Cá nhân',
      icon: <FiUser className="text-lg" />
    }
  ];

  const guestNavItems = [
    {
      to: '/',
      label: t('home') || 'Trang chủ',
      icon: <FiHome className="text-lg" />
    },
    {
      to: '/courses',
      label: t('courses') || 'Khóa học',
      icon: <FiBook className="text-lg" />
    },
    {
      to: '/academy',
      label: t('roadmap') || 'Lộ trình',
      icon: <FiCompass className="text-lg" />
    },
    {
      to: '/quizzes',
      label: t('quizzes') || 'Trắc nghiệm',
      icon: <FiAward className="text-lg" />
    },
    {
      to: '/login',
      label: t('login') || 'Đăng nhập',
      icon: <FiLogIn className="text-lg" />
    }
  ];

  const navItems = user ? loggedInNavItems : guestNavItems;

  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-800 text-slate-400 shadow-2xl transition-all duration-300"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
        {navItems.map((item, idx) => (
          <NavLink
            key={idx}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full min-w-[48px] min-h-[44px] px-1 py-1 transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-lg transition-transform duration-200 ${isActive ? 'scale-110 bg-indigo-500/20 text-indigo-400' : ''}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] tracking-tight truncate max-w-[60px] mt-0.5">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
