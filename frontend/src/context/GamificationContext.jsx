import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { getGamificationSummary } from '../modules/gamification/services/gamification.service';
import { useAuth } from './AuthContext';

const GamificationContext = createContext();

export const GamificationProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? user?.user_id ?? null;
  const [streak, setStreak] = useState(null);
  const [badges, setBadges] = useState([]);
  const [streakError, setStreakError] = useState(null);
  const [badgesError, setBadgesError] = useState(null);
  const [isGamificationLoading, setIsGamificationLoading] = useState(false);
  const [activeBadgePopup, setActiveBadgePopup] = useState(null);
  const loadGeneration = useRef(0);
  const activeRequest = useRef(null);

  // Nạp thông tin Streak và Badges khi người dùng thay đổi hoặc ứng dụng khởi chạy
  const reloadGamification = useCallback(async () => {
    if (!userId) {
      loadGeneration.current += 1;
      activeRequest.current = null;
      setStreak(null);
      setBadges([]);
      setStreakError(null);
      setBadgesError(null);
      setIsGamificationLoading(false);
      return;
    }

    if (activeRequest.current?.userId === userId) {
      return activeRequest.current.promise;
    }

    const requestId = ++loadGeneration.current;

    setIsGamificationLoading(true);
    setStreakError(null);
    setBadgesError(null);

    const promise = getGamificationSummary()
      .then(summary => {
        if (requestId !== loadGeneration.current) return;

        setStreak(summary.streak);
        setBadges(summary.badges);
      })
      .catch(error => {
        if (requestId !== loadGeneration.current) return;

        setStreak(null);
        setBadges([]);
        setStreakError(error);
        setBadgesError(error);
      })
      .finally(() => {
        if (activeRequest.current?.promise === promise) {
          activeRequest.current = null;
        }
        if (requestId === loadGeneration.current) {
          setIsGamificationLoading(false);
        }
      });

    activeRequest.current = { userId, promise };
    return promise;
  }, [userId]);

  useEffect(() => {
    reloadGamification();
    return () => {
      loadGeneration.current += 1;
    };
  }, [reloadGamification]);

  // Kích hoạt pháo hoa mừng và hiển thị Pop-up Huy hiệu
  const triggerBadgeUnlock = (badgeOrId) => {
    let badgeObj = null;
    if (typeof badgeOrId === 'string') {
      badgeObj = badges.find(b => b.id === badgeOrId);
    } else {
      badgeObj = badgeOrId;
    }

    if (!badgeObj?.unlocked) return;

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
        streakError,
        badgesError,
        isGamificationLoading,
        reloadGamification,
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
