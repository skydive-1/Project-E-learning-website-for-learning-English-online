import { useEffect, useRef } from 'react';
import { sendStudyHeartbeat } from '../../analytics/services/analytics.service';

/**
 * Hook useStudyTimeTracker - Đo lường chính xác thời gian học thực tế (Minute-by-Minute Real-Time Tracker)
 * 
 * @param {string|number} lessonId - ID của bài học hiện tại
 * @param {boolean} isVideoPlaying - Trạng thái video đang phát (đối với bài học Video)
 * @param {string} activityType - 'video' | 'pdf' | 'speaking' | 'quiz'
 */
export const useStudyTimeTracker = (lessonId, isVideoPlaying = true, activityType = 'video') => {
  const accumulatedSecondsRef = useRef(0);
  const isIdleRef = useRef(false);
  const lastActivityTimestampRef = useRef(Date.now());
  const intervalRef = useRef(null);

  // Flush remaining study time to server
  const flushHeartbeat = () => {
    const secondsToFlush = accumulatedSecondsRef.current;
    if (secondsToFlush >= 3 && lessonId) {
      accumulatedSecondsRef.current = 0;
      sendStudyHeartbeat(lessonId, secondsToFlush, activityType);
    }
  };

  useEffect(() => {
    if (!lessonId) return;

    // Reset accumulated time for new lesson
    accumulatedSecondsRef.current = 0;
    isIdleRef.current = false;
    lastActivityTimestampRef.current = Date.now();

    // User activity listener to avoid recording idle/AFK time
    const handleUserActivity = () => {
      lastActivityTimestampRef.current = Date.now();
      isIdleRef.current = false;
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // 1-second interval timer to track actual active study seconds
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const isDocumentActive = !document.hidden;
      const isWindowFocused = document.hasFocus ? document.hasFocus() : true;
      const isNotIdle = (now - lastActivityTimestampRef.current) < 90000; // Idle after 90s without interaction

      // Only count active seconds if tab is visible, focused, and not idle
      // For video lessons: also check isVideoPlaying
      const isActive = isDocumentActive && isWindowFocused && isNotIdle && (activityType !== 'video' || isVideoPlaying);

      if (isActive) {
        accumulatedSecondsRef.current += 1;

        // Gửi nhịp Heartbeat mỗi 30 giây học thực tế
        if (accumulatedSecondsRef.current >= 30) {
          flushHeartbeat();
        }
      }
    }, 1000);

    // Visibility change / Page unload handler
    const handleVisibilityOrUnload = () => {
      if (document.hidden) {
        flushHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleVisibilityOrUnload);

    return () => {
      // Cleanup on unmount or lesson change
      flushHeartbeat();
      if (intervalRef.current) clearInterval(intervalRef.current);
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleVisibilityOrUnload);
    };
  }, [lessonId, isVideoPlaying, activityType]);
};

export default useStudyTimeTracker;
