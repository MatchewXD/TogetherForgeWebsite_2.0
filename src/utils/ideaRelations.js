/**
 * Related Ideas / parent-child helpers (pure).
 * Model: adjacency list via parent_idea_id — one level deep in v1.
 */

/** Max nesting depth enforced in product v1 (parent = root only). */
export const IDEA_RELATION_MAX_DEPTH = 1;

/**
 * @param {object|null|undefined} idea
 * @returns {number|null}
 */
export function getParentIdeaId(idea) {
  if (!idea) return null;
  const raw = idea.parent_idea_id ?? idea.parentIdeaId ?? null;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object|null|undefined} idea
 */
export function ideaHasParent(idea) {
  return getParentIdeaId(idea) != null;
}

/**
 * Normalize a parent id from form / API input.
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
export function normalizeParentIdeaId(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Client-side validation before save (server trigger is source of truth).
 *
 * @param {{
 *   childId?: number|null,
 *   parentId?: number|null,
 *   parentIdea?: object|null,
 *   childHasChildren?: boolean,
 * }} opts
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateParentLink(opts = {}) {
  const parentId = normalizeParentIdeaId(opts.parentId);
  if (parentId == null) return { ok: true };

  const childId =
    opts.childId != null && Number.isFinite(Number(opts.childId))
      ? Number(opts.childId)
      : null;

  if (childId != null && parentId === childId) {
    return {
      ok: false,
      message: 'An idea cannot build on itself.',
    };
  }

  if (opts.childHasChildren) {
    return {
      ok: false,
      message:
        'This idea already has related ideas building on it, so it cannot link to a parent (one level only for now).',
    };
  }

  const parent = opts.parentIdea;
  if (parent) {
    if (getParentIdeaId(parent) != null) {
      return {
        ok: false,
        message:
          'That idea already builds on another idea. Only one level of related ideas is allowed for now.',
      };
    }
    // Parent id mismatch safety
    const pid = Number(parent.id);
    if (Number.isFinite(pid) && pid !== parentId) {
      return { ok: false, message: 'Parent idea does not match selection.' };
    }
  }

  return { ok: true };
}

/**
 * Whether an idea can be chosen as a parent (must be a root).
 * @param {object} candidate
 * @param {number|null} [excludeChildId]
 */
export function canBeParentIdea(candidate, excludeChildId = null) {
  if (!candidate || candidate.id == null) return false;
  if (getParentIdeaId(candidate) != null) return false;
  if (
    excludeChildId != null &&
    Number(candidate.id) === Number(excludeChildId)
  ) {
    return false;
  }
  return true;
}

/**
 * Human copy for credit lines.
 */
export function relatedCreditLine(parentTitle, creatorName) {
  const title = String(parentTitle || 'Untitled idea').trim() || 'Untitled idea';
  const by = String(creatorName || '').trim();
  if (by) return { title, by, text: `This idea builds on ${title} by ${by}` };
  return { title, by: '', text: `This idea builds on ${title}` };
}

/**
 * Map DB/API error messages to readable copy.
 * @param {unknown} err
 */
export function humanizeParentLinkError(err) {
  const msg = String(err?.message || err || '');
  if (/IDEA_PARENT_SELF/i.test(msg)) {
    return 'An idea cannot build on itself.';
  }
  if (/IDEA_PARENT_NOT_ROOT/i.test(msg)) {
    return 'That idea already builds on another idea. Only one level of related ideas is allowed for now.';
  }
  if (/IDEA_PARENT_HAS_CHILDREN/i.test(msg)) {
    return 'This idea already has related ideas building on it, so it cannot link to a parent (one level only for now).';
  }
  if (/IDEA_PARENT_MISSING/i.test(msg)) {
    return 'The selected parent idea could not be found.';
  }
  if (/parent_idea_id|column .* does not exist/i.test(msg)) {
    return 'Related ideas need a database update. Run supabase/sql/supabase_idea_parent.sql in the Supabase SQL Editor.';
  }
  return msg || 'Could not save related idea link.';
}
