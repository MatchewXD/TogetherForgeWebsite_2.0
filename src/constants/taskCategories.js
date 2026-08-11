/**
 * Task board categories + shared visual styles.
 * Use these everywhere (cards, detail, filters, forms) for consistent scanning.
 */

export const TASK_CATEGORIES = [
  'Code',
  'Art',
  'Design',
  'Writing',
  'Level Design',
  'Audio',
  'QA',
  'Other',
];

/**
 * Soft fill + readable text + border. Text label always required with color.
 * Keys are normalized (lowercase, stripped).
 */
const CATEGORY_STYLES = {
  code: {
    label: 'Code',
    badge:
      'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/50',
    text: 'text-neon-cyan',
    swatch: 'bg-neon-cyan',
    ring: 'ring-neon-cyan/40',
  },
  coding: {
    label: 'Code',
    badge:
      'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/50',
    text: 'text-neon-cyan',
    swatch: 'bg-neon-cyan',
    ring: 'ring-neon-cyan/40',
  },
  art: {
    label: 'Art',
    badge:
      'bg-neon-magenta/15 text-neon-magenta border-neon-magenta/50',
    text: 'text-neon-magenta',
    swatch: 'bg-neon-magenta',
    ring: 'ring-neon-magenta/40',
  },
  design: {
    label: 'Design',
    badge:
      'bg-neon-purple/15 text-neon-purple border-neon-purple/50',
    text: 'text-neon-purple',
    swatch: 'bg-neon-purple',
    ring: 'ring-neon-purple/40',
  },
  writing: {
    label: 'Writing',
    badge:
      'bg-semantic-achievement/15 text-semantic-achievement border-semantic-achievement/50',
    text: 'text-semantic-achievement',
    swatch: 'bg-semantic-achievement',
    ring: 'ring-semantic-achievement/40',
  },
  'level design': {
    label: 'Level Design',
    badge:
      'bg-neon-green/15 text-neon-green border-neon-green/50',
    text: 'text-neon-green',
    swatch: 'bg-neon-green',
    ring: 'ring-neon-green/40',
  },
  leveldesign: {
    label: 'Level Design',
    badge:
      'bg-neon-green/15 text-neon-green border-neon-green/50',
    text: 'text-neon-green',
    swatch: 'bg-neon-green',
    ring: 'ring-neon-green/40',
  },
  audio: {
    label: 'Audio',
    badge:
      'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/50',
    text: 'text-semantic-warning',
    swatch: 'bg-semantic-warning',
    ring: 'ring-semantic-warning/40',
  },
  sound: {
    label: 'Audio',
    badge:
      'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/50',
    text: 'text-semantic-warning',
    swatch: 'bg-semantic-warning',
    ring: 'ring-semantic-warning/40',
  },
  qa: {
    label: 'QA',
    badge:
      'bg-sky-400/15 text-sky-300 border-sky-400/45',
    text: 'text-sky-300',
    swatch: 'bg-sky-400',
    ring: 'ring-sky-400/40',
  },
  testing: {
    label: 'QA',
    badge:
      'bg-sky-400/15 text-sky-300 border-sky-400/45',
    text: 'text-sky-300',
    swatch: 'bg-sky-400',
    ring: 'ring-sky-400/40',
  },
  'qa / testing': {
    label: 'QA',
    badge:
      'bg-sky-400/15 text-sky-300 border-sky-400/45',
    text: 'text-sky-300',
    swatch: 'bg-sky-400',
    ring: 'ring-sky-400/40',
  },
  docs: {
    label: 'Docs',
    badge:
      'bg-slate-400/15 text-slate-300 border-slate-400/45',
    text: 'text-slate-300',
    swatch: 'bg-slate-400',
    ring: 'ring-slate-400/40',
  },
  documentation: {
    label: 'Docs',
    badge:
      'bg-slate-400/15 text-slate-300 border-slate-400/45',
    text: 'text-slate-300',
    swatch: 'bg-slate-400',
    ring: 'ring-slate-400/40',
  },
  other: {
    label: 'Other',
    badge:
      'bg-cyber-surface text-text-secondary border-cyber-border',
    text: 'text-text-secondary',
    swatch: 'bg-text-muted',
    ring: 'ring-cyber-border',
  },
};

const FALLBACK = CATEGORY_STYLES.other;

/** Normalize free-form category strings for lookup */
export function normalizeTaskCategoryKey(category) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * @returns {{ label: string, badge: string, text: string, swatch: string, ring: string }}
 */
export function getTaskCategoryStyle(category) {
  const key = normalizeTaskCategoryKey(category);
  if (!key) return FALLBACK;
  if (CATEGORY_STYLES[key]) return CATEGORY_STYLES[key];
  // Compact key without spaces (e.g. leveldesign)
  const compact = key.replace(/\s+/g, '');
  if (CATEGORY_STYLES[compact]) return CATEGORY_STYLES[compact];
  return FALLBACK;
}

export function getTaskCategoryBadgeClass(category) {
  return getTaskCategoryStyle(category).badge;
}

export function getTaskCategoryTextClass(category) {
  return getTaskCategoryStyle(category).text;
}

/**
 * Does this task match any of the selected board category filters?
 * Empty selected list = all categories.
 * "Other" also matches missing/unknown categories.
 */
export function taskMatchesCategoryFilter(task, selectedCategories = []) {
  if (!selectedCategories?.length) return true;
  const raw = String(task?.category || '').trim();
  const key = normalizeTaskCategoryKey(raw);
  return selectedCategories.some((sel) => {
    const selKey = normalizeTaskCategoryKey(sel);
    if (selKey === 'other') {
      if (!key) return true;
      // Known preset categories should not count as Other
      const isKnownPreset = TASK_CATEGORIES.some(
        (c) => normalizeTaskCategoryKey(c) === key && c !== 'Other'
      );
      return !isKnownPreset;
    }
    return key === selKey || key.replace(/\s+/g, '') === selKey.replace(/\s+/g, '');
  });
}
