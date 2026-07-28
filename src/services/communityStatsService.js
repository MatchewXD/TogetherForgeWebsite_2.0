/**
 * Community / Home momentum stats - lightweight exact counts from Supabase.
 * Each metric fails open to 0 so the Home UI never shows "n/a".
 */

import { supabase } from '../lib/supabase';

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

/**
 * Volunteers: prefer profiles (registered community members).
 * Fallback: distinct users who have ever claimed a task (if profiles not readable).
 */
async function countVolunteers() {
  const fromProfiles = await exactCount('profiles');
  if (fromProfiles > 0) return fromProfiles;

  // Fallback when profiles select is restricted but claims are visible
  try {
    const { data, error } = await supabase
      .from('task_claims')
      .select('user_id');
    if (error) {
      console.warn('[communityStats] volunteer fallback failed:', error.message || error);
      return 0;
    }
    const ids = new Set(
      (data || []).map((r) => r.user_id).filter((id) => id != null && id !== '')
    );
    return ids.size;
  } catch (err) {
    console.warn('[communityStats] volunteer fallback error:', err);
    return 0;
  }
}

/**
 * Active projects: In Development / Active (not Planning / Vision / archived).
 * If status filter yields nothing but rows exist, fall back to phase = Early.
 */
async function countActiveProjects() {
  const byStatus = await exactCount('projects', (q) =>
    q.in('status', ['In Development', 'Active', 'active', 'Live', 'live'])
  );
  if (byStatus > 0) return byStatus;

  const byPhase = await exactCount('projects', (q) =>
    q.ilike('phase', 'early')
  );
  if (byPhase > 0) return byPhase;

  // Last resort: total projects (still a real count, never "n/a")
  return exactCount('projects');
}

/**
 * Tasks claimed: Active + Completed (real claim work). Falls back to all rows.
 */
async function countTasksClaimed() {
  const meaningful = await exactCount('task_claims', (q) =>
    q.in('status', ['Active', 'Completed'])
  );
  if (meaningful > 0) return meaningful;
  return exactCount('task_claims');
}

/**
 * Live Community section stats for the Home page.
 * @returns {Promise<{
 *   volunteers: number,
 *   ideasSubmitted: number,
 *   activeProjects: number,
 *   tasksClaimed: number,
 * }>}
 */
export async function getHomeCommunityStats() {
  const [volunteers, ideasSubmitted, activeProjects, tasksClaimed] =
    await Promise.all([
      countVolunteers(),
      exactCount('ideas'),
      countActiveProjects(),
      countTasksClaimed(),
    ]);

  return {
    volunteers,
    ideasSubmitted,
    activeProjects,
    tasksClaimed,
  };
}

export const communityStatsService = {
  getHomeCommunityStats,
};

export default communityStatsService;
