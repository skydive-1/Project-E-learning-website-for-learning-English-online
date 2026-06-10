import React from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen } from 'react-icons/fi';

const Footer = () => {
  return (
    <footer className="main-footer">
      <div className="footer-container">
        <div className="footer-info">
          <Link to="/" className="footer-logo">
            <FiBookOpen className="logo-icon" />
            <span>E-Learn Academy</span>
          </Link>
          <p className="copyright">© 2026 E-Learn Academy. Teaching English with story.</p>
        </div>

        <div className="footer-links">
          <a href="#hero">Trang chủ</a>
          <a href="#roadmap-sec">Lộ trình</a>
          <a href="#courses-sec">Khóa học</a>
          <a href="#privacy">Chính sách</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
