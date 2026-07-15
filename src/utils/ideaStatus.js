/**
 * Shared idea status helpers for listing cards and filters.
 */

/**
 * Derive listing status (priority: Linked > Hot > Promising > Open).
 */
export function deriveIdeaStatus(idea) {
  if (idea?.project_id || idea?.projectId || idea?.project_slug) {
    return 'Linked';
  }
  const raw = idea?.status && String(idea.status).trim();
  if (raw && ['Open', 'Promising', 'Hot', 'Linked'].includes(raw)) {
    return raw;
  }
  const votes = idea?.votes || 0;
  if (votes >= 15) return 'Hot';
  if (votes >= 5) return 'Promising';
  return 'Open';
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

/** Visual style for status chip (Linked uses a consistent sky/emerald accent). */
export function statusChipClasses(status) {
  switch (status) {
    case 'Hot':
      return 'border-orange-400/50 bg-orange-400/10 text-orange-300';
    case 'Promising':
      return 'border-neon-purple/40 bg-neon-purple/10 text-neon-purple';
    case 'Linked':
      return 'border-sky-400/50 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20 hover:border-sky-300/70';
    case 'Open':
    default:
      return 'border-cyber-border bg-cyber-surface text-text-secondary';
  }
}

export function getIdeaProjectKey(idea) {
  return (
    idea?.project_id ||
    idea?.projectId ||
    idea?.project_slug ||
    idea?.projectSlug ||
    idea?.projectId ||
    null
  );
}
