/**
 * Community Showcase — moderated community posts.
 * Table: community_showcase_posts
 * Public feed: approved only. Submissions start as pending.
 */

import { supabase } from '../lib/supabase';
import { asUserError, isMissingRpcError } from '../utils/abuseErrors';
import { rpcWithFreshAuth } from '../utils/ensureAuthSession';
import {
  parseYoutubeId,
  youtubeWatchUrl,
  youtubeThumbnailUrl,
} from '../data/officialVideos';
import {
  getShowcaseItemsSorted,
  isDemoShowcaseEnabled,
} from '../data/communityShowcase';

const TABLE = 'community_showcase_posts';
const LIKES_TABLE = 'community_showcase_likes';

const SELECT_BASE =
  'id, content_type, title, description, creator_display_name, creator_user_id, url, youtube_id, image_url, thumbnail_url, project_tag, status, is_featured, moderator_note, moderated_by, moderated_at, published_at, created_at, updated_at';

const SELECT = `${SELECT_BASE}, likes, likes_public`;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when post id is a real DB uuid (not demo string ids). */
export function isShowcasePostUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

/** UI filter groups */
export const SHOWCASE_FILTER_GROUPS = [
  {
    id: 'videos_streams',
    label: 'Videos / Streams',
    types: ['video', 'stream'],
  },
  {
    id: 'art_images',
    label: 'Art & Images',
    types: ['art'],
  },
  {
    id: 'other',
    label: 'Other',
    types: ['article'],
  },
];

export const SHOWCASE_CONTENT_TYPES = [
  { id: 'video', label: 'Video' },
  { id: 'stream', label: 'Stream' },
  { id: 'art', label: 'Art / Image' },
  { id: 'article', label: 'Article / Link' },
];

function isMissingTableError(error) {
  if (!error) return false;
  const msg = String(error.message || error.code || '');
  return (
    /relation .* does not exist|could not find the table|PGRST205|42P01/i.test(
      msg
    ) || error.code === '42P01'
  );
}

function normalizeShowcaseType(raw) {
  const t = String(raw || 'article').toLowerCase().trim();
  if (t === 'post' || t === 'link' || t === 'blog') return 'article';
  if (t === 'image' || t === 'artwork') return 'art';
  if (t === 'clip') return 'video';
  return t || 'article';
}

/** Public credit line — never empty on approved feed cards. */
export function normalizeCredit(raw) {
  const s = String(raw || '').trim();
  return s || 'Community creator';
}

/** Trim project tag; empty → null. Prefer official project slug/id when saving. */
export function normalizeProjectTag(raw) {
  const s = String(raw || '').trim();
  return s || null;
}

/**
 * Case-insensitive project tag match.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
export function projectTagsMatch(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * Does a showcase post belong to an official project option?
 * Matches stored project_tag against project id (slug) or label.
 * @param {object} post
 * @param {{ id: string, label: string }} project
 */
export function postMatchesOfficialProject(post, project) {
  if (!post || !project) return false;
  const tag = normalizeProjectTag(post.projectTag);
  if (!tag) return false;
  const id = String(project.id || '').trim();
  const label = String(project.label || '').trim();
  if (id && projectTagsMatch(tag, id)) return true;
  if (label && projectTagsMatch(tag, label)) return true;
  return false;
}

/**
 * Filter official TF projects to those referenced by at least one post.
 * Never invents projects from free-text tags alone.
 * @param {object[]} posts
 * @param {Array<{ id: string, label: string }>} officialProjects
 */
export function officialProjectsPresentInPosts(posts, officialProjects = []) {
  const list = Array.isArray(officialProjects) ? officialProjects : [];
  return list.filter((proj) =>
    (posts || []).some((p) => postMatchesOfficialProject(p, proj))
  );
}

/**
 * Display label for a post's project_tag using official project catalog only.
 * Unknown free-text tags are not shown as “projects”.
 * @param {string|null|undefined} tag
 * @param {Array<{ id: string, label: string }>} officialProjects
 */
export function resolveOfficialProjectLabel(tag, officialProjects = []) {
  const t = normalizeProjectTag(tag);
  if (!t) return null;
  for (const p of officialProjects || []) {
    if (postMatchesOfficialProject({ projectTag: t }, p)) {
      return p.label || p.id;
    }
  }
  return null;
}

