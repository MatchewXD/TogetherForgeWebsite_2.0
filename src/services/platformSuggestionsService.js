/**
 * Platform Suggestions — minimal site feedback.
 * Requires supabase/sql/supabase_platform_suggestions.sql
 */
import { supabase } from '../lib/supabase';
import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUSES,
} from '../constants/platformSuggestions';

function isMissingTable(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /platform_suggestions|relation .* does not exist|schema cache/i.test(msg)
  );
}

function mapRow(row, profileMap = {}) {
  if (!row) return null;
  const profile = row.user_id ? profileMap[row.user_id] : null;
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    category: row.category || 'Other',
    status: row.status || 'Open',
    isHidden: Boolean(row.is_hidden),
    userId: row.user_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    creator: profile
      ? {
          id: profile.id || row.user_id,
          username: profile.username || 'Member',
          avatar_url: profile.avatar_url || null,
          avatarUrl: profile.avatar_url || null,
          pinned_badge_key: profile.pinned_badge_key || null,
          pinnedBadgeKey: profile.pinned_badge_key || null,
        }
      : {
          id: row.user_id,
          username: 'Member',
          avatar_url: null,
          avatarUrl: null,
          pinned_badge_key: null,
          pinnedBadgeKey: null,
        },
  };
}

async function loadProfiles(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, pinned_badge_key')
    .in('id', ids);
  if (error) {
    console.warn('[platformSuggestions] profiles', error);
    return {};
  }
  const map = {};
  for (const p of data || []) {
    if (p?.id) map[p.id] = p;
  }
  return map;
}

export const platformSuggestionsService = {
  categories: SUGGESTION_CATEGORIES,
  statuses: SUGGESTION_STATUSES,

  /**
   * Public list (non-hidden for public; staff may pass includeHidden).
   * @param {{ status?: string, includeHidden?: boolean, limit?: number }} [opts]
   */
  async list(opts = {}) {
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
    try {
      let q = supabase
        .from('platform_suggestions')
        .select(
          'id, title, description, category, status, is_hidden, user_id, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!opts.includeHidden) {
        q = q.eq('is_hidden', false);
      }
      if (opts.status && opts.status !== 'all') {
        q = q.eq('status', opts.status);
      }

      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      const profiles = await loadProfiles(rows.map((r) => r.user_id));
      return rows.map((r) => mapRow(r, profiles));
    } catch (err) {
      if (isMissingTable(err)) {
        throw new Error(
          'Platform suggestions are not set up yet. Run supabase/sql/supabase_platform_suggestions.sql in the Supabase SQL Editor.'
        );
      }
      throw new Error(err.message || 'Could not load suggestions.');
    }
  },

  /**
   * @param {{ title: string, description: string, category?: string, userId: string }} input
   */
  async submit(input) {
    const userId = input.userId;
    if (!userId) throw new Error('You must be signed in to submit a suggestion.');

    const title = String(input.title || '').trim();
    const description = String(input.description || '').trim();
    let category = String(input.category || 'Other').trim();
    if (!SUGGESTION_CATEGORIES.includes(category)) category = 'Other';

    if (title.length < 3) throw new Error('Title must be at least 3 characters.');
    if (title.length > 120) throw new Error('Title is too long (max 120).');
    if (description.length < 8) {
      throw new Error('Add a short description (at least a sentence).');
    }
    if (description.length > 2000) {
      throw new Error('Description is too long (max 2000).');
    }

    try {
      const { data, error } = await supabase
        .from('platform_suggestions')
        .insert({
          title,
          description,
          category,
          status: 'Open',
          is_hidden: false,
          user_id: userId,
        })
        .select(
          'id, title, description, category, status, is_hidden, user_id, created_at, updated_at'
        )
        .single();

      if (error) throw error;
      const profiles = await loadProfiles([userId]);
      return mapRow(data, profiles);
    } catch (err) {
      if (isMissingTable(err)) {
        throw new Error(
          'Platform suggestions are not set up yet. Run supabase/sql/supabase_platform_suggestions.sql in the Supabase SQL Editor.'
        );
      }
      throw new Error(err.message || 'Could not submit suggestion.');
    }
  },

  /**
   * Staff: set status.
   * @param {string} id
   * @param {string} status
   */
  async updateStatus(id, status) {
    if (!SUGGESTION_STATUSES.includes(status)) {
      throw new Error('Invalid status.');
    }
    const { data, error } = await supabase
      .from('platform_suggestions')
      .update({ status })
      .eq('id', id)
      .select(
        'id, title, description, category, status, is_hidden, user_id, created_at, updated_at'
      )
      .single();
    if (error) throw new Error(error.message || 'Could not update status.');
    const profiles = await loadProfiles([data.user_id]);
    return mapRow(data, profiles);
  },

  /**
   * Staff: hide or unhide.
   * @param {string} id
   * @param {boolean} hidden
   */
  async setHidden(id, hidden) {
    const { data, error } = await supabase
      .from('platform_suggestions')
      .update({ is_hidden: Boolean(hidden) })
      .eq('id', id)
      .select(
        'id, title, description, category, status, is_hidden, user_id, created_at, updated_at'
      )
      .single();
    if (error) throw new Error(error.message || 'Could not update visibility.');
    const profiles = await loadProfiles([data.user_id]);
    return mapRow(data, profiles);
  },
};

export default platformSuggestionsService;
