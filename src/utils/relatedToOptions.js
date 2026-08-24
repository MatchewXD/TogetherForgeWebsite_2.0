/**
 * "Related to" dropdown for idea creation (Guided + Wizard).
 * Groups: Phases (stable) + Projects (live from Supabase projects table).
 */

import { supabase } from '../lib/supabase';
import {
  isStudioStageKey,
  resolveLinkDisplayName,
  canonicalProjectSlug,
} from './ideaStatus';

/** Fixed phase options — not projects. Empty id = community (unlinked). */
export const RELATED_PHASE_OPTIONS = [
  { id: '', label: 'Community Idea' },
  { id: 'early', label: 'Early Game' },
  { id: 'mid', label: 'Mid Game' },
  { id: 'late', label: 'Late Game' },
];

/** Temporary / catalog placeholders that must not appear as "projects". */
const PLACEHOLDER_PROJECT_IDS = new Set([
  'core-features',
  'polish-playtests',
]);

/**
 * Load real workspace projects for the Projects group.
 * Automatically picks up new projects as they are added to the projects table.
 * @returns {Promise<Array<{ id: string, label: string }>>}
 */
export async function loadRelatedProjectOptions() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, slug, title')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[relatedToOptions] load projects', error);
      return fallbackProjects();
    }

    const rows = data || [];
    const seen = new Set();
    const projects = [];

    for (const p of rows) {
      const id = String(p.slug || p.id || '').trim();
      if (!id) continue;
      // Never list phase keys as projects
      if (isStudioStageKey(id)) continue;
      if (PLACEHOLDER_PROJECT_IDS.has(id.toLowerCase())) continue;
      const optionId = canonicalProjectSlug(id) || id;
      const key = String(optionId).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Always Tether for the early project slug (never "Prototype Systems")
      const label = resolveLinkDisplayName(optionId, p.title) || p.title || optionId;
      projects.push({ id: optionId, label });
    }

    // If DB empty, still show known live project so Early/Tether workflows work
    if (projects.length === 0) {
      return fallbackProjects();
    }

    return projects;
  } catch (err) {
    console.warn('[relatedToOptions] load projects', err);
    return fallbackProjects();
  }
}

function fallbackProjects() {
  // Minimal safe fallback when projects table is unavailable
  return [{ id: 'tether', label: 'Tether' }];
}

/**
 * Ensure a legacy/current value still appears in the select so existing ideas
 * are not forced blank (e.g. old core-features ids).
 */
export function ensureRelatedValueOption(phases, projects, currentId) {
  const id = currentId != null ? String(currentId).trim() : '';
  if (!id) return { phases, projects };
  const canonical = canonicalProjectSlug(id) || id;

  const inPhases = phases.some((p) => p.id === id || p.id === canonical);
  const inProjects = projects.some((p) => p.id === id || p.id === canonical);
  if (inPhases || inProjects) return { phases, projects };

  if (isStudioStageKey(id)) {
    return {
      phases: [
        ...phases,
        { id, label: resolveLinkDisplayName(id) || id },
      ],
      projects,
    };
  }

  return {
    phases,
    projects: [
      ...projects,
      { id, label: resolveLinkDisplayName(id) || id },
    ],
  };
}

/**
 * Render helper data for a select with optgroups.
 * @returns {{ phases: Array, projects: Array }}
 */
export async function getRelatedToGroupedOptions(currentId = '') {
  const projects = await loadRelatedProjectOptions();
  return ensureRelatedValueOption(
    RELATED_PHASE_OPTIONS,
    projects,
    currentId
  );
}
