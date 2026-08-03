/**
 * Official Together Forge videos for the Media page (/media).
 *
 * HOW TO ADD A VIDEO
 * 1. Copy a block below and fill in the fields.
 * 2. youtubeId = the 11-character id from the URL:
 *      https://www.youtube.com/watch?v=XXXXXXXXXXX  →  youtubeId: 'XXXXXXXXXXX'
 *      https://youtu.be/XXXXXXXXXXX                 →  same
 * 3. publishedAt uses ISO date (YYYY-MM-DD). List is sorted newest first.
 * 4. Optional: thumbnailUrl (defaults to YouTube hqdefault).
 * 5. Optional: relatedProjectId / relatedPage for notes only (not required).
 *
 * Community / fan videos stay on Showcase — do not add them here.
 */

/** Official channel (Watch more / subscribe) */
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@MXDGameGuides';

/** Community-made videos and posts (separate from official media) */
export const COMMUNITY_SHOWCASE_PATH = '/showcase';

/**
 * @typedef {Object} OfficialVideo
 * @property {string} id - Stable local id (any unique string)
 * @property {string} title
 * @property {string} description - 1–2 lines for the card
 * @property {string} youtubeId - YouTube video id
 * @property {string} [thumbnailUrl] - Override thumbnail
 * @property {string} [category] - e.g. Overview | Progress | How to Help | Studio
 * @property {string} publishedAt - ISO date YYYY-MM-DD
 * @property {string} [relatedProjectId]
 * @property {string} [relatedPage]
 */

/**
 * Add real videos here. Example:
 *
 * {
 *   id: 'what-is-tf',
 *   title: 'What is Together Forge?',
 *   description: 'A short overview of the community-first studio.',
 *   youtubeId: 'XXXXXXXXXXX',
 *   category: 'Overview',
 *   publishedAt: '2026-03-01',
 * },
 *
 * @type {OfficialVideo[]}
 */
export const OFFICIAL_VIDEOS = [];

/**
 * Sort newest first. Only lists entries with a title and a valid youtubeId.
 */
export function getOfficialVideosSorted() {
  return [...OFFICIAL_VIDEOS]
    .filter(
      (v) =>
        v &&
        String(v.title || '').trim() &&
        parseYoutubeId(v.youtubeId || v.youtubeUrl)
    )
    .sort((a, b) => {
      const da = Date.parse(a.publishedAt || 0) || 0;
      const db = Date.parse(b.publishedAt || 0) || 0;
      return db - da;
    });
}

/** Extract 11-char id from common YouTube URL shapes */
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
    const m = u.pathname.match(/\/embed\/([\w-]{11})/);
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

export function youtubeThumbnailUrl(video) {
  if (video?.thumbnailUrl) return video.thumbnailUrl;
  const id = parseYoutubeId(video?.youtubeId);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
