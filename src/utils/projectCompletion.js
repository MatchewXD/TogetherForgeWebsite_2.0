/**
 * Shared helpers for Mark as Completed / Released flow.
 * Used by phase Edit pages (Early first; Mid/Late can reuse the same modal).
 */

/** Standard release link kinds collected on the completion form */
export const STANDARD_LINK_KINDS = ['play', 'download', 'buy'];

export function emptyCompletionForm() {
  return {
    completed_at: '',
    play_url: '',
    download_url: '',
    buy_url: '',
    release_summary: '',
    confirmed: false,
  };
}

function toDateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Prefill completion form from an existing project row.
 * @param {object|null} project
 */
export function completionFormFromProject(project) {
  const links = Array.isArray(project?.completion_links)
    ? project.completion_links
    : [];

  const byKind = (kind) => {
    const hit = links.find(
      (l) =>
        String(l.kind || '').toLowerCase() === kind ||
        String(l.label || '').toLowerCase() === kind
    );
    return hit?.url ? String(hit.url).trim() : '';
  };

  // Fallback: match common labels if kind missing
  const byLabel = (...labels) => {
    const set = new Set(labels.map((s) => s.toLowerCase()));
    const hit = links.find((l) => set.has(String(l.label || '').toLowerCase()));
    return hit?.url ? String(hit.url).trim() : '';
  };

  return {
    completed_at:
      toDateInputValue(project?.completed_at) ||
      toDateInputValue(new Date().toISOString()),
    play_url: byKind('play') || byLabel('play', 'play free', 'play now'),
    download_url:
      byKind('download') || byLabel('download', 'get it', 'installer'),
    buy_url:
      byKind('buy') ||
      byKind('steam') ||
      byKind('store') ||
      byLabel('buy', 'steam', 'store', 'purchase'),
    release_summary: String(
      project?.completion_notes || project?.summary || ''
    ).trim(),
    confirmed: false,
  };
}

/**
 * Build completion_links array from structured form fields.
 * Only includes rows with a non-empty URL.
 */
export function buildCompletionLinksFromForm(form) {
  const out = [];
  const play = String(form?.play_url || '').trim();
  const download = String(form?.download_url || '').trim();
  const buy = String(form?.buy_url || '').trim();

  if (play) out.push({ label: 'Play', url: play, kind: 'play' });
  if (download) {
    out.push({ label: 'Download', url: download, kind: 'download' });
  }
  if (buy) out.push({ label: 'Buy', url: buy, kind: 'buy' });

  return out;
}

/**
 * Validate completion form before save.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateCompletionForm(form, { requireConfirm = true } = {}) {
  const date = String(form?.completed_at || '').trim();
  if (!date) {
    return { ok: false, error: 'Release date is required.' };
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'Release date is not valid.' };
  }
  if (requireConfirm && !form?.confirmed) {
    return {
      ok: false,
      error:
        'Confirm that you want to mark this project completed and move it off the active board.',
    };
  }
  return { ok: true };
}

/**
 * Payload for projectsService.completeProject
 */
export function completionPayloadFromForm(form) {
  const summary = String(form?.release_summary || '').trim() || null;
  return {
    completed_at: String(form?.completed_at || '').trim() || null,
    completion_notes: summary,
    /** Also seed card summary when staff provides a short release blurb */
    summary,
    completion_links: buildCompletionLinksFromForm(form),
  };
}

export function releasedDetailPath(project) {
  const slug = project?.slug || project?.id;
  return slug ? `/released/${slug}` : '/released';
}
