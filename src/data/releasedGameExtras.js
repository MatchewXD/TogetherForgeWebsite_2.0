/**
 * Optional per-release catalog extras for /released/:slug.
 * Use when release_meta is not yet stored on the projects row, or to
 * seed media / platforms / genre before the admin form exists.
 *
 * Keys: project slug (preferred) or project id.
 * DB `release_meta` always wins when a field is populated there.
 *
 * @type {Record<string, import('../utils/releaseMeta').ReleaseMetaInput>}
 */
export const RELEASED_GAME_EXTRAS = {
  // Example (uncomment / edit when a game ships):
  // 'prototype-systems': {
  //   tagline: 'A tethered crew crosses dangerous semi-procedural levels.',
  //   platforms: ['PC'],
  //   genre: ['Co-op', 'Action'],
  //   media: [
  //     { url: '/images/releases/tether-1.webp', alt: 'Crew mid-climb', caption: '' },
  //   ],
  //   // Steam Reviews (manual entry; no scraping)
  //   steam_reviews: {
  //     recent: { label: 'Overwhelmingly Positive', percent: 97 },
  //     overall: { label: 'Very Positive', percent: 94, count: 8512 },
  //     url: 'https://store.steampowered.com/app/…',
  //   },
  //   development_story: '',
  //   origin_idea_ids: [],
  // },
};

/**
 * @param {string|null|undefined} slugOrId
 * @returns {object|null}
 */
export function getReleasedGameExtras(slugOrId) {
  if (!slugOrId) return null;
  const key = String(slugOrId).trim();
  if (!key) return null;
  return RELEASED_GAME_EXTRAS[key] || null;
}