/**
 * Sort approved posts for discovery.
 * @param {object[]} posts
 * @param {'newest'|'featured'|'liked'} mode
 */
export function sortShowcasePosts(posts = [], mode = 'newest') {
  const list = [...(posts || [])];
  const ts = (p) => {
    const t = Date.parse(p.publishedAt || p.createdAt || '');
    return Number.isFinite(t) ? t : 0;
  };
  switch (mode) {
    case 'liked':
      list.sort((a, b) => {
        const ld = (Number(b.likes) || 0) - (Number(a.likes) || 0);
        if (ld !== 0) return ld;
        return ts(b) - ts(a);
      });
      break;
    case 'featured':
      list.sort((a, b) => {
        const fa = a.isFeatured ? 1 : 0;
        const fb = b.isFeatured ? 1 : 0;
        if (fb !== fa) return fb - fa;
        return ts(b) - ts(a);
      });
      break;
    case 'newest':
    default:
      list.sort((a, b) => ts(b) - ts(a));
      break;
  }
  return list;
}

export const SHOWCASE_SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'featured', label: 'Featured first' },
  { id: 'liked', label: 'Most liked' },
];

function mapRow(row) {
  if (!row) return null;
  const youtubeId = parseYoutubeId(row.youtube_id || row.youtubeId);
  const type = normalizeShowcaseType(row.content_type || row.type || 'article');
  return {
    id: row.id,
    type,
    contentType: type,
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    creatorDisplayName: normalizeCredit(
      row.creator_display_name || row.creatorDisplayName
    ),
    creatorUserId: row.creator_user_id || row.creatorUserId || null,
    creator: row.creator || null,
    url: row.url ? String(row.url).trim() : null,
    youtubeId: youtubeId || null,
    imageUrl: row.image_url || row.imageUrl || null,
    thumbnailUrl:
      row.thumbnail_url ||
      row.thumbnailUrl ||
      row.image_url ||
      row.imageUrl ||
      null,
    projectTag: normalizeProjectTag(row.project_tag || row.projectTag),
    status: row.status || 'pending',
    isFeatured: Boolean(row.is_featured ?? row.isFeatured),
    moderatorNote: row.moderator_note || row.moderatorNote || null,
    moderatedBy: row.moderated_by || null,
    moderatedAt: row.moderated_at || null,
    publishedAt: row.published_at || row.created_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    likes: Math.max(
      0,
      Number(
        row.likes_public != null && row.likes_public !== ''
          ? row.likes_public
          : row.likes
      ) || 0
    ),
    submitterEmail: null,
    _isDemo: Boolean(row._isDemo),
  };
}

function mapDemoItem(item) {
  const username = item.authorUsername || null;
  const displayName = item.authorName || username || 'Community';
  return mapRow({
    id: item.id,
    content_type: item.type,
    title: item.title,
    description: item.description,
    creator_display_name: displayName,
    youtube_id: item.youtubeId,
    url: item.url,
    thumbnail_url: item.thumbnailUrl,
    image_url: item.thumbnailUrl,
    project_tag: item.projectTag || null,
    status: 'approved',
    is_featured: false,
    published_at: item.publishedAt
      ? `${item.publishedAt}T12:00:00.000Z`
      : null,
    created_at: item.publishedAt
      ? `${item.publishedAt}T12:00:00.000Z`
      : null,
    _isDemo: true,
    creator: {
      id: null,
      username: username || displayName,
      avatar_url: item.authorAvatarUrl || item.avatarUrl || null,
    },
  });
}

/**
 * Attach profile rows (username, avatar) for creator_user_id on posts.
 */
