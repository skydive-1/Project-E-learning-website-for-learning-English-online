import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../../auth/services/auth.service';
import { FiLogOut, FiBookOpen, FiMessageSquare, FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import '../styles/dashboard.scss';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const data = await getProfile();
        setUser(data.user);
      } catch (error) {
        console.error('Lỗi khi lấy thông tin cá nhân:', error);
        localStorage.removeItem('token');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Đang tải thông tin cá nhân...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Navigation Header */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <FiBookOpen className="brand-icon" />
          <span>E-Learning English</span>
        </div>

        <div className="user-profile-nav">
          <div className="user-info">
            <span className="name">{user?.username || 'Học viên'}</span>
            <span className="role">{user?.role === 'student' ? 'Học sinh' : 'Thành viên'}</span>
          </div>
          <div className="avatar">
            {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <FiLogOut /> Đăng xuất
          </button>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="dashboard-content">
        <div className="welcome-banner">
          <h1>Chào mừng quay trở lại, {user?.username}!</h1>
          <p>Hôm nay bạn muốn học gì? Hãy tiếp tục bài học dang dở hoặc trò chuyện với trợ lý chatbot AI để nâng cao phản xạ tiếng Anh của bạn.</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="icon-box">
              <FiBookOpen />
            </div>
            <div className="stat-info">
              <span className="title">Khóa học đã tham gia</span>
              <span className="value">2 Khóa học</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="icon-box emerald">
              <FiTrendingUp />
            </div>
            <div className="stat-info">
              <span className="title">Tiến trình trung bình</span>
              <span className="value">45%</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="icon-box violet">
              <FiMessageSquare />
            </div>
            <div className="stat-info">
              <span className="title">Hội thoại với AI</span>
              <span className="value">18 Lượt hỏi</span>
            </div>
          </div>
        </div>

        {/* Quick Actions / Modules Links */}
        <div className="quick-actions">
          <h2>Bắt đầu học ngay</h2>
          <div className="actions-grid">
            <div className="action-card" onClick={() => alert('Đang đi tới danh sách khóa học!')}>
              <div>
                <h3>Khóa học & Bài học</h3>
                <p>Danh sách bài học ngữ pháp, từ vựng theo trình độ được chia nhỏ giúp dễ tiếp thu.</p>
              </div>
              <span className="action-link">Xem danh sách bài học <FiArrowRight /></span>
            </div>

            <div className="action-card" onClick={() => alert('Đang đi tới Chatbot AI!')}>
              <div>
                <h3>Trợ lý học tập RAG AI</h3>
                <p>Hỏi đáp ngữ pháp, tra từ và giao tiếp tự nhiên cùng Chatbot AI tích hợp công nghệ RAG cao cấp.</p>
              </div>
              <span className="action-link">Trò chuyện với AI <FiArrowRight /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
