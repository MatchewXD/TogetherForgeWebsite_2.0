/**
 * Project Contributors: durable memorial credits (project_contributions) + live supplements.
 * Memorial rows persist when projects complete, rename, or soft-delete (see
 * supabase/sql/supabase_contributions_memorial.sql). Live task/donation queries
 * still fill gaps and are auto-recorded into the memorial table when possible.
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
import {
  isDemoContributorsEnabled,
  injectDemoAllContributors,
} from '../data/demoAllContributors';

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
  source_key,
  project_title_snapshot,
  username_snapshot,
  archived_at,
  profiles:user_id (
    id,
    username,
    avatar_url
  )
`;

const CONTRIB_SELECT_BASIC = `
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
  if (row.archived_at) return null;
  const profile = row.profiles || null;
  const username =
    profile?.username || row.username_snapshot || null;
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitleSnapshot: row.project_title_snapshot || null,
    userId: row.user_id || null,
    username,
    avatarUrl: profile?.avatar_url || null,
    displayName:
      username ||
      row.display_name ||
      row.username_snapshot ||
      (row.is_anonymous ? 'Anonymous' : 'Contributor'),
    category: row.category,
    subcategory: row.subcategory || null,
    isAnonymous: Boolean(row.is_anonymous),
    amountCents: row.amount_cents != null ? Number(row.amount_cents) : null,
    roleLabel: row.role_label || null,
    notes: row.notes || null,
    sortOrder: Number(row.sort_order) || 0,
    sourceKey: row.source_key || null,
    source: row.source_key ? 'memorial' : 'manual',
  };
}

/**
 * Write (or refresh) a durable memorial credit. Never removes credits.
 * Requires supabase/sql/supabase_contributions_memorial.sql RPC.
 */
