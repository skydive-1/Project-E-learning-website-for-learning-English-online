import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiUser, FiMail, FiLock, FiCalendar, FiShield, 
  FiCamera, FiBookOpen, FiTrendingUp, FiMessageSquare, 
  FiAlertCircle, FiArrowLeft, FiAward, FiCheck, FiLoader, FiRefreshCw, FiSave
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { updateProfileApi, changePasswordApi } from '../../auth/services/auth.service';
import { useAuth } from '../../../context/AuthContext';
import { useGamification } from '../../../context/GamificationContext';
import '../styles/profile.scss';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user: authUser, refreshProfile } = useAuth();
  const {
    badges,
    badgesError,
    isGamificationLoading,
    reloadGamification,
    triggerBadgeUnlock
  } = useGamification();
  
  // Gán biến user bằng authUser từ context để giữ nguyên các tham chiếu hiển thị trong JSX bên dưới
  const user = authUser;
  
  // Tab states
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'stats', 'password'

  // User details state
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
    if (authUser) {
      setProfileData({
        username: authUser.username || '',
        fullName: authUser.fullName || authUser.full_name || '',
        profilePictureUrl: authUser.profilePictureUrl || authUser.profile_picture_url || ''
      });
      setIsLoading(false);
    }
  }, [authUser]);

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
      await updateProfileApi({
        username: profileData.username,
        fullName: profileData.fullName,
        profilePictureUrl: profileData.profilePictureUrl
      });
      
      setInfoMessage({ type: 'success', text: 'Cập nhật thông tin cá nhân thành công!' });
      await refreshProfile();
      
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
      }).then(async (result) => {
        await refreshProfile();
        setInfoMessage({ type: 'success', text: 'Cập nhật ảnh đại diện thành công!' });
        setTimeout(() => setInfoMessage({ type: '', text: '' }), 3000);
      }).catch(err => {
        setInfoMessage({ type: 'error', text: 'Không thể lưu ảnh đại diện.' });
      });
    }
  };

  if (isLoading) {
    return (
      <div className="profile-page-wrapper">
        <Header />
        <main className="profile-main-content">
          <div className="profile-container animate-pulse">
            {/* Back Nav Link Skeleton */}
            <div className="back-to-home" style={{ opacity: 0.5 }}>
              <div style={{ height: '16px', width: '120px', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px' }}></div>
            </div>

            <div className="profile-layout-grid">
              {/* Left Panel Skeleton */}
              <div className="profile-left-panel">
                <div className="profile-summary-card" style={{ gap: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--border-color, #cbd5e1)', opacity: 0.2 }}></div>
                  <div style={{ height: '24px', width: '60%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.2 }}></div>
                  <div style={{ height: '20px', width: '40%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                  <div className="panel-divider" style={{ width: '100%' }}></div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ height: '40px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                    <div style={{ height: '40px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                    <div style={{ height: '40px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                  </div>
                </div>
              </div>

              {/* Right Panel Skeleton */}
              <div className="profile-right-panel" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '24px', padding: '32px' }}>
                <div style={{ height: '28px', width: '40%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', marginBottom: '24px', opacity: 0.2 }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <div style={{ height: '16px', width: '30%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px', marginBottom: '8px', opacity: 0.2 }}></div>
                      <div style={{ height: '44px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                    </div>
                    <div>
                      <div style={{ height: '16px', width: '30%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px', marginBottom: '8px', opacity: 0.2 }}></div>
                      <div style={{ height: '44px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ height: '16px', width: '20%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px', marginBottom: '8px', opacity: 0.2 }}></div>
                    <div style={{ height: '44px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                  </div>
                  <div>
                    <div style={{ height: '16px', width: '20%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px', marginBottom: '8px', opacity: 0.2 }}></div>
                    <div style={{ height: '44px', width: '100%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
                  </div>
                  <div style={{ height: '48px', width: '140px', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '14px', marginTop: '12px', opacity: 0.2 }}></div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
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

                    {/* GAMIFICATION BADGES SHOWCASE GRID */}
                    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-color, #0f172a)', margin: 0 }}>
                            <FiAward aria-hidden="true" style={{ display: 'inline', marginRight: '8px' }} />
                            Huy hiệu & Thành tích (Gamification Badges)
                          </h3>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                            Bộ sưu tập huy hiệu độc quyền khi đạt cột mốc học tập
                          </span>
                        </div>
                      </div>

                      {badgesError ? (
                        <div
                          role="alert"
                          style={{
                            padding: '24px',
                            borderRadius: '16px',
                            background: 'rgba(190, 18, 60, 0.08)',
                            color: 'var(--text-color, #0f172a)',
                            textAlign: 'center'
                          }}
                        >
                          <FiAlertCircle aria-hidden="true" style={{ fontSize: '28px', color: '#be123c', marginBottom: '8px' }} />
                          <p style={{ margin: '0 0 12px', fontWeight: '700' }}>
                            Không thể tải danh sách huy hiệu, vui lòng thử lại sau
                          </p>
                          <button
                            type="button"
                            onClick={reloadGamification}
                            disabled={isGamificationLoading}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 18px',
                              border: 0,
                              borderRadius: '12px',
                              background: '#1d4ed8',
                              color: '#fff',
                              fontWeight: '700',
                              cursor: isGamificationLoading ? 'wait' : 'pointer',
                              opacity: isGamificationLoading ? 0.7 : 1
                            }}
                          >
                            <FiRefreshCw aria-hidden="true" />
                            {isGamificationLoading ? 'Đang thử lại...' : 'Thử lại'}
                          </button>
                        </div>
                      ) : isGamificationLoading && badges.length === 0 ? (
                        <div role="status" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-light, #475569)' }}>
                          <FiLoader className="animate-spin" aria-hidden="true" style={{ marginRight: '8px' }} />
                          Đang tải danh sách huy hiệu...
                        </div>
                      ) : badges.length === 0 ? (
                        <div role="status" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-light, #475569)' }}>
                          Bạn chưa có huy hiệu nào.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                        {(badges || []).map((badge) => (
                          <div 
                            key={badge.id}
                            onClick={badge.unlocked ? () => triggerBadgeUnlock(badge) : undefined}
                            style={{
                              background: badge.unlocked ? 'var(--card-bg, #ffffff)' : '#f8fafc',
                              border: badge.unlocked ? '2px solid #f59e0b' : '1px dashed #cbd5e1',
                              borderRadius: '16px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              textAlign: 'center',
                              gap: '8px',
                              cursor: badge.unlocked ? 'pointer' : 'default',
                              opacity: badge.unlocked ? 1 : 0.65,
                              transition: 'all 0.2s hover:scale-102 shadow-sm'
                            }}
                            title={badge.unlocked ? 'Nhấp để mở xem huy hiệu thành tích!' : 'Huy hiệu chưa mở khóa'}
                          >
                            <div style={{ fontSize: '36px', filter: badge.unlocked ? 'drop-shadow(0 4px 6px rgba(245, 158, 11, 0.3))' : 'grayscale(100%)' }}>
                              {badge.icon}
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: badge.unlocked ? '#0f172a' : '#64748b' }}>
                              {badge.title}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                              {badge.description}
                            </span>
                            {badge.unlocked ? (
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px' }}>
                                Đã đạt được{badge.unlockedAt ? ` (${badge.unlockedAt})` : ''}
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                                🔒 Chưa mở khóa
                              </span>
                            )}
                          </div>
                        ))}
                        </div>
                      )}
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
