/**
 * Shared idea status helpers for listing cards, filters, and detail pages.
 *
 * Workflow statuses (stored on ideas.status):
 *   Draft | Proposed | UnderReview | Adopted | Archived
 *
 * Public labels: only Under Review and Adopted (when TF engages).
 * Vote heat (filters only, not default badges): Promising 50–99, Hot 100+.
 */

/** Promising = 50–99 votes */
export const PROMISING_MIN_VOTES = 50;
/** Hot = 100+ votes */
export const HOT_MIN_VOTES = 100;

export const WORKFLOW_STATUSES = [
  'Draft',
  'Proposed',
  'UnderReview',
  'Adopted',
  'Archived',
];

/** Display labels for workflow + heat chips */
export const STATUS_LABELS = {
  Draft: 'Draft',
  Proposed: 'Proposed',
  UnderReview: 'Under Review',
  Adopted: 'Adopted',
  Archived: 'Archived',
  Open: 'Open',
  Promising: 'Promising',
  Hot: 'Hot',
  Linked: 'Linked',
};

/**
 * Normalize raw DB / form status into a workflow key.
 * Returns null if empty or unrecognized heat-only values.
 */
export function normalizeWorkflowStatus(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!s) return null;
  if (s === 'draft') return 'Draft';
  if (s === 'proposed' || s === 'open' || s === 'new') return 'Proposed';
  if (
    s === 'underreview' ||
    s === 'inreview' ||
    s === 'review'
  ) {
    return 'UnderReview';
  }
  if (s === 'adopted' || s === 'accepted' || s === 'approved') return 'Adopted';
  if (s === 'archived' || s === 'closed' || s === 'rejected') return 'Archived';
  // Exact workflow keys already correct
  if (
    ['Draft', 'Proposed', 'UnderReview', 'Adopted', 'Archived'].includes(
      String(raw).trim()
    )
  ) {
    return String(raw).trim();
  }
  return null;
}

/**
 * Stored / default workflow status for an idea row.
 */
export function getWorkflowStatus(idea) {
  return normalizeWorkflowStatus(idea?.status) || 'Proposed';
}

/**
 * Vote-heat bucket for filters. Not shown as a default public badge.
 * @returns {'Hot'|'Promising'|null}
 */
export function getIdeaVoteHeat(idea) {
  const votes = Math.max(0, Number(idea?.votes) || 0);
  if (votes >= HOT_MIN_VOTES) return 'Hot';
  if (votes >= PROMISING_MIN_VOTES) return 'Promising';
  return null;
}

/**
 * Public badge: only when Together Forge has engaged.
 * @returns {'Adopted'|'UnderReview'|null}
 */
export function getPublicIdeaLabel(idea) {
  if (!idea) return null;
  const workflow = getWorkflowStatus(idea);
  if (workflow === 'Adopted') return 'Adopted';
  if (workflow === 'UnderReview') return 'UnderReview';
  return null;
}

/**
 * Derive listing/filter status (not always shown on cards).
 * Priority: Adopted > UnderReview > vote heat > Proposed
 */
export function deriveIdeaStatus(idea) {
  const workflow = getWorkflowStatus(idea);

  if (workflow === 'Draft') return 'Draft';
  if (workflow === 'Archived') return 'Archived';
  if (workflow === 'Adopted') return 'Adopted';
  if (workflow === 'UnderReview') return 'UnderReview';

  const heat = getIdeaVoteHeat(idea);
  if (heat) return heat;

  const raw = idea?.status && String(idea.status).trim();
  if (raw && ['Open', 'Promising', 'Hot'].includes(raw)) {
    return raw;
  }

  return 'Proposed';
}

