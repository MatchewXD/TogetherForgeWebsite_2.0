/**
 * Public profile URL helpers.
 * Canonical route: /u/:username (also aliased as /profile/:username).
 */

const PLACEHOLDER_NAMES = new Set([
  'community',
  'anonymous',
  'someone',
  'member',
  'user',
  'guest',
  'unnamed',
  'volunteer',
  'you',
]);

/**
 * @param {string|null|undefined} username
 * @returns {string|null} path or null if not linkable
 */
export function publicProfilePath(username) {
  if (username == null) return null;
  const u = String(username).trim();
  if (!u) return null;
  if (PLACEHOLDER_NAMES.has(u.toLowerCase())) return null;
  // Avoid linking non-username labels
  if (u.includes(' ')) return null;
  return `/u/${encodeURIComponent(u)}`;
}

/**
 * @param {string|null|undefined} username
 */
export function canLinkPublicProfile(username) {
  return Boolean(publicProfilePath(username));
}
