import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiHome, FiBook, FiBookmark, FiAward, FiUser, FiCompass, FiLogIn, FiMessageCircle, FiBell } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

/**
 * MobileBottomNav Component (PWA & Mobile Navigation Bar)
 * - Tối ưu hóa trải nghiệm điều hướng ngón tay cái (Thumb Zone UX) cho điện thoại di động
 * - Hiển thị cố định ở chân màn hình (Bottom Navigation) trên màn hình < 768px
 * - Hỗ trợ safe-area-inset-bottom cho iPhone/iPad (tai thỏ / home bar)
 * - Touch target chuẩn >= 44x44px, phân quyền theo trạng thái đăng nhập
 * - Badge indicators cho unread discussions/notifications
 */
const MobileBottomNav = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [unreadCounts, setUnreadCounts] = useState({
    discussions: 0,
    notifications: 0
  });

  // Ẩn Bottom Navigation khi đang học bài trong Lesson Detail để nhường toàn bộ không gian cho Video và AI Assistant
  const isLessonPage = location.pathname.startsWith('/lessons');
  if (isLessonPage) {
    return null;
  }

  // Fetch unread counts for badges
  useEffect(() => {
    if (!user?.userId) return;

    const fetchUnreadCounts = async () => {
      try {
        // TODO: Replace with actual API calls when endpoints are available
        // const [discussionsRes, notificationsRes] = await Promise.all([
        //   apiClient.get('/discussions/unread-count'),
        //   apiClient.get('/notifications/unread-count')
        // ]);
        // setUnreadCounts({
        //   discussions: discussionsRes.data?.count || 0,
        //   notifications: notificationsRes.data?.count || 0
        // });
      } catch (err) {
        console.warn('Failed to fetch unread counts:', err);
      }
    };

    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [user?.userId]);

  const loggedInNavItems = [
    {
      to: '/',
      label: t('home') || 'Trang chủ',
      icon: <FiHome className="text-lg" />,
      badge: null
    },
    {
      to: '/courses',
      state: { activeHubTab: 'course' },
      label: t('learn') || 'Học tập',
      icon: <FiBook className="text-lg" />,
      badge: null
    },
    {
      to: '/my-courses',
      label: t('my_courses') || 'Của tôi',
      icon: <FiBookmark className="text-lg" />,
      badge: unreadCounts.discussions > 0 ? unreadCounts.discussions : null
    },
    {
      to: '/profile',
      label: t('profile') || 'Cá nhân',
      icon: <FiUser className="text-lg" />,
      badge: unreadCounts.notifications > 0 ? unreadCounts.notifications : null
    }
  ];

  const guestNavItems = [
    {
      to: '/',
      label: t('home') || 'Trang chủ',
      icon: <FiHome className="text-lg" />,
      badge: null
    },
    {
      to: '/courses',
      state: { activeHubTab: 'course' },
      label: t('learn') || 'Học tập',
      icon: <FiBook className="text-lg" />,
      badge: null
    },
    {
      to: '/academy',
      label: t('roadmap') || 'Lộ trình',
      icon: <FiCompass className="text-lg" />,
      badge: null
    },
    {
      to: '/login',
      label: t('login') || 'Đăng nhập',
      icon: <FiLogIn className="text-lg" />,
      badge: null
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
            state={item.state}
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
                <div className="relative p-1 rounded-lg transition-transform duration-200">
                  {({ isActive }) => (
                    <div className={`transition-transform duration-200 ${isActive ? 'scale-110 bg-indigo-500/20 text-indigo-400' : ''}`}>
                      {item.icon}
                    </div>
                  )}
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 min-w-[18px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900 dark:border-slate-950">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
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
