import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBookOpen, FiUser, FiLogOut, FiLayout, FiSun, FiMoon, FiMenu, FiX, FiActivity } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScrambleText from './ScrambleText';
import FlameStreakWidget from '../../modules/gamification/components/FlameStreakWidget';
import '../../modules/homepage/styles/homepage.scss'; // Link global/homepage styles

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isDropdownOpen || isMobileMenuOpen) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isDropdownOpen, isMobileMenuOpen]);

  // Keyboard navigation for dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      } else if (event.key === 'Tab') {
        // Trap focus within dropdown
        const focusableElements = dropdownRef.current?.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  // Keyboard navigation for mobile menu
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      } else if (event.key === 'Tab') {
        // Trap focus within mobile menu
        const focusableElements = mobileMenuRef.current?.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Lock body scroll when mobile menu is open to prevent background scrolling on small screens
  useEffect(() => {
    if (isMobileMenuOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow || '';
      };
    }
    // ensure cleanup
    document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const userRoleId = parseInt(user?.roleId || user?.role_id || user?.role, 10);
  const isAdmin = userRoleId === 1 || Boolean(user?.is_super_admin);
  const isInstructor = userRoleId === 2;
  const canAccessInstructorPanel = isAdmin || isInstructor;

  return (
    <header className="main-header">
      <div className="header-container">
        <Link to="/" className="logo" onClick={() => setIsMobileMenuOpen(false)}>
          <FiBookOpen className="logo-icon" />
          <ScrambleText text="E-Learn Academy" className="logo-text" />
        </Link>

        {/* Mobile menu backdrop overlay */}
        {isMobileMenuOpen && (
          <div 
            ref={mobileMenuRef}
            className="mobile-menu-backdrop" 
            onClick={() => setIsMobileMenuOpen(false)} 
            aria-hidden="true"
          />
        )}

        <nav 
          ref={mobileMenuRef}
          id="main-nav" 
          className={`nav-menu ${isMobileMenuOpen ? 'open' : ''}`} 
          aria-hidden={!isMobileMenuOpen && window.innerWidth <= 768}
          role="navigation"
          aria-label={t('menu')}
        >
          <Link
            to="/courses"
            state={{ activeHubTab: 'course' }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {t('learn')}
          </Link>
          <Link to="/academy" onClick={() => setIsMobileMenuOpen(false)}>{t('roadmap')}</Link>
          <Link to="/#features" onClick={() => setIsMobileMenuOpen(false)}>{t('features')}</Link>

          {/* Mobile-only auth links or user menu */}
          {!user && isMobileMenuOpen && (
            <div className="mobile-auth-links">
              <Link to="/login" className="mobile-btn-login" onClick={() => setIsMobileMenuOpen(false)}>{t('login')}</Link>
              <Link to="/register" className="mobile-btn-register" onClick={() => setIsMobileMenuOpen(false)}>{t('register')}</Link>
            </div>
          )}

          {/* When user is logged in, expose account links inside mobile nav for easy access */}
          {user && isMobileMenuOpen && (
            <div className="mobile-auth-links">
              <Link to="/profile" className="mobile-btn-login" onClick={() => setIsMobileMenuOpen(false)}>
                {t('profile')}
              </Link>

              <Link to="/my-courses" className="mobile-btn-login" onClick={() => setIsMobileMenuOpen(false)}>
                {t('myCourses')}
              </Link>

              {/* Role-based quick links */}
              {isAdmin && (
                <Link to="/admin/dashboard" className="mobile-btn-login" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('adminDashboard')}
                </Link>
              )}

              {canAccessInstructorPanel && (
                <Link to="/instructor/dashboard" className="mobile-btn-login" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('instructorDashboard')}
                </Link>
              )}

              <button className="mobile-btn-register" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}>
                {t('logout')}
              </button>
            </div>
          )}
        </nav>

        <div className="auth-buttons">
          {/* iOS Segmented Language Switcher Button */}
          <button
            type="button"
            onClick={toggleLanguage}
            className={`ios-lang-switch ${language === 'ENG' ? 'en' : 'vn'}`}
            title={t('switchLangTip')}
            aria-label={t('switchLangTip')}
            aria-pressed={language === 'ENG'}
          >
            <span className="ios-switch-thumb" aria-hidden="true" />
            <span className={`ios-switch-option ${language === 'VIE' ? 'active' : ''}`} aria-hidden="true">VN</span>
            <span className={`ios-switch-option ${language === 'ENG' ? 'active' : ''}`} aria-hidden="true">EN</span>
          </button>

          {/* Flame Streak Gamification Widget (Chỉ hiển thị khi đã đăng nhập) */}
          {user && <FlameStreakWidget />}

          {/* Dark Mode Toggle Button */}
          <button 
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
          >
            {theme === 'dark' ? <FiSun style={{ color: '#f59e0b' }} /> : <FiMoon />}
          </button>

          {user ? (
            <div 
              ref={dropdownRef}
              className="user-menu-wrapper"
            >
              <div className="avatar-trigger" onClick={toggleDropdown}>
                {user?.profilePictureUrl || user?.profile_picture_url ? (
                  <img 
                    src={user.profilePictureUrl || user.profile_picture_url} 
                    alt={t('profileAvatar')}
                    className="user-avatar-img" 
                  />
                ) : (
                  <div className="avatar-initials">
                    {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="user-header-name">{user?.username || t('student')}</span>
              </div>
              
              {isDropdownOpen && (
                <div className="user-dropdown-menu">
                  <div className="dropdown-user-info">
                    <p className="dropdown-username">{user?.username || t('student')}</p>
                    <p className="dropdown-email">{user?.email}</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  
                  <Link to="/profile" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    <FiUser className="dropdown-icon" />
                    <span>{t('profile')}</span>
                  </Link>

                  {isAdmin && (
                    <Link to="/admin/dashboard" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      <FiLayout className="dropdown-icon" />
                      <span>{t('adminDashboard')}</span>
                    </Link>
                  )}

                  {canAccessInstructorPanel && (
                    <Link to="/instructor/dashboard" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      <FiLayout className="dropdown-icon" />
                      <span>{t('instructorDashboard')}</span>
                    </Link>
                  )}

                  <Link to="/my-courses" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    <FiBookOpen className="dropdown-icon" />
                    <span>{t('myCourses')}</span>
                  </Link>

                  <Link to="/analytics" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    <FiActivity className="dropdown-icon" />
                    <span>{t('learningAnalytics')}</span>
                  </Link>

                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout-btn" onClick={handleLogout}>
                    <FiLogOut className="dropdown-icon" />
                    <span>{t('logout')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-login">{t('login')}</Link>
              <Link to="/register" className="btn-register">{t('register')}</Link>
            </>
          )}

          {/* Mobile Menu Toggle Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }}
            className="mobile-menu-toggle-btn"
            title={t('menu')}
            aria-label={t('menu')}
            aria-expanded={isMobileMenuOpen}
            aria-controls="main-nav"
          >
            {isMobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