export function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map((t) => (typeof t === 'string' ? t : t?.name || t?.label || String(t)))
      .map((t) => String(t).trim())
      .filter(Boolean);
  }
  return String(tags)
    .split(/[,;#|]+/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean);
}

/** Visual style for status chip. */
export function statusChipClasses(status) {
  switch (status) {
    case 'Hot':
      return 'border-orange-400/50 bg-orange-400/10 text-orange-300';
    case 'Promising':
      return 'border-neon-purple/40 bg-neon-purple/10 text-neon-purple';
    case 'UnderReview':
      return 'border-amber-400/50 bg-amber-400/10 text-amber-200';
    case 'Adopted':
      return 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300';
    case 'Archived':
      return 'border-white/15 bg-white/5 text-text-muted';
    case 'Draft':
      return 'border-white/20 bg-white/5 text-text-muted';
    case 'Linked':
      return 'border-sky-400/50 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20 hover:border-sky-300/70';
    case 'Proposed':
    case 'Open':
    default:
      return 'border-cyber-border bg-cyber-surface text-text-secondary';
  }
}

export function statusLabel(status) {
  if (!status) return '';
  return STATUS_LABELS[status] || status;
}

export function getIdeaProjectKey(idea) {
  return (
    idea?.project_id ||
    idea?.projectId ||
    idea?.project_slug ||
    idea?.projectSlug ||
    null
  );
}

/**
 * Friendly display names for known project / pipeline ids stored on ideas.project_id.
 * User-facing: stages are "Early Game" / "Mid Game" / "Late Game" (not "Phase").
 */
/** Public URL slug for the Early Game project. */
export const TETHER_SLUG = 'tether';
/** Retired URL slug — still accepted, always rewritten to TETHER_SLUG. */
export const TETHER_LEGACY_SLUG = 'prototype-systems';

const PROJECT_DISPLAY_NAMES = {
  [TETHER_LEGACY_SLUG]: 'Tether',
  [TETHER_SLUG]: 'Tether',
  early: 'Early Game',
  'early-phase': 'Early Game',
  mid: 'Mid Game',
  'mid-phase': 'Mid Game',
  late: 'Late Game',
  'late-phase': 'Late Game',
  'core-features': 'Mid Game Ambitions',
  'polish-playtests': 'Stability and Polish',
};

/** Old product name; never show this to users. */
const LEGACY_PROTOTYPE_SYSTEMS = /^prototype[\s_-]*systems$/i;

/** True when a slug/id is Tether, including the retired Prototype Systems slug. */
export function isTetherProjectSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  return s === TETHER_SLUG || s === TETHER_LEGACY_SLUG;
}

/**
 * Public URL slug. Prototype Systems always becomes `tether`.
 * @param {string|null|undefined} slug
 * @returns {string}
 */
export function canonicalProjectSlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return '';
  if (isTetherProjectSlug(s) || LEGACY_PROTOTYPE_SYSTEMS.test(s.replace(/[_-]+/g, ' '))) {
    return TETHER_SLUG;
  }
  return s.toLowerCase() === s ? s : s;
}

/**
 * Keys that should match Tether ideas/projects (current slug + legacy slug).
 * @param {string|null|undefined} slug
 * @returns {string[]}
 */
export function expandProjectSlugAliases(slug) {
  const raw = String(slug || '').trim();
  if (!raw) return [];
  if (isTetherProjectSlug(raw)) return [TETHER_SLUG, TETHER_LEGACY_SLUG];
  const canonical = canonicalProjectSlug(raw);
  if (canonical === TETHER_SLUG) return [TETHER_SLUG, TETHER_LEGACY_SLUG];
  return [raw];
}

const STUDIO_STAGE_KEYS = new Set([
  'early',
  'early-phase',
  'mid',
  'mid-phase',
  'late',
  'late-phase',
]);

/** True when project_id points at a studio stage (Early/Mid/Late Game), not a project. */
export function isStudioStageKey(key) {
  if (key == null) return false;
  return STUDIO_STAGE_KEYS.has(String(key).trim().toLowerCase());
}

/**
 * @param {string|null|undefined} key - slug / project_id
 * @returns {string|null}
 */
