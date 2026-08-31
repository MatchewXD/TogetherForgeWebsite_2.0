/**
 * Terms + Community Guidelines + Payments and refunds acceptance
 * (profiles + user_metadata).
 */
import { supabase } from '../lib/supabase';
import {
  GUIDELINES_VERSION,
  PAYMENTS_POLICY_VERSION,
  TERMS_VERSION,
} from '../constants/legal';

const PAYMENTS_POLICY_LS_KEY = `tf.payments_policy.${PAYMENTS_POLICY_VERSION}`;

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

/**
 * Metadata payload when the user accepts the current Payments and refunds policy.
 */
export function paymentsPolicyAcceptanceMetadata(
  at = new Date().toISOString()
) {
  return {
    payments_policy_version: PAYMENTS_POLICY_VERSION,
    payments_policy_accepted_at: at,
  };
}

/**
 * @param {object|null} profile
 * @param {object|null} user - auth user (metadata fallback)
 */
export function hasAcceptedCurrentPaymentsPolicy(profile, user = null) {
  const meta = user?.user_metadata || user?.raw_user_meta_data || {};
  return (
    String(profile?.payments_policy_version || '') === PAYMENTS_POLICY_VERSION ||
    String(meta.payments_policy_version || '') === PAYMENTS_POLICY_VERSION
  );
}

export function readLocalPaymentsPolicyAcceptance() {
  try {
    return localStorage.getItem(PAYMENTS_POLICY_LS_KEY) === PAYMENTS_POLICY_VERSION;
  } catch {
    return false;
  }
}

export function writeLocalPaymentsPolicyAcceptance() {
  try {
    localStorage.setItem(PAYMENTS_POLICY_LS_KEY, PAYMENTS_POLICY_VERSION);
  } catch {
    /* ignore */
  }
}

/**
 * Load Payments and refunds acceptance for the signed-in user.
 * Separate select so missing payments columns never break Terms gating.
 */
export async function fetchPaymentsPolicyAcceptance(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, payments_policy_version, payments_policy_accepted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    if (/column|schema cache|does not exist/i.test(error.message || '')) {
      return { _columnsMissing: true };
    }
    console.warn('[legal] payments policy fetch', error.message);
    return null;
  }
  return data;
}

/**
 * Persist current Payments and refunds acceptance on the profile.
 * @param {string} userId
 */
export async function acceptPaymentsPolicy(userId) {
  if (!userId) throw new Error('Sign in required.');
  const now = new Date().toISOString();
  const meta = paymentsPolicyAcceptanceMetadata(now);
  const patch = {
    id: userId,
    ...meta,
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(patch, { onConflict: 'id' });

  if (error) {
    if (/column|schema cache|does not exist/i.test(error.message || '')) {
      const err = new Error(
        'Payments policy columns are missing. Run supabase/sql/supabase_payments_policy_acceptance.sql on this project.'
      );
      err.code = 'LEGAL_SQL_MISSING';
      throw err;
    }
    throw error;
  }

  try {
    await supabase.auth.updateUser({
      data: meta,
    });
  } catch {
    /* ignore */
  }

  writeLocalPaymentsPolicyAcceptance();
  return patch;
}
