/**
 * Shared idea status helpers for listing cards, filters, and detail pages.
 *
 * Workflow statuses (stored on ideas.status):
 *   Proposed | UnderReview | Adopted | Archived
 *
 * Heat / listing chips (derived when not terminal/linked):
 *   Open | Promising | Hot | Linked
 */

export const WORKFLOW_STATUSES = [
  'Proposed',
  'UnderReview',
  'Adopted',
  'Archived',
];

/** Display labels for workflow + heat chips */
export const STATUS_LABELS = {
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
  if (['Proposed', 'UnderReview', 'Adopted', 'Archived'].includes(String(raw).trim())) {
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
 * Derive listing/detail chip status.
 * Priority: Archived > Adopted > Linked > UnderReview > vote heat > Proposed
 */
export function deriveIdeaStatus(idea) {
  const workflow = getWorkflowStatus(idea);

  if (workflow === 'Archived') return 'Archived';
  if (workflow === 'Adopted') return 'Adopted';

  if (idea?.project_id || idea?.projectId || idea?.project_slug) {
    return 'Linked';
  }

  if (workflow === 'UnderReview') return 'UnderReview';

  // Explicit raw heat statuses (legacy)
  const raw = idea?.status && String(idea.status).trim();
  if (raw && ['Open', 'Promising', 'Hot', 'Linked'].includes(raw)) {
    return raw;
  }

  const votes = idea?.votes || 0;
  if (votes >= 15) return 'Hot';
  if (votes >= 5) return 'Promising';
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
    case 'Linked':
      return 'border-sky-400/50 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20 hover:border-sky-300/70';
    case 'Proposed':
    case 'Open':
    default:
      return 'border-cyber-border bg-cyber-surface text-text-secondary';
  }
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Proposed';
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
      key: 'inspiration',
      label: 'Inspiration',
      value: pick(guided.inspiration, idea?.inspiration),
    },
    {
      key: 'visual',
      label: 'Visual Style',
      value: pick(guided.visual_style, idea?.visual_style),
    },
    {
      key: 'multiplayer',
      label: 'Multiplayer Type',
      value: pick(guided.multiplayer_type, idea?.multiplayer_type),
    },
  ];

  return sections.filter((s) => !!s.value);
}
