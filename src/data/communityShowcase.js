/**
 * Community Showcase catalog (fan / community content only).
 * Official studio videos stay on /media — do not mix them here.
 *
 * Demo entries are off unless VITE_SHOW_DEMO_SHOWCASE=true
 * (keep off in production).
 *
 * HOW TO ADD (when ready for real posts)
 * Append to COMMUNITY_SHOWCASE_ITEMS with type, title, author, etc.
 */

import {
  parseYoutubeId,
  youtubeWatchUrl,
  youtubeThumbnailUrl,
  YOUTUBE_CHANNEL_URL,
} from './officialVideos';

export { YOUTUBE_CHANNEL_URL };

export function isDemoShowcaseEnabled() {
  const flag = import.meta.env?.VITE_SHOW_DEMO_SHOWCASE;
  return flag === 'true' || flag === '1';
}

/**
 * @typedef {'video' | 'stream' | 'post' | 'art'} ShowcaseType
 *
 * @typedef {Object} ShowcaseItem
 * @property {string} id
 * @property {ShowcaseType} type
 * @property {string} title
 * @property {string} description
 * @property {string} authorName
 * @property {string} [authorUsername]
 * @property {string} [youtubeId]
 * @property {string} [url] - external link (clip, post, art)
 * @property {string} [thumbnailUrl]
 * @property {string} [publishedAt] - YYYY-MM-DD
 * @property {boolean} [_isDemo]
 */

/** Real community entries (empty until you add them) */
export const COMMUNITY_SHOWCASE_ITEMS = [];

/** Layout preview only — not official Media */
export const DEMO_SHOWCASE_ITEMS = [
  {
    id: 'demo-clip-1',
    type: 'video',
    title: 'First tether run — we almost made it',
    description:
      'Community clip from a weekend playtest. Pure co-op chaos and a last-second save.',
    authorName: 'ClipCaptain',
    authorUsername: 'clip_captain',
    youtubeId: 'aqz-KE-bpKQ',
    thumbnailUrl: '/images/Hero_Background.webp',
    // Official project slug only (matches projects table / relatedToOptions)
    projectTag: 'tether',
    publishedAt: '2026-06-12',
    _isDemo: true,
  },
  {
    id: 'demo-stream-1',
    type: 'stream',
    title: 'Forge Friday: building with volunteers',
    description:
      'Recap stream walking through open tasks and how to claim your first one.',
    authorName: 'StreamBridge',
    authorUsername: 'stream_bridge',
    youtubeId: 'eRsGyueVLvQ',
    thumbnailUrl: '/images/Get_Involved_Background.webp',
    projectTag: null,
    publishedAt: '2026-06-20',
    _isDemo: true,
  },
  {
    id: 'demo-art-1',
    type: 'art',
    title: 'Colony vista fan art',
    description:
      'Digital painting of the colony waiting below while the crew climbs.',
    authorName: 'LumenBrush',
    authorUsername: 'lumen_brush',
    url: 'https://togetherforge.gg',
    thumbnailUrl: '/images/About_Page_Background.webp',
    projectTag: 'tether',
    publishedAt: '2026-05-28',
    _isDemo: true,
  },
  {
    id: 'demo-post-1',
    type: 'article',
    title: 'Why I joined the task board',
    description:
      'Short write-up on claiming a small art task and how public credit felt.',
    authorName: 'PixelPatron',
    authorUsername: 'pixel_patron',
    url: 'https://togetherforge.gg',
    thumbnailUrl: '/images/Support_Page.webp',
    projectTag: null,
    publishedAt: '2026-06-02',
    _isDemo: true,
  },
  {
    id: 'demo-clip-2',
    type: 'video',
    title: 'Tether snap — highlight reel',
    description:
      'Thirty seconds of the best (and worst) tether moments from Discord.',
    authorName: 'HighlightHive',
    authorUsername: 'highlight_hive',
    youtubeId: 'R6MlUcmOul8',
    thumbnailUrl: '/images/Projects_Page.webp',
    projectTag: 'tether',
    publishedAt: '2026-06-25',
    _isDemo: true,
  },
  {
    id: 'demo-stream-2',
    type: 'stream',
    title: 'Devlog watch party + Q&A',
    description:
      'Community stream reacting to the latest progress report together.',
    authorName: 'ForgeFriend',
    authorUsername: 'forge_friend',
    youtubeId: 'aqz-KE-bpKQ',
    thumbnailUrl: '/images/Transparency_Page.webp',
    projectTag: null,
    publishedAt: '2026-07-01',
    _isDemo: true,
  },
  {
    id: 'demo-art-2',
    type: 'art',
    title: 'Crew silhouette sticker sheet',
    description: 'Fan sticker concepts for the tethered crew — free for Discord.',
    authorName: 'StickerForge',
    authorUsername: 'sticker_forge',
    url: 'https://togetherforge.gg',
    thumbnailUrl: '/images/phase_images/Early_Phase_Illistration.webp',
    projectTag: 'tether',
    publishedAt: '2026-05-15',
    _isDemo: true,
  },
  {
    id: 'demo-post-2',
    type: 'post',
    title: 'Playtest notes from build night',
    description:
      'What felt great, what broke, and three ideas for the next sprint.',
    authorName: 'NoteTaker',
    authorUsername: 'note_taker',
    url: 'https://togetherforge.gg',
    thumbnailUrl: '/images/Ideas_Page_Background.webp',
    projectTag: 'tether',
    publishedAt: '2026-06-18',
    _isDemo: true,
  },
];

const TYPE_ORDER = { video: 0, stream: 1, art: 2, post: 3 };

/**
 * @returns {ShowcaseItem[]}
 */
export function getShowcaseItemsSorted() {
  const real = (COMMUNITY_SHOWCASE_ITEMS || []).filter(
    (item) => item && String(item.title || '').trim()
  );
  const demo = isDemoShowcaseEnabled() ? DEMO_SHOWCASE_ITEMS : [];
  const merged = [...real, ...demo];

  // Dedupe by id
  const seen = new Set();
  const unique = [];
  for (const item of merged) {
    const id = String(item.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push({
      ...item,
      youtubeId: parseYoutubeId(item.youtubeId || item.youtubeUrl) || null,
    });
  }

  unique.sort((a, b) => {
    const da = Date.parse(a.publishedAt || 0) || 0;
    const db = Date.parse(b.publishedAt || 0) || 0;
    if (db !== da) return db - da;
    return (TYPE_ORDER[a.type] ?? 50) - (TYPE_ORDER[b.type] ?? 50);
  });

  return unique;
}

export function showcaseItemHref(item) {
  if (!item) return null;
  if (item.youtubeId) return youtubeWatchUrl(item.youtubeId);
  if (item.url) return String(item.url).trim();
  return null;
}

export function showcaseThumbnail(item) {
  if (!item) return null;
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.youtubeId) {
    return youtubeThumbnailUrl({
      youtubeId: item.youtubeId,
      thumbnailUrl: null,
    });
  }
  return null;
}

export function showcaseTypeLabel(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'video') return 'Video';
  if (t === 'stream') return 'Stream';
  if (t === 'art') return 'Art';
  if (t === 'post') return 'Post';
  return 'Community';
}

/** Types that currently have at least one item (for filters) */
export function showcaseTypesPresent(items) {
  const set = new Set();
  for (const item of items || []) {
    if (item?.type) set.add(item.type);
  }
  const order = ['video', 'stream', 'art', 'post'];
  return order.filter((t) => set.has(t));
}
