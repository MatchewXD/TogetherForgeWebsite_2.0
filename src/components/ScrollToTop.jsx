import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll window to top on every client-side route change.
 * Fixes mid-page landings (e.g. Home "Join the work" → /get-involved).
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // In-page anchors keep browser hash scrolling
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search, hash]);

  return null;
}
