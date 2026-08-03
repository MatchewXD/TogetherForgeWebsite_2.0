/**
 * Project Contributors: curated credits + task-claim derived development credits.
 * Table: project_contributions (see supabase/sql/supabase_project_contributions.sql)
 */

import { supabase } from '../lib/supabase';
import {
  listProjectsByPhase,
  isProjectInDevelopment,
  isProjectCompleted,
} from './projectsService';
import { displayProjectTitle } from '../utils/ideaStatus';
import { mapTaskCategoryToDevSub } from '../constants/contributionCategories';
import {
  isDemoReleaseEnabled,
  isDemoReleaseKey,
  getDemoReleaseCredits,
} from '../data/demoReleasedGame';

// re-export helpers for pages
export { isProjectInDevelopment, isProjectCompleted };

const CONTRIB_SELECT = `
  id,
  project_id,
  user_id,
  display_name,
  category,
  subcategory,
  is_anonymous,
  amount_cents,
  role_label,
  notes,
  sort_order,
  created_at,
  profiles:user_id (
    id,
    username,
    avatar_url
  )
`;

function personKey(row) {
  if (row.user_id) return `u:${row.user_id}`;
  const name = String(row.display_name || row.username || '')
    .trim()
    .toLowerCase();
  return name ? `n:${name}` : `id:${row.id}`;
}

function mapContribRow(row) {
  if (!row) return null;
  const profile = row.profiles || null;
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id || null,
    username: profile?.username || null,
    avatarUrl: profile?.avatar_url || null,
    displayName:
      profile?.username ||
      row.display_name ||
      (row.is_anonymous ? 'Anonymous' : 'Contributor'),
    category: row.category,
    subcategory: row.subcategory || null,
    isAnonymous: Boolean(row.is_anonymous),
    amountCents: row.amount_cents != null ? Number(row.amount_cents) : null,
    roleLabel: row.role_label || null,
    notes: row.notes || null,
    sortOrder: Number(row.sort_order) || 0,
    source: 'manual',
  };
}

/**
 * Projects shown on Contributors landing: In Development + Completed.
 */
export async function listContributorProjects() {
  const phases = ['Early', 'Mid', 'Late'];
  const all = [];
  for (const phase of phases) {
    try {
      const rows = await listProjectsByPhase(phase, {
        includeCompleted: true,
      });
      all.push(...rows);
    } catch (err) {
      console.warn('[contributors] list phase', phase, err);
    }
  }

  // Dedupe by id/slug
  const seen = new Set();
  const out = [];
  for (const p of all) {
    const key = p.id || p.slug;
    if (!key || seen.has(key)) continue;
    if (!isProjectInDevelopment(p) && !isProjectCompleted(p)) continue;
    seen.add(key);
    out.push({
      ...p,
      title: displayProjectTitle(p),
    });
  }

  out.sort((a, b) => {
    // In development first, then completed; then sort_order / title
    const aActive = isProjectInDevelopment(a) ? 0 : 1;
    const bActive = isProjectInDevelopment(b) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const so = (a.sort_order || 0) - (b.sort_order || 0);
    if (so !== 0) return so;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  return out;
}

/**
 * Load curated contribution rows for a project UUID.
 */
export async function listProjectContributions(projectId) {
  if (!projectId) return [];
  try {
    const { data, error } = await supabase
      .from('project_contributions')
      .select(CONTRIB_SELECT)
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      // Table may not exist yet
      if (/does not exist|relation/i.test(error.message || '')) {
        console.warn(
          '[contributors] project_contributions missing — run supabase_project_contributions.sql'
        );
        return [];
      }
      throw error;
    }
    return (data || []).map(mapContribRow).filter(Boolean);
  } catch (err) {
    console.warn('[contributors] listProjectContributions', err);
    return [];
  }
}

/**
 * Derive development credits from completed task claims (account holders only).
 */
export async function listDevelopmentFromTasks(projectId) {
  if (!projectId) return [];
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(
        `
        id,
        category,
        status,
        task_claims (
          id,
          status,
          user_id,
          profiles:user_id (
            id,
            username,
            avatar_url
          )
        )
      `
      )
      .eq('project_id', projectId);

    if (error) {
      console.warn('[contributors] tasks for credits', error);
      return [];
    }

    const byPersonSub = new Map();

    for (const task of data || []) {
      const taskDone =
        String(task.status || '').toLowerCase() === 'completed';
      const sub = mapTaskCategoryToDevSub(task.category);
      for (const claim of task.task_claims || []) {
        const claimDone =
          String(claim.status || '').toLowerCase() === 'completed';
        if (!taskDone && !claimDone) continue;
        const uid = claim.user_id;
        if (!uid) continue;
        const profile = claim.profiles;
        const key = `${uid}::${sub}`;
        if (byPersonSub.has(key)) continue;
        byPersonSub.set(key, {
          id: `task-${claim.id || uid}-${sub}`,
          projectId,
          userId: uid,
          username: profile?.username || null,
          avatarUrl: profile?.avatar_url || null,
          displayName: profile?.username || 'Contributor',
          category: 'development',
          subcategory: sub,
          isAnonymous: false,
          amountCents: null,
          roleLabel: null,
          notes: null,
          sortOrder: 0,
          source: 'task',
        });
      }
    }

    return [...byPersonSub.values()];
  } catch (err) {
    console.warn('[contributors] listDevelopmentFromTasks', err);
    return [];
  }
}

/**
 * Donations attributed to this project while it was active (project_id set at
 * payment time). Falls back to project_contributions donation rows if RPC missing.
 */
