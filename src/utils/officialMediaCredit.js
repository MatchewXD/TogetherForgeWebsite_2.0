/**
 * Official Media credits live in project_contributions (memorial ledger).
 * source_key = official-media:{official_videos.id}:{profiles.id}
 */

export const OFFICIAL_MEDIA_SOURCE_PREFIX = 'official-media:';

export function officialMediaSourcePrefix(videoId) {
  const id = String(videoId || '').trim();
  if (!id) return '';
  return `${OFFICIAL_MEDIA_SOURCE_PREFIX}${id}:`;
}

export function officialMediaSourceKey(videoId, userId) {
  const prefix = officialMediaSourcePrefix(videoId);
  const uid = String(userId || '').trim();
  if (!prefix || !uid) return '';
  return `${prefix}${uid}`;
}

/**
 * @param {string|null|undefined} sourceKey
 * @returns {{ videoId: string, userId: string }|null}
 */
export function parseOfficialMediaSourceKey(sourceKey) {
  const raw = String(sourceKey || '').trim();
  if (!raw.startsWith(OFFICIAL_MEDIA_SOURCE_PREFIX)) return null;
  const rest = raw.slice(OFFICIAL_MEDIA_SOURCE_PREFIX.length);
  const idx = rest.indexOf(':');
  if (idx <= 0) return null;
  const videoId = rest.slice(0, idx).trim();
  const userId = rest.slice(idx + 1).trim();
  if (!videoId || !userId) return null;
  return { videoId, userId };
}

/**
 * @param {Array<{ sourceKey?: string|null }>} rows
 * @returns {Record<string, typeof rows>}
 */
export function groupOfficialMediaCreditsByVideo(rows) {
  const byVideo = {};
  for (const row of rows || []) {
    const parsed = parseOfficialMediaSourceKey(row?.sourceKey);
    if (!parsed) continue;
    if (!byVideo[parsed.videoId]) byVideo[parsed.videoId] = [];
    byVideo[parsed.videoId].push(row);
  }
  return byVideo;
}