async function attachCreators(posts = []) {
  const list = posts || [];
  const ids = [
    ...new Set(list.map((p) => p.creatorUserId).filter(Boolean)),
  ];
  if (!ids.length) return list;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, pinned_badge_key')
      .in('id', ids);
    if (error) {
      console.warn('[showcase] attachCreators', error);
      return list;
    }
    const map = Object.fromEntries((data || []).map((p) => [p.id, p]));
    return list.map((post) => {
      const profile = post.creatorUserId ? map[post.creatorUserId] : null;
      if (!profile && post.creator) return post;
      if (!profile) {
        return {
          ...post,
          creator: {
            id: post.creatorUserId,
            username: post.creatorDisplayName || null,
            avatar_url: null,
          },
        };
      }
      return {
        ...post,
        creator: {
          id: profile.id,
          username: profile.username || post.creatorDisplayName || null,
          avatar_url: profile.avatar_url || null,
          pinned_badge_key: profile.pinned_badge_key || null,
          pinnedBadgeKey: profile.pinned_badge_key || null,
        },
        // Prefer profile username for display when available
        creatorDisplayName:
          profile.username || post.creatorDisplayName || 'Community',
      };
    });
  } catch (err) {
    console.warn('[showcase] attachCreators', err);
    return list;
  }
}

export function showcaseHref(post) {
  if (!post) return null;
  if (post.youtubeId) return youtubeWatchUrl(post.youtubeId);
  if (post.url) return post.url;
  if (post.imageUrl) return post.imageUrl;
  return null;
}

export function showcaseThumb(post) {
  if (!post) return null;
  if (post.thumbnailUrl) return post.thumbnailUrl;
  if (post.imageUrl) return post.imageUrl;
  if (post.youtubeId) {
    return youtubeThumbnailUrl({ youtubeId: post.youtubeId });
  }
  return null;
}

export function filterGroupForType(type) {
  const t = String(type || '').toLowerCase();
  for (const g of SHOWCASE_FILTER_GROUPS) {
    if (g.types.includes(t)) return g.id;
  }
  return 'other';
}

/**
 * Public approved feed, newest first (featured first).
 * Falls back to file-based demo when table missing or empty + demo enabled.
 */
export async function listApprovedShowcasePosts() {
  try {
    let query = supabase
      .from(TABLE)
      .select(SELECT)
      .eq('status', 'approved')
      .order('is_featured', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    let { data, error } = await query;

    // Older DBs without likes column
    if (
      error &&
      /likes/i.test(String(error.message || '')) &&
      /column|schema cache|could not find/i.test(String(error.message || ''))
    ) {
      ({ data, error } = await supabase
        .from(TABLE)
        .select(SELECT_BASE)
        .eq('status', 'approved')
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }));
    }

    if (error) {
      if (isMissingTableError(error)) {
        console.warn(
          '[showcase] table missing — run supabase/sql/supabase_community_showcase.sql'
        );
        return demoFallbackList();
      }
      throw error;
    }

    const rows = (data || []).map(mapRow).filter((p) => p && p.title);
    if (rows.length === 0 && isDemoShowcaseEnabled()) {
      return demoFallbackList();
    }
    return attachCreators(rows);
  } catch (err) {
    console.warn('[showcase] listApproved', err);
    return demoFallbackList();
  }
}

/**
 * Post ids (uuid strings) the user has liked.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function getUserLikedShowcasePostIds(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from(LIKES_TABLE)
      .select('post_id')
      .eq('user_id', userId);
    if (error) {
      if (isMissingTableError(error)) return [];
      console.warn('[showcase] getUserLikedShowcasePostIds', error);
      return [];
    }
    return (data || [])
      .map((r) => r.post_id)
      .filter((id) => isShowcasePostUuid(id));
  } catch (err) {
    console.warn('[showcase] getUserLikedShowcasePostIds', err);
    return [];
  }
}

/**
 * Live like count for a post (prefer likes table, fall back to denormalized).
 */
