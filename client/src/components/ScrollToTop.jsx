import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname, search, hash, key } = useLocation();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    const timers = [0, 80, 200].map((delay) => window.setTimeout(resetScroll, delay));

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname, search, hash, key]);

  return null;
};

export default ScrollToTop;