export async function ensureMemorialCredit({
  projectId = null,
  userId = null,
  displayName = null,
  category,
  subcategory = null,
  roleLabel = null,
  sourceKey = null,
  projectTitle = null,
  username = null,
} = {}) {
  if (!category) return null;
  try {
    const { data, error } = await supabase.rpc('ensure_project_contribution', {
      p_project_id: projectId || null,
      p_user_id: userId || null,
      p_display_name: displayName || null,
      p_category: category,
      p_subcategory: subcategory || null,
      p_role_label: roleLabel || null,
      p_source_key: sourceKey || null,
      p_project_title: projectTitle || null,
      p_username: username || null,
    });
    if (error) {
      // RPC not migrated yet — fail soft
      if (/function|does not exist|PGRST202/i.test(error.message || '')) {
        console.warn(
          '[contributors] ensure_project_contribution missing — run supabase_contributions_memorial.sql'
        );
        return null;
      }
      console.warn('[contributors] ensureMemorialCredit', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[contributors] ensureMemorialCredit', err);
    return null;
  }
}

/**
 * Resolve a showcase project tag (slug / title / uuid) to a projects row.
 * @returns {Promise<{ id: string, title: string, slug: string|null }|null>}
 */
export async function resolveProjectByTag(tag) {
  const raw = String(tag || '').trim();
  if (!raw) return null;
  try {
    // Direct uuid
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        raw
      )
    ) {
      const { data } = await supabase
        .from('projects')
        .select('id, slug, title')
        .eq('id', raw)
        .maybeSingle();
      if (data?.id) {
        return {
          id: data.id,
          slug: data.slug || null,
          title: data.title || data.slug || 'Project',
        };
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, slug, title')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !data?.length) return null;

    const lower = raw.toLowerCase();
    const match = data.find((p) => {
      const slug = String(p.slug || '').trim().toLowerCase();
      const title = String(p.title || '').trim().toLowerCase();
      const id = String(p.id || '').trim().toLowerCase();
      return slug === lower || title === lower || id === lower;
    });
    if (!match) return null;
    return {
      id: match.id,
      slug: match.slug || null,
      title: match.title || match.slug || 'Project',
    };
  } catch (err) {
    console.warn('[contributors] resolveProjectByTag', err);
    return null;
  }
}

/**
 * Record Marketing / Content credit for an approved showcase post.
 * When the post has an official project tag, credits the project page section.
 */
export async function ensureShowcaseMarketingCredit(post) {
  if (!post) return null;
  const userId = post.creatorUserId || post.creator_user_id || null;
  if (!userId) return null;

  const postId = post.id;
  const displayName =
    post.creatorDisplayName ||
    post.creator_display_name ||
    post.creator?.username ||
    'Showcase creator';
  const username = post.creator?.username || null;
  const tag = post.projectTag || post.project_tag || null;

  let projectId = null;
  let projectTitle = 'Community Showcase';
  if (tag) {
    const resolved = await resolveProjectByTag(tag);
    if (resolved?.id) {
      projectId = resolved.id;
      projectTitle = resolved.title || tag;
    } else {
      // Unknown free-text tags do not create projects; still site-wide credit
      projectTitle = `Community Showcase · ${tag}`;
    }
  }

  return ensureMemorialCredit({
    projectId,
    userId,
    displayName,
    username,
    category: 'marketing',
    subcategory: 'Content Creation',
    roleLabel: 'Community Showcase',
    sourceKey: postId ? `showcase:${postId}` : null,
    projectTitle,
  });
}

/**
 * Persist task-derived development credits into the memorial table (best-effort).
 */
async function persistTaskCredits(rows = [], projectTitle = null) {
  for (const row of rows || []) {
    if (!row?.userId || row.category !== 'development') continue;
    await ensureMemorialCredit({
      projectId: row.projectId || null,
      userId: row.userId,
      displayName: row.displayName,
      username: row.username,
      category: 'development',
      subcategory: row.subcategory || 'Other',
      sourceKey: row.sourceKey || row.id || null,
      projectTitle,
    });
  }
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
    let { data, error } = await supabase
      .from('project_contributions')
      .select(CONTRIB_SELECT)
      .eq('project_id', projectId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    // Older schema without snapshot columns
    if (
      error &&
      /column|schema cache|could not find/i.test(error.message || '')
    ) {
      ({ data, error } = await supabase
        .from('project_contributions')
        .select(CONTRIB_SELECT_BASIC)
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }));
    }

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
 * All memorial contribution rows (including orphaned project_id null after delete).
 * Used for All Contributors so credits never depend only on “live” projects.
 */
export async function listAllMemorialContributions({ limit = 2000 } = {}) {
  try {
    let { data, error } = await supabase
      .from('project_contributions')
      .select(CONTRIB_SELECT)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (
      error &&
      /column|schema cache|could not find/i.test(error.message || '')
    ) {
      ({ data, error } = await supabase
        .from('project_contributions')
        .select(CONTRIB_SELECT_BASIC)
        .order('created_at', { ascending: false })
        .limit(limit));
    }

    if (error) {
      if (/does not exist|relation/i.test(error.message || '')) return [];
      console.warn('[contributors] listAllMemorialContributions', error);
      return [];
    }
    return (data || []).map(mapContribRow).filter(Boolean);
  } catch (err) {
    console.warn('[contributors] listAllMemorialContributions', err);
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
          sourceKey: claim.id ? `task-claim:${claim.id}` : null,
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

  // Memorial first (never evaporates), then live task rows fill any gap
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

  // Best-effort: persist live task credits so completing a project never drops them
  const titleSnap =
    manual.find((r) => r.projectTitleSnapshot)?.projectTitleSnapshot || null;
  void persistTaskCredits(fromTasks, titleSnap);

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

function personDedupeKey(person) {
  if (person?.userId) return `u:${person.userId}`;
  const name = String(person?.username || person?.displayName || '')
    .trim()
    .toLowerCase();
  return name ? `n:${name}` : null;
}

function upsertPerson(map, person, context = null) {
  const key = personDedupeKey(person);
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    if (context && !existing.contexts.includes(context)) {
      existing.contexts.push(context);
    }
    // Prefer richer profile fields
    if (!existing.avatarUrl && person.avatarUrl) {
      existing.avatarUrl = person.avatarUrl;
    }
    if (!existing.username && person.username) {
      existing.username = person.username;
    }
    if (
      person.displayName &&
      (!existing.displayName || existing.displayName === 'Contributor')
    ) {
      existing.displayName = person.displayName;
    }
    if (person.roleLabel && !existing.roleLabel) {
      existing.roleLabel = person.roleLabel;
    }
    return;
  }
  map.set(key, {
    userId: person.userId || null,
    username: person.username || null,
    avatarUrl: person.avatarUrl || null,
    displayName:
      person.displayName || person.username || 'Contributor',
    roleLabel: person.roleLabel || null,
    contexts: context ? [context] : [],
  });
}

function mapToSortedList(map) {
  return [...map.values()].sort((a, b) =>
    String(a.displayName || a.username || '').localeCompare(
      String(b.displayName || b.username || '')
    )
  );
}

/**
 * Site-wide All Contributors directory.
 * Groups people from every In Development + Completed project, public idea authors,
 * and approved Community Showcase creators (Content & Showcase).
 * Sections only returned when non-empty.
 *
 * @returns {Promise<{
 *   projectContributors: Array,
 *   donors: Array,
 *   communityModeration: Array,
 *   ideasFeedback: Array,
 *   contentShowcase: Array,
 *   otherSkills: Array,
 *   totalPeople: number,
 * }>}
 */
function foldMemorialRowIntoSections(row, sections, fallbackTitle = null) {
  if (!row || row.isAnonymous) return;
  const projectTitle =
    row.projectTitleSnapshot || fallbackTitle || 'Together Forge';
  const ctx = [projectTitle, row.subcategory || row.roleLabel]
    .filter(Boolean)
    .join(' · ');

  if (row.category === 'donations') {
    if (!row.isAnonymous) {
      upsertPerson(sections.donors, row, projectTitle);
    }
    return;
  }
  if (row.category === 'development') {
    if (!row.userId) return;
    upsertPerson(sections.projectContributors, row, ctx || projectTitle);
    return;
  }
  if (row.category === 'marketing') {
    if (!row.userId && !row.displayName) return;
    upsertPerson(sections.contentShowcase, row, ctx || projectTitle);
    return;
  }
  if (row.category === 'community') {
    if (!row.userId && !row.displayName) return;
    const sub = String(row.subcategory || '').toLowerCase();
    if (sub === 'feedback') {
      upsertPerson(sections.ideasFeedback, row, ctx || projectTitle);
    } else if (
      sub === 'moderation' ||
      sub === 'playtesting' ||
      sub === 'playtest'
    ) {
      upsertPerson(sections.communityModeration, row, ctx || projectTitle);
    } else if (sub === 'other' || !sub) {
      upsertPerson(sections.otherSkills, row, ctx || projectTitle);
    } else {
      upsertPerson(sections.communityModeration, row, ctx || projectTitle);
    }
  }
}

export async function listAllContributorsGrouped() {
  const projects = await listContributorProjects();
  const projectContributors = new Map();
  const donors = new Map();
  const communityModeration = new Map();
  const ideasFeedback = new Map();
  const contentShowcase = new Map();
  const otherSkills = new Map();
  const sectionMaps = {
    projectContributors,
    donors,
    communityModeration,
    ideasFeedback,
    contentShowcase,
    otherSkills,
  };

  // 1) Durable memorial ledger first (survives project completion / deletion)
  try {
    const memorial = await listAllMemorialContributions({ limit: 3000 });
    for (const row of memorial) {
      foldMemorialRowIntoSections(row, sectionMaps);
    }
  } catch (err) {
    console.warn('[contributors] memorial ledger', err);
  }

  // 2) Live project credits (fills gaps; also persists task credits into memorial)
  for (const project of projects) {
    if (!project?.id) continue;
    // Skip pure client demo release id
    if (isDemoReleaseEnabled() && isDemoReleaseKey(project.id)) continue;

    let credits;
    try {
      credits = await getProjectCredits(project.id);
    } catch (err) {
      console.warn('[contributors] all credits', project.slug, err);
      continue;
    }

    const projectTitle = displayProjectTitle(project);

    for (const row of credits.development || []) {
      const ctx = [projectTitle, row.subcategory || row.roleLabel]
        .filter(Boolean)
        .join(' · ');
      upsertPerson(projectContributors, row, ctx || projectTitle);
    }

    for (const d of credits.donations?.namedDonors || []) {
      upsertPerson(donors, d, projectTitle);
    }

    for (const row of credits.marketing || []) {
      const ctx = [projectTitle, row.subcategory || row.roleLabel]
        .filter(Boolean)
        .join(' · ');
      upsertPerson(contentShowcase, row, ctx || projectTitle);
    }

    for (const row of credits.community || []) {
      const sub = String(row.subcategory || '').toLowerCase();
      const ctx = [projectTitle, row.subcategory || row.roleLabel]
        .filter(Boolean)
        .join(' · ');
      if (sub === 'feedback') {
        upsertPerson(ideasFeedback, row, ctx || projectTitle);
      } else if (
        sub === 'moderation' ||
        sub === 'playtesting' ||
        sub === 'playtest'
      ) {
        upsertPerson(communityModeration, row, ctx || projectTitle);
      } else if (sub === 'other' || !sub) {
        upsertPerson(otherSkills, row, ctx || projectTitle);
      } else {
        upsertPerson(communityModeration, row, ctx || projectTitle);
      }
    }
  }

  // Public idea authors → Ideas & Feedback (+ memorial persist when possible)
  try {
    const { ideasService } = await import('./ideasService');
    const listing = await ideasService.getIdeasListing();
    const ideas = Array.isArray(listing)
      ? listing
      : listing?.ideas || [];
    for (const idea of ideas) {
      const creator = idea.creator || idea.profiles || null;
      const userId = idea.user_id || idea.userId || creator?.id || null;
      const username = creator?.username || idea.username || null;
      const avatarUrl =
        creator?.avatar_url || creator?.avatarUrl || idea.avatar_url || null;
      if (!userId && !username) continue;
      upsertPerson(
        ideasFeedback,
        {
          userId,
          username,
          avatarUrl,
          displayName: username || 'Idea author',
        },
        idea.title ? `Idea: ${idea.title}` : 'Idea'
      );
      if (userId && idea.id) {
        void ensureMemorialCredit({
          projectId: null,
          userId,
          displayName: username || 'Idea author',
          username,
          category: 'community',
          subcategory: 'Feedback',
          roleLabel: 'Idea author',
          sourceKey: `idea:${idea.id}`,
          projectTitle: 'Ideas',
        });
      }
    }
  } catch (err) {
    console.warn('[contributors] ideas for all list', err);
  }

  // Approved Community Showcase creators → Content & Showcase
  // Also persist memorial rows so un-publishing later does not erase credit.
  try {
    const { data: showcaseRows, error: scErr } = await supabase
      .from('community_showcase_posts')
      .select(
        'id, title, creator_display_name, creator_user_id, project_tag, published_at'
      )
      .eq('status', 'approved')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(300);

    if (scErr) {
      // Table missing is fine before migration
      if (
        !/relation|does not exist|PGRST205|42P01|schema cache/i.test(
          String(scErr.message || scErr.code || '')
        )
      ) {
        console.warn('[contributors] showcase posts', scErr);
      }
    } else if (showcaseRows?.length) {
      const userIds = [
        ...new Set(
          showcaseRows.map((r) => r.creator_user_id).filter(Boolean)
        ),
      ];
      const profileById = {};
      if (userIds.length) {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        if (pErr) {
          console.warn('[contributors] showcase profiles', pErr);
        } else {
          for (const p of profiles || []) {
            if (p?.id) profileById[p.id] = p;
          }
        }
      }

      for (const row of showcaseRows) {
        const credit = String(row.creator_display_name || '').trim();
        const profile = row.creator_user_id
          ? profileById[row.creator_user_id]
          : null;
        const username = profile?.username || null;
        const displayName =
          username || credit || 'Showcase creator';
        if (!row.creator_user_id && !credit) continue;

        const contextParts = ['Community Showcase'];
        if (row.title) contextParts.push(row.title);
        if (row.project_tag) contextParts.push(String(row.project_tag));

        upsertPerson(
          contentShowcase,
          {
            userId: row.creator_user_id || null,
            username,
            avatarUrl: profile?.avatar_url || null,
            displayName,
            roleLabel: 'Community Showcase',
          },
          contextParts.join(' · ')
        );

        if (row.creator_user_id) {
          void ensureShowcaseMarketingCredit({
            id: row.id,
            creatorUserId: row.creator_user_id,
            creatorDisplayName: displayName,
            creator: { username },
            projectTag: row.project_tag || null,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[contributors] showcase for all list', err);
  }

  // Layout preview people (merged with real credits; default on)
  if (isDemoContributorsEnabled()) {
    injectDemoAllContributors(
      {
        projectContributors,
        donors,
        communityModeration,
        ideasFeedback,
        contentShowcase,
        otherSkills,
      },
      upsertPerson
    );
  }

  const sections = {
    projectContributors: mapToSortedList(projectContributors),
    donors: mapToSortedList(donors),
    communityModeration: mapToSortedList(communityModeration),
    ideasFeedback: mapToSortedList(ideasFeedback),
    contentShowcase: mapToSortedList(contentShowcase),
    otherSkills: mapToSortedList(otherSkills),
  };

  const allKeys = new Set();
  for (const list of Object.values(sections)) {
    for (const p of list) {
      const k = personDedupeKey(p);
      if (k) allKeys.add(k);
    }
  }

  return {
    ...sections,
    totalPeople: allKeys.size,
  };
}

export const contributorsService = {
  listContributorProjects,
  listProjectContributions,
  listAllMemorialContributions,
  listDevelopmentFromTasks,
  getProjectDonationCredits,
  getProjectCredits,
  listAllContributorsGrouped,
  ensureMemorialCredit,
  ensureShowcaseMarketingCredit,
  resolveProjectByTag,
  formatUsdFromCents,
};

export default contributorsService;
