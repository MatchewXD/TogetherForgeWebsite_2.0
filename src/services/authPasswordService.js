/**
 * Password change + reset flows on Supabase Auth.
 * Tokens, hashing, and reset rate limits are enforced by Supabase Auth.
 */

import { supabase } from '../lib/supabase';
import { validatePasswordStrength } from '../utils/passwordRules';
import { AUTH_FROM_HINT } from '../constants/authEmail';
import { emailChangeRedirectUrl, passwordResetRedirectUrl } from '../utils/authIdentities';

/**
 * Whether the user has a verified TOTP factor (2FA enrolled).
 */
export async function getVerifiedTotpFactor() {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.warn('[authPassword] listFactors', error.message);
      return null;
    }
    const totp = (data?.totp || []).find((f) => f.status === 'verified');
    return totp || null;
  } catch (e) {
    console.warn('[authPassword] mfa unavailable', e);
    return null;
  }
}

/**
 * Verify a TOTP code for the current user (when 2FA is enrolled).
 * @param {string} factorId
 * @param {string} code
 */
export async function verifyTotpCode(factorId, code) {
  const cleaned = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) {
    const err = new Error('Enter the 6-digit code from your authenticator app.');
    err.code = 'MFA_CODE_INVALID';
    throw err;
  }
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (chErr) {
    const err = new Error(chErr.message || 'Could not start 2FA challenge.');
    err.code = 'MFA_CHALLENGE';
    throw err;
  }
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: cleaned,
  });
  if (vErr) {
    const err = new Error(vErr.message || 'Invalid 2FA code.');
    err.code = 'MFA_VERIFY';
    throw err;
  }
}

/**
 * Change password while signed in.
 * Verifies current password, optional 2FA, then updates password.
 *
 * @param {{
 *   email: string,
 *   currentPassword: string,
 *   newPassword: string,
 *   confirmPassword: string,
 *   mfaCode?: string,
 *   signOutOtherSessions?: boolean,
 * }} opts
 */
export async function changePasswordWhileLoggedIn(opts) {
  const email = String(opts.email || '').trim();
  const currentPassword = String(opts.currentPassword || '');
  const newPassword = String(opts.newPassword || '');
  const confirmPassword = String(opts.confirmPassword || '');
  const mfaCode = opts.mfaCode;
  const signOutOtherSessions = opts.signOutOtherSessions !== false;

  if (!email) {
    const err = new Error('No email on this account.');
    err.code = 'NO_EMAIL';
    throw err;
  }
  if (!currentPassword) {
    const err = new Error('Enter your current password.');
    err.code = 'CURRENT_REQUIRED';
    throw err;
  }
  if (newPassword !== confirmPassword) {
    const err = new Error('New password and confirmation do not match.');
    err.code = 'MISMATCH';
    throw err;
  }
  if (currentPassword === newPassword) {
    const err = new Error('New password must be different from your current password.');
    err.code = 'SAME_PASSWORD';
    throw err;
  }

  const strength = validatePasswordStrength(newPassword, { email });
  if (!strength.ok) {
    const err = new Error(strength.message);
    err.code = strength.code || 'WEAK';
    throw err;
  }

  // Re-auth with current password (also refreshes session)
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthErr) {
    const err = new Error(
      /invalid|credentials|password/i.test(reauthErr.message || '')
        ? 'Current password is incorrect.'
        : reauthErr.message || 'Could not verify current password.'
    );
    err.code = 'CURRENT_INVALID';
    throw err;
  }

  const factor = await getVerifiedTotpFactor();
  if (factor) {
    if (!String(mfaCode || '').trim()) {
      const err = new Error(
        'Two-factor authentication is enabled. Enter your 6-digit authenticator code.'
      );
      err.code = 'MFA_REQUIRED';
      err.factorId = factor.id;
      throw err;
    }
    await verifyTotpCode(factor.id, mfaCode);
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateErr) {
    const err = new Error(updateErr.message || 'Could not update password.');
    err.code = 'UPDATE_FAILED';
    throw err;
  }

  // Prefer signing out other devices; keep this session
  if (signOutOtherSessions) {
    try {
      await supabase.auth.signOut({ scope: 'others' });
    } catch (e) {
      console.warn('[authPassword] signOut others failed', e);
    }
  }

  // Supabase Auth can email "Password changed" when security notifications
  // are enabled in the project. No extra client call required.
  return {
    ok: true,
    mfaUsed: Boolean(factor),
    signedOutOthers: signOutOtherSessions,
  };
}

