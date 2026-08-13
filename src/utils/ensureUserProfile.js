/**
 * Ensure a profiles row exists for the signed-in user (legacy SSO / early accounts).
 * Does not invent a username — that is chosen on Account → Profile.
 */

import { supabase } from '../lib/supabase';

/** How often an existing username may be changed. */
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

/** Username chosen on create-account form before session/claim settles */
export const PENDING_USERNAME_KEY = 'tf_pending_username';

/**
 * @param {string} userId
 * @param {{ email?: string|null }} [opts]
 * @returns {Promise<object|null>} profile row or null
 */
export async function ensureUserProfile(userId, opts = {}) {
  if (!userId) return null;

  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (readErr) {
    console.warn('[ensureUserProfile] read', readErr.message);
  }
  if (existing) return existing;

  const seed = {
    id: userId,
    email: opts.email || null,
    username: null,
    bio: null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from('profiles')
    .upsert(seed, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (insErr) {
    console.warn('[ensureUserProfile] upsert', insErr.message);
    // Row may have been created concurrently
    const { data: retry } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return retry || null;
  }

  return inserted || null;
}

/**
 * Username rules for public /u/:username routes.
 * @returns {{ ok: boolean, message?: string, value?: string }}
 */
export function validatePublicUsername(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return {
      ok: false,
      message: 'Choose a username so people can open your profile.',
    };
  }
  if (value.length < 3) {
    return { ok: false, message: 'Username must be at least 3 characters.' };
  }
  if (value.length > 24) {
    return { ok: false, message: 'Username must be 24 characters or fewer.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return {
      ok: false,
      message: 'Use only letters, numbers, and underscores (no spaces).',
    };
  }
  const reserved = new Set([
    'admin',
    'moderator',
    'api',
    'account',
    'dashboard',
    'profile',
    'u',
    'null',
    'undefined',
    'community',
    'anonymous',
    'someone',
    'member',
    'user',
    'guest',
    'volunteer',
  ]);
  if (reserved.has(value.toLowerCase())) {
    return { ok: false, message: 'That username is reserved. Pick another.' };
  }
  return { ok: true, value };
}

/** Escape % and _ so ilike does exact matching for usernames. */
function escapeIlikeExact(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Case-insensitive availability against profiles.username.
 * @param {string} raw
 * @param {string|null} [excludeUserId] - current user may keep their name
 * @returns {Promise<{ ok: boolean, available?: boolean, message?: string, value?: string }>}
 */
export async function checkUsernameAvailability(raw, excludeUserId = null) {
  const check = validatePublicUsername(raw);
  if (!check.ok) {
    return { ok: false, available: false, message: check.message, value: check.value };
  }

  // limit(1) avoids maybeSingle() errors if multiple rows ever match
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', escapeIlikeExact(check.value))
    .limit(1);

  if (error) {
    console.warn('[checkUsernameAvailability]', error.code || '', error.message);
    const denied =
      /permission|rls|policy|42501|PGRST301/i.test(
        `${error.code || ''} ${error.message || ''}`
      );
    return {
      ok: false,
      available: false,
      message: denied
        ? 'Could not check availability (database permissions). Apply supabase_profiles_api_grants.sql on this project.'
        : 'Could not check availability. Try again.',
      value: check.value,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row && excludeUserId && String(row.id) === String(excludeUserId)) {
    return { ok: true, available: true, value: check.value };
  }
  if (row) {
    return {
      ok: false,
      available: false,
      message: 'Username already taken',
      value: check.value,
    };
  }
  return { ok: true, available: true, value: check.value };
}

/**
 * Persist username for the signed-in user (stable id; username is display only).
 * @returns {Promise<{ ok: boolean, message?: string, username?: string }>}
 */
export async function claimUsernameForUser(userId, rawUsername, email = null) {
  if (!userId) return { ok: false, message: 'You must be signed in.' };
  const avail = await checkUsernameAvailability(rawUsername, userId);
  if (!avail.ok || !avail.available) {
    return { ok: false, message: avail.message || 'Username not available' };
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      username: avail.value,
      email: email || null,
    },
    { onConflict: 'id' }
  );

  if (error) {
    if (/unique|duplicate/i.test(error.message || '')) {
      return { ok: false, message: 'Username already taken' };
    }
    return { ok: false, message: error.message || 'Could not save username' };
  }

  try {
    localStorage.removeItem(PENDING_USERNAME_KEY);
  } catch {
    /* ignore */
  }

  return { ok: true, username: avail.value };
}

/**
 * Remember username from the create-account form until the profile row is written
 * (email confirm delay / first session).
 * @param {string} raw
 */
export function stashPendingUsername(raw) {
  try {
    const check = validatePublicUsername(raw);
    if (!check.ok || !check.value) {
      localStorage.removeItem(PENDING_USERNAME_KEY);
      return;
    }
    localStorage.setItem(PENDING_USERNAME_KEY, check.value);
  } catch {
    /* ignore */
  }
}

export function readPendingUsername() {
  try {
    return localStorage.getItem(PENDING_USERNAME_KEY) || '';
  } catch {
    return '';
  }
}

export function clearPendingUsername() {
  try {
    localStorage.removeItem(PENDING_USERNAME_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Preferred username from auth metadata or local create-account stash.
 * @param {object|null|undefined} user - Supabase auth user
 * @returns {string}
 */
export function getPreferredUsernameFromUser(user) {
  if (!user) return readPendingUsername();
  const meta = user.user_metadata || {};
  const fromMeta = String(
    meta.username || meta.preferred_username || meta.user_name || ''
  ).trim();
  if (fromMeta) return fromMeta;
  return readPendingUsername();
}

/**
 * After email/password sign-up (or first login), apply the username they already
 * chose on the create-account form so ChooseUsernameStep is not needed again.
 *
 * @param {object} user - Supabase auth user
 * @param {object|null} [profile] - current profiles row
 * @returns {Promise<object|null>} updated profile or original/null
 */
export async function ensureUsernameFromSignup(user, profile = null) {
  if (!user?.id) return profile;

  const existing = String(profile?.username || '').trim();
  if (existing) {
    clearPendingUsername();
    return profile;
  }

  const preferred = getPreferredUsernameFromUser(user);
  if (!preferred) return profile;

  const claimed = await claimUsernameForUser(
    user.id,
    preferred,
    user.email || null
  );
  if (claimed.ok && claimed.username) {
    return {
      ...(profile || {}),
      id: user.id,
      username: claimed.username,
      email: user.email || profile?.email || null,
    };
  }

  // Taken or error — clear stale stash so user can pick another only if needed
  if (claimed.message && /taken/i.test(claimed.message)) {
    clearPendingUsername();
  }
  return profile;
}

/**
 * @param {string|null|undefined} lastChangedAtIso
 * @param {number} [cooldownDays]
 * @returns {{ locked: boolean, daysLeft: number, nextChangeAt: Date|null, lastChangedAt: Date|null }}
 */
export function getUsernameChangeCooldown(
  lastChangedAtIso,
  cooldownDays = USERNAME_CHANGE_COOLDOWN_DAYS
) {
  if (!lastChangedAtIso) {
    return {
      locked: false,
      daysLeft: 0,
      nextChangeAt: null,
      lastChangedAt: null,
    };
  }
  const last = new Date(lastChangedAtIso);
  if (Number.isNaN(last.getTime())) {
    return {
      locked: false,
      daysLeft: 0,
      nextChangeAt: null,
      lastChangedAt: null,
    };
  }
  const next = new Date(
    last.getTime() + cooldownDays * 24 * 60 * 60 * 1000
  );
  const msLeft = next.getTime() - Date.now();
  if (msLeft <= 0) {
    return {
      locked: false,
      daysLeft: 0,
      nextChangeAt: next,
      lastChangedAt: last,
    };
  }
  const daysLeft = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  return {
    locked: true,
    daysLeft,
    nextChangeAt: next,
    lastChangedAt: last,
  };
}

/**
 * Latest username change for cooldown (from username_history).
 * @param {string} userId
 * @returns {Promise<string|null>} ISO timestamp or null
 */
export async function fetchLastUsernameChangeAt(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('username_history')
      .select('changed_at')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      // Table may not exist yet
      if (!/relation|does not exist|schema cache/i.test(error.message || '')) {
        console.warn('[fetchLastUsernameChangeAt]', error.message);
      }
      return null;
    }
    return data?.changed_at || null;
  } catch {
    return null;
  }
}

/**
 * Record a username change for the 30-day cooldown.
 * @param {string} userId
 * @param {string} oldUsername
 */
export async function recordUsernameChange(userId, oldUsername) {
  if (!userId || !oldUsername) return false;
  try {
    const { error } = await supabase.from('username_history').insert({
      user_id: userId,
      old_username: String(oldUsername).trim(),
    });
    if (error) {
      console.warn('[recordUsernameChange]', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[recordUsernameChange]', e);
    return false;
  }
}
