/**
 * Normalize public social fields into linkable URLs / display handles.
 */

export function normalizeGithubHref(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^github\.com\//i.test(s)) return `https://${s}`;
  return `https://github.com/${s.replace(/^@/, '')}`;
}

export function normalizeYoutubeHref(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://www.youtube.com/@${s.replace(/^@/, '')}`;
}

export function normalizeTwitchHref(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://www.twitch.tv/${s.replace(/^@/, '')}`;
}

export function normalizeXHref(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://x.com/${s.replace(/^@/, '')}`;
}

/** Public label for a stored YouTube handle or URL. */
export function formatYoutubeLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let t = s
    .replace(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i, '')
    .replace(/\/+$/, '');
  t = t.replace(/^(channel|c|user)\//i, '');
  t = t.split(/[/?#]/)[0] || '';
  if (!t) return s;
  return t.startsWith('@') ? t : t;
}

/** Public label for a stored Twitch login or URL. */
export function formatTwitchLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let t = s
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  t = t.split(/[/?#]/)[0] || '';
  return t || s;
}

export function formatCentsUsd(cents) {
  const n = Number(cents) || 0;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n % 100 === 0 ? 0 : 2,
  }).format(n / 100);
}
