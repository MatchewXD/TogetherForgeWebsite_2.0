/**
 * Lightweight first-party heartbeat. Failures are swallowed.
 * Skips the Moderator Traffic tab so staff viewing it do not inflate Active now.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { TRAFFIC_HEARTBEAT_MS } from '../../constants/traffic';
import {
  isModeratorTrafficTab,
  sanitizeTrafficPath,
} from '../../utils/trafficPath';
import { recordTrafficHeartbeat } from '../../services/trafficService';

const TrafficBeacon = () => {
  const { pathname, search } = useLocation();
  const lastPath = useRef('');
  const lastBeat = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (isModeratorTrafficTab(pathname, search)) return undefined;

    const path = sanitizeTrafficPath(pathname);
    const isPageview = lastPath.current !== path;
    lastPath.current = path;
    lastBeat.current = Date.now();
    void recordTrafficHeartbeat({ path, isPageview });

    const tick = () => {
      // Background tabs are not "active now" and must not keep writing
      if (document.visibilityState === 'hidden') return;
      if (isModeratorTrafficTab(window.location.pathname, window.location.search)) {
        return;
      }
      lastBeat.current = Date.now();
      void recordTrafficHeartbeat({
        path: sanitizeTrafficPath(window.location.pathname),
        isPageview: false,
      });
    };

    // Returning to the tab: report presence again without waiting a full interval
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastBeat.current >= TRAFFIC_HEARTBEAT_MS
      ) {
        tick();
      }
    };

    const id = window.setInterval(tick, TRAFFIC_HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname, search]);

  return null;
};

export default TrafficBeacon;
