import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiUser, FiMail, FiLock, FiCalendar, FiShield, 
  FiCamera, FiBookOpen, FiTrendingUp, FiMessageSquare, 
  FiAlertCircle, FiArrowLeft, FiAward, FiCheck, FiLoader, FiRefreshCw, FiSave,
  FiClock, FiKey
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { updateProfileApi, uploadAvatarApi, changePasswordApi, requestPasswordChangeOtpApi, getUserStatsApi } from '../../auth/services/auth.service';
import { useAuth } from '../../../context/AuthContext';
import { useGamification } from '../../../context/GamificationContext';
import { useLanguage } from '../../../context/LanguageContext';
import '../styles/profile.scss';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
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

  // Password change state (2-step OTP flow)
  const [passwordStep, setPasswordStep] = useState(1); // 1: Điền mật khẩu -> gửi OTP, 2: Nhập OTP -> xác nhận
  const [passwordOtp, setPasswordOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0); // Đếm ngược hạn mã OTP (giây)
  const [resendCountdown, setResendCountdown] = useState(0); // Đếm ngược nút gửi lại mã (giây)
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    let timer = null;
    if (passwordStep === 2 && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [passwordStep, otpCountdown]);

  useEffect(() => {
    let timer = null;
    if (passwordStep === 2 && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [passwordStep, resendCountdown]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Feedback messages
  const [infoMessage, setInfoMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const fileInputRef = useRef(null);

  // User stats state (kết nối API thật)
  const [userStats, setUserStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  useEffect(() => {
    if (authUser) {
      setProfileData({
        username: authUser.username || '',
        fullName: authUser.fullName || authUser.full_name || '',
        profilePictureUrl: authUser.profilePictureUrl || authUser.profile_picture_url || ''
      });
      setAvatarImgError(false);
      setIsLoading(false);
    }
  }, [authUser]);

  // Tải stats khi chuyển sang tab stats
  useEffect(() => {
    if (activeTab === 'stats' && !userStats && !statsLoading) {
      setStatsLoading(true);
      setStatsError(null);
      getUserStatsApi()
        .then(res => setUserStats(res.data))
        .catch(() => setStatsError('Không tải được thống kê.'))
        .finally(() => setStatsLoading(false));
    }
  }, [activeTab]);

  // Luôn lấy snapshot mới nhất khi người dùng mở phần thống kê sau một phiên học.
  useEffect(() => {
    if (activeTab === 'stats') {
      reloadGamification();
    }
  }, [activeTab, reloadGamification]);

  const formatBadgeDate = (value) => {
    if (!value) return '';
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? String(value)
      : new Intl.DateTimeFormat(locale).format(parsed);
  };

  const getBadgeProgressText = (badge) => {
    const progress = badge?.progress;
    if (!progress) return '';
    if (progress.available === false) return 'Chưa bắt đầu khóa Ngữ pháp';

    const current = Math.max(0, Number(progress.current) || 0);
    const target = Math.max(0, Number(progress.target) || 0);
    return `Tiến độ thật: ${Math.min(current, target)}/${target} ${progress.unit || ''}`.trim();
  };

  const getBadgeRequirementText = (badge) => {
    if (badge?.requirement) return badge.requirement;
    return badge?.description || '';
  };

  const getBadgeProgressPercent = (badge) => {
    const progress = badge?.progress;
    if (!progress) return 0;
    const current = Math.max(0, Number(progress.current) || 0);
    const target = Math.max(1, Number(progress.target) || 1);
    return Math.min(100, Math.round((Math.min(current, target) / target) * 100));
  };

  const getBadgeRemainingText = (badge) => {
    const progress = badge?.progress;
    if (!progress || progress.available === false) return '';
    const current = Math.max(0, Number(progress.current) || 0);
    const target = Math.max(0, Number(progress.target) || 0);
    const remaining = Math.max(0, target - Math.min(current, target));
    if (remaining <= 0) return '';
    return `Còn thiếu ${remaining} ${progress.unit || ''}`.trim();
  };

  const unlockedBadgeCount = (badges || []).filter((badge) => badge?.unlocked).length;
  const totalBadgeCount = (badges || []).length;

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

  // Step 1: Yêu cầu gửi mã xác thực OTP qua Gmail
  const handleRequestPasswordOtp = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (!passwordData.oldPassword) {
      setPasswordMessage({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
      return;
    }

    if (passwordData.oldPassword === passwordData.newPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await requestPasswordChangeOtpApi({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordStep(2);
      setPasswordOtp('');
      setOtpCountdown(300); // 5 phút hiệu lực
      setResendCountdown(60); // 60s chờ gửi lại
      setPasswordMessage({
        type: 'success',
        text: res?.message || 'Mã xác thực OTP đã được gửi đến Gmail của bạn. Vui lòng kiểm tra hộp thư.'
      });
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Không thể gửi mã xác thực OTP. Vui lòng kiểm tra lại mật khẩu hiện tại.';
      setPasswordMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSaving(false);
    }
  };

  // Gửi lại mã OTP khi đang ở Step 2
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isSaving) return;

    setIsSaving(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      const res = await requestPasswordChangeOtpApi({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });

      setOtpCountdown(300);
      setResendCountdown(60);
      setPasswordMessage({
        type: 'success',
        text: res?.message || 'Đã gửi lại mã OTP mới đến Gmail của bạn.'
      });
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.';
      setPasswordMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSaving(false);
    }
  };

  // Step 2: Xác nhận đổi mật khẩu với mã OTP
  const handleConfirmPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (!passwordOtp || passwordOtp.length !== 6) {
      setPasswordMessage({ type: 'error', text: 'Vui lòng nhập đủ 6 chữ số mã OTP nhận từ Gmail' });
      return;
    }

    if (otpCountdown <= 0) {
      setPasswordMessage({ type: 'error', text: 'Mã OTP đã hết hạn. Vui lòng bấm Gửi lại mã OTP.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await changePasswordApi({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
        otp: passwordOtp
      });

      setPasswordStep(1);
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordOtp('');
      setOtpCountdown(0);
      setResendCountdown(0);

      setPasswordMessage({
        type: 'success',
        text: res?.message || 'Đổi mật khẩu thành công! Email xác nhận đã được gửi đến hộp thư của bạn.'
      });

      setTimeout(() => setPasswordMessage({ type: '', text: '' }), 6000);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mã OTP.';
      setPasswordMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToStep1 = () => {
    setPasswordStep(1);
    setPasswordOtp('');
    setPasswordMessage({ type: '', text: '' });
  };

  // Kích hoạt chọn file ảnh đại diện từ thiết bị
  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;
    fileInputRef.current?.click();
  };

  // Xử lý upload file ảnh khi người dùng chọn từ máy tính/điện thoại
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setInfoMessage({ type: 'error', text: t('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP, GIF).') });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setInfoMessage({ type: 'error', text: t('Kích thước ảnh không được vượt quá 5MB.') });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Xem trước tức thì (preview)
    const previewUrl = URL.createObjectURL(file);
    setProfileData((prev) => ({ ...prev, profilePictureUrl: previewUrl }));
    setAvatarImgError(false);
    setIsUploadingAvatar(true);
    setInfoMessage({ type: '', text: '' });

    try {
      const res = await uploadAvatarApi(file);
      const uploadedUrl = res.data?.profilePictureUrl;
      setProfileData((prev) => ({ ...prev, profilePictureUrl: uploadedUrl || previewUrl }));
      await refreshProfile();
      setInfoMessage({ type: 'success', text: t('Cập nhật ảnh đại diện thành công!') });
      setTimeout(() => setInfoMessage({ type: '', text: '' }), 3500);
    } catch (err) {
      console.error('Lỗi tải ảnh đại diện lên:', err);
      const errMsg = err.response?.data?.message || t('Không thể tải ảnh đại diện lên. Vui lòng thử lại.');
      setInfoMessage({ type: 'error', text: errMsg });
      setProfileData((prev) => ({
        ...prev,
        profilePictureUrl: authUser?.profilePictureUrl || authUser?.profile_picture_url || ''
      }));
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Gỡ ảnh đại diện (quay về ký tự mặc định)
  const handleRemoveAvatar = async () => {
    if (isUploadingAvatar || !profileData.profilePictureUrl) return;
    setIsUploadingAvatar(true);
    try {
      await updateProfileApi({
        username: profileData.username,
        fullName: profileData.fullName,
        profilePictureUrl: null
      });
      setProfileData((prev) => ({ ...prev, profilePictureUrl: '' }));
      setAvatarImgError(false);
      await refreshProfile();
      setInfoMessage({ type: 'success', text: t('Đã gỡ ảnh đại diện.') });
      setTimeout(() => setInfoMessage({ type: '', text: '' }), 3500);
    } catch (err) {
      const errMsg = err.response?.data?.message || t('Không thể gỡ ảnh đại diện.');
      setInfoMessage({ type: 'error', text: errMsg });
    } finally {
      setIsUploadingAvatar(false);
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
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
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
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: 'none' }}
                  />
                  <div
                    className={`avatar-container ${isUploadingAvatar ? 'is-uploading' : ''}`}
                    onClick={handleAvatarClick}
                    title={t('Bấm để đổi ảnh đại diện từ máy')}
                  >
                    {profileData.profilePictureUrl && !avatarImgError ? (
                      <img
                        src={profileData.profilePictureUrl}
                        alt="User Avatar"
                        className="profile-avatar-img"
                        onError={() => setAvatarImgError(true)}
                      />
                    ) : (
                      <div className="avatar-fallback-large">
                        {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="avatar-edit-overlay">
                      {isUploadingAvatar ? (
                        <FiLoader className="edit-icon spin" />
                      ) : (
                        <FiCamera className="edit-icon" />
                      )}
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
                  {profileData.profilePictureUrl && (
                    <div className="avatar-action-links">
                      <button
                        type="button"
                        className="avatar-action-btn btn-danger-link"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar}
                      >
                        {t('Gỡ ảnh')}
                      </button>
                    </div>
                  )}
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
                          <span className="value">
                            {statsLoading ? '...' : statsError ? '--' : `${userStats?.enrolledCourses ?? 0} Khóa học`}
                          </span>
                        </div>
                      </div>

                      <div className="profile-stat-card">
                        <div className="stat-icon-wrapper orange">
                          <FiTrendingUp />
                        </div>
                        <div className="stat-details">
                          <span className="label">Tiến trình trung bình</span>
                          <span className="value">
                            {statsLoading ? '...' : statsError ? '--' : `${userStats?.avgProgress ?? 0}%`}
                          </span>
                        </div>
                      </div>

                      <div className="profile-stat-card">
                        <div className="stat-icon-wrapper purple">
                          <FiMessageSquare />
                        </div>
                        <div className="stat-details">
                          <span className="label">Hội thoại RAG AI</span>
                          <span className="value">
                            {statsLoading ? '...' : statsError ? '--' : `${userStats?.aiChatCount ?? 0} Lượt hỏi`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="activity-summary">
                      <h3>Hoạt động gần đây</h3>
                      <div className="activity-timeline">
                        {statsLoading && (
                          <div className="timeline-item">
                            <div className="timeline-dot"></div>
                            <div className="timeline-info">
                              <span className="time">...</span>
                              <p>Đang tải dữ liệu...</p>
                            </div>
                          </div>
                        )}
                        {!statsLoading && statsError && (
                          <p style={{ color: '#f87171', fontSize: '14px' }}>{statsError}</p>
                        )}
                        {!statsLoading && !statsError && userStats && (
                          <div className="timeline-item">
                            <div className="timeline-dot"></div>
                            <div className="timeline-info">
                              <span className="time">Tổng cộng</span>
                              <p>Bạn đã hoàn thành <strong>{userStats.completedLessons}</strong> bài học, tham gia <strong>{userStats.enrolledCourses}</strong> khóa học và hỏi AI <strong>{userStats.aiChatCount}</strong> lần.</p>
                            </div>
                          </div>
                        )}
                        {!statsLoading && !statsError && !userStats && (
                          <div className="timeline-item">
                            <div className="timeline-dot"></div>
                            <div className="timeline-info">
                              <span className="time">Chưa có hoạt động</span>
                              <p>Bắt đầu học bài đầu tiên để tạo lịch sử hoạt động.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <section className="gamification-section" aria-labelledby="gamification-badges-title">
                      <div className="gamification-section-header">
                        <div>
                          <h3 id="gamification-badges-title">
                            <FiAward aria-hidden="true" />
                            Huy hiệu & Thành tích (Gamification Badges)
                          </h3>
                          <p>Tiến độ được tính trực tiếp từ hoạt động học tập đã lưu của bạn.</p>
                          {totalBadgeCount > 0 && (
                            <p className="gamification-badges-count" aria-live="polite">
                              Đã đạt {unlockedBadgeCount}/{totalBadgeCount}
                              {unlockedBadgeCount < totalBadgeCount
                                ? ` • Còn ${totalBadgeCount - unlockedBadgeCount} huy hiệu đang khóa`
                                : ' • Đã mở khóa toàn bộ!'}
                            </p>
                          )}
                        </div>
                      </div>

                      {badgesError ? (
                        <div role="alert" className="gamification-state gamification-state-error">
                          <FiAlertCircle aria-hidden="true" />
                          <p>
                            Không thể tải danh sách huy hiệu, vui lòng thử lại sau
                          </p>
                          <button
                            type="button"
                            onClick={reloadGamification}
                            disabled={isGamificationLoading}
                          >
                            <FiRefreshCw aria-hidden="true" />
                            {isGamificationLoading ? 'Đang thử lại...' : 'Thử lại'}
                          </button>
                        </div>
                      ) : isGamificationLoading && badges.length === 0 ? (
                        <div role="status" className="gamification-state">
                          <FiLoader className="animate-spin" aria-hidden="true" />
                          Đang tải danh sách huy hiệu...
                        </div>
                      ) : badges.length === 0 ? (
                        <div role="status" className="gamification-state">
                          Chưa có dữ liệu huy hiệu. Hãy hoàn thành một bài học để bắt đầu.
                        </div>
                      ) : (
                        <div className="gamification-badges-grid">
                        {(badges || []).map((badge) => (
                          <button
                            type="button"
                            key={badge.id}
                            onClick={badge.unlocked ? () => triggerBadgeUnlock(badge) : undefined}
                            disabled={!badge.unlocked}
                            className={`gamification-badge-card ${badge.unlocked ? 'is-unlocked' : 'is-locked'}`}
                            title={badge.unlocked ? 'Nhấp để mở xem huy hiệu thành tích!' : `Chưa đạt: ${getBadgeRequirementText(badge)}`}
                            aria-label={badge.unlocked ? `Huy hiệu đã đạt: ${badge.title}` : `Huy hiệu đang khóa: ${badge.title}. ${getBadgeRequirementText(badge)}`}
                          >
                            <span className="gamification-badge-icon" aria-hidden="true">
                              {badge.unlocked ? badge.icon : '🔒'}
                            </span>
                            <span className="gamification-badge-title">
                              {badge.title}
                            </span>
                            <span className="gamification-badge-description">
                              {badge.description}
                            </span>
                            <span className="gamification-badge-requirement">
                              Điều kiện: {getBadgeRequirementText(badge)}
                            </span>
                            {badge.unlocked ? (
                              <span className="gamification-badge-status is-earned">
                                <FiCheck aria-hidden="true" />
                                Đã đạt{badge.unlockedAt ? ` · ${formatBadgeDate(badge.unlockedAt)}` : ''}
                              </span>
                            ) : (
                              <>
                                <span
                                  className="gamification-badge-progress"
                                  role="progressbar"
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={getBadgeProgressPercent(badge)}
                                  aria-label={`Tiến độ ${badge.title}`}
                                >
                                  <span
                                    className="gamification-badge-progress-bar"
                                    style={{ width: `${getBadgeProgressPercent(badge)}%` }}
                                  />
                                </span>
                                <span className="gamification-badge-status">
                                  <FiLock aria-hidden="true" />
                                  {getBadgeProgressText(badge)}
                                  {getBadgeRemainingText(badge) ? ` • ${getBadgeRemainingText(badge)}` : ''}
                                </span>
                              </>
                            )}
                          </button>
                        ))}
                        </div>
                      )}
                    </section>

                  </div>
                )}

                {/* 3. Tab: Change Password */}
                {activeTab === 'password' && (
                  <div className="tab-content-wrapper animate-fade">
                    <h2>Đổi mật khẩu bảo mật</h2>
                    <p className="tab-subtitle">
                      Hệ thống bảo vệ tài khoản 2 lớp bằng mã OTP qua Gmail giúp ngăn chặn triệt để nguy cơ người lạ chiếm đoạt tài khoản.
                    </p>

                    {passwordMessage.text && (
                      <div className={`form-alert ${passwordMessage.type}`}>
                        {passwordMessage.text}
                      </div>
                    )}

                    {passwordStep === 1 ? (
                      <form onSubmit={handleRequestPasswordOtp} className="profile-form">
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
                          {isSaving ? <span className="btn-spinner"></span> : <><FiShield /> Đổi mật khẩu</>}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleConfirmPasswordChange} className="profile-form">
                        <div className="otp-verification-card">
                          <div className="otp-notice-header">
                            <div className="otp-icon-bubble">
                              <FiMail />
                            </div>
                            <div className="otp-notice-text">
                              <h4>Xác thực mã OTP bảo mật 2 lớp</h4>
                              <p>
                                Mã xác thực OTP 6 chữ số đã được gửi tới email <strong>{user?.email}</strong>. 
                                Tuyệt đối KHÔNG chia sẻ mã này cho bất kỳ ai!
                              </p>
                            </div>
                          </div>

                          <div className={`otp-timer-badge ${otpCountdown === 0 ? 'expired' : ''}`}>
                            <FiClock />
                            <span>
                              {otpCountdown > 0 
                                ? `Mã hết hạn sau: ${formatTimer(otpCountdown)}` 
                                : 'Mã OTP đã hết hạn. Vui lòng bấm Gửi lại mã OTP.'}
                            </span>
                          </div>
                        </div>

                        <div className="otp-input-wrapper">
                          <label htmlFor="passwordOtp" style={{ fontSize: '14px', fontWeight: 600 }}>
                            Nhập 6 số mã xác thực OTP
                          </label>
                          <input 
                            type="text" 
                            id="passwordOtp" 
                            name="passwordOtp"
                            className="otp-input-field"
                            placeholder="------"
                            maxLength={6}
                            value={passwordOtp}
                            onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            autoFocus
                            required 
                          />
                          <span className="otp-hint">Kiểm tra hộp thư chính hoặc mục Thư rác/Spam của Gmail</span>
                        </div>

                        <div className="otp-actions">
                          <button 
                            type="submit" 
                            className="save-btn" 
                            disabled={isSaving || passwordOtp.length !== 6 || otpCountdown <= 0}
                            style={{ margin: 0 }}
                          >
                            {isSaving ? <span className="btn-spinner"></span> : <><FiCheck /> Xác nhận đổi mật khẩu</>}
                          </button>

                          <button 
                            type="button" 
                            className="otp-resend-btn" 
                            onClick={handleResendOtp}
                            disabled={resendCountdown > 0 || isSaving}
                          >
                            <FiRefreshCw className={isSaving ? 'animate-spin' : ''} />
                            {resendCountdown > 0 ? `Gửi lại mã (${resendCountdown}s)` : 'Gửi lại mã OTP'}
                          </button>

                          <button 
                            type="button" 
                            className="otp-back-btn" 
                            onClick={handleBackToStep1}
                            disabled={isSaving}
                          >
                            <FiArrowLeft /> Quay lại sửa mật khẩu
                          </button>
                        </div>
                      </form>
                    )}
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