export async function getProjectDonationCredits(projectId) {
  if (!projectId) {
    return { projectTotalCents: 0, anonymousCents: 0, namedDonors: [] };
  }

  try {
    const { data, error } = await supabase.rpc('get_project_donation_credits', {
      p_project_id: projectId,
    });
    if (!error && data && typeof data === 'object') {
      const named = Array.isArray(data.named_donors)
        ? data.named_donors
        : typeof data.named_donors === 'string'
          ? JSON.parse(data.named_donors || '[]')
          : [];
      return {
        projectTotalCents: Number(data.project_total_cents) || 0,
        anonymousCents: Number(data.anonymous_cents) || 0,
        namedDonors: (named || []).map((d) => ({
          userId: d.user_id || d.userId || null,
          username: d.username || null,
          avatarUrl: d.avatar_url || d.avatarUrl || null,
          displayName:
            d.display_name || d.displayName || d.username || 'Supporter',
        })),
        source: 'donations_rpc',
      };
    }
    if (error) {
      console.warn('[contributors] get_project_donation_credits', error.message);
    }
  } catch (err) {
    console.warn('[contributors] donation RPC', err);
  }

  // Fallback: curated project_contributions only (already scoped to project)
  const manual = await listProjectContributions(projectId);
  const donationRows = manual.filter((r) => r.category === 'donations');
  const projectTotalCents = donationRows.reduce(
    (sum, r) => sum + (Number(r.amountCents) || 0),
    0
  );
  const anonymousCents = donationRows
    .filter((r) => r.isAnonymous)
    .reduce((sum, r) => sum + (Number(r.amountCents) || 0), 0);
  const namedDonorsMap = new Map();
  for (const r of donationRows) {
    if (r.isAnonymous) continue;
    const key = personKey(r);
    if (namedDonorsMap.has(key)) continue;
    namedDonorsMap.set(key, {
      userId: r.userId,
      username: r.username,
      avatarUrl: r.avatarUrl,
      displayName: r.displayName,
    });
  }
  return {
    projectTotalCents,
    anonymousCents,
    namedDonors: [...namedDonorsMap.values()],
    source: 'contributions_fallback',
  };
}

/**
 * Build full public credit view for one project.
 * Donations: only those attributed while the project was active (In Development).
 */
export async function getProjectCredits(projectId) {
  if (isDemoReleaseEnabled() && isDemoReleaseKey(projectId)) {
    return getDemoReleaseCredits();
  }

  const [manual, fromTasks, donationCredits] = await Promise.all([
    listProjectContributions(projectId),
    listDevelopmentFromTasks(projectId),
    getProjectDonationCredits(projectId),
  ]);

  // Merge non-donation credits: manual first; add task-derived development
  const merged = [...manual];
  const seen = new Set(
    manual.map(
      (r) =>
        `${r.category}|${r.subcategory || ''}|${r.userId || personKey(r)}`
    )
  );

  for (const row of fromTasks) {
    const k = `${row.category}|${row.subcategory || ''}|${row.userId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(row);
  }

  // Prefer Stripe/RPC donation totals (attributed at payment time to active project).
  // Merge named donors from RPC + any non-anonymous contribution rows (staff credits).
  const namedDonorsMap = new Map();
  for (const d of donationCredits.namedDonors || []) {
    const key = d.userId
      ? `u:${d.userId}`
      : `n:${String(d.displayName || d.username || '')
          .trim()
          .toLowerCase()}`;
    if (!key || key === 'n:') continue;
    if (namedDonorsMap.has(key)) continue;
    namedDonorsMap.set(key, d);
  }
  for (const r of manual.filter((x) => x.category === 'donations' && !x.isAnonymous)) {
    const key = personKey(r);
    if (namedDonorsMap.has(key)) continue;
    namedDonorsMap.set(key, {
      userId: r.userId,
      username: r.username,
      avatarUrl: r.avatarUrl,
      displayName: r.displayName,
    });
  }

  // If RPC returned zeros but contributions have amounts, use contribution sums
  // (dev/demo seed). Prefer max of the two totals only when RPC empty.
  let projectTotalCents = donationCredits.projectTotalCents || 0;
  let anonymousCents = donationCredits.anonymousCents || 0;
  if (projectTotalCents === 0 && donationCredits.source !== 'donations_rpc') {
    const donationRows = manual.filter((r) => r.category === 'donations');
    projectTotalCents = donationRows.reduce(
      (sum, r) => sum + (Number(r.amountCents) || 0),
      0
    );
    anonymousCents = donationRows
      .filter((r) => r.isAnonymous)
      .reduce((sum, r) => sum + (Number(r.amountCents) || 0), 0);
  }

  // Development / marketing / community: account holders only
  const byCategory = {
    development: [],
    marketing: [],
    community: [],
  };

  for (const r of merged) {
    if (r.category === 'donations') continue;
    if (!r.userId) continue; // enforce account rule
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  return {
    donations: {
      projectTotalCents,
      anonymousCents,
      namedDonors: [...namedDonorsMap.values()],
      /** true when totals come from payments attributed while project was active */
      attributedWhileActive: donationCredits.source === 'donations_rpc',
    },
    development: byCategory.development,
    marketing: byCategory.marketing,
    community: byCategory.community,
    raw: merged,
  };
}

export function formatUsdFromCents(cents) {
  const n = Number(cents) || 0;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n % 100 === 0 ? 0 : 2,
  }).format(n / 100);
}

export const contributorsService = {
  listContributorProjects,
  listProjectContributions,
  listDevelopmentFromTasks,
  getProjectDonationCredits,
  getProjectCredits,
  formatUsdFromCents,
};

export default contributorsService;