/**
 * Request a password-reset email. Always succeeds from the caller's perspective
 * when the request is accepted (do not reveal whether the email exists).
 * @param {string} email
 * @param {{ redirectTo?: string }} [opts]
 */
export async function requestPasswordReset(email, opts = {}) {
  const cleaned = String(email || '').trim().toLowerCase();
  if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    const err = new Error('Enter a valid email address.');
    err.code = 'EMAIL_INVALID';
    throw err;
  }

  const redirectTo = opts.redirectTo || passwordResetRedirectUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(cleaned, {
    redirectTo,
  });

  // Rate limit / network errors: surface them. "User not found" style: treat as success.
  if (error) {
    const msg = error.message || '';
    if (/rate|limit|too many/i.test(msg)) {
      const err = new Error(
        'Too many reset requests. Wait a few minutes and try again.'
      );
      err.code = 'RATE_LIMIT';
      throw err;
    }
    // Avoid account enumeration for other soft failures
    console.warn('[authPassword] resetPasswordForEmail', msg);
  }

  return {
    ok: true,
    message:
      `If an account exists for that email, we sent a password reset link. Look for mail from ${AUTH_FROM_HINT}.`,
  };
}

/**
 * Set a new password after the user opens a recovery link (session already established).
 * @param {{ newPassword: string, confirmPassword: string, email?: string }} opts
 */
export async function completePasswordReset(opts) {
  const newPassword = String(opts.newPassword || '');
  const confirmPassword = String(opts.confirmPassword || '');

  if (newPassword !== confirmPassword) {
    const err = new Error('Password and confirmation do not match.');
    err.code = 'MISMATCH';
    throw err;
  }

  const strength = validatePasswordStrength(newPassword, {
    email: opts.email,
  });
  if (!strength.ok) {
    const err = new Error(strength.message);
    err.code = strength.code || 'WEAK';
    throw err;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    const err = new Error(
      'This reset link is invalid or has expired. Request a new one from the sign-in page.'
    );
    err.code = 'NO_SESSION';
    throw err;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    const err = new Error(error.message || 'Could not set a new password.');
    err.code = 'UPDATE_FAILED';
    throw err;
  }

  // End recovery session; user signs in with the new password
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch {
    await supabase.auth.signOut();
  }

  return { ok: true };
}

/**
 * Start an email change. Supabase sends the dashboard “Change email address”
 * template. The address does not switch until the user opens that link.
 * @param {string} newEmail
 */
export async function requestEmailChange(newEmail) {
  const cleaned = String(newEmail || '').trim().toLowerCase();
  if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    const err = new Error('Enter a valid email address.');
    err.code = 'EMAIL_INVALID';
    throw err;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const current = String(session?.user?.email || '').trim().toLowerCase();
  if (current && current === cleaned) {
    const err = new Error('That is already the email on this account.');
    err.code = 'SAME_EMAIL';
    throw err;
  }

  const { error } = await supabase.auth.updateUser(
    { email: cleaned },
    { emailRedirectTo: emailChangeRedirectUrl() }
  );
  if (error) {
    const msg = error.message || '';
    if (/rate|limit|too many/i.test(msg)) {
      const err = new Error(
        'Too many attempts. Wait a few minutes and try again.'
      );
      err.code = 'RATE_LIMIT';
      throw err;
    }
    const err = new Error(msg || 'Could not start the email change.');
    err.code = 'UPDATE_FAILED';
    throw err;
  }

  return {
    ok: true,
    message: `We sent a confirmation link to ${cleaned}. Look for mail from ${AUTH_FROM_HINT}.`,
  };
}
