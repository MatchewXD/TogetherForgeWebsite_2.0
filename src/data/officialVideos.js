/**
 * Official Media helpers (YouTube URLs, channel links).
 *
 * SOURCE OF TRUTH: Supabase table `official_videos`
 * (see supabase/sql/supabase_official_videos.sql + officialMediaService.js).
 *
 * This file no longer holds the video catalog. Staff manage videos at /media/edit.
 * Community / fan content stays on /showcase — never here.
 */

/** Official channel (header / empty-state links) */
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@MXDGameGuides';

/** Fan and community content lives here — never on /media */
export const COMMUNITY_SHOWCASE_PATH = '/showcase';

/** @deprecated Catalog lives in Supabase. Kept empty so old imports do not break. */
export const OFFICIAL_VIDEOS = [];

/** Extract 11-char id from common YouTube URL shapes or bare id */
export function parseYoutubeId(urlOrId) {
  if (!urlOrId) return '';
  const s = String(urlOrId).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').slice(0, 11);
    }
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
    const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/);
    if (m) return m[1];
  } catch {
    /* not a URL */
  }
  return '';
}

export function youtubeWatchUrl(youtubeId) {
  const id = parseYoutubeId(youtubeId);
  return id ? `https://www.youtube.com/watch?v=${id}` : YOUTUBE_CHANNEL_URL;
}

export function youtubeEmbedUrl(youtubeId) {
  const id = parseYoutubeId(youtubeId);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : '';
}

/**
 * @param {{ thumbnailUrl?: string, thumbnail_url?: string, youtubeId?: string, youtube_id?: string }} video
 */
export function youtubeThumbnailUrl(video) {
  const override = video?.thumbnailUrl || video?.thumbnail_url;
  if (override) return String(override).trim();
  const id = parseYoutubeId(video?.youtubeId || video?.youtube_id);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * @deprecated Use officialMediaService.listPublishedOfficialVideos()
 */
export function getOfficialVideosSorted() {
  console.warn(
    '[officialVideos] getOfficialVideosSorted is deprecated — use officialMediaService'
  );
  return [];
}

/**
 * @deprecated Use officialMediaService.listPublishedOfficialVideos()
 */
export async function fetchOfficialVideos() {
  const { listPublishedOfficialVideos } = await import(
    '../services/officialMediaService'
  );
  return listPublishedOfficialVideos();
}
