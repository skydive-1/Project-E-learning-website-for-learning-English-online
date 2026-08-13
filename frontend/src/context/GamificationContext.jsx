import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { getUserStreakInfo, getUserBadges, SYSTEM_BADGES } from '../modules/gamification/services/gamification.service';
import { useAuth } from './AuthContext';

const GamificationContext = createContext();

export const GamificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [streak, setStreak] = useState({
    currentStreak: 0,
    longestStreak: 0,
    weeklyStatus: [
      { day: 'T2', active: false, label: 'Thứ 2' },
      { day: 'T3', active: false, label: 'Thứ 3' },
      { day: 'T4', active: false, label: 'Thứ 4' },
      { day: 'T5', active: false, label: 'Thứ 5' },
      { day: 'T6', active: false, label: 'Thứ 6' },
      { day: 'T7', active: false, label: 'Thứ 7' },
      { day: 'CN', active: false, label: 'Chủ nhật' }
    ]
  });

  const [badges, setBadges] = useState(SYSTEM_BADGES);
  const [activeBadgePopup, setActiveBadgePopup] = useState(null);

  // Nạp thông tin Streak và Badges khi người dùng thay đổi hoặc ứng dụng khởi chạy
  useEffect(() => {
    const loadGamificationData = async () => {
      const uid = user?.user_id || user?.id;
      const sData = await getUserStreakInfo(uid);
      const bData = await getUserBadges(uid);
      if (sData) setStreak(sData);
      if (bData) setBadges(bData);
    };
    loadGamificationData();
  }, [user]);

  // Kích hoạt pháo hoa mừng và hiển thị Pop-up Huy hiệu
  const triggerBadgeUnlock = (badgeOrId) => {
    let badgeObj = null;
    if (typeof badgeOrId === 'string') {
      badgeObj = badges.find(b => b.id === badgeOrId) || SYSTEM_BADGES.find(b => b.id === badgeOrId);
    } else {
      badgeObj = badgeOrId;
    }

    if (!badgeObj) return;

    // Cập nhật trạng thái mở khóa huy hiệu trong state
    setBadges(prev => prev.map(b => b.id === badgeObj.id ? { ...b, unlocked: true, unlockedAt: new Date().toLocaleDateString('vi-VN') } : b));
    setActiveBadgePopup(badgeObj);

    // Kích hoạt bắn pháo hoa Confetti 3 đợt ăn mừng rực rỡ
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 250);
    } catch (e) {
      console.warn("Confetti error:", e);
    }
  };

  const closeBadgePopup = () => {
    setActiveBadgePopup(null);
  };

  return (
    <GamificationContext.Provider
      value={{
        streak,
        badges,
        activeBadgePopup,
        triggerBadgeUnlock,
        closeBadgePopup
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => useContext(GamificationContext);
