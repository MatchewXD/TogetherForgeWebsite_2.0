/**
 * Community / Home momentum stats.
 * Prefers get_public_community_stats() (members, ideas, supporters, tasks).
 * Each metric fails open to 0 so the Home UI never shows "n/a".
 */

import { supabase } from '../lib/supabase';
import {
  getPublicFundContributors,
  uniqueContributorsFromLocal,
} from './donationsService';

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
};

export default communityStatsService;
