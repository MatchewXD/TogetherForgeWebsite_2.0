/**
 * Projects table CRUD for phase hubs (Early / Mid / Late) and workspaces.
 * Extends the base row from supabase_tasks_schema with completion fields
 * (see supabase/sql/supabase_projects_completion.sql).
 */

import { supabase } from '../lib/supabase';
import { canonicalProjectSlug, displayProjectTitle } from '../utils/ideaStatus';
import {
  parseReleaseMeta,
  mergeReleaseMeta,
  emptyReleaseMeta,
} from '../utils/releaseMeta';
import { getReleasedGameExtras } from '../data/releasedGameExtras';
import {
  isDemoReleaseEnabled,
  isDemoReleaseKey,
  getDemoReleasedGame,
} from '../data/demoReleasedGame';

const PROJECT_SELECT_FULL =
  'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, release_meta, github_url, contribution_meta, updated_at';

const PROJECT_SELECT_BASIC =
  'id, slug, title, description, phase, status, created_at';

/** Normalize optional GitHub repo / Project board URL. */
export function normalizeGithubUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^github\.com\//i.test(s)) return `https://${s}`;
  return s;
}

/** Status values treated as "done" for active-board filtering */
export const COMPLETED_STATUSES = new Set([
  'completed',
  'complete',
  'shipped',
  'released',
  'done',
]);

/** Statuses that may appear under "Active Projects" on phase hubs */
export const IN_DEVELOPMENT_STATUSES = new Set([
  'in development',
  'in-development',
  'development',
  'active',
  'live',
]);

/** Statuses that are planned / not yet active work */
export const PLANNED_STATUSES = new Set([
  'planning',
  'planned',
  'on hold',
  'on-hold',
  'hold',
  'queued',
  'upcoming',
  'concept',
  'vision',
]);

function normalizeStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function isProjectCompleted(project) {
  if (!project) return false;
  if (project.completed_at) return true;
  return COMPLETED_STATUSES.has(normalizeStatus(project.status));
}

/**
 * True only for live build work. Planning, on hold, and completed are excluded.
 * Empty status defaults to in-development for legacy rows.
 */
export function isProjectInDevelopment(project) {
  if (!project || isProjectCompleted(project)) return false;
  const s = normalizeStatus(project.status);
  if (!s) return true;
  if (PLANNED_STATUSES.has(s)) return false;
  return IN_DEVELOPMENT_STATUSES.has(s);
}

export function isEarlyPhase(phase) {
  const p = String(phase || '')
    .trim()
    .toLowerCase();
  return p === 'early' || p === 'early game' || p === '';
}

/** Normalize free-form phase labels to Early | Mid | Late */
export function normalizePhase(phase) {
  const p = String(phase || '')
    .trim()
    .toLowerCase();
  if (p.startsWith('mid')) return 'Mid';
  if (p.startsWith('late')) return 'Late';
  return 'Early';
}

export function slugifyProjectTitle(title) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `project-${Date.now().toString(36)}`;
}

export function parseCompletionLinks(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item, i) => {
      if (!item || typeof item !== 'object') return null;
      const url = String(item.url || item.href || '').trim();
      if (!url) return null;
      const label =
        String(item.label || item.name || item.kind || `Link ${i + 1}`).trim() ||
        `Link ${i + 1}`;
      const kind = String(item.kind || item.type || '').trim() || 'link';
      return { label, url, kind };
    })
    .filter(Boolean);
}

function mapProjectRow(row) {
  if (!row) return null;
  const releaseMeta = parseReleaseMeta(row.release_meta);
  let contributionMeta = row.contribution_meta;
  if (typeof contributionMeta === 'string') {
    try {
      contributionMeta = JSON.parse(contributionMeta);
    } catch {
      contributionMeta = {};
    }
  }
  if (!contributionMeta || typeof contributionMeta !== 'object') {
    contributionMeta = {};
  }
  const mapped = {
    ...row,
    summary: row.summary ?? null,
    completed_at: row.completed_at ?? null,
    completion_notes: row.completion_notes ?? null,
    completion_links: parseCompletionLinks(row.completion_links),
    sort_order: Number(row.sort_order) || 0,
    phase: normalizePhase(row.phase),
    release_meta: releaseMeta,
    github_url: normalizeGithubUrl(row.github_url) || null,
    githubUrl: normalizeGithubUrl(row.github_url) || null,
    contribution_meta: contributionMeta,
    contributionMeta,
  };
  // Always expose the public title + URL slug (Prototype Systems → Tether)
  mapped.slug = canonicalProjectSlug(mapped.slug) || mapped.slug;
  mapped.title = displayProjectTitle(mapped);
  return mapped;
}

