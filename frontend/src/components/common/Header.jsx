import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBookOpen, FiUser, FiLogOut, FiLayout, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import '../../modules/homepage/styles/homepage.scss'; // Link global/homepage styles

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest('.user-menu-wrapper')) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className="main-header">
      <div className="header-container">
        <Link to="/" className="logo">
          <FiBookOpen className="logo-icon" />
          <span>E-Learn Academy</span>
        </Link>

        <nav className="nav-menu">
          <Link to="/courses">Programs</Link>
          <Link to="/academy">Academy</Link>
          <Link to="/quizzes">Quizzes</Link>
          <a href="#features">Featured</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="auth-buttons">
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
                <span className="user-header-name">{user?.username || 'Học viên'}</span>
              </div>
              
              {isDropdownOpen && (
                <div className="user-dropdown-menu">
                  <div className="dropdown-user-info">
                    <p className="dropdown-username">{user?.username || 'Học viên'}</p>
                    <p className="dropdown-email">{user?.email}</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  
                  <Link to="/profile" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    <FiUser className="dropdown-icon" />
                    <span>Trang cá nhân</span>
                  </Link>

                  {parseInt(user?.roleId || user?.role_id || user?.role) === 2 && (
                    <Link to="/instructor/dashboard" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      <FiLayout className="dropdown-icon" />
                      <span>Quản lý khóa học</span>
                    </Link>
                  )}

                  <Link to="/lessons" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    <FiBookOpen className="dropdown-icon" />
                    <span>Bài học của tôi</span>
                  </Link>

                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout-btn" onClick={handleLogout}>
                    <FiLogOut className="dropdown-icon" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-login">Login</Link>
              <Link to="/register" className="btn-register">Register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
