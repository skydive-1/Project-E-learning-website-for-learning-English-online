import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const HASH_RETRY_DELAYS_MS = [80, 240, 600];

const getHashTargetId = (hash) => {
  if (!hash || hash === '#') return '';
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
};

/**
 * BrowserRouter does not reset scroll for client-side route transitions.
 * New modules start at the top, while query-only filters and browser
 * Back/Forward retain the user's current/native restored position.
 */
const RouteScrollManager = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousLocationRef = useRef(location);

  useLayoutEffect(() => {
    const previousLocation = previousLocationRef.current;
    const pathnameChanged = previousLocation.pathname !== location.pathname;
    const sameDestination = previousLocation.pathname === location.pathname
      && previousLocation.search === location.search;
    const isNewExactEntry = previousLocation.key !== location.key
      && sameDestination
      && navigationType === 'PUSH';
    previousLocationRef.current = location;

    if (location.hash) {
      const targetId = getHashTargetId(location.hash);
      const timers = [];
      let cancelled = false;

      if (pathnameChanged && navigationType !== 'POP') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }

      const scrollToHashTarget = () => {
        if (cancelled || !targetId) return true;
        const target = document.getElementById(targetId);
        if (!target) return false;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({
          block: 'start',
          behavior: pathnameChanged || reduceMotion ? 'auto' : 'smooth'
        });
        return true;
      };

      if (!scrollToHashTarget()) {
        HASH_RETRY_DELAYS_MS.forEach((delay) => {
          timers.push(window.setTimeout(scrollToHashTarget, delay));
        });
      }

      return () => {
        cancelled = true;
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    }

    const shouldResetScroll = navigationType !== 'POP'
      && location.state?.preserveScroll !== true
      && (pathnameChanged || isNewExactEntry);

    if (shouldResetScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    return undefined;
  }, [location, navigationType]);

  return null;
};

export default RouteScrollManager;