/**
 * Attach static extras for empty release_meta slots (media, platforms, etc.).
 */
export function withReleaseExtras(project) {
  if (!project) return null;
  const extras =
    getReleasedGameExtras(project.slug) ||
    getReleasedGameExtras(project.id) ||
    null;
  const releaseMeta = mergeReleaseMeta(project.release_meta, extras);
  return {
    ...project,
    release_meta: releaseMeta,
  };
}

async function selectProjects(queryBuilder) {
  let { data, error } = await queryBuilder.select(PROJECT_SELECT_FULL);
  if (
    error &&
    /column .* does not exist|completion_links|completed_at|summary|sort_order|release_meta|github_url|contribution_meta|updated_at/i.test(
      error.message || ''
    )
  ) {
    // Drop newer optional columns first
    if (/github_url|contribution_meta/i.test(error.message || '')) {
      const withoutGh = await queryBuilder.select(
        'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, release_meta, updated_at'
      );
      if (!withoutGh.error) {
        return (withoutGh.data || []).map(mapProjectRow);
      }
    }
    // Drop release_meta first if that is the missing column
    if (/release_meta/i.test(error.message || '')) {
      const withoutMeta = await queryBuilder.select(
        'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, updated_at'
      );
      if (!withoutMeta.error) {
        return (withoutMeta.data || []).map(mapProjectRow);
      }
    }
    const retry = await queryBuilder.select(PROJECT_SELECT_BASIC);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return (data || []).map(mapProjectRow);
}

/**
 * List projects for a studio phase (Early / Mid / Late).
 * @param {string} phase
 * @param {{ includeCompleted?: boolean, onlyCompleted?: boolean, onlyInDevelopment?: boolean }} [opts]
 */
export async function listProjectsByPhase(phase, opts = {}) {
  const phaseLabel = normalizePhase(phase);
  // Match common stored variants
  const phaseValues =
    phaseLabel === 'Early'
      ? ['Early', 'early', 'Early Game']
      : phaseLabel === 'Mid'
        ? ['Mid', 'mid', 'Mid Game']
        : ['Late', 'late', 'Late Game'];

  let q = supabase
    .from('projects')
    .select(PROJECT_SELECT_FULL)
    .in('phase', phaseValues)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  let { data, error } = await q;

  if (
    error &&
    /column .* does not exist|sort_order|completion_|release_meta/i.test(
      error.message || ''
    )
  ) {
    if (/release_meta/i.test(error.message || '')) {
      const mid = await supabase
        .from('projects')
        .select(
          'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, updated_at'
        )
        .in('phase', phaseValues)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (!mid.error) {
        data = mid.data;
        error = null;
      } else {
        error = mid.error;
      }
    }
    if (error) {
      const retry = await supabase
        .from('projects')
        .select(PROJECT_SELECT_BASIC)
        .in('phase', phaseValues)
        .order('created_at', { ascending: true });
      data = retry.data;
      error = retry.error;
    }
  }

  // If .in failed on empty or phase mismatch, try case-insensitive via filter-less + client filter
  if (error) {
    console.warn('[projectsService] listByPhase query', error);
    const all = await supabase
      .from('projects')
      .select(PROJECT_SELECT_BASIC)
      .order('created_at', { ascending: true });
    if (all.error) throw all.error;
    data = (all.data || []).filter(
      (p) => normalizePhase(p.phase) === phaseLabel
    );
    error = null;
  }

  let rows = (data || []).map(mapProjectRow);

  if (opts.onlyCompleted) {
    rows = rows.filter(isProjectCompleted);
  } else if (opts.onlyInDevelopment) {
    rows = rows.filter(isProjectInDevelopment);
  } else if (!opts.includeCompleted) {
    // Default: not completed (may still include Planning). Prefer onlyInDevelopment for hubs.
    rows = rows.filter((p) => !isProjectCompleted(p));
  }

  rows.sort((a, b) => {
    const so = (a.sort_order || 0) - (b.sort_order || 0);
    if (so !== 0) return so;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });

  return rows;
}

/**
 * All completed / shipped games across phases (for /released).
 * Newest release first.
 */
export async function listReleasedGames() {
  const phases = ['Early', 'Mid', 'Late'];
  const all = [];
  for (const phase of phases) {
    try {
      const rows = await listProjectsByPhase(phase, { onlyCompleted: true });
      all.push(...(rows || []));
    } catch (err) {
      console.warn('[projectsService] listReleasedGames', phase, err);
    }
  }
  // Dedupe by id/slug
  const seen = new Set();
  const unique = [];
  for (const p of all) {
    const key = p.id || p.slug;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(withReleaseExtras(p));
  }
  unique.sort((a, b) => {
    const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return tb - ta;
  });

  // Preview card with every catalog field filled (no DB row required)
  if (isDemoReleaseEnabled()) {
    const demo = getDemoReleasedGame();
    const demoKey = demo.id || demo.slug;
    if (demoKey && !seen.has(demoKey) && !seen.has(demo.slug)) {
      unique.unshift(demo);
    }
  }

  return unique;
}

/**
 * Single released game by public slug or UUID (for /released/:slug).
 * Returns null if not found. Does not require completed status so staff
 * can preview; callers should warn when not completed.
 */
export async function getReleasedGameBySlug(slugOrId) {
  if (!slugOrId) return null;
  const key = String(slugOrId).trim();
  if (!key) return null;

  if (isDemoReleaseEnabled() && isDemoReleaseKey(key)) {
    return getDemoReleasedGame();
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key
    );

  const fetchOne = async (column, value) => {
    let { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT_FULL)
      .eq(column, value)
      .maybeSingle();

    if (
      error &&
      /column .* does not exist|release_meta|completion_|summary|sort_order|updated_at/i.test(
        error.message || ''
      )
    ) {
      if (/release_meta/i.test(error.message || '')) {
        const mid = await supabase
          .from('projects')
          .select(
            'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, updated_at'
          )
          .eq(column, value)
          .maybeSingle();
        data = mid.data;
        error = mid.error;
      }
      if (
        error &&
        /column .* does not exist|completion_|summary|sort_order|updated_at/i.test(
          error.message || ''
        )
      ) {
        const retry = await supabase
          .from('projects')
          .select(PROJECT_SELECT_BASIC)
          .eq(column, value)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }
    if (error) throw error;
    return data ? withReleaseExtras(mapProjectRow(data)) : null;
  };

  if (isUuid) {
    const byId = await fetchOne('id', key);
    if (byId) return byId;
  }
  return fetchOne('slug', key);
}

export async function getProjectById(id) {
  if (!id) return null;
  let { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT_FULL)
    .eq('id', id)
    .maybeSingle();
  if (
    error &&
    /column .* does not exist|release_meta|completion_|summary|sort_order|updated_at/i.test(
      error.message || ''
    )
  ) {
    if (/release_meta/i.test(error.message || '')) {
      const mid = await supabase
        .from('projects')
        .select(
          'id, slug, title, description, summary, phase, status, sort_order, created_at, completed_at, completion_links, completion_notes, updated_at'
        )
        .eq('id', id)
        .maybeSingle();
      data = mid.data;
      error = mid.error;
    }
    if (error && /column .* does not exist/i.test(error.message || '')) {
      const retry = await supabase
        .from('projects')
        .select(PROJECT_SELECT_BASIC)
        .eq('id', id)
        .maybeSingle();
      if (retry.error) throw retry.error;
      return mapProjectRow(retry.data);
    }
  }
  if (error) throw error;
  return mapProjectRow(data);
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  for (let i = 0; i < 12; i += 1) {
    let q = supabase.from('projects').select('id').eq('slug', slug).maybeSingle();
    const { data, error } = await q;
    if (error) throw error;
    if (!data || (excludeId && data.id === excludeId)) return slug;
    slug = `${baseSlug}-${i + 2}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

/**
 * @param {{ title: string, slug?: string, description?: string, summary?: string, phase?: string, status?: string, sort_order?: number }} input
 */
export async function createProject(input) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Title is required');

  const phase = normalizePhase(input.phase || 'Early');
  const slugBase = slugifyProjectTitle(input.slug || title);
  const slug = await ensureUniqueSlug(slugBase);

  const row = {
    slug,
    title,
    description: String(input.description || '').trim() || null,
    phase,
    status: String(input.status || 'In Development').trim() || 'In Development',
  };

  // Optional columns (migration may not be applied yet)
  if (input.summary != null) row.summary = String(input.summary).trim() || null;
  if (input.sort_order != null) row.sort_order = Number(input.sort_order) || 0;
  if (input.github_url != null || input.githubUrl != null) {
    row.github_url = normalizeGithubUrl(input.github_url ?? input.githubUrl);
  }
  if (input.contribution_meta != null || input.contributionMeta != null) {
    row.contribution_meta =
      input.contribution_meta ?? input.contributionMeta ?? {};
  }

  let { data, error } = await supabase
    .from('projects')
    .insert(row)
    .select(PROJECT_SELECT_FULL)
    .maybeSingle();

  if (
    error &&
    /column .* does not exist|summary|sort_order/i.test(error.message || '')
  ) {
    const basic = {
      slug: row.slug,
      title: row.title,
      description: row.description,
      phase: row.phase,
      status: row.status,
    };
    const retry = await supabase
      .from('projects')
      .insert(basic)
      .select(PROJECT_SELECT_BASIC)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return mapProjectRow(data);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateProject(id, patch) {
  if (!id) throw new Error('Project id is required');
  const updates = { ...patch, updated_at: new Date().toISOString() };

  if (updates.phase != null) updates.phase = normalizePhase(updates.phase);
  if (updates.title != null) updates.title = String(updates.title).trim();
  if (updates.slug != null) {
    updates.slug = await ensureUniqueSlug(
      slugifyProjectTitle(updates.slug),
      id
    );
  }
  if (updates.completion_links != null) {
    updates.completion_links = parseCompletionLinks(updates.completion_links);
  }
  if (updates.githubUrl != null && updates.github_url == null) {
    updates.github_url = updates.githubUrl;
  }
  if (updates.github_url != null) {
    updates.github_url = normalizeGithubUrl(updates.github_url);
  }
  if (updates.contributionMeta != null && updates.contribution_meta == null) {
    updates.contribution_meta = updates.contributionMeta;
  }
  delete updates.githubUrl;
  delete updates.contributionMeta;

  // Strip undefined
  Object.keys(updates).forEach((k) => {
    if (updates[k] === undefined) delete updates[k];
  });

  let { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select(PROJECT_SELECT_FULL)
    .maybeSingle();

  if (
    error &&
    /column .* does not exist|completion_|summary|sort_order|github_url|contribution_meta|updated_at/i.test(
      error.message || ''
    )
  ) {
    const basicKeys = [
      'slug',
      'title',
      'description',
      'phase',
      'status',
      'github_url',
    ];
    const basic = {};
    basicKeys.forEach((k) => {
      if (updates[k] !== undefined) basic[k] = updates[k];
    });
    const retry = await supabase
      .from('projects')
      .update(basic)
      .eq('id', id)
      .select(PROJECT_SELECT_BASIC)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
    if (!error && data) {
      // Best-effort write of completion fields one at a time if basic update worked
      for (const key of [
        'summary',
        'completed_at',
        'completion_links',
        'completion_notes',
        'sort_order',
        'updated_at',
      ]) {
        if (updates[key] === undefined) continue;
        const r = await supabase
          .from('projects')
          .update({ [key]: updates[key] })
          .eq('id', id);
        if (r.error) {
          console.warn(`[projectsService] optional column ${key}`, r.error);
        }
      }
      const refreshed = await getProjectById(id);
      return refreshed || mapProjectRow(data);
    }
  }

  if (error) throw error;
  return mapProjectRow(data);
}

/**
 * Mark project complete / released and store catalog fields.
 * Sets status Completed + completed_at (closes donation attribution window).
 * Leaves tasks, contributors, and description intact.
 *
 * @param {string} id
 * @param {{
 *   completed_at?: string|null,
 *   completion_links?: Array,
 *   completion_notes?: string|null,
 *   summary?: string|null,
 * }} payload
 */
export async function completeProject(id, payload = {}) {
  if (!id) throw new Error('Project id is required');

  const dateRaw =
    payload.completed_at != null && String(payload.completed_at).trim()
      ? String(payload.completed_at).trim()
      : null;
  if (!dateRaw) {
    throw new Error('Release date is required');
  }
  const completedAt = new Date(
    dateRaw.includes('T') ? dateRaw : `${dateRaw}T12:00:00`
  );
  if (Number.isNaN(completedAt.getTime())) {
    throw new Error('Release date is not valid');
  }

  const patch = {
    status: 'Completed',
    completed_at: completedAt.toISOString(),
    completion_links: parseCompletionLinks(payload.completion_links || []),
  };

  if (payload.completion_notes !== undefined) {
    patch.completion_notes =
      payload.completion_notes != null
        ? String(payload.completion_notes).trim() || null
        : null;
  }

  // Optional short blurb for phase hub + Released Games cards
  if (payload.summary !== undefined) {
    patch.summary =
      payload.summary != null ? String(payload.summary).trim() || null : null;
  }

  return updateProject(id, patch);
}

/** Move a completed project back to active board (donations can attach again) */
export async function reactivateProject(id, status = 'In Development') {
  return updateProject(id, {
    status,
    completed_at: null,
  });
}

/**
 * Active projects that have a Task Board (/projects/:slug/board).
 * In Development only (not Planning, not Completed). Includes light open-task counts.
 */
export async function listActiveTaskBoards() {
  const phases = ['Early', 'Mid', 'Late'];
  const all = [];
  for (const phase of phases) {
    try {
      const rows = await listProjectsByPhase(phase, { onlyInDevelopment: true });
      all.push(...(rows || []));
    } catch (err) {
      console.warn('[projectsService] listActiveTaskBoards', phase, err);
    }
  }

  const seen = new Set();
  const boards = [];
  for (const p of all) {
    const key = p.id || p.slug;
    if (!key || seen.has(key)) continue;
    if (!isProjectInDevelopment(p)) continue;
    seen.add(key);
    const slug = p.slug || p.id;
    boards.push({
      id: p.id,
      slug,
      title: displayProjectTitle(p),
      phase: normalizePhase(p.phase),
      status: p.status || 'In Development',
      description: p.summary || p.description || '',
      boardPath: `/projects/${slug}/board`,
      hubPath: `/projects/${slug}`,
      openTasks: null,
      totalTasks: null,
      sort_order: p.sort_order || 0,
    });
  }

  boards.sort((a, b) => {
    const so = (a.sort_order || 0) - (b.sort_order || 0);
    if (so !== 0) return so;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  // Light task counts (open = ToDo claimable work)
  const uuids = boards.map((b) => b.id).filter(Boolean);
  if (uuids.length > 0) {
    try {
      let { data, error } = await supabase
        .from('tasks')
        .select('project_id, status, board_scope')
        .in('project_id', uuids)
        .eq('board_scope', 'public');
      if (error && /board_scope/i.test(error.message || '')) {
        const retry = await supabase
          .from('tasks')
          .select('project_id, status')
          .in('project_id', uuids);
        data = retry.data;
        error = retry.error;
      }
      if (!error && data) {
        const openBy = new Map();
        const totalBy = new Map();
        for (const row of data) {
          if (String(row.board_scope || 'public') === 'staging') continue;
          const pid = row.project_id;
          if (!pid) continue;
          totalBy.set(pid, (totalBy.get(pid) || 0) + 1);
          const st = String(row.status || '');
          if (st === 'ToDo' || st === 'todo') {
            openBy.set(pid, (openBy.get(pid) || 0) + 1);
          }
        }
        for (const b of boards) {
          if (!b.id) continue;
          b.openTasks = openBy.get(b.id) ?? 0;
          b.totalTasks = totalBy.get(b.id) ?? 0;
        }
      }
    } catch (err) {
      console.warn('[projectsService] listActiveTaskBoards counts', err);
    }
  }

  return boards;
}

export const projectsService = {
  listProjectsByPhase,
  listReleasedGames,
  listActiveTaskBoards,
  getReleasedGameBySlug,
  getProjectById,
  createProject,
  updateProject,
  completeProject,
  reactivateProject,
  slugifyProjectTitle,
  parseCompletionLinks,
  isProjectCompleted,
  isProjectInDevelopment,
  normalizePhase,
  withReleaseExtras,
  parseReleaseMeta,
  emptyReleaseMeta,
};

export default projectsService;
