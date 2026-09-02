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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (isModeratorTrafficTab(pathname, search)) return undefined;

    const path = sanitizeTrafficPath(pathname);
    const isPageview = lastPath.current !== path;
    lastPath.current = path;
    void recordTrafficHeartbeat({ path, isPageview });

    const tick = () => {
      if (isModeratorTrafficTab(window.location.pathname, window.location.search)) {
        return;
      }
      void recordTrafficHeartbeat({
        path: sanitizeTrafficPath(window.location.pathname),
        isPageview: false,
      });
    };

    const id = window.setInterval(tick, TRAFFIC_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [pathname, search]);

  return null;
};

export default TrafficBeacon;
