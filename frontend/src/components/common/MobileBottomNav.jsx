import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiHome, FiBook, FiBookmark, FiUser, FiCompass, FiLogIn, FiGrid, FiEdit3 } from 'react-icons/fi';
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

  // Fetch unread counts for badges
  useEffect(() => {
    // Hook phải luôn được gọi ở mọi render. Chỉ bỏ qua phần side effect khi
    // thanh điều hướng đang bị ẩn hoặc người dùng chưa đăng nhập.
    if (isLessonPage || !user?.userId) return undefined;

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
  }, [isLessonPage, user?.userId]);

  if (isLessonPage) {
    return null;
  }

  const userRoleId = Number.parseInt(user?.roleId || user?.role_id || user?.role, 10);
  const workspaceItem = userRoleId === 1
    ? {
        to: '/admin/dashboard',
        label: t('adminDashboard') || 'Vận hành',
        icon: <FiGrid aria-hidden="true" />,
      }
    : userRoleId === 2
      ? {
          to: '/instructor/dashboard',
          label: t('instructorDashboard') || 'Giảng dạy',
          icon: <FiEdit3 aria-hidden="true" />,
        }
      : {
          to: '/my-courses',
          label: t('myCourses') || t('my_courses') || 'Khóa của tôi',
          icon: <FiBookmark aria-hidden="true" />,
          badge: unreadCounts.discussions > 0 ? unreadCounts.discussions : null,
        };

  const loggedInNavItems = [
    {
      to: '/',
      label: t('home') || 'Trang chủ',
      icon: <FiHome aria-hidden="true" />,
      badge: null
    },
    {
      to: '/courses',
      state: { activeHubTab: 'course' },
      label: t('learn') || 'Học tập',
      icon: <FiBook aria-hidden="true" />,
      badge: null
    },
    workspaceItem,
    {
      to: '/profile',
      label: t('profile') || 'Cá nhân',
      icon: <FiUser aria-hidden="true" />,
      badge: unreadCounts.notifications > 0 ? unreadCounts.notifications : null
    }
  ];

  const guestNavItems = [
    {
      to: '/',
      label: t('home') || 'Trang chủ',
      icon: <FiHome aria-hidden="true" />,
      badge: null
    },
    {
      to: '/courses',
      state: { activeHubTab: 'course' },
      label: t('learn') || 'Học tập',
      icon: <FiBook aria-hidden="true" />,
      badge: null
    },
    {
      to: '/academy',
      label: t('roadmap') || 'Lộ trình',
      icon: <FiCompass aria-hidden="true" />,
      badge: null
    },
    {
      to: '/login',
      label: t('login') || 'Đăng nhập',
      icon: <FiLogIn aria-hidden="true" />,
      badge: null
    }
  ];

  const navItems = user ? loggedInNavItems : guestNavItems;

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="mobile-bottom-nav md:hidden"
      data-role={userRoleId === 1 ? 'admin' : userRoleId === 2 ? 'instructor' : 'student'}
    >
      <div className="mobile-bottom-nav__inner">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            state={item.state}
            end={item.to === '/'}
            className={({ isActive }) =>
              `mobile-bottom-nav__item ${isActive ? 'is-active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`mobile-bottom-nav__icon ${isActive ? 'is-active' : ''}`}>
                  {item.icon}
                  {item.badge && item.badge > 0 && (
                    <span className="mobile-bottom-nav__badge" aria-label={`${item.badge} thông báo chưa đọc`}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                <span className="mobile-bottom-nav__label">
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
