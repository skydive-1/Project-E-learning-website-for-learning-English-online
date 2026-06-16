import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiUser, FiMail, FiLock, FiCalendar, FiShield, 
  FiCamera, FiBookOpen, FiTrendingUp, FiMessageSquare, 
  FiArrowLeft, FiCheck, FiSave 
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { getProfile, updateProfileApi, changePasswordApi } from '../../auth/services/auth.service';
import '../styles/profile.scss';

const ProfilePage = () => {
  const navigate = useNavigate();
  
  // Tab states
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'stats', 'password'

  // User details state
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState({
    username: '',
    fullName: '',
    profilePictureUrl: ''
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Feedback messages
  const [infoMessage, setInfoMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const res = await getProfile();
        const userData = res.data || res.user || res;
        setUser(userData);
        setProfileData({
          username: userData.username || '',
          fullName: userData.fullName || userData.full_name || '',
          profilePictureUrl: userData.profilePictureUrl || userData.profile_picture_url || ''
        });
      } catch (error) {
        console.error("Error loading user profile:", error);
        localStorage.removeItem('token');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  // Handle input changes
  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  // Submit Profile Changes
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setInfoMessage({ type: '', text: '' });
    setIsSaving(true);

    try {
      const result = await updateProfileApi({
        username: profileData.username,
        fullName: profileData.fullName,
        profilePictureUrl: profileData.profilePictureUrl
      });
      
      setInfoMessage({ type: 'success', text: 'Cập nhật thông tin cá nhân thành công!' });
      setUser({ ...user, ...result.data });
      
      // Auto clear message after 3 seconds
      setTimeout(() => setInfoMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.';
      setInfoMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Password Change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp' });
      return;
    }

    setIsSaving(true);

    try {
      await changePasswordApi({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });

      setTimeout(() => setPasswordMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra mật khẩu cũ.';
      setPasswordMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle profile image click / dummy upload
  const handleAvatarChange = () => {
    const url = prompt("Nhập link URL ảnh đại diện mới của bạn:", profileData.profilePictureUrl);
    if (url !== null) {
      setProfileData({ ...profileData, profilePictureUrl: url });
      // Call update immediately
      updateProfileApi({
        username: profileData.username,
        fullName: profileData.fullName,
        profilePictureUrl: url
      }).then((result) => {
        setUser(prev => ({ ...prev, profile_picture_url: url, profilePictureUrl: url }));
        setInfoMessage({ type: 'success', text: 'Cập nhật ảnh đại diện thành công!' });
        setTimeout(() => setInfoMessage({ type: '', text: '' }), 3000);
      }).catch(err => {
        setInfoMessage({ type: 'error', text: 'Không thể lưu ảnh đại diện.' });
      });
    }
  };

  if (isLoading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner-large"></div>
        <p>Đang tải thông tin cá nhân...</p>
      </div>
    );
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa xác định';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="profile-page-wrapper">
      <Header />
      
      <main className="profile-main-content">
        <div className="profile-container">
          {/* Back Nav Link */}
          <div className="back-to-home" onClick={() => navigate('/')}>
            <FiArrowLeft /> <span>Quay lại trang chủ</span>
          </div>

          <div className="profile-layout-grid">
            
            {/* Left Card - Quick Overview & Navigation */}
            <div className="profile-left-panel">
              <div className="profile-summary-card">
                <div className="avatar-section">
                  <div className="avatar-container" onClick={handleAvatarChange}>
                    {profileData.profilePictureUrl ? (
                      <img src={profileData.profilePictureUrl} alt="User Avatar" className="profile-avatar-img" />
                    ) : (
                      <div className="avatar-fallback-large">
                        {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="avatar-edit-overlay">
                      <FiCamera className="edit-icon" />
                    </div>
                  </div>
                  <h3>{profileData.fullName || user?.username || 'Học viên'}</h3>
                  <span className="role-tag">
                    <FiShield /> {
                      (user?.roleId || user?.role_id) === 1 
                        ? 'Quản trị viên' 
                        : (user?.roleId || user?.role_id) === 2 
                          ? 'Giảng viên' 
                          : 'Học viên'
                    }
                  </span>
                </div>

                <div className="panel-divider"></div>

                {/* Vertical Navigation Tabs */}
                <div className="profile-nav-tabs">
                  <button 
                    className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('info')}
                  >
                    <FiUser className="tab-icon" />
                    <span>Thông tin cá nhân</span>
                  </button>

                  <button 
                    className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                  >
                    <FiTrendingUp className="tab-icon" />
                    <span>Thống kê học tập</span>
                  </button>

                  <button 
                    className={`tab-btn ${activeTab === 'password' ? 'active' : ''}`}
                    onClick={() => setActiveTab('password')}
                  >
                    <FiLock className="tab-icon" />
                    <span>Đổi mật khẩu</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Card - Dynamic Tab Contents */}
            <div className="profile-right-panel">
              <div className="profile-content-card">
                
                {/* 1. Tab: Information Info */}
                {activeTab === 'info' && (
                  <div className="tab-content-wrapper animate-fade">
                    <h2>Thông tin cá nhân</h2>
                    <p className="tab-subtitle">Cập nhật thông tin tài khoản và thông tin hiển thị của bạn.</p>

                    {infoMessage.text && (
                      <div className={`form-alert ${infoMessage.type}`}>
                        {infoMessage.text}
                      </div>
                    )}

                    <form onSubmit={handleProfileSubmit} className="profile-form">
                      <div className="form-grid">
                        <div className="form-group">
                          <label htmlFor="username">Tên người dùng (Username)</label>
                          <div className="input-with-icon">
                            <FiUser className="field-icon" />
                            <input 
                              type="text" 
                              id="username" 
                              name="username"
                              value={profileData.username} 
                              onChange={handleProfileChange}
                              required 
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label htmlFor="fullName">Họ và tên (Display Name)</label>
                          <div className="input-with-icon">
                            <FiUser className="field-icon" />
                            <input 
                              type="text" 
                              id="fullName" 
                              name="fullName"
                              placeholder="Nhập họ và tên đầy đủ"
                              value={profileData.fullName} 
                              onChange={handleProfileChange}
                            />
                          </div>
                        </div>

                        <div className="form-group disabled-group">
                          <label htmlFor="email">Địa chỉ Email</label>
                          <div className="input-with-icon">
                            <FiMail className="field-icon" />
                            <input 
                              type="email" 
                              id="email" 
                              value={user?.email || ''} 
                              disabled 
                            />
                          </div>
                          <span className="field-hint">Email đăng ký không thể thay đổi.</span>
                        </div>

                        <div className="form-group disabled-group">
                          <label>Ngày tham gia</label>
                          <div className="input-with-icon">
                            <FiCalendar className="field-icon" />
                            <input 
                              type="text" 
                              value={formatDate(user?.created_date || user?.created_at)} 
                              disabled 
                            />
                          </div>
                        </div>
                      </div>

                      <button type="submit" className="save-btn" disabled={isSaving}>
                        {isSaving ? <span className="btn-spinner"></span> : <><FiSave /> Lưu thay đổi</>}
                      </button>
                    </form>
                  </div>
                )}

                {/* 2. Tab: Learning Stats */}
                {activeTab === 'stats' && (
                  <div className="tab-content-wrapper animate-fade">
                    <h2>Thống kê học tập</h2>
                    <p className="tab-subtitle">Tổng quan về kết quả học tập và hoạt động của bạn trên E-Learn.</p>

                    <div className="stats-cards-grid">
                      <div className="profile-stat-card">
                        <div className="stat-icon-wrapper blue">
                          <FiBookOpen />
                        </div>
                        <div className="stat-details">
                          <span className="label">Khóa học đã đăng ký</span>
                          <span className="value">2 Khóa học</span>
                        </div>
                      </div>

                      <div className="profile-stat-card">
                        <div className="stat-icon-wrapper orange">
                          <FiTrendingUp />
                        </div>
                        <div className="stat-details">
                          <span className="label">Tiến trình trung bình</span>
                          <span className="value">45%</span>
                        </div>
                      </div>

                      <div className="profile-stat-card">
                        <div className="stat-icon-wrapper purple">
                          <FiMessageSquare />
                        </div>
                        <div className="stat-details">
                          <span className="label">Hội thoại RAG AI</span>
                          <span className="value">18 Lượt hỏi</span>
                        </div>
                      </div>
                    </div>

                    <div className="activity-summary">
                      <h3>Hoạt động gần đây</h3>
                      <div className="activity-timeline">
                        <div className="timeline-item">
                          <div className="timeline-dot"></div>
                          <div className="timeline-info">
                            <span className="time">Hôm qua</span>
                            <p>Bạn đã thực hành luyện nói phản xạ với Trợ lý AI và đạt 8.5 điểm.</p>
                          </div>
                        </div>
                        <div className="timeline-item">
                          <div className="timeline-dot"></div>
                          <div className="timeline-info">
                            <span className="time">3 ngày trước</span>
                            <p>Đăng ký thành công khóa học "Tiếng Anh Giao Tiếp Online".</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Tab: Change Password */}
                {activeTab === 'password' && (
                  <div className="tab-content-wrapper animate-fade">
                    <h2>Đổi mật khẩu</h2>
                    <p className="tab-subtitle">Đảm bảo an toàn bảo mật cho tài khoản của bạn bằng cách cập nhật mật khẩu định kỳ.</p>

                    {passwordMessage.text && (
                      <div className={`form-alert ${passwordMessage.type}`}>
                        {passwordMessage.text}
                      </div>
                    )}

                    <form onSubmit={handlePasswordSubmit} className="profile-form">
                      <div className="form-group">
                        <label htmlFor="oldPassword">Mật khẩu hiện tại</label>
                        <div className="input-with-icon">
                          <FiLock className="field-icon" />
                          <input 
                            type="password" 
                            id="oldPassword" 
                            name="oldPassword"
                            placeholder="Nhập mật khẩu hiện tại"
                            value={passwordData.oldPassword}
                            onChange={handlePasswordChange}
                            required 
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="newPassword">Mật khẩu mới</label>
                        <div className="input-with-icon">
                          <FiLock className="field-icon" />
                          <input 
                            type="password" 
                            id="newPassword" 
                            name="newPassword"
                            placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            required 
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
                        <div className="input-with-icon">
                          <FiLock className="field-icon" />
                          <input 
                            type="password" 
                            id="confirmPassword" 
                            name="confirmPassword"
                            placeholder="Nhập lại mật khẩu mới để xác nhận"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            required 
                          />
                        </div>
                      </div>

                      <button type="submit" className="save-btn" disabled={isSaving}>
                        {isSaving ? <span className="btn-spinner"></span> : <><FiCheck /> Cập nhật mật khẩu</>}
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;
