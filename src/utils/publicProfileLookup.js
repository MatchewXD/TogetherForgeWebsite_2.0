/**
 * Load a public profiles row by username (case-insensitive).
 * Progressive selects so missing optional columns never blank the page.
 */

import { supabase } from '../lib/supabase';

const SELECT_FULL = [
  'id',
  'username',
  'avatar_url',
  'banner_url',
  'banner_position',
  'bio',
  'interests',
  'favorite_games',
  'favorite_game_types',
  'discord',
  'github',
  'youtube',
  'twitch',
  'x_handle',
  'joined_at',
  'show_donation_total',
  'moderation_status',
].join(', ');

const SELECT_MID =
  'id, username, avatar_url, banner_url, bio, interests, favorite_games, favorite_game_types, discord, youtube, twitch, x_handle, joined_at';

const SELECT_MIN =
  'id, username, avatar_url, bio, discord, joined_at';

/**
 * @param {string} rawUsername
 * @returns {Promise<{ data: object|null, error: Error|null, strategy?: string }>}
 */
export async function fetchPublicProfileByUsername(rawUsername) {
  const username = String(rawUsername || '').trim();
  if (!username) {
    return { data: null, error: new Error('Username required') };
  }

  const selects = [SELECT_FULL, SELECT_MID, SELECT_MIN];
  let lastError = null;

  for (const select of selects) {
    // Prefer exact match first (uses unique index), then case-insensitive
    for (const mode of ['eq', 'ilike']) {
      let q = supabase.from('profiles').select(select);
      q = mode === 'eq' ? q.eq('username', username) : q.ilike('username', username);
      const { data, error } = await q.maybeSingle();

      if (!error && data) {
        return { data, error: null, strategy: `${mode}:${select.slice(0, 24)}` };
      }
      if (error) {
        lastError = error;
        // Column missing / schema cache → try next select shape
        if (/column|schema cache|could not find/i.test(error.message || '')) {
          break;
        }
        // Multiple rows should not happen with unique username
        if (/multiple/i.test(error.message || '')) {
          const list = await supabase
            .from('profiles')
            .select(select)
            .ilike('username', username)
            .limit(1);
          if (list.data?.[0]) {
            return {
              data: list.data[0],
              error: null,
              strategy: 'ilike-limit1',
            };
          }
        }
      }
    }
  }

  return { data: null, error: lastError };
}

/**
 * Load the signed-in user's profile shell (for not-found diagnostics).
 * @param {string} userId
 */
export async function fetchOwnProfileShell(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}
