/**
 * Community / Home momentum stats.
 * Prefers get_public_community_stats() (members, ideas, supporters, tasks).
 * Each metric fails open to 0 so the Home UI never shows "n/a".
 */

import { supabase } from '../lib/supabase';
import { initialsFromName } from '../utils/avatarUtils';
import {
  getPublicFundContributors,
  uniqueContributorsFromLocal,
} from './donationsService';

const HOME_ACTIVITY_LIMIT = 6;
const HOME_TASK_ACTIONS = [
  'claimed',
  'completed',
  'submitted_for_review',
  'review_accepted',
  'published',
];

const TASK_ACTION_LABELS = {
  claimed: 'claimed',
  completed: 'completed',
  submitted_for_review: 'submitted for review',
  review_accepted: 'accepted',
  published: 'published to the public board',
};

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function pickNestedProfile(source) {
  if (!source) return null;
  const raw = source.profiles ?? source.profile ?? source;
  if (Array.isArray(raw)) return raw[0] || null;
  if (
    raw &&
    typeof raw === 'object' &&
    (raw.username !== undefined || raw.avatar_url !== undefined)
  ) {
    return raw;
  }
  return null;
}

function mapPerson(profile, fallback = 'Someone') {
  const username = profile?.username || fallback;
  const avatarUrl =
    (typeof profile?.avatar_url === 'string' && profile.avatar_url.trim()) ||
    (typeof profile?.avatarUrl === 'string' && profile.avatarUrl.trim()) ||
    null;
  const pinned = profile?.pinned_badge_key || profile?.pinnedBadgeKey || null;
  return {
    user: username,
    username,
    userInitials: initialsFromName(username),
    avatarUrl,
    avatar_url: avatarUrl,
    pinnedBadgeKey: pinned,
    pinned_badge_key: pinned,
  };
}

function isDraftIdeaRow(idea) {
  if (!idea) return true;
  return String(idea.status || '').trim().toLowerCase() === 'draft';
}

function isPublicTaskRow(row, taskMetaById) {
  if (!row?.target_id) return true;
  const meta = taskMetaById.get(String(row.target_id));
  if (!meta) return true;
  if (meta.staffOnly) return false;
  return String(meta.boardScope || 'public') !== 'staging';
}

/**
 * Merge public task log + published ideas into Home Recent Activity rows.
 * Staging / staff-only tasks and draft ideas stay out.
 */
export function assembleHomeActivity({
  taskRows = [],
  taskMetaById = new Map(),
  ideaRows = [],
  profileMap = {},
  limit = HOME_ACTIVITY_LIMIT,
} = {}) {
  const items = [];

  for (const row of taskRows || []) {
    if (!HOME_TASK_ACTIONS.includes(row.action)) continue;
    if (!isPublicTaskRow(row, taskMetaById)) continue;
    const person = mapPerson(pickNestedProfile(row));
    items.push({
      id: row.id,
      ...person,
      action: TASK_ACTION_LABELS[row.action] || row.action,
      target: row.target_title || 'a task',
      time: relativeTime(row.created_at),
      createdAt: row.created_at,
    });
  }

  for (const row of ideaRows || []) {
    if (isDraftIdeaRow(row)) continue;
    const person = mapPerson(profileMap[row.user_id] || null);
    items.push({
      id: `idea-${row.id}`,
      ...person,
      action: 'submitted an idea',
      target: row.title || 'an idea',
      time: relativeTime(row.created_at),
      createdAt: row.created_at,
    });
  }

  return items
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, Math.max(1, Number(limit) || HOME_ACTIVITY_LIMIT));
}

async function loadProfileMap(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, pinned_badge_key')
    .in('id', ids);
  if (error) {
    console.warn('[communityStats] activity profiles', error.message);
    return {};
  }
  const map = {};
  for (const row of data || []) map[row.id] = row;
  return map;
}

