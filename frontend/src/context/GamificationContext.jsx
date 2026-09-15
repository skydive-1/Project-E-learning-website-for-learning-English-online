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
  const knownUnlockedRef = useRef(new Set());
  const popupRef = useRef(null);
  useEffect(() => {
    popupRef.current = activeBadgePopup;
  }, [activeBadgePopup]);

  const hasSeenBadgeThisSession = badgeId => {
    try {
      return sessionStorage.getItem(`elear-badge-seen-${badgeId}`) === '1';
    } catch {
      return knownUnlockedRef.current.has(`seen:${badgeId}`);
    }
  };

  const markBadgeSeenThisSession = badgeId => {
    knownUnlockedRef.current.add(`seen:${badgeId}`);
    try {
      sessionStorage.setItem(`elear-badge-seen-${badgeId}`, '1');
    } catch {
      // Bỏ qua khi browser chặn storage: vẫn chống spam bằng ref trong phiên
    }
  };

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

        // Workflow tự động: phát hiện huy hiệu vừa mở khóa so với snapshot trước
        // và tự bật modal ăn mừng đúng 1 lần mỗi huy hiệu trong phiên.
        const previousUnlocked = knownUnlockedRef.current;
        const freshlyUnlocked = (summary.badges || []).filter(
          badge => badge?.unlocked && badge?.id && !previousUnlocked.has(badge.id)
        );
        (summary.badges || []).forEach(badge => {
          if (badge?.unlocked && badge?.id) previousUnlocked.add(badge.id);
        });
        const unseen = freshlyUnlocked.filter(badge => !hasSeenBadgeThisSession(badge.id));
        if (unseen.length > 0 && !popupRef.current) {
          const first = unseen[0];
          markBadgeSeenThisSession(first.id);
          setActiveBadgePopup(first);
          try {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          } catch (e) {
            console.warn('Confetti error:', e);
          }
        }
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
