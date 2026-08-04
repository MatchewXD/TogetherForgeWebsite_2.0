/**
 * Official Media video categories.
 * Stored as plain text on official_videos.category.
 * Public filters only show categories that have at least one published video.
 */

export const OFFICIAL_VIDEO_CATEGORIES = [
  'Progress & Updates',
  'Guides',
  'Announcements',
  'Studio / Behind the scenes',
  'Other',
];

/** Map older seed / freeform labels onto the current set when possible */
const LEGACY_CATEGORY_MAP = {
  overview: 'Studio / Behind the scenes',
  studio: 'Studio / Behind the scenes',
  'behind the scenes': 'Studio / Behind the scenes',
  'studio / behind the scenes': 'Studio / Behind the scenes',
  progress: 'Progress & Updates',
  'progress & updates': 'Progress & Updates',
  updates: 'Progress & Updates',
  guide: 'Guides',
  guides: 'Guides',
  'how to help': 'Guides',
  'how-to-help': 'Guides',
  announcement: 'Announcements',
  announcements: 'Announcements',
  release: 'Announcements',
  other: 'Other',
};

/**
 * Normalize a stored category for display / filter keys.
 * Unknown non-empty values pass through so custom staff text still filters.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeOfficialVideoCategory(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const mapped = LEGACY_CATEGORY_MAP[trimmed.toLowerCase()];
  if (mapped) return mapped;
  // Exact match against canonical list (case-sensitive preferred)
  const exact = OFFICIAL_VIDEO_CATEGORIES.find((c) => c === trimmed);
  if (exact) return exact;
  const ci = OFFICIAL_VIDEO_CATEGORIES.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  if (ci) return ci;
  return trimmed;
}

/**
 * Categories present in a video list, ordered by OFFICIAL_VIDEO_CATEGORIES
 * then any extra labels alphabetically. Only non-empty categories.
 * @param {Array<{ category?: string|null }>} videos
 * @returns {string[]}
 */
export function categoriesPresentInVideos(videos) {
  const counts = new Map();
  for (const v of videos || []) {
    const cat = normalizeOfficialVideoCategory(v.category);
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  if (counts.size === 0) return [];

  const ordered = [];
  for (const c of OFFICIAL_VIDEO_CATEGORIES) {
    if (counts.has(c)) ordered.push(c);
  }
  const extras = [...counts.keys()]
    .filter((c) => !OFFICIAL_VIDEO_CATEGORIES.includes(c))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...extras];
}
