/**
 * Global unread notices (avatar + dashboard cards).
 * Does not include Ideas new-activity.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import tasksService from '../services/tasksService';
import { taskSuggestionsService } from '../services/taskSuggestionsService';
import {
  keysFromNoticeSummary,
  readSeenNoticeKeys,
  rememberNoticeKeys,
  summarizeUserNotices,
} from '../utils/userNotices';

const EMPTY = {
  joinRequests: false,
  suggestions: false,
  noticesCard: false,
  global: false,
  joinIds: [],
  suggestionIds: [],
  noticeIds: [],
};

const UserNoticesContext = createContext({
  ...EMPTY,
  refresh: async () => {},
  ingestItems: () => {},
  markDashboardSeen: () => {},
});

async function loadNoticeItems() {
  const [joinRequests, suggestions, noticeItems] = await Promise.all([
    tasksService.listMyPendingJoinRequests().catch(() => []),
    taskSuggestionsService.listMine().catch(() => []),
    tasksService.listMyRecentClaimSplits({ days: 14, limit: 20 }).catch(() => []),
  ]);
  return {
    joinRequests: joinRequests || [],
    suggestions: suggestions || [],
    noticeItems: noticeItems || [],
  };
}

export function UserNoticesProvider({ children }) {
  const location = useLocation();
  const [userId, setUserId] = useState(null);
  const [flags, setFlags] = useState(EMPTY);
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const pathRef = useRef(location.pathname);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id || null;
    if (!uid) {
      setFlags(EMPTY);
      return EMPTY;
    }
    const items = await loadNoticeItems();
    const next = summarizeUserNotices({
      ...items,
      seen: readSeenNoticeKeys(uid),
    });
    setFlags(next);
    return next;
  }, []);

  const ingestItems = useCallback(
    (items) => {
      if (!userId) return;
      const next = summarizeUserNotices({
        joinRequests: items?.joinRequests || [],
        suggestions: items?.suggestions || [],
        noticeItems: items?.noticeItems || [],
        seen: readSeenNoticeKeys(userId),
      });
      setFlags(next);
    },
    [userId]
  );

  const markDashboardSeen = useCallback(() => {
    if (!userId) return;
    rememberNoticeKeys(userId, keysFromNoticeSummary(flagsRef.current));
    setFlags(EMPTY);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data?.session?.user?.id || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'SIGNED_OUT' ||
          event === 'USER_UPDATED' ||
          event === 'TOKEN_REFRESHED'
        ) {
          setUserId(session?.user?.id || null);
        }
      }
    );
    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setFlags(EMPTY);
      return undefined;
    }
    void refresh();
    const onRefresh = () => {
      void refresh();
    };
    window.addEventListener('tf-user-notices-refresh', onRefresh);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30000);
    return () => {
      window.removeEventListener('tf-user-notices-refresh', onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(poll);
    };
  }, [userId, refresh]);

  useEffect(() => {
    const prev = pathRef.current;
    pathRef.current = location.pathname;
    const wasDashboard = prev === '/dashboard' || prev.startsWith('/dashboard/');
    const onDashboard =
      location.pathname === '/dashboard' ||
      location.pathname.startsWith('/dashboard/');
    if (wasDashboard && !onDashboard) {
      markDashboardSeen();
    } else if (userId) {
      void refresh();
    }
  }, [location.pathname, markDashboardSeen, refresh, userId]);

  const value = useMemo(
    () => ({
      ...flags,
      refresh,
      ingestItems,
      markDashboardSeen,
    }),
    [flags, refresh, ingestItems, markDashboardSeen]
  );

  return (
    <UserNoticesContext.Provider value={value}>
      {children}
    </UserNoticesContext.Provider>
  );
}

export function useUserNotices() {
  return useContext(UserNoticesContext);
}
