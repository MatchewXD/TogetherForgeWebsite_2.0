/**
 * Unseen in-app notices for the navbar + dashboard cards.
 * Ideas "new activity" is separate and must not drive the global avatar dot.
 */

const storageKey = (userId) => `tf_global_notice_seen_${userId || 'anon'}`;

export const REVIEWED_SUGGESTION_STATUSES = new Set([
  'accepted',
  'rejected',
  'struck',
]);

export function noticeKey(kind, id) {
  if (!kind || id == null || id === '') return '';
  return `${kind}:${id}`;
}

export function readSeenNoticeKeys(userId) {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((k) => String(k)));
  } catch {
    return new Set();
  }
}

const deletedStorageKey = (userId) =>
  `tf_dash_notices_deleted_${userId || 'anon'}`;

/** Local dismiss list for activity-log auto-release banners / inbox rows. */
export const AUTO_RELEASE_SEEN_STORAGE_KEY = 'tf_auto_release_seen';

export function readAutoReleaseSeenIds() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(AUTO_RELEASE_SEEN_STORAGE_KEY) || '[]'
    );
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

export function rememberAutoReleaseSeen(ids) {
  const incoming = (ids || []).map(String).filter(Boolean);
  if (!incoming.length) return;
  const next = [...new Set([...readAutoReleaseSeenIds(), ...incoming])].slice(
    -50
  );
  try {
    localStorage.setItem(AUTO_RELEASE_SEEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function filterUnseenAutoReleases(rows) {
  const seen = new Set(readAutoReleaseSeenIds());
  return (rows || []).filter((n) => n?.id && !seen.has(String(n.id)));
}

export function asAutoReleaseNotice(row) {
  if (!row) return null;
  return {
    ...row,
    kind: 'auto_release',
    title: row.title || row.taskTitle || '',
  };
}

export function readDeletedNoticeIds(userId) {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(deletedStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((k) => String(k)));
  } catch {
    return new Set();
  }
}

export function rememberDeletedNoticeIds(userId, ids) {
  if (!userId) return;
  const next = readDeletedNoticeIds(userId);
  for (const id of ids || []) {
    if (id) next.add(String(id));
  }
  const arr = [...next];
  const overflow = arr.length - 400;
  if (overflow > 0) arr.splice(0, overflow);
  try {
    localStorage.setItem(deletedStorageKey(userId), JSON.stringify(arr));
  } catch {
    /* ignore quota */
  }
}

export function rememberNoticeKeys(userId, keys) {
  if (!userId) return;
  const next = readSeenNoticeKeys(userId);
  for (const key of keys || []) {
    if (key) next.add(String(key));
  }
  const arr = [...next];
  const overflow = arr.length - 400;
  if (overflow > 0) arr.splice(0, overflow);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(arr));
  } catch {
    /* ignore quota */
  }
}

/**
 * Which dashboard surfaces still have unseen items.
 * @param {{
 *   joinRequests?: Array<{id: string}>,
 *   suggestions?: Array<{id: string, status?: string}>,
 *   noticeItems?: Array<{id: string}>,
 *   seen?: Set<string>,
 *   deleted?: Set<string>,
 * }} input
 */
export function summarizeUserNotices({
  joinRequests = [],
  suggestions = [],
  noticeItems = [],
  seen = new Set(),
  deleted = new Set(),
} = {}) {
  const joinUnseen = (joinRequests || []).filter(
    (row) => row?.id && !seen.has(noticeKey('join', row.id))
  );
  const suggestionUnseen = (suggestions || []).filter((row) => {
    if (!row?.id) return false;
    if (!REVIEWED_SUGGESTION_STATUSES.has(row.status)) return false;
    return !seen.has(noticeKey('suggestion', row.id));
  });
  const noticeUnseen = (noticeItems || []).filter((row) => {
    if (!row?.id) return false;
    if (deleted.has(String(row.id))) return false;
    if (row.readAt || row.read_at) return false;
    return !seen.has(noticeKey('notice', row.id));
  });

  const joinRequestsFlag = joinUnseen.length > 0;
  const suggestionsFlag = suggestionUnseen.length > 0;
  const noticesCard = noticeUnseen.length > 0;

  return {
    joinRequests: joinRequestsFlag,
    suggestions: suggestionsFlag,
    noticesCard,
    global: joinRequestsFlag || suggestionsFlag || noticesCard,
    joinIds: joinUnseen.map((row) => row.id),
    suggestionIds: suggestionUnseen.map((row) => row.id),
    noticeIds: noticeUnseen.map((row) => row.id),
  };
}

export function pingUserNotices() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('tf-user-notices-refresh'));
}

/** Open staff queues (suggestions, scope, reports, bugs). Independent of member inbox. */
export function hasStaffQueuePin(staffAttention) {
  return (Number(staffAttention?.total) || 0) > 0;
}

/** Member dashboard inbox only. Must not include staff queues. */
export function hasMemberNoticePin(summary) {
  return Boolean(summary?.global);
}

/** Avatar marker: member inbox or staff queues. */
export function hasAvatarNoticePin(summary) {
  return hasMemberNoticePin(summary) || hasStaffQueuePin(summary?.staffAttention);
}

/**
 * Which account-menu rows get a pin.
 * Staff queues go on Moderator Dashboard, never on Dashboard.
 */
export function menuNoticeTargets(summary) {
  return {
    dashboard: hasMemberNoticePin(summary),
    moderatorDashboard: hasStaffQueuePin(summary?.staffAttention),
  };
}

export function keysFromNoticeSummary(summary) {
  if (!summary) return [];
  return [
    ...(summary.joinIds || []).map((id) => noticeKey('join', id)),
    ...(summary.suggestionIds || []).map((id) => noticeKey('suggestion', id)),
  ];
}
