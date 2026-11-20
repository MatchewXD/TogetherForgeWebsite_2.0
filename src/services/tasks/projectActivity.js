/**
 * tasksService: project activity feed, pulse stats, shoutouts.
 * Part of the tasks service; import from '../tasksService' in app code.
 */

import { supabase } from '../../lib/supabase';
import { initialsFromName } from '../../utils/avatarUtils';
import { BOARD_SCOPE_PUBLIC, BOARD_SCOPE_STAGING } from './taskModel';
import {
  relativeTime,
  pickProfile,
  profileAvatarUrl,
  isVisibleProjectHubActivity,
  mapActivityRow,
} from './taskMappers';

export const projectActivityMethods = {
  async getActivityForProject(projectId, { limit = 20 } = {}) {
    if (!projectId) return [];
    const cap = Math.max(1, Number(limit) || 20);
    const { data, error } = await supabase
      .from('activity_log')
      .select(
        `
        id,
        project_id,
        user_id,
        action,
        target_type,
        target_id,
        target_title,
        created_at,
        profiles (
          username,
          avatar_url,
          pinned_badge_key
        )
      `
      )
      .eq('project_id', projectId)
      .neq('action', 'updated progress on')
      .neq('action', 'progress')
      .order('created_at', { ascending: false })
      .limit(cap);
    if (error) throw error;
    return (data || [])
      .filter((row) => isVisibleProjectHubActivity(row.action))
      .slice(0, cap)
      .map(mapActivityRow);
  },

  /**
   * Project Pulse metrics for workspace header:
   * - contributors: unique people from Contributors data (tasks, donations, credits)
   * - tasksCompleted: total Completed tasks on this project
   * - openTasks: tasks available to claim (ToDo)
   * Also returns activeWorkers for the optional “On the forge now” strip.
   */
  async getProjectPulse(projectId) {
    const empty = {
      contributors: 0,
      tasksCompleted: 0,
      openTasks: 0,
      activeWorkers: [],
      // legacy keys kept so older UI does not crash
      activePeople: 0,
      tasksThisWeek: 0,
      tasksThisMonth: 0,
      recentWins: 0,
    };
    if (!projectId) return empty;

    try {
      const {
        isDemoReleaseEnabled,
        isDemoReleaseKey,
        getDemoReleasePulse,
      } = await import('../../data/demoReleasedGame');
      if (isDemoReleaseEnabled() && isDemoReleaseKey(projectId)) {
        return getDemoReleasePulse();
      }
    } catch {
      /* ignore */
    }

    // --- Task counts + active claimers ---
    let pulseSelect = `
        id,
        status,
        board_scope,
        archived_at,
        task_claims (
          id,
          user_id,
          status,
          profiles!user_id ( username, avatar_url, pinned_badge_key )
        )
      `;
    let { data: taskRows, error: taskErr } = await supabase
      .from('tasks')
      .select(pulseSelect)
      .eq('project_id', projectId)
      .eq('board_scope', BOARD_SCOPE_PUBLIC);

    if (taskErr && /archived_at/i.test(taskErr.message || '')) {
      const retry = await supabase
        .from('tasks')
        .select(
          pulseSelect.replace(/archived_at,\s*/g, '')
        )
        .eq('project_id', projectId)
        .eq('board_scope', BOARD_SCOPE_PUBLIC);
      taskRows = retry.data;
      taskErr = retry.error;
    }

    if (taskErr && /board_scope/i.test(taskErr.message || '')) {
      const retry = await supabase
        .from('tasks')
        .select(
          `
        id,
        status,
        task_claims (
          id,
          user_id,
          status,
          profiles!user_id ( username, avatar_url, pinned_badge_key )
        )
      `
        )
        .eq('project_id', projectId);
      taskRows = retry.data;
      taskErr = retry.error;
    }

    if (taskErr) throw taskErr;

    let tasksCompleted = 0;
    let openTasks = 0;
    const workerMap = new Map();
    const claimerIds = new Set();

    for (const t of taskRows || []) {
      if (t.archived_at) continue;
      if (String(t.board_scope || BOARD_SCOPE_PUBLIC) === BOARD_SCOPE_STAGING) {
        continue;
      }
      const st = String(t.status || '');
      if (st === 'Completed') tasksCompleted += 1;
      if (st === 'ToDo') openTasks += 1;

      for (const c of t.task_claims || []) {
        if (!c.user_id) continue;
        claimerIds.add(c.user_id);
        const claimActive =
          c.status === 'Active' || c.status === 'PendingReview';
        const taskHot =
          st === 'InProgress' || st === 'InReview' || st === 'PendingReview';
        if (claimActive && taskHot && !workerMap.has(c.user_id)) {
          const profile = pickProfile(c);
          const username = profile?.username || 'Volunteer';
          const avatarUrl = profileAvatarUrl(profile);
          const pinnedBadgeKey =
            profile?.pinned_badge_key || profile?.pinnedBadgeKey || null;
          workerMap.set(c.user_id, {
            userId: c.user_id,
            username,
            avatarUrl,
            avatar_url: avatarUrl,
            pinnedBadgeKey,
            pinned_badge_key: pinnedBadgeKey,
            initials: initialsFromName(username),
          });
        }
      }
    }

    // --- Unique contributors (same sources as Contributors page) ---
    const people = new Set();
    for (const uid of claimerIds) {
      people.add(`u:${uid}`);
    }

    try {
      // Lazy require avoids circular import at module load if bundler reorders
      const { getProjectCredits } = await import('../contributorsService');
      const credits = await getProjectCredits(projectId);
      for (const d of credits?.donations?.namedDonors || []) {
        if (d.userId) people.add(`u:${d.userId}`);
        else if (d.displayName || d.username) {
          people.add(
            `n:${String(d.displayName || d.username)
              .trim()
              .toLowerCase()}`
          );
        }
      }
      for (const cat of ['development', 'marketing', 'community']) {
        for (const row of credits?.[cat] || []) {
          if (row.userId) people.add(`u:${row.userId}`);
          else if (row.displayName || row.username) {
            people.add(
              `n:${String(row.displayName || row.username)
                .trim()
                .toLowerCase()}`
            );
          }
        }
      }
    } catch (err) {
      console.warn('[tasksService.getProjectPulse] contributors', err);
    }

    // Manual credits table (covers rows not yet in getProjectCredits edge cases)
    try {
      const { data: contribRows } = await supabase
        .from('project_contributions')
        .select('user_id, display_name, is_anonymous, category')
        .eq('project_id', projectId);
      for (const r of contribRows || []) {
        if (r.is_anonymous) continue;
        if (r.user_id) people.add(`u:${r.user_id}`);
        else if (r.display_name) {
          people.add(`n:${String(r.display_name).trim().toLowerCase()}`);
        }
      }
    } catch {
      /* table may not exist */
    }

    const contributors = people.size;

    return {
      contributors,
      tasksCompleted,
      openTasks,
      activeWorkers: [...workerMap.values()],
      activePeople: contributors,
      tasksThisWeek: tasksCompleted,
      tasksThisMonth: tasksCompleted,
      recentWins: openTasks,
    };
  },

  /**
   * Public shoutouts for the project hub:
   * - Recent task completions (one card per completion event — same person can
   *   appear more than once for different tasks)
   * - Named donors + one Anonymous supporters card when anonymous credit
   *   exists (same attribution as Contributors / getProjectCredits — no amounts)
   *
   * @param {number} [opts.limit=8] - max task-completion shoutouts (donors append)
   */
  async getShoutouts(projectId, { limit = 8 } = {}) {
    if (!projectId) return [];

    const taskLimit = Math.max(1, Number(limit) || 8);

    let completionRows = [];
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select(
          `
          id,
          action,
          target_title,
          created_at,
          user_id,
          profiles ( username, avatar_url, pinned_badge_key )
        `
        )
        .eq('project_id', projectId)
        .eq('action', 'completed')
        .order('created_at', { ascending: false })
        .limit(taskLimit);
      if (error) throw error;
      completionRows = data || [];
    } catch (err) {
      console.warn('[tasksService.getShoutouts] activity', err);
    }

    // One shoutout per completion event (do not collapse by person)
    const shippers = completionRows.map((row) => {
      const profile = pickProfile(row);
      const name = profile?.username || 'Volunteer';
      const avatarUrl = profileAvatarUrl(profile);
      const pinnedBadgeKey =
        profile?.pinned_badge_key || profile?.pinnedBadgeKey || null;
      return {
        id: `task-${row.id}`,
        userId: row.user_id || null,
        username: profile?.username || null,
        name,
        initials: initialsFromName(name),
        avatarUrl,
        avatar_url: avatarUrl,
        pinnedBadgeKey,
        pinned_badge_key: pinnedBadgeKey,
        note: `Shipped “${row.target_title || 'a task'}” - thanks for moving the forge forward!`,
        role: 'Contributor',
        kind: 'task',
        time: relativeTime(row.created_at),
      };
    });

    let namedDonors = [];
    let anonymousCents = 0;
    try {
      const { getProjectCredits } = await import('../contributorsService');
      const credits = await getProjectCredits(projectId);
      namedDonors = credits?.donations?.namedDonors || [];
      anonymousCents = Number(credits?.donations?.anonymousCents) || 0;
    } catch (err) {
      console.warn('[tasksService.getShoutouts] donations', err);
    }

    // Unique named donors only (one supporter card each)
    const seenDonors = new Set();
    const donors = [];
    for (let i = 0; i < namedDonors.length; i += 1) {
      const d = namedDonors[i];
      const key = d.userId
        ? `u:${d.userId}`
        : `n:${String(d.username || d.displayName || '')
            .trim()
            .toLowerCase()}`;
      if (!key || key === 'n:' || seenDonors.has(key)) continue;
      seenDonors.add(key);

      const name = d.displayName || d.username || 'Supporter';
      const avatarUrl = d.avatarUrl || d.avatar_url || null;
      const pinnedBadgeKey =
        d.pinnedBadgeKey || d.pinned_badge_key || null;
      donors.push({
        id: `donor-${d.userId || d.username || d.displayName || i}`,
        userId: d.userId || null,
        username: d.username || null,
        name,
        initials: initialsFromName(name),
        avatarUrl,
        avatar_url: avatarUrl,
        pinnedBadgeKey,
        pinned_badge_key: pinnedBadgeKey,
        note: 'Supported this project. Thank you!',
        role: 'Supporter',
        kind: 'donation',
        time: null,
      });
    }

    // Single card for anonymous support (no names / no amounts)
    if (anonymousCents > 0) {
      donors.push({
        id: 'donor-anonymous',
        userId: null,
        username: null,
        name: 'Anonymous',
        initials: '?',
        avatarUrl: null,
        avatar_url: null,
        pinnedBadgeKey: null,
        pinned_badge_key: null,
        note: 'An anonymous supporter has supported this project. Thank you!',
        role: 'Supporter',
        kind: 'donation',
        time: null,
      });
    }

    const combined = [...shippers, ...donors];
    // Hydrate pinned badges for donors (RPC often omits pin) and any gaps
    try {
      const ids = [
        ...new Set(combined.map((p) => p.userId).filter(Boolean)),
      ];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, pinned_badge_key')
          .in('id', ids);
        const pinById = new Map(
          (profiles || []).map((p) => [p.id, p.pinned_badge_key || null])
        );
        for (const person of combined) {
          if (!person.userId) continue;
          if (!person.pinnedBadgeKey && pinById.has(person.userId)) {
            const pin = pinById.get(person.userId);
            person.pinnedBadgeKey = pin;
            person.pinned_badge_key = pin;
          }
        }
      }
    } catch {
      /* optional column / RLS */
    }

    // Recent wins first, then supporters
    return combined;
  },
};
