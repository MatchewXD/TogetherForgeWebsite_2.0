/**
 * Shared helpers for user avatar display.
 */

/**
 * Build 1–2 letter initials from a display name.
 */
export function initialsFromName(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

/**
 * Pick a stable accent class from a name (for initials circles).
 */
export function accentFromName(name) {
  const accents = [
    'border-neon-cyan/40 text-neon-cyan',
    'border-neon-magenta/40 text-neon-magenta',
    'border-neon-purple/40 text-neon-purple',
    'border-cyan-400/40 text-cyan-300',
  ];
  const str = String(name || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return accents[hash % accents.length];
}

/**
 * Normalize common avatar field shapes from API/UI rows.
 */
export function resolveAvatarUrl(source) {
  if (!source) return null;
  if (typeof source === 'string') {
    const trimmed = source.trim();
    return trimmed || null;
  }
  return (
    source.avatarUrl ||
    source.avatar_url ||
    source.userAvatarUrl ||
    source.user_avatar_url ||
    null
  );
}
