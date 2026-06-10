import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBookOpen } from 'react-icons/fi';
import '../../modules/homepage/styles/homepage.scss'; // Link global/homepage styles

const Header = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  return (
    <header className="main-header">
      <div className="header-container">
        <Link to="/" className="logo">
          <FiBookOpen className="logo-icon" />
          <span>E-Learn Academy</span>
        </Link>

        <nav className="nav-menu">
          <a href="#programs">Programs</a>
          <a href="#about">Academy</a>
          <a href="#features">Featured</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="auth-buttons">
          {token ? (
            <button className="btn-dashboard" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
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
