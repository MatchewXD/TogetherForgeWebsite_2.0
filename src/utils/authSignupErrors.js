/**
 * Map email/password sign-up Auth errors so they are not confused with
 * username availability (profiles.username vs auth.users.email).
 */

export const EXISTING_EMAIL_SIGNUP_BANNER = 'This email is already registered.';

export const EXISTING_EMAIL_SIGNUP_MESSAGE =
  'This email is already registered. Sign in, or use Forgot password. If you just created an account, check your inbox for the confirmation link.';

const GENERIC_SIGNUP_MESSAGE = 'Could not create the account. Please try again.';

/**
 * @param {unknown} err
 * @returns {{ field: 'email' | 'password' | 'form', message: string }}
 */
export function humanizeSignupError(err) {
  const code = String(err?.code || err?.error_code || err?.error || '').toLowerCase();
  const raw = String(
    err?.error_description ||
      err?.message ||
      (typeof err === 'string' ? err : '') ||
      ''
  );
  const combined = `${code} ${raw}`.toLowerCase();

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    /user already registered|already been registered|email.*already.*(exist|register|taken)|user already exists/.test(
      combined
    )
  ) {
    return { field: 'email', message: EXISTING_EMAIL_SIGNUP_MESSAGE };
  }

  if (
    /password should be|password is too|weak password|password.*characters/.test(
      combined
    )
  ) {
    return {
      field: 'password',
      message: raw || 'Choose a stronger password.',
    };
  }

  if (/rate.?limit|too many|over_request|429/.test(combined)) {
    return {
      field: 'form',
      message: 'Too many attempts. Please wait a moment and try again.',
    };
  }

  if (/signup.?disabled|signups not allowed|signups disabled/.test(combined)) {
    return {
      field: 'form',
      message: 'New account creation is temporarily disabled.',
    };
  }

  return {
    field: 'form',
    message: raw.trim() || GENERIC_SIGNUP_MESSAGE,
  };
}

/**
 * Some Supabase configs return a user with an empty identities list instead of
 * "User already registered" when the email is already in auth.users.
 *
 * @param {{ user?: { identities?: unknown[] }|null, session?: unknown }|null|undefined} data
 * @returns {boolean}
 */
export function isDuplicateEmailSignupResult(data) {
  const user = data?.user;
  if (!user || data?.session) return false;
  if (!Array.isArray(user.identities)) return false;
  return user.identities.length === 0;
}
