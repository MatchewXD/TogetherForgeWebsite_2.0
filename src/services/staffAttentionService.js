/**
 * Staff queue counts for moderator pins and the avatar notice.
 * Open work only. Does not mark member dashboard notices.
 */

import { supabase } from '../lib/supabase';
import { OPEN_SUGGESTION_STATUSES } from '../constants/platformSuggestions';
import { OPEN_BUG_STATUSES } from './bugReportsService';
import { CONDUCT_OPEN_STATUSES } from '../constants/conduct';
import { OPEN_VOLUNTEER_STATUSES } from './volunteerService';
import { tasksService } from './tasksService';

const STAFF_ROLES = new Set([
  'founder',
  'admin',
  'moderator',
  'project_lead',
]);

export const EMPTY_STAFF_ATTENTION = {
  suggestions: 0,
  scope: 0,
  reports: 0,
  bugs: 0,
  showcase: 0,
  suggested: 0,
  conduct: 0,
  volunteers: 0,
  total: 0,
};

function countOrZero(res) {
  if (res?.error) return 0;
  return typeof res.count === 'number' ? res.count : 0;
}

export async function isStaffProfile(userId) {
  if (!userId) return false;
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return STAFF_ROLES.has(String(data?.role || '').trim());
}

export async function loadStaffAttentionCounts(userId) {
  if (!userId) return { ...EMPTY_STAFF_ATTENTION };
  const staff = await isStaffProfile(userId);
  if (!staff) return { ...EMPTY_STAFF_ATTENTION };

  const [
    suggestionsRes,
    scope,
    reportsRes,
    bugsRes,
    showcaseRes,
    suggestedRes,
    conductRes,
    volunteersRes,
  ] = await Promise.all([
    supabase
      .from('platform_suggestions')
      .select('id', { count: 'exact', head: true })
      .in('status', OPEN_SUGGESTION_STATUSES),
    tasksService.countPendingScopeRequests(),
    supabase
      .from('content_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('bug_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', OPEN_BUG_STATUSES),
    supabase
      .from('community_showcase_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('task_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('conduct_cases')
      .select('id', { count: 'exact', head: true })
      .in('status', CONDUCT_OPEN_STATUSES),
    supabase
      .from('volunteer_applications')
      .select('id', { count: 'exact', head: true })
      .in('status', OPEN_VOLUNTEER_STATUSES),
  ]);

  const suggestions = countOrZero(suggestionsRes);
  const reports = countOrZero(reportsRes);
  const bugs = countOrZero(bugsRes);
  const showcase = countOrZero(showcaseRes);
  const suggested = countOrZero(suggestedRes);
  const conduct = countOrZero(conductRes);
  const volunteers = countOrZero(volunteersRes);
  const scopeCount = typeof scope === 'number' ? scope : 0;
  const total =
    suggestions +
    scopeCount +
    reports +
    bugs +
    showcase +
    suggested +
    conduct +
    volunteers;
  return {
    suggestions,
    scope: scopeCount,
    reports,
    bugs,
    showcase,
    suggested,
    conduct,
    volunteers,
    total,
  };
}
