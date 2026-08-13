/**
 * Terms + Community Guidelines acceptance (profiles + user_metadata).
 */
import { supabase } from '../lib/supabase';
import {
  GUIDELINES_VERSION,
  TERMS_VERSION,
} from '../constants/legal';

/**
 * Metadata payload for signUp / updateUser when the user accepts current versions.
 */
export function legalAcceptanceMetadata(at = new Date().toISOString()) {
  return {
    terms_version: TERMS_VERSION,
    guidelines_version: GUIDELINES_VERSION,
    terms_accepted_at: at,
    guidelines_accepted_at: at,
  };
}

/**
 * @param {object|null} profile
 * @param {object|null} user - auth user (metadata fallback)
 */
export function hasAcceptedCurrentLegal(profile, user = null) {
  const meta = user?.user_metadata || user?.raw_user_meta_data || {};
  const termsOk =
    (profile?.terms_version &&
      String(profile.terms_version) === TERMS_VERSION) ||
    String(meta.terms_version || meta.terms_accepted_version || '') ===
      TERMS_VERSION;
  const guidelinesOk =
    (profile?.guidelines_version &&
      String(profile.guidelines_version) === GUIDELINES_VERSION) ||
    String(
      meta.guidelines_version || meta.guidelines_accepted_version || ''
    ) === GUIDELINES_VERSION;
  return Boolean(termsOk && guidelinesOk);
}

/**
 * Load acceptance fields for the signed-in user.
 */
export async function fetchLegalAcceptance(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, terms_version, terms_accepted_at, guidelines_version, guidelines_accepted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    // Columns may not exist yet on older DBs
    if (/column|schema cache|does not exist/i.test(error.message || '')) {
      return { _columnsMissing: true };
    }
    console.warn('[legal] fetch', error.message);
    return null;
  }
  return data;
}

/**
 * Persist current Terms + Guidelines acceptance on the profile.
 * @param {string} userId
 */
export async function acceptCurrentLegal(userId) {
  if (!userId) throw new Error('Sign in required.');
  const now = new Date().toISOString();
  const meta = legalAcceptanceMetadata(now);
  const patch = {
    id: userId,
    ...meta,
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(patch, { onConflict: 'id' });

  if (error) {
    // Retry without optional columns if migration not applied
    if (/column|schema cache|does not exist/i.test(error.message || '')) {
      const err = new Error(
        'Legal acceptance columns are missing. Run supabase/sql/supabase_legal_acceptance.sql on this project.'
      );
      err.code = 'LEGAL_SQL_MISSING';
      throw err;
    }
    throw error;
  }

  // Mirror into auth metadata (best-effort) for signup paths without profiles row yet
  try {
    await supabase.auth.updateUser({
      data: meta,
    });
  } catch {
    /* ignore */
  }

  return patch;
}
