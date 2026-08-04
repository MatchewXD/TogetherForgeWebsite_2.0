/**
 * Official Media library — Supabase-backed (table: official_videos).
 * Public: published + not archived, newest first.
 * Staff: full CRUD via is_project_staff() RLS.
 */

import { supabase } from '../lib/supabase';
import {
  parseYoutubeId,
  youtubeWatchUrl,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  YOUTUBE_CHANNEL_URL,
  COMMUNITY_SHOWCASE_PATH,
} from '../data/officialVideos';
import { normalizeOfficialVideoCategory } from '../constants/officialVideoCategories';

const TABLE = 'official_videos';

const SELECT_PUBLIC =
  'id, title, description, youtube_id, thumbnail_url, category, published_at, is_published, archived_at, sort_order, created_at, updated_at';

const SELECT_STAFF = `${SELECT_PUBLIC}, created_by`;

function mapRow(row) {
  if (!row) return null;
  const youtubeId = parseYoutubeId(row.youtube_id || row.youtubeId);
  return {
    id: row.id,
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    youtubeId,
    youtube_id: youtubeId,
    thumbnailUrl: row.thumbnail_url || row.thumbnailUrl || null,
    thumbnail_url: row.thumbnail_url || row.thumbnailUrl || null,
    category: normalizeOfficialVideoCategory(row.category),
    publishedAt: row.published_at || row.publishedAt || null,
    published_at: row.published_at || row.publishedAt || null,
    isPublished: row.is_published !== false && row.isPublished !== false,
    is_published: row.is_published !== false && row.isPublished !== false,
    archivedAt: row.archived_at || row.archivedAt || null,
    archived_at: row.archived_at || row.archivedAt || null,
    sortOrder: Number(row.sort_order) || 0,
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function isMissingTableError(error) {
  if (!error) return false;
  const msg = String(error.message || error.code || '');
  return (
    /relation .* does not exist|could not find the table|PGRST205|42P01/i.test(
      msg
    ) || error.code === '42P01'
  );
}

function toDateInput(isoOrDate) {
  if (!isoOrDate) return new Date().toISOString().slice(0, 10);
  const s = String(isoOrDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Public catalog for /media (published, not archived).
 * @returns {Promise<ReturnType<typeof mapRow>[]>}
 */
export async function listPublishedOfficialVideos() {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT_PUBLIC)
      .eq('is_published', true)
      .is('archived_at', null)
      .order('published_at', { ascending: false })
      .order('sort_order', { ascending: true });

    if (error) {
      if (isMissingTableError(error)) {
        console.warn(
          '[officialMedia] table missing — run supabase/sql/supabase_official_videos.sql'
        );
        return [];
      }
      throw error;
    }

    return (data || [])
      .map(mapRow)
      .filter((v) => v && v.title && v.youtubeId);
  } catch (err) {
    console.warn('[officialMedia] listPublished', err);
    return [];
  }
}

/**
 * Staff list: all non-archived by default; includeArchived for archive bin.
 * @param {{ includeArchived?: boolean }} [opts]
 */
export async function listStaffOfficialVideos(opts = {}) {
  let q = supabase
    .from(TABLE)
    .select(SELECT_STAFF)
    .order('published_at', { ascending: false })
    .order('sort_order', { ascending: true });

  if (!opts.includeArchived) {
    q = q.is('archived_at', null);
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingTableError(error)) {
      const e = new Error(
        'Official videos table is missing. Run supabase/sql/supabase_official_videos.sql in the Supabase SQL Editor.'
      );
      e.code = 'TABLE_MISSING';
      throw e;
    }
    throw error;
  }
  return (data || []).map(mapRow).filter(Boolean);
}

/**
 * @param {object} input
 */
export async function createOfficialVideo(input) {
  const youtubeId = parseYoutubeId(input.youtubeId || input.youtube_id);
  if (!youtubeId) throw new Error('A valid YouTube link or video ID is required.');
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Title is required.');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row = {
    title,
    description: String(input.description || '').trim(),
    youtube_id: youtubeId,
    thumbnail_url: String(input.thumbnailUrl || input.thumbnail_url || '').trim() || null,
    category: normalizeOfficialVideoCategory(input.category),
    published_at: toDateInput(input.publishedAt || input.published_at),
    is_published: input.isPublished !== false && input.is_published !== false,
    sort_order: Number(input.sortOrder ?? input.sort_order) || 0,
    created_by: user?.id || null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select(SELECT_STAFF)
    .maybeSingle();

  if (error) throw error;
  return mapRow(data);
}

/**
 * @param {string} id
 * @param {object} patch
 */
export async function updateOfficialVideo(id, patch) {
  if (!id) throw new Error('Video id is required.');
  const updates = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) {
    updates.title = String(patch.title || '').trim();
    if (!updates.title) throw new Error('Title is required.');
  }
  if (patch.description !== undefined) {
    updates.description = String(patch.description || '').trim();
  }
  if (patch.youtubeId !== undefined || patch.youtube_id !== undefined) {
    const youtubeId = parseYoutubeId(patch.youtubeId || patch.youtube_id);
    if (!youtubeId) throw new Error('A valid YouTube link or video ID is required.');
    updates.youtube_id = youtubeId;
  }
  if (patch.thumbnailUrl !== undefined || patch.thumbnail_url !== undefined) {
    updates.thumbnail_url =
      String(patch.thumbnailUrl ?? patch.thumbnail_url ?? '').trim() || null;
  }
  if (patch.category !== undefined) {
    updates.category = normalizeOfficialVideoCategory(patch.category);
  }
  if (patch.publishedAt !== undefined || patch.published_at !== undefined) {
    updates.published_at = toDateInput(
      patch.publishedAt ?? patch.published_at
    );
  }
  if (patch.isPublished !== undefined || patch.is_published !== undefined) {
    updates.is_published =
      patch.isPublished !== false && patch.is_published !== false;
  }
  if (patch.sortOrder !== undefined || patch.sort_order !== undefined) {
    updates.sort_order = Number(patch.sortOrder ?? patch.sort_order) || 0;
  }
  if (patch.archivedAt !== undefined || patch.archived_at !== undefined) {
    updates.archived_at = patch.archivedAt ?? patch.archived_at ?? null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select(SELECT_STAFF)
    .maybeSingle();

  if (error) throw error;
  return mapRow(data);
}

export async function setOfficialVideoPublished(id, isPublished) {
  return updateOfficialVideo(id, { isPublished: Boolean(isPublished) });
}

/** Soft-remove from library (hidden from public + staff default list) */
export async function archiveOfficialVideo(id) {
  return updateOfficialVideo(id, {
    archivedAt: new Date().toISOString(),
    isPublished: false,
  });
}

export async function restoreOfficialVideo(id) {
  return updateOfficialVideo(id, {
    archivedAt: null,
    isPublished: false,
  });
}

/** Permanent delete (staff only) */
export async function deleteOfficialVideo(id) {
  if (!id) throw new Error('Video id is required.');
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}

export const officialMediaService = {
  listPublishedOfficialVideos,
  listStaffOfficialVideos,
  createOfficialVideo,
  updateOfficialVideo,
  setOfficialVideoPublished,
  archiveOfficialVideo,
  restoreOfficialVideo,
  deleteOfficialVideo,
  parseYoutubeId,
  youtubeWatchUrl,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  YOUTUBE_CHANNEL_URL,
  COMMUNITY_SHOWCASE_PATH,
};

export default officialMediaService;