export async function getShowcaseLikeCount(postId) {
  if (!isShowcasePostUuid(postId)) return 0;
  let { data, error } = await supabase
    .from(TABLE)
    .select('likes, likes_public')
    .eq('id', postId)
    .maybeSingle();
  if (error && /likes_public/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TABLE)
      .select('likes')
      .eq('id', postId)
      .maybeSingle());
  }
  if (error || !data) return 0;
  const n = Number(
    data.likes_public != null && data.likes_public !== ''
      ? data.likes_public
      : data.likes
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Toggle like for signed-in user on an approved showcase post.
 * @returns {Promise<{ liked: boolean, likes: number }>}
 */
export async function toggleShowcaseLike(postId, userId) {
  if (!isShowcasePostUuid(postId)) {
    throw new Error('Likes are not available for demo posts.');
  }

  const rpc = await rpcWithFreshAuth('toggle_showcase_like', {
    p_post_id: postId,
  });
  const actorId = rpc.user?.id || userId;
  if (!actorId) throw new Error('Sign in to like posts.');
  if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
    return {
      liked: Boolean(rpc.data.liked),
      likes: Math.max(0, Number(rpc.data.likes) || 0),
    };
  }
  if (rpc.error && !isMissingRpcError(rpc.error)) {
    throw asUserError(rpc.error, 'Could not update like.');
  }

  const { data: existing, error: findError } = await supabase
    .from(LIKES_TABLE)
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', actorId)
    .maybeSingle();

  if (findError && findError.code !== 'PGRST116') {
    if (isMissingTableError(findError)) {
      throw new Error(
        'Likes are not set up yet. Run supabase/sql/supabase_community_showcase_likes.sql in Supabase.'
      );
    }
    throw asUserError(findError, 'Could not update like.');
  }

  if (existing) {
    const { error: delError } = await supabase
      .from(LIKES_TABLE)
      .delete()
      .eq('post_id', postId)
      .eq('user_id', actorId);
    if (delError) throw asUserError(delError, 'Could not update like.');
  } else {
    const { error: insError } = await supabase
      .from(LIKES_TABLE)
      .insert([{ post_id: postId, user_id: actorId }]);
    if (insError) {
      if (
        insError.code === '23505' ||
        /duplicate|unique/i.test(insError.message || '')
      ) {
        /* already liked */
      } else if (isMissingTableError(insError)) {
        throw new Error(
          'Likes are not set up yet. Run supabase/sql/supabase_community_showcase_likes.sql in Supabase.'
        );
      } else {
        throw asUserError(insError, 'Could not update like.');
      }
    }
  }

  const likes = await getShowcaseLikeCount(postId);
  const { data: stillLiked } = await supabase
    .from(LIKES_TABLE)
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', actorId)
    .maybeSingle();

  return { liked: !!stillLiked, likes: Math.max(0, likes || 0) };
}

function demoFallbackList() {
  if (!isDemoShowcaseEnabled()) return [];
  return getShowcaseItemsSorted().map(mapDemoItem);
}

/**
 * Signed-in user's own submissions (any status) for Dashboard status tracking.
 */
export async function listMyShowcaseSubmissions() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT)
      .eq('creator_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (isMissingTableError(error)) {
        console.warn(
          '[showcase] table missing — run supabase/sql/supabase_community_showcase.sql'
        );
        return [];
      }
      throw error;
    }
    return (data || []).map(mapRow).filter(Boolean);
  } catch (err) {
    console.warn('[showcase] listMyShowcaseSubmissions', err);
    return [];
  }
}

/**
 * Staff: list by status (pending default).
 * @param {{ status?: 'pending'|'approved'|'rejected'|'all', limit?: number }} [opts]
 */
export async function listShowcaseForModeration(opts = {}) {
  const status = opts.status || 'pending';
  const limit = Math.min(Number(opts.limit) || 80, 200);

  let q = supabase
    .from(TABLE)
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    q = q.eq('status', status);
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingTableError(error)) {
      const e = new Error(
        'Showcase table missing. Run supabase/sql/supabase_community_showcase.sql'
      );
      e.code = 'TABLE_MISSING';
      throw e;
    }
    throw error;
  }
  return (data || []).map(mapRow).filter(Boolean);
}

/**
 * Submit a post (pending). Signed-in users only.
 * @param {object} input
 */
