/**
 * Pure helpers for hybrid idea tags (normalize, public selectability, parse).
 */
import {
  CURATED_CORE_TAGS,
  TAG_MAX_LENGTH,
  TAG_PROMOTION_THRESHOLD,
  TAG_STATUS,
} from '../constants/ideaTags';
import { parseTags as parseTagsBase } from './ideaStatus';

/** Re-export parse for convenience. */
export function parseTagList(tags) {
  return parseTagsBase(tags);
}

/**
 * Display-safe name: trim, strip leading #, collapse spaces, cap length.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeTagName(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ');
  if (!s) return '';
  if (s.length > TAG_MAX_LENGTH) s = s.slice(0, TAG_MAX_LENGTH);
  return s;
}

/**
 * Stable slug for equality / catalog keys.
 * @param {string} raw
 * @returns {string}
 */
export function slugifyTag(raw) {
  const name = normalizeTagName(raw);
  if (!name) return '';
  let s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length > 48) s = s.slice(0, 48).replace(/-$/, '');
  return s;
}

/**
 * Whether a catalog row is shown in public pickers / filters.
 * @param {{ status?: string, usage_count?: number, usageCount?: number }|null|undefined} tag
 * @param {number} [threshold]
 */
export function isTagPubliclySelectable(tag, threshold = TAG_PROMOTION_THRESHOLD) {
  if (!tag) return false;
  const status = String(tag.status || '').toLowerCase();
  if (status === TAG_STATUS.HIDDEN) return false;
  if (status === TAG_STATUS.CURATED || status === TAG_STATUS.APPROVED) return true;
  if (status === TAG_STATUS.SUGGESTED) {
    const usage = Number(tag.usage_count ?? tag.usageCount ?? 0) || 0;
    return usage >= threshold;
  }
  // Unknown status: only if usage clears threshold
  const usage = Number(tag.usage_count ?? tag.usageCount ?? 0) || 0;
  return usage >= threshold;
}

/**
 * Sort public tags: usage desc, then name.
 * @param {Array<{ name?: string, usage_count?: number, usageCount?: number }>} tags
 */
export function sortTagsByUsage(tags) {
  return [...(tags || [])].sort((a, b) => {
    const ua = Number(a.usage_count ?? a.usageCount ?? 0) || 0;
    const ub = Number(b.usage_count ?? b.usageCount ?? 0) || 0;
    if (ub !== ua) return ub - ua;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
      sensitivity: 'base',
    });
  });
}

/**
 * Dedupe tag names by slug, keep first casing.
 * @param {string[]} names
 * @returns {string[]}
 */
