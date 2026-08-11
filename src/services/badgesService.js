/**
 * Badge grants + pin (Supabase RPCs + profiles.pinned_badge_key).
 */
import { supabase } from '../lib/supabase';
import { BADGE_CATALOG, getBadgeDef } from '../constants/badges';

function mapBadgeRow(row) {
  if (!row) return null;
  const key = row.key || row.badge_key || null;
  if (!key) return null;
  const def = getBadgeDef(key);
  return {
    key,
    grantedAt: row.granted_at || row.grantedAt || null,
    name: def?.name || key,
    description: def?.description || '',
    category: def?.category || 'status',
    icon: def?.icon || 'star',
  };
}

export const badgesService = {
  getCatalog() {
    return BADGE_CATALOG;
  },

  /**
   * @param {string} userId
   * @returns {Promise<{ badges: object[], pinnedBadgeKey: string|null }>}
   */
  async getPublicUserBadges(userId) {
    if (!userId) return { badges: [], pinnedBadgeKey: null };
    try {
      const { data, error } = await supabase.rpc('get_public_user_badges', {
        p_user_id: userId,
      });
      if (error) throw error;
      const payload = data && typeof data === 'object' ? data : {};
      const raw = payload.badges || payload.Badges || [];
      const badges = (Array.isArray(raw) ? raw : [])
        .map(mapBadgeRow)
        .filter(Boolean);
      return {
        badges,
        pinnedBadgeKey:
          payload.pinned_badge_key || payload.pinnedBadgeKey || null,
      };
    } catch (e) {
      console.warn('[badges] getPublicUserBadges', e?.message || e);
      // Fallback: table select if RPC missing
      try {
        const [{ data: rows }, { data: prof }] = await Promise.all([
          supabase
            .from('user_badges')
            .select('badge_key, granted_at')
            .eq('user_id', userId),
          supabase
            .from('profiles')
            .select('pinned_badge_key')
            .eq('id', userId)
            .maybeSingle(),
        ]);
        return {
          badges: (rows || [])
            .map((r) => mapBadgeRow({ key: r.badge_key, granted_at: r.granted_at }))
            .filter(Boolean),
          pinnedBadgeKey: prof?.pinned_badge_key || null,
        };
      } catch (e2) {
        console.warn('[badges] fallback', e2?.message || e2);
        return { badges: [], pinnedBadgeKey: null };
      }
    }
  },

  async syncMyBadges() {
    try {
      const { data, error } = await supabase.rpc('sync_my_badges');
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[badges] syncMyBadges', e?.message || e);
      return null;
    }
  },

  /**
   * @param {string|null} badgeKey
   */
  async setPinnedBadge(badgeKey) {
    const { data, error } = await supabase.rpc('set_my_pinned_badge', {
      p_badge_key: badgeKey || null,
    });
    if (error) throw error;
    if (data && data.ok === false) {
      throw new Error(data.error || 'Could not pin badge');
    }
    return {
      pinnedBadgeKey: data?.pinned_badge_key ?? badgeKey ?? null,
    };
  },

  /**
   * Batch pinned keys for feed flair.
   * @param {string[]} userIds
   * @returns {Promise<Record<string, string|null>>}
   */
  async getPinnedBadgesForUserIds(userIds = []) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return {};
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, pinned_badge_key')
        .in('id', ids);
      if (error) throw error;
      const map = {};
      for (const row of data || []) {
        if (row?.id) map[row.id] = row.pinned_badge_key || null;
      }
      return map;
    } catch (e) {
      console.warn('[badges] getPinnedBadgesForUserIds', e?.message || e);
      return {};
    }
  },
};

export default badgesService;
