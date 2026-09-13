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
import { dashboardNoticesService } from '../services/dashboardNoticesService';
import { openQuestionsService } from '../services/openQuestionsService';
import {
  keysFromNoticeSummary,
  readDeletedNoticeIds,
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

function filterLegacyClaimSplits(splits) {
  let seen = [];
  try {
    seen = JSON.parse(localStorage.getItem('tf_claim_split_seen') || '[]');
  } catch {
    seen = [];
  }
  return (splits || []).filter((n) => n?.id && !seen.includes(n.id));
}

async function loadNoticeItems() {
  const [joinRequests, suggestions, claimSplits, inbox, hiddenReplies] =
    await Promise.all([
      tasksService.listMyPendingJoinRequests().catch(() => []),
      taskSuggestionsService.listMine().catch(() => []),
      tasksService.listMyRecentClaimSplits({ days: 14, limit: 20 }).catch(() => []),
      dashboardNoticesService.listMine({ limit: 30 }).catch((err) => {
        console.warn('[notices] dashboard inbox', err);
        return [];
      }),
      openQuestionsService.listMyHiddenReplyNotices({ limit: 20 }).catch((err) => {
        console.warn('[notices] hidden OQ replies', err);
        return [];
      }),
    ]);
  const inboxSourceIds = new Set(
    (inbox || []).map((n) => n.sourceId).filter(Boolean)
  );
  const fallbackHides = (hiddenReplies || []).filter(
    (n) => n?.replyId && !inboxSourceIds.has(n.replyId)
  );
  return {
    joinRequests: joinRequests || [],
    suggestions: suggestions || [],
    noticeItems: [
      ...(inbox || []),
      ...fallbackHides,
      ...filterLegacyClaimSplits(claimSplits).map((n) => ({
        ...n,
        kind: n.kind || 'claim',
      })),
    ],
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
      deleted: readDeletedNoticeIds(uid),
    });
    setFlags(next);
    return next;
  }, []);

  const ingestItems = useCallback((items) => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid = user?.id;
      if (!uid) return;
      const next = summarizeUserNotices({
        joinRequests: items?.joinRequests || [],
        suggestions: items?.suggestions || [],
        noticeItems: items?.noticeItems || [],
        seen: readSeenNoticeKeys(uid),
        deleted: readDeletedNoticeIds(uid),
      });
      setFlags(next);
    })();
  }, []);

  const markDashboardSeen = useCallback(() => {
    if (!userId) return;
    rememberNoticeKeys(userId, keysFromNoticeSummary(flagsRef.current));
    void refresh();
  }, [userId, refresh]);

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
    const channel = supabase
      .channel(`dashboard-notices:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dashboard_notices',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      window.removeEventListener('tf-user-notices-refresh', onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(poll);
      supabase.removeChannel(channel);
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