export function uniqueTagNames(names) {
  const seen = new Set();
  const out = [];
  for (const raw of names || []) {
    const name = normalizeTagName(raw);
    const slug = slugifyTag(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(name);
  }
  return out;
}

/**
 * Serialize selected tags for ideas.tags column.
 * @param {string[]} names
 */
export function serializeTags(names) {
  return uniqueTagNames(names).join(', ');
}

/**
 * Ideas listing URL with one tag pre-selected in the filter.
 * @param {string} tag
 * @returns {string}
 */
export function ideasListHrefForTag(tag) {
  const name = normalizeTagName(tag);
  if (!name) return '/ideas';
  return `/ideas?tag=${encodeURIComponent(name)}`;
}

/**
 * Read selected tag filters from /ideas search params.
 * Supports `?tag=a&tag=b` and `?tags=a,b`.
 * @param {URLSearchParams|{ get?: Function, getAll?: Function }|null|undefined} searchParams
 * @returns {string[]}
 */
export function parseIdeaListTagParams(searchParams) {
  if (!searchParams) return [];
  const repeated =
    typeof searchParams.getAll === 'function'
      ? searchParams.getAll('tag')
      : [];
  const csv =
    typeof searchParams.get === 'function' ? searchParams.get('tags') : '';
  return uniqueTagNames([
    ...(repeated || []),
    ...String(csv || '').split(/[,;#|]+/),
  ]);
}

/**
 * True when two tag lists match by slug (order-independent).
 * @param {string[]} a
 * @param {string[]} b
 */
export function tagNamesEqual(a, b) {
  const as = uniqueTagNames(a)
    .map((n) => slugifyTag(n))
    .sort();
  const bs = uniqueTagNames(b)
    .map((n) => slugifyTag(n))
    .sort();
  if (as.length !== bs.length) return false;
  return as.every((slug, i) => slug === bs[i]);
}

/**
 * Build fallback public list from curated + idea-derived usage (>= threshold).
 * Used when idea_tags table is not deployed yet.
 * @param {Array<{ tags?: string }>} ideas
 * @param {string[]} [extraSelected]
 */
export function buildFallbackPublicTags(ideas = [], extraSelected = []) {
  const usage = new Map(); // slug -> { name, usage_count }

  for (const name of CURATED_CORE_TAGS) {
    const n = normalizeTagName(name);
    const slug = slugifyTag(n);
    if (!slug) continue;
    usage.set(slug, {
      id: `curated:${slug}`,
      slug,
      name: n,
      status: TAG_STATUS.CURATED,
      usage_count: 0,
    });
  }

  for (const idea of ideas) {
    for (const t of parseTagList(idea?.tags)) {
      const name = normalizeTagName(t);
      const slug = slugifyTag(name);
      if (!slug) continue;
      const prev = usage.get(slug);
      if (prev) {
        prev.usage_count += 1;
      } else {
        usage.set(slug, {
          id: `derived:${slug}`,
          slug,
          name,
          status: TAG_STATUS.SUGGESTED,
          usage_count: 1,
        });
      }
    }
  }

  // Selected tags should remain visible in filter chips even if not public
  for (const t of extraSelected) {
    const name = normalizeTagName(t);
    const slug = slugifyTag(name);
    if (!slug) continue;
    if (!usage.has(slug)) {
      usage.set(slug, {
        id: `selected:${slug}`,
        slug,
        name,
        status: TAG_STATUS.SUGGESTED,
        usage_count: 0,
        _selectedOnly: true,
      });
    }
  }

  const list = [...usage.values()].filter(
    (row) => isTagPubliclySelectable(row) || row._selectedOnly
  );
  return sortTagsByUsage(list.map(({ _selectedOnly, ...rest }) => rest));
}

/**
 * Map DB row → client shape.
 */
export function mapIdeaTagRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug || slugifyTag(row.name),
    name: row.name || row.slug,
    status: String(row.status || TAG_STATUS.SUGGESTED).toLowerCase(),
    usage_count: Number(row.usage_count ?? 0) || 0,
    suggested_by: row.suggested_by || null,
    approved_by: row.approved_by || null,
    approved_at: row.approved_at || null,
    hidden_at: row.hidden_at || null,
    notes: row.notes || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function statusLabel(status) {
  switch (String(status || '').toLowerCase()) {
    case TAG_STATUS.CURATED:
      return 'Curated';
    case TAG_STATUS.APPROVED:
      return 'Approved';
    case TAG_STATUS.SUGGESTED:
      return 'Suggested';
    case TAG_STATUS.HIDDEN:
      return 'Hidden';
    default:
      return status || 'Unknown';
  }
}

/**
 * Progress toward public promotion for suggested tags.
 * @param {{ status?: string, usage_count?: number }} tag
 */
export function promotionProgress(tag) {
  const status = String(tag?.status || '').toLowerCase();
  const usage = Number(tag?.usage_count ?? 0) || 0;
  if (status === TAG_STATUS.CURATED || status === TAG_STATUS.APPROVED) {
    return { public: true, usage, need: 0, remaining: 0 };
  }
  if (status === TAG_STATUS.HIDDEN) {
    return { public: false, usage, need: TAG_PROMOTION_THRESHOLD, remaining: null };
  }
  const remaining = Math.max(0, TAG_PROMOTION_THRESHOLD - usage);
  return {
    public: remaining === 0,
    usage,
    need: TAG_PROMOTION_THRESHOLD,
    remaining,
  };
}