export function getProjectDisplayName(key) {
  if (key == null || String(key).trim() === '') return null;
  const raw = String(key).trim();
  const lower = raw.toLowerCase();
  if (PROJECT_DISPLAY_NAMES[lower]) return PROJECT_DISPLAY_NAMES[lower];
  // Never surface the retired product name (slug or free text)
  if (LEGACY_PROTOTYPE_SYSTEMS.test(raw.replace(/[_-]+/g, ' '))) {
    return 'Tether';
  }
  // Humanize slug-ish keys: some-slug → Some Slug
  if (raw.includes('-') || raw.includes('_')) {
    return raw
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return raw;
}

/**
 * User-facing project title. Prefer mapped names for known slugs;
 * rewrite legacy "Prototype Systems" titles to Tether.
 * @param {{ slug?: string, title?: string, id?: string }|null|undefined} project
 * @returns {string}
 */
export function displayProjectTitle(project) {
  if (!project) return 'Project';
  const slug = String(project.slug || project.id || '')
    .trim()
    .toLowerCase();
  if (slug && PROJECT_DISPLAY_NAMES[slug]) return PROJECT_DISPLAY_NAMES[slug];
  const title = String(project.title || '').trim();
  if (title && LEGACY_PROTOTYPE_SYSTEMS.test(title)) return 'Tether';
  if (title) return title;
  return getProjectDisplayName(project.slug || project.id) || 'Project';
}

/**
 * Resolve a user-facing label for what an idea is linked to.
 * Stages → "Early Game" etc.; projects → title or mapped name (e.g. Tether).
 * @param {string|null|undefined} key
 * @param {string|null|undefined} [optionalTitle] - DB/catalog title if known
 */
export function resolveLinkDisplayName(key, optionalTitle = null) {
  if (key == null || String(key).trim() === '') return null;
  if (isStudioStageKey(key)) return getProjectDisplayName(key);
  const mapped = getProjectDisplayName(key);
  if (mapped && mapped === 'Tether') return 'Tether';
  const title = optionalTitle && String(optionalTitle).trim();
  if (title && !LEGACY_PROTOTYPE_SYSTEMS.test(title)) return title;
  return mapped || title || String(key).trim();
}

/**
 * Parse guided_data JSON from DB (object or string).
 */
export function parseGuidedData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '{}' || trimmed === 'null') return {};
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Parse JSON-ish values that may arrive as arrays, objects, or strings. */
export function parseMaybeJson(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t === '[]' || t === '{}' || t === 'null') return null;
    try {
      return JSON.parse(t);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Normalize features from guided_data.features and/or ideas.features column.
 */
export function extractIdeaFeatures(idea) {
  const guided = parseGuidedData(idea?.guided_data);
  const candidates = [
    guided.features,
    parseMaybeJson(idea?.features),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const list = Array.isArray(raw) ? raw : null;
    if (!list || !list.length) continue;

    const normalized = list
      .map((f) => {
        if (typeof f === 'string') {
          const t = f.trim();
          return t ? { name: '', description: t } : null;
        }
        if (f && typeof f === 'object') {
          const name = String(f.name || f.title || '').trim();
          const description = String(
            f.description || f.body || f.text || ''
          ).trim();
          if (!name && !description) return null;
          return { name, description };
        }
        return null;
      })
      .filter(Boolean);

    if (normalized.length) return normalized;
  }
  return [];
}

/**
 * Normalize additional notes from guided_data and legacy columns.
 */
export function extractIdeaNotes(idea) {
  const guided = parseGuidedData(idea?.guided_data);
  const candidates = [
    guided.additional_notes,
    guided.additionalNotes,
    parseMaybeJson(idea?.additional_notes),
  ];

  for (const raw of candidates) {
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      const notes = raw.map((n) => String(n ?? '').trim()).filter(Boolean);
      if (notes.length) return notes;
      continue;
    }
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t || t === '[]') continue;
      return [t];
    }
  }
  return [];
}

/**
 * Pull single-field optional details for display (guided + flat columns).
 */
export function extractIdeaTextSections(idea) {
  const guided = parseGuidedData(idea?.guided_data);
  const pick = (...vals) => {
    for (const v of vals) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s && s !== '[]' && s !== '{}') return s;
    }
    return null;
  };

  const sections = [
    {
      key: 'art',
      label: 'Art Style',
      value: pick(
        guided.art_style,
        guided.artStyle,
        guided.visual_style,
        idea?.visual_style
      ),
    },
    {
      key: 'platforms',
      label: 'Target Platforms',
      value: pick(
        guided.target_platforms,
        guided.targetPlatforms,
        idea?.target_platforms
      ),
    },
    {
      key: 'loop',
      label: 'Core Loop Length',
      value: pick(
        guided.core_loop_length,
        guided.coreLoopLength,
        idea?.core_loop_length
      ),
    },
    {
      key: 'inspiration',
      label: 'Primary Inspiration / Comparable Games',
      value: pick(
        guided.primary_inspiration,
        guided.primaryInspiration,
        guided.inspiration,
        idea?.inspiration
      ),
    },
    {
      key: 'scope',
      label: 'Estimated Scope',
      value: pick(
        guided.estimated_scope,
        guided.estimatedScope,
        idea?.estimated_scope
      ),
    },
    {
      key: 'twitch',
      label: 'Twitch and Community Integration',
      value: pick(
        guided.twitch_community,
        guided.twitchIntegration,
        idea?.twitch_integration
      ),
    },
    {
      key: 'env',
      label: 'Environmental Storytelling',
      value: pick(
        guided.environmental_storytelling,
        guided.environmentalStorytelling,
        idea?.environmental_storytelling
      ),
    },
    {
      key: 'economy',
      label: 'Economy System',
      value: pick(
        guided.economy_system,
        guided.economySystem,
        idea?.economy_description
      ),
    },
    {
      key: 'story',
      label: 'Story and Narrative',
      value: pick(
        guided.story_narrative,
        guided.storyNarrative,
        idea?.story_overview
      ),
    },
    {
      key: 'visual',
      label: 'Visual Style',
      value: pick(
        // Only when distinct from art_style already shown
        !pick(guided.art_style, guided.artStyle)
          ? pick(guided.visual_style, idea?.visual_style)
          : null
      ),
    },
    {
      key: 'multiplayer',
      label: 'Multiplayer Type',
      value: pick(guided.multiplayer_type, idea?.multiplayer_type),
    },
  ];

  return sections.filter((s) => !!s.value);
}
