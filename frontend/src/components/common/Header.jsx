import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBookOpen, FiUser, FiLogOut, FiLayout, FiSun, FiMoon, FiMenu, FiX, FiGlobe, FiActivity } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScrambleText from './ScrambleText';
import '../../modules/homepage/styles/homepage.scss'; // Link global/homepage styles

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest('.user-menu-wrapper')) {
        setIsDropdownOpen(false);
      }
      if (!event.target.closest('.main-header')) {
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
            className="mobile-menu-backdrop" 
            onClick={() => setIsMobileMenuOpen(false)} 
            aria-hidden="true"
          />
        )}

        <nav id="main-nav" className={`nav-menu ${isMobileMenuOpen ? 'open' : ''}`} aria-hidden={!isMobileMenuOpen && window.innerWidth <= 768}>
          <Link to="/courses" onClick={() => setIsMobileMenuOpen(false)}>{t('courses')}</Link>
          <Link to="/academy" onClick={() => setIsMobileMenuOpen(false)}>{t('roadmap')}</Link>
          <Link to="/quizzes" onClick={() => setIsMobileMenuOpen(false)}>{t('quizzes')}</Link>
          <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>{t('features')}</a>
          <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>{t('pricing')}</a>

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
              {parseInt(user?.roleId || user?.role_id || user?.role) === 1 && (
                <Link to="/admin/dashboard" className="mobile-btn-login" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('adminDashboard')}
                </Link>
              )}

              {parseInt(user?.roleId || user?.role_id || user?.role) === 2 && (
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
          <div 
            onClick={toggleLanguage}
            className={`ios-lang-switch ${language === 'ENG' ? 'en' : 'vn'}`}
            title={t('switchLangTip')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && toggleLanguage()}
          >
            <div className="ios-switch-thumb" />
            <span className={`ios-switch-option ${language === 'VIE' ? 'active' : ''}`}>VN</span>
            <span className={`ios-switch-option ${language === 'ENG' ? 'active' : ''}`}>EN</span>
          </div>

          {/* Dark Mode Toggle Button */}
          <button 
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          >
            {theme === 'dark' ? <FiSun style={{ color: '#f59e0b' }} /> : <FiMoon />}
          </button>

          {user ? (
            <div className="user-menu-wrapper">
              <div className="avatar-trigger" onClick={toggleDropdown}>
                {user?.profilePictureUrl || user?.profile_picture_url ? (
                  <img 
                    src={user.profilePictureUrl || user.profile_picture_url} 
                    alt="Avatar" 
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

                  {parseInt(user?.roleId || user?.role_id || user?.role) === 1 && (
                    <Link to="/admin/dashboard" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      <FiLayout className="dropdown-icon" />
                      <span>{t('adminDashboard')}</span>
                    </Link>
                  )}

                  {parseInt(user?.roleId || user?.role_id || user?.role) === 2 && (
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
                    <span>Phân tích học tập</span>
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
            title="Menu"
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