async function loadPublicTaskMeta(taskIds) {
  const ids = [...new Set((taskIds || []).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  let { data, error } = await supabase
    .from('tasks')
    .select('id, board_scope, staff_only')
    .in('id', ids);
  if (error && /board_scope|staff_only/i.test(error.message || '')) {
    const retry = await supabase.from('tasks').select('id').in('id', ids);
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    console.warn('[communityStats] activity tasks', error.message);
    return map;
  }
  for (const row of data || []) {
    map.set(String(row.id), {
      boardScope: row.board_scope || 'public',
      staffOnly: Boolean(row.staff_only),
    });
  }
  return map;
}

/**
 * Live Recent Activity for the Home page (public board + published ideas).
 * Never returns demo names — empty list if nothing is public yet.
 */
export async function getHomeRecentActivity({ limit = HOME_ACTIVITY_LIMIT } = {}) {
  const take = Math.max(1, Number(limit) || HOME_ACTIVITY_LIMIT);
  let taskRows = [];
  let ideaRows = [];

  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select(
        'id, project_id, user_id, action, target_type, target_id, target_title, metadata, created_at, profiles ( username, avatar_url, pinned_badge_key )'
      )
      .in('action', HOME_TASK_ACTIONS)
      .order('created_at', { ascending: false })
      .limit(Math.max(24, take * 4));
    if (error) {
      console.warn('[communityStats] activity_log', error.message);
    } else {
      taskRows = data || [];
    }
  } catch (err) {
    console.warn('[communityStats] activity_log', err);
  }

  try {
    const { data, error } = await supabase
      .from('ideas')
      .select('id, title, user_id, created_at, status')
      .neq('status', 'Draft')
      .order('created_at', { ascending: false })
      .limit(take);
    if (error && /status/i.test(error.message || '')) {
      const retry = await supabase
        .from('ideas')
        .select('id, title, user_id, created_at, status')
        .order('created_at', { ascending: false })
        .limit(take);
      ideaRows = (retry.data || []).filter((row) => !isDraftIdeaRow(row));
    } else if (error) {
      console.warn('[communityStats] ideas activity', error.message);
    } else {
      ideaRows = data || [];
    }
  } catch (err) {
    console.warn('[communityStats] ideas activity', err);
  }

  const taskMetaById = await loadPublicTaskMeta(
    taskRows.map((r) => r.target_id)
  );
  const profileMap = await loadProfileMap(ideaRows.map((r) => r.user_id));
  return assembleHomeActivity({
    taskRows,
    taskMetaById,
    ideaRows,
    profileMap,
    limit: take,
  });
}

/** @returns {Promise<number>} */
async function exactCount(table, apply = (q) => q) {
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    query = apply(query) || query;
    const { count, error } = await query;
    if (error) {
      console.warn(`[communityStats] ${table} count failed:`, error.message || error);
      return 0;
    }
    return typeof count === 'number' ? count : 0;
  } catch (err) {
    console.warn(`[communityStats] ${table} count error:`, err);
    return 0;
  }
}

function uniqueLocalSupporters() {
  const named = [
    ...uniqueContributorsFromLocal('studio'),
    ...uniqueContributorsFromLocal('runway'),
  ];
  const keys = new Set();
  for (const row of named) {
    const key = String(row.username || row.displayName || '')
      .trim()
      .toLowerCase();
    if (key) keys.add(`name:${key}`);
  }
  return keys.size;
}

async function countSupportersFallback() {
  try {
    const [studio, runway] = await Promise.all([
      getPublicFundContributors('studio'),
      getPublicFundContributors('runway'),
    ]);
    const keys = new Set();
    for (const row of [...(studio.items || []), ...(runway.items || [])]) {
      const key = String(row.username || row.displayName || '')
        .trim()
        .toLowerCase();
      if (key) keys.add(`name:${key}`);
    }
    if (keys.size > 0) return keys.size;
  } catch (err) {
    console.warn('[communityStats] supporter fallback failed:', err);
  }
  return uniqueLocalSupporters();
}

async function fallbackStats() {
  const [members, ideasSubmitted, supporters, tasksCompleted] =
    await Promise.all([
      exactCount('profiles'),
      exactCount('ideas', (q) => q.neq('status', 'Draft')),
      countSupportersFallback(),
      exactCount('tasks', (q) => q.eq('status', 'Completed')),
    ]);
  const ideas =
    ideasSubmitted > 0 ? ideasSubmitted : await exactCount('ideas');
  const tasks =
    tasksCompleted > 0
      ? tasksCompleted
      : await exactCount('task_claims', (q) => q.eq('status', 'Completed'));
  return {
    members,
    ideasSubmitted: ideas,
    supporters,
    tasksCompleted: tasks,
    source: 'fallback',
  };
}

function mapRpc(row) {
  return {
    members: Number(row.members) || 0,
    ideasSubmitted: Number(row.ideas_submitted ?? row.ideasSubmitted) || 0,
    supporters: Number(row.supporters) || 0,
    tasksCompleted: Number(
      row.tasks_completed ?? row.tasksCompleted ?? 0
    ),
    source: 'supabase',
  };
}

/**
 * Live Community Pulse stats for the Home page.
 * @returns {Promise<{
 *   members: number,
 *   ideasSubmitted: number,
 *   supporters: number,
 *   tasksCompleted: number,
 *   source: 'supabase'|'fallback',
 * }>}
 */
export async function getHomeCommunityStats() {
  try {
    const { data, error } = await supabase.rpc('get_public_community_stats');
    if (!error && data && typeof data === 'object') {
      const mapped = mapRpc(data);
      if (
        mapped.members > 0 ||
        mapped.ideasSubmitted > 0 ||
        mapped.supporters > 0 ||
        mapped.tasksCompleted > 0
      ) {
        return mapped;
      }
    }
    if (error) {
      console.warn(
        '[communityStats] RPC failed:',
        error.message || error
      );
    }
  } catch (err) {
    console.warn('[communityStats] RPC error:', err);
  }
  return fallbackStats();
}

export const communityStatsService = {
  getHomeCommunityStats,
  getHomeRecentActivity,
};

export default communityStatsService;