export async function submitShowcasePost(input) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to submit to the Community Showcase.');
  }

  const contentType = String(input.contentType || input.type || '')
    .trim()
    .toLowerCase();
  if (!['video', 'stream', 'art', 'article'].includes(contentType)) {
    throw new Error('Choose a content type: video, stream, art, or article.');
  }

  const title = String(input.title || '').trim();
  if (title.length < 2) throw new Error('Title is required.');

  // Credit is always the signed-in profile username (not user-editable)
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  const creatorDisplayName = String(profile?.username || '').trim();
  if (!creatorDisplayName) {
    throw new Error(
      'Set a username on your profile before submitting. Showcase credit uses your account name.'
    );
  }

  const youtubeId = parseYoutubeId(input.youtubeId || input.youtubeUrl || '');
  const url = String(input.url || '').trim() || null;
  const imageUrl = String(input.imageUrl || input.thumbnailUrl || '').trim() || null;

  if (contentType === 'video' || contentType === 'stream') {
    if (!youtubeId && !url) {
      throw new Error('Add a YouTube link (or video URL) for videos and streams.');
    }
  }
  if (contentType === 'art' && !imageUrl && !url) {
    throw new Error('Add an image URL or link for art submissions.');
  }
  if (contentType === 'article' && !url) {
    throw new Error('Add a link to the article or post.');
  }

  const row = {
    content_type: contentType,
    title,
    description: String(input.description || '').trim(),
    creator_display_name: creatorDisplayName,
    creator_user_id: user.id,
    submitter_email: String(input.submitterEmail || user.email || '').trim() || null,
    url,
    youtube_id: youtubeId || null,
    image_url: imageUrl,
    thumbnail_url:
      String(input.thumbnailUrl || '').trim() || imageUrl || null,
    project_tag: normalizeProjectTag(input.projectTag),
    status: 'pending',
    is_featured: false,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        'Showcase is not set up yet. Run supabase/sql/supabase_community_showcase.sql'
      );
    }
    throw error;
  }
  return mapRow(data);
}

/**
 * Staff: approve | reject | feature toggle
 */
export async function moderateShowcasePost(id, action, note = '') {
  if (!id) throw new Error('Post id is required.');
  const act = String(action || '').toLowerCase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Sign in as staff to moderate.');

  const now = new Date().toISOString();
  let patch = {
    moderated_by: user.id,
    moderated_at: now,
    moderator_note: String(note || '').trim() || null,
    updated_at: now,
  };

  if (act === 'approve') {
    patch = {
      ...patch,
      status: 'approved',
      published_at: now,
    };
  } else if (act === 'reject') {
    patch = {
      ...patch,
      status: 'rejected',
      is_featured: false,
    };
  } else if (act === 'feature') {
    patch = {
      ...patch,
      status: 'approved',
      is_featured: true,
      published_at: now,
    };
  } else if (act === 'unfeature') {
    patch = {
      is_featured: false,
      updated_at: now,
    };
  } else if (act === 'pending') {
    patch = {
      ...patch,
      status: 'pending',
      is_featured: false,
      published_at: null,
    };
  } else {
    throw new Error('Unknown moderation action.');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .maybeSingle();

  if (error) throw error;
  const mapped = mapRow(data);

  // Memorial: approved creators → All Contributors + project Marketing / Content
  if (
    mapped &&
    (act === 'approve' || act === 'feature') &&
    mapped.creatorUserId
  ) {
    try {
      const { ensureShowcaseMarketingCredit } = await import(
        './contributorsService'
      );
      await ensureShowcaseMarketingCredit(mapped);
    } catch (err) {
      console.warn('[showcase] memorial credit on approve', err);
    }
  }

  return mapped;
}

export async function deleteShowcasePost(id) {
  if (!id) throw new Error('Post id is required.');
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}

/**
 * Filter helpers for public UI
 */
export function projectsPresentInPosts(posts) {
  // Preserve first-seen casing as display label
  const byKey = new Map();
  for (const p of posts || []) {
    const tag = normalizeProjectTag(p.projectTag);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, tag);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

export function filterGroupsPresentInPosts(posts) {
  const counts = new Map();
  for (const p of posts || []) {
    const gid = filterGroupForType(p.type || p.contentType);
    counts.set(gid, (counts.get(gid) || 0) + 1);
  }
  return SHOWCASE_FILTER_GROUPS.filter((g) => counts.has(g.id));
}

export const showcaseService = {
  listApprovedShowcasePosts,
  listMyShowcaseSubmissions,
  listShowcaseForModeration,
  submitShowcasePost,
  moderateShowcasePost,
  deleteShowcasePost,
  projectsPresentInPosts,
  officialProjectsPresentInPosts,
  postMatchesOfficialProject,
  resolveOfficialProjectLabel,
  filterGroupsPresentInPosts,
  sortShowcasePosts,
  showcaseHref,
  showcaseThumb,
  normalizeCredit,
  normalizeProjectTag,
  projectTagsMatch,
  SHOWCASE_FILTER_GROUPS,
  SHOWCASE_CONTENT_TYPES,
  SHOWCASE_SORT_OPTIONS,
};

export default showcaseService;
